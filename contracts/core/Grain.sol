// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title Grain
 * @notice USDC-backed, auto-revaluing stablecoin for B2B settlements
 *
 * Unlike traditional stablecoins (fixed 1:1 peg), GRAIN price automatically
 * adjusts based on total Net Asset Value (NAV) of the Vault.
 *
 * Price Formula: GRAIN_PRICE = TOTAL_NAV / TOTAL_SUPPLY
 *
 * As Vault assets appreciate (treasury yield, asset appreciation, mortgage interest),
 * GRAIN price increases automatically. This creates network effects:
 * - More assets in Vault → Higher GRAIN price
 * - Higher GRAIN price → More demand for GRAIN
 * - More demand → More transactions → More fees → More assets
 *
 * Security Features:
 * - Circuit breaker (freeze price if anomaly detected)
 * - Multi-sig minting/burning
 * - Emergency pause mechanism
 * - 7-day audit process for major NAV changes
 */
contract Grain is ERC20, AccessControl, ReentrancyGuard, Pausable {
    // ============================================
    // ROLES
    // ============================================

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // ============================================
    // STATE VARIABLES
    // ============================================

    // Current GRAIN price in USD (18 decimals)
    // Example: 1.0417e18 = $1.0417 per GRAIN
    uint256 public grainPrice;

    // Total Net Asset Value backing GRAIN (18 decimals)
    // Sum of all Vault assets minus liabilities
    uint256 public totalNAV;

    // Circuit breaker state
    bool public circuitBreakerTriggered;
    uint256 public frozenPrice;
    uint256 public auditDeadline;

    // Revaluation tracking
    uint256 public lastRevaluationTime;
    uint256 public revaluationCount;

    // Minimum collateralization ratio (basis points)
    // 10000 = 100%, 11000 = 110%
    uint256 public minCollateralRatio = 11000; // 110%

    // ============================================
    // EVENTS
    // ============================================

    event GrainMinted(address indexed to, uint256 amount, uint256 price);
    event GrainBurned(address indexed from, uint256 amount, uint256 price);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice, uint256 totalNAV, uint256 totalSupply);
    event CircuitBreakerTriggered(string reason, uint256 frozenPrice, uint256 auditDeadline);
    event CircuitBreakerReset(uint256 newPrice);
    event NAVUpdated(uint256 oldNAV, uint256 newNAV);

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address admin,
        address vault,
        uint256 initialPrice
    ) ERC20("Grain", "GRAIN") {
        require(admin != address(0), "Invalid admin");
        require(vault != address(0), "Invalid vault");
        require(initialPrice > 0, "Invalid price");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, vault);
        _grantRole(BURNER_ROLE, vault);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(ORACLE_ROLE, vault);

        grainPrice = initialPrice; // Start at $1.00 (1e18)
        lastRevaluationTime = block.timestamp;
    }

    // ============================================
    // MINTING & BURNING (Vault Only)
    // ============================================

    /**
     * @notice Mint new GRAIN tokens
     * @dev Only callable by Vault when:
     *      1. New assets deposited
     *      2. Escrow funded
     *      3. Mortgage issued
     *
     * @param to Recipient address
     * @param amount Amount of GRAIN to mint
     */
    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(!circuitBreakerTriggered, "Circuit breaker active");

        // Check collateralization ratio BEFORE minting
        uint256 newSupply = totalSupply() + amount;
        uint256 requiredNAV = (newSupply * grainPrice * minCollateralRatio) / 10000 / 1e18;
        require(totalNAV >= requiredNAV, "Insufficient collateral");

        _mint(to, amount);

        emit GrainMinted(to, amount, grainPrice);
    }

    /**
     * @notice Burn GRAIN tokens
     * @dev Only callable by Vault when:
     *      1. User redeems GRAIN for USDC
     *      2. Escrow released
     *      3. Mortgage paid off
     *
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount)
        external
        onlyRole(BURNER_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(from != address(0), "Invalid address");
        require(amount > 0, "Invalid amount");
        require(balanceOf(from) >= amount, "Insufficient balance");

        _burn(from, amount);

        emit GrainBurned(from, amount, grainPrice);
    }

    // ============================================
    // PRICE REVALUATION (Oracle Only)
    // ============================================

    /**
     * @notice Update GRAIN price based on current NAV
     * @dev Called daily by Vault oracle after calculating total NAV
     *
     * Formula: newPrice = totalNAV / totalSupply
     *
     * Circuit breakers trigger if:
     * 1. Price drops > 5%
     * 2. NAV declines > 10%
     * 3. Collateralization < 100%
     *
     * @param newNAV Total Net Asset Value in USD (18 decimals)
     */
    function updateNAV(uint256 newNAV)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        require(newNAV > 0, "Invalid NAV");
        require(!circuitBreakerTriggered, "Circuit breaker active");

        uint256 oldNAV = totalNAV;
        totalNAV = newNAV;

        // Calculate new GRAIN price
        uint256 supply = totalSupply();
        if (supply == 0) {
            // No GRAIN issued yet, keep initial price
            emit NAVUpdated(oldNAV, newNAV);
            return;
        }

        uint256 newPrice = (newNAV * 1e18) / supply;
        uint256 oldPrice = grainPrice;

        // CIRCUIT BREAKER #1: Price drop > 5%
        if (newPrice < oldPrice) {
            uint256 priceDrop = ((oldPrice - newPrice) * 10000) / oldPrice; // basis points
            if (priceDrop > 500) { // 5%
                _triggerCircuitBreaker("Price drop >5%", oldPrice);
                return;
            }
        }

        // CIRCUIT BREAKER #2: NAV decline > 10%
        if (newNAV < oldNAV) {
            uint256 navDrop = ((oldNAV - newNAV) * 10000) / oldNAV;
            if (navDrop > 1000) { // 10%
                _triggerCircuitBreaker("NAV decline >10%", oldPrice);
                return;
            }
        }

        // CIRCUIT BREAKER #3: Undercollateralized
        uint256 collateralRatio = (newNAV * 10000) / (supply * newPrice / 1e18);
        if (collateralRatio < 10000) { // Less than 100%
            _triggerCircuitBreaker("Undercollateralized", oldPrice);
            return;
        }

        // All checks passed, update price
        grainPrice = newPrice;
        lastRevaluationTime = block.timestamp;
        revaluationCount++;

        emit PriceUpdated(oldPrice, newPrice, newNAV, supply);
        emit NAVUpdated(oldNAV, newNAV);
    }

    /**
     * @notice Trigger circuit breaker and freeze price
     * @dev Initiates 7-day audit process
     */
    function _triggerCircuitBreaker(string memory reason, uint256 _frozenPrice) internal {
        circuitBreakerTriggered = true;
        frozenPrice = _frozenPrice;
        auditDeadline = block.timestamp + 7 days;

        _pause(); // Pause all minting/burning

        emit CircuitBreakerTriggered(reason, frozenPrice, auditDeadline);
    }

    /**
     * @notice Reset circuit breaker after audit
     * @dev Only callable by admin after 7-day audit complete
     *
     * @param newPrice Audited GRAIN price
     * @param newNAV Audited total NAV
     */
    function resetCircuitBreaker(uint256 newPrice, uint256 newNAV)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(circuitBreakerTriggered, "Not triggered");
        require(block.timestamp >= auditDeadline, "Audit not complete");
        require(newPrice > 0 && newNAV > 0, "Invalid values");

        // Verify new values are reasonable (within 20% of frozen values)
        uint256 supply = totalSupply();
        if (supply > 0) {
            uint256 expectedPrice = (newNAV * 1e18) / supply;
            uint256 priceDiff = newPrice > expectedPrice
                ? ((newPrice - expectedPrice) * 10000) / expectedPrice
                : ((expectedPrice - newPrice) * 10000) / expectedPrice;
            require(priceDiff <= 2000, "Price deviation >20%");
        }

        grainPrice = newPrice;
        totalNAV = newNAV;
        circuitBreakerTriggered = false;
        frozenPrice = 0;
        auditDeadline = 0;

        _unpause(); // Resume minting/burning

        emit CircuitBreakerReset(newPrice);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Emergency pause (stops all transfers, minting, burning)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Update minimum collateralization ratio
     * @param newRatio New ratio in basis points (10000 = 100%)
     */
    function setMinCollateralRatio(uint256 newRatio)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newRatio >= 10000 && newRatio <= 15000, "Invalid ratio");
        minCollateralRatio = newRatio;
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get current collateralization ratio
     * @return Ratio in basis points (10000 = 100%)
     */
    function getCollateralRatio() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return type(uint256).max;

        uint256 totalValue = supply * grainPrice / 1e18;
        return (totalNAV * 10000) / totalValue;
    }

    /**
     * @notice Get GRAIN price in USD
     * @return Price with 18 decimals (1e18 = $1.00)
     */
    function getPrice() external view returns (uint256) {
        return circuitBreakerTriggered ? frozenPrice : grainPrice;
    }

    /**
     * @notice Check if circuit breaker is active
     */
    function isCircuitBreakerActive() external view returns (bool) {
        return circuitBreakerTriggered;
    }

    /**
     * @notice Get time until audit deadline
     * @return Seconds remaining (0 if not triggered)
     */
    function getAuditTimeRemaining() external view returns (uint256) {
        if (!circuitBreakerTriggered) return 0;
        if (block.timestamp >= auditDeadline) return 0;
        return auditDeadline - block.timestamp;
    }

    // ============================================
    // OVERRIDE REQUIRED BY PAUSABLE
    // ============================================

    /**
     * @dev Hook override for ERC20 _update (replaces _beforeTokenTransfer in v5)
     * @notice Ensures all token transfers respect the pause state
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._update(from, to, amount);
    }
}
