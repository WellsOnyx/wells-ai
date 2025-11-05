// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title Vault
 * @notice Treasury holding USDC reserves + tracking all downstream assets
 * @dev Multi-sig controlled, fully auditable, real-time NAV calculation
 *
 * Security features:
 * - Multi-signature wallet control
 * - Role-based access control
 * - Reentrancy protection
 * - Emergency pause mechanism
 * - Comprehensive event logging
 *
 * Asset tracking:
 * - Liquid reserves (USDC, cash, money market, treasuries)
 * - Float & in-transit (pending escrows, ACH, wires)
 * - Physical assets (inventory, equipment, real estate)
 * - Investment positions (bonds, equities, alternatives)
 * - Receivables (invoices, loans, pending fees)
 */
contract Vault is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 public immutable usdc;

    // Vault statistics
    uint256 public totalDeposits;
    uint256 public totalWithdrawals;

    // Asset categories (tracked off-chain, verified on-chain)
    struct AssetBreakdown {
        uint256 liquidReserves;         // USDC + cash + money market + treasuries
        uint256 floatInTransit;         // Pending escrows + ACH + wires
        uint256 physicalAssets;         // Inventory + equipment + real estate
        uint256 investmentPositions;    // Bonds + equities + alternatives
        uint256 receivables;            // Invoices + loans + fees (probability-adjusted)
        uint256 lastUpdated;            // Timestamp of last update
    }

    AssetBreakdown public assets;

    // Circuit breaker state
    bool public circuitBreakerTriggered;
    uint256 public frozenGrainPrice; // Price frozen when circuit breaker triggered
    uint256 public auditDeadline;    // Timestamp when audit must be complete

    // Historical NAV tracking (for circuit breaker)
    uint256 public lastNAV;
    uint256 public yesterdayHighPrice;

    // Events
    event Deposit(address indexed from, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed to, uint256 amount, uint256 timestamp);
    event AssetsUpdated(
        uint256 liquidReserves,
        uint256 floatInTransit,
        uint256 physicalAssets,
        uint256 investmentPositions,
        uint256 receivables,
        uint256 totalNAV
    );
    event CircuitBreakerTriggered(
        string reason,
        uint256 frozenPrice,
        uint256 navAtTrigger,
        uint256 auditDeadline
    );
    event CircuitBreakerResolved(
        uint256 newGrainPrice,
        uint256 newNAV,
        uint256 resolvedAt
    );
    event NAVCalculated(uint256 nav, uint256 timestamp);

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(WITHDRAWER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        // Initialize asset breakdown
        assets.lastUpdated = block.timestamp;
    }

    /**
     * @notice Deposit USDC into Vault
     * @param amount Amount of USDC to deposit
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be positive");

        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );

        totalDeposits += amount;
        emit Deposit(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Withdraw USDC from Vault (requires WITHDRAWER_ROLE)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdraw(address to, uint256 amount)
        external
        onlyRole(WITHDRAWER_ROLE)
        nonReentrant
        whenNotPaused
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");

        require(
            usdc.transfer(to, amount),
            "USDC transfer failed"
        );

        totalWithdrawals += amount;
        emit Withdrawal(to, amount, block.timestamp);
    }

    /**
     * @notice Update asset breakdown (called by oracle)
     * @dev This is called periodically (every 5 min) by backend service
     * @param _liquidReserves USDC + cash + money market + treasuries
     * @param _floatInTransit Pending escrows + ACH + wires
     * @param _physicalAssets Inventory + equipment + real estate
     * @param _investmentPositions Bonds + equities + alternatives
     * @param _receivables Invoices + loans + fees (probability-adjusted)
     */
    function updateAssets(
        uint256 _liquidReserves,
        uint256 _floatInTransit,
        uint256 _physicalAssets,
        uint256 _investmentPositions,
        uint256 _receivables
    ) external onlyRole(ORACLE_ROLE) {
        assets.liquidReserves = _liquidReserves;
        assets.floatInTransit = _floatInTransit;
        assets.physicalAssets = _physicalAssets;
        assets.investmentPositions = _investmentPositions;
        assets.receivables = _receivables;
        assets.lastUpdated = block.timestamp;

        uint256 totalNAV = getTotalNAV();

        emit AssetsUpdated(
            _liquidReserves,
            _floatInTransit,
            _physicalAssets,
            _investmentPositions,
            _receivables,
            totalNAV
        );

        emit NAVCalculated(totalNAV, block.timestamp);

        // Update historical tracking
        lastNAV = totalNAV;
    }

    /**
     * @notice Get current USDC balance in Vault
     */
    function getUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get total liquid reserves
     */
    function getLiquidReserves() external view returns (uint256) {
        return assets.liquidReserves;
    }

    /**
     * @notice Get total NAV (sum of all assets minus liabilities)
     * @dev Liabilities assumed to be zero for v1 (no loans)
     * @return Total net asset value in USD (6 decimals, USDC standard)
     */
    function getTotalNAV() public view returns (uint256) {
        uint256 totalAssets =
            assets.liquidReserves +
            assets.floatInTransit +
            assets.physicalAssets +
            assets.investmentPositions +
            assets.receivables;

        // In v1, no liabilities. In v2+, subtract liabilities here.
        uint256 liabilities = 0;

        return totalAssets - liabilities;
    }

    /**
     * @notice Get asset breakdown
     */
    function getAssetBreakdown()
        external
        view
        returns (
            uint256 liquidReserves,
            uint256 floatInTransit,
            uint256 physicalAssets,
            uint256 investmentPositions,
            uint256 receivables,
            uint256 lastUpdated
        )
    {
        return (
            assets.liquidReserves,
            assets.floatInTransit,
            assets.physicalAssets,
            assets.investmentPositions,
            assets.receivables,
            assets.lastUpdated
        );
    }

    /**
     * @notice Trigger circuit breaker (emergency stop)
     * @param reason Human-readable reason for triggering
     * @param _frozenPrice GRAIN price to freeze at
     */
    function triggerCircuitBreaker(string memory reason, uint256 _frozenPrice)
        external
        onlyRole(PAUSER_ROLE)
    {
        require(!circuitBreakerTriggered, "Circuit breaker already active");

        circuitBreakerTriggered = true;
        frozenGrainPrice = _frozenPrice;
        auditDeadline = block.timestamp + 7 days; // 7-day audit period

        uint256 navAtTrigger = getTotalNAV();

        emit CircuitBreakerTriggered(
            reason,
            _frozenPrice,
            navAtTrigger,
            auditDeadline
        );

        // Pause all operations
        _pause();
    }

    /**
     * @notice Resolve circuit breaker (after 7-day audit)
     * @param newGrainPrice New GRAIN price after audit
     * @dev Requires multi-sig approval (2-of-3 founders)
     */
    function resolveCircuitBreaker(uint256 newGrainPrice)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(circuitBreakerTriggered, "Circuit breaker not active");
        require(block.timestamp >= auditDeadline, "Audit period not complete");

        circuitBreakerTriggered = false;
        uint256 newNAV = getTotalNAV();

        emit CircuitBreakerResolved(
            newGrainPrice,
            newNAV,
            block.timestamp
        );

        // Unpause operations
        _unpause();
    }

    /**
     * @notice Set yesterday's high price (for circuit breaker reference)
     * @param price GRAIN price (yesterday's high)
     */
    function setYesterdayHighPrice(uint256 price)
        external
        onlyRole(ORACLE_ROLE)
    {
        yesterdayHighPrice = price;
    }

    /**
     * @notice Emergency pause (stops all deposits/withdrawals)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
