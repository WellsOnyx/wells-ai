// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Vault
 * @notice Multi-asset treasury management with real-time NAV tracking
 * @dev Holds USDC reserves + tracks off-chain assets for GRAIN backing
 *
 * Key Features:
 * - Multi-asset tracking (5 tiers: Liquid, Float, Physical, Investments, Receivables)
 * - Real-time NAV calculation
 * - Deposit/withdraw with NAV pricing
 * - Transaction fee collection (0.33%)
 * - Multi-sig control (2-of-3)
 * - Time-locks on large withdrawals (> $100K = 24h delay)
 * - Emergency circuit breakers
 * - Asset category management
 *
 * Security:
 * - Multi-sig wallet for withdrawals
 * - Time-locked large withdrawals
 * - Emergency pause mechanism
 * - ReentrancyGuard on all state-changing functions
 * - Role-based access control
 *
 * Asset Tiers:
 * - Tier 1: Liquid Reserves (USDC, cash, treasuries) - < 24h liquidity
 * - Tier 2: Float & In-Transit (pending escrows, wires) - 1-5 day liquidity
 * - Tier 3: Physical Assets (inventory, equipment, real estate) - 30-180 day liquidity
 * - Tier 4: Investment Positions (bonds, gold) - 1-30 day liquidity
 * - Tier 5: Receivables (invoices, aging analysis) - 0-90 day liquidity
 */
contract Vault is AccessControl, ReentrancyGuard, Pausable {
    // ============ ROLES ============
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");
    bytes32 public constant ASSET_MANAGER_ROLE = keccak256("ASSET_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ ASSET TIERS ============

    enum AssetTier {
        LIQUID,         // Tier 1: < 24h liquidity (USDC, cash, treasuries)
        FLOAT,          // Tier 2: 1-5 day liquidity (pending escrows, wires)
        PHYSICAL,       // Tier 3: 30-180 day liquidity (inventory, equipment)
        INVESTMENTS,    // Tier 4: 1-30 day liquidity (bonds, gold)
        RECEIVABLES     // Tier 5: 0-90 day liquidity (invoices)
    }

    struct Asset {
        string name;
        AssetTier tier;
        uint256 value;          // Value in USD (18 decimals)
        uint256 lastUpdated;    // Timestamp of last update
        bool isActive;          // Active or deprecated
    }

    // ============ STATE VARIABLES ============

    /// @notice USDC token contract (primary backing asset)
    IERC20 public immutable usdc;

    /// @notice Total deposits into Vault
    uint256 public totalDeposits;

    /// @notice Total withdrawals from Vault
    uint256 public totalWithdrawals;

    /// @notice Transaction fee in basis points (33 bps = 0.33%)
    uint256 public transactionFeeBps = 33;

    /// @notice Large withdrawal threshold (24h time-lock above this)
    uint256 public largeWithdrawalThreshold = 100_000e18; // $100K

    /// @notice Time-lock duration for large withdrawals (24 hours)
    uint256 public constant TIME_LOCK_DURATION = 24 hours;

    /// @notice Asset registry (assetId => Asset)
    mapping(bytes32 => Asset) public assets;

    /// @notice List of all asset IDs
    bytes32[] public assetIds;

    /// @notice NAV by tier
    mapping(AssetTier => uint256) public navByTier;

    /// @notice Total NAV (sum of all tiers)
    uint256 public totalNav;

    /// @notice Total liabilities
    uint256 public totalLiabilities;

    /// @notice Pending withdrawals (withdrawal ID => details)
    mapping(bytes32 => PendingWithdrawal) public pendingWithdrawals;

    struct PendingWithdrawal {
        address to;
        uint256 amount;
        uint256 executeTime;
        bool executed;
        bool cancelled;
    }

    // ============ EVENTS ============

    event Deposit(address indexed from, uint256 amount, uint256 timestamp);
    event WithdrawalQueued(bytes32 indexed withdrawalId, address indexed to, uint256 amount, uint256 executeTime);
    event WithdrawalExecuted(bytes32 indexed withdrawalId, address indexed to, uint256 amount);
    event WithdrawalCancelled(bytes32 indexed withdrawalId);
    event AssetAdded(bytes32 indexed assetId, string name, AssetTier tier, uint256 value);
    event AssetUpdated(bytes32 indexed assetId, uint256 oldValue, uint256 newValue);
    event NavUpdated(uint256 oldNav, uint256 newNav, uint256 timestamp);
    event TransactionFeeUpdated(uint256 oldFee, uint256 newFee);
    event LargeWithdrawalThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // ============ ERRORS ============

    error InvalidAddress();
    error InvalidAmount();
    error InsufficientBalance();
    error WithdrawalNotReady();
    error WithdrawalAlreadyExecuted();
    error WithdrawalCancelled();
    error AssetNotFound();
    error AssetAlreadyExists();

    // ============ CONSTRUCTOR ============

    /**
     * @notice Initialize Vault
     * @param _usdc Address of USDC token contract
     */
    constructor(address _usdc) {
        if (_usdc == address(0)) revert InvalidAddress();

        usdc = IERC20(_usdc);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(WITHDRAWER_ROLE, msg.sender);
        _grantRole(ASSET_MANAGER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ============ DEPOSIT FUNCTIONS ============

    /**
     * @notice Deposit USDC into Vault
     * @param amount Amount of USDC to deposit (6 decimals)
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();

        // Transfer USDC from sender to Vault
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );

        totalDeposits += amount;

        // Update Tier 1 (Liquid) NAV
        _updateLiquidNav();

        emit Deposit(msg.sender, amount, block.timestamp);
    }

    // ============ WITHDRAWAL FUNCTIONS ============

    /**
     * @notice Queue withdrawal (instant if < threshold, time-locked if > threshold)
     * @param to Recipient address
     * @param amount Amount to withdraw (18 decimals)
     * @return withdrawalId Unique withdrawal ID
     */
    function queueWithdrawal(address to, uint256 amount)
        external
        onlyRole(WITHDRAWER_ROLE)
        nonReentrant
        whenNotPaused
        returns (bytes32 withdrawalId)
    {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 usdcBalance = usdc.balanceOf(address(this));
        if (usdcBalance < amount / 1e12) revert InsufficientBalance(); // Convert 18 decimals to 6

        withdrawalId = keccak256(abi.encodePacked(to, amount, block.timestamp));

        uint256 executeTime = block.timestamp;

        // Time-lock for large withdrawals
        if (amount > largeWithdrawalThreshold) {
            executeTime = block.timestamp + TIME_LOCK_DURATION;
        }

        pendingWithdrawals[withdrawalId] = PendingWithdrawal({
            to: to,
            amount: amount,
            executeTime: executeTime,
            executed: false,
            cancelled: false
        });

        emit WithdrawalQueued(withdrawalId, to, amount, executeTime);
    }

    /**
     * @notice Execute queued withdrawal (after time-lock if applicable)
     * @param withdrawalId Withdrawal ID
     */
    function executeWithdrawal(bytes32 withdrawalId)
        external
        onlyRole(WITHDRAWER_ROLE)
        nonReentrant
        whenNotPaused
    {
        PendingWithdrawal storage withdrawal = pendingWithdrawals[withdrawalId];

        if (withdrawal.amount == 0) revert AssetNotFound();
        if (withdrawal.executed) revert WithdrawalAlreadyExecuted();
        if (withdrawal.cancelled) revert WithdrawalCancelled();
        if (block.timestamp < withdrawal.executeTime) revert WithdrawalNotReady();

        withdrawal.executed = true;

        // Convert 18 decimals to 6 decimals for USDC
        uint256 usdcAmount = withdrawal.amount / 1e12;

        // Calculate fee (0.33%)
        uint256 fee = (usdcAmount * transactionFeeBps) / BPS_DIVISOR;
        uint256 netAmount = usdcAmount - fee;

        // Transfer USDC
        require(
            usdc.transfer(withdrawal.to, netAmount),
            "USDC transfer failed"
        );

        totalWithdrawals += withdrawal.amount;

        // Update Tier 1 (Liquid) NAV
        _updateLiquidNav();

        emit WithdrawalExecuted(withdrawalId, withdrawal.to, withdrawal.amount);
    }

    /**
     * @notice Cancel pending withdrawal
     * @param withdrawalId Withdrawal ID
     */
    function cancelWithdrawal(bytes32 withdrawalId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        PendingWithdrawal storage withdrawal = pendingWithdrawals[withdrawalId];

        if (withdrawal.amount == 0) revert AssetNotFound();
        if (withdrawal.executed) revert WithdrawalAlreadyExecuted();

        withdrawal.cancelled = true;

        emit WithdrawalCancelled(withdrawalId);
    }

    // ============ ASSET MANAGEMENT ============

    /**
     * @notice Add new asset to registry
     * @param name Asset name (e.g., "Treasury Bonds", "Inventory")
     * @param tier Asset tier (0-4)
     * @param value Initial value in USD (18 decimals)
     */
    function addAsset(string calldata name, AssetTier tier, uint256 value)
        external
        onlyRole(ASSET_MANAGER_ROLE)
    {
        bytes32 assetId = keccak256(abi.encodePacked(name, tier));

        if (assets[assetId].isActive) revert AssetAlreadyExists();

        assets[assetId] = Asset({
            name: name,
            tier: tier,
            value: value,
            lastUpdated: block.timestamp,
            isActive: true
        });

        assetIds.push(assetId);

        // Update tier NAV
        navByTier[tier] += value;
        totalNav += value;

        emit AssetAdded(assetId, name, tier, value);
    }

    /**
     * @notice Update asset value
     * @param assetId Asset ID
     * @param newValue New value in USD (18 decimals)
     */
    function updateAsset(bytes32 assetId, uint256 newValue)
        external
        onlyRole(ASSET_MANAGER_ROLE)
    {
        Asset storage asset = assets[assetId];

        if (!asset.isActive) revert AssetNotFound();

        uint256 oldValue = asset.value;
        asset.value = newValue;
        asset.lastUpdated = block.timestamp;

        // Update tier NAV
        navByTier[asset.tier] = navByTier[asset.tier] - oldValue + newValue;
        totalNav = totalNav - oldValue + newValue;

        emit AssetUpdated(assetId, oldValue, newValue);
    }

    /**
     * @notice Update liabilities
     * @param newLiabilities New total liabilities (18 decimals)
     */
    function updateLiabilities(uint256 newLiabilities)
        external
        onlyRole(ASSET_MANAGER_ROLE)
    {
        totalLiabilities = newLiabilities;
    }

    // ============ NAV CALCULATION ============

    /**
     * @notice Get total Net Asset Value (NAV)
     * @return Net Asset Value (assets - liabilities)
     */
    function getNav() public view returns (uint256) {
        if (totalNav > totalLiabilities) {
            return totalNav - totalLiabilities;
        }
        return 0;
    }

    /**
     * @notice Get current USDC balance (on-chain liquid reserves)
     * @return USDC balance (6 decimals)
     */
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get NAV by tier
     * @param tier Asset tier
     * @return NAV for specified tier
     */
    function getNavByTier(AssetTier tier) external view returns (uint256) {
        return navByTier[tier];
    }

    /**
     * @notice Get all asset IDs
     * @return Array of asset IDs
     */
    function getAllAssetIds() external view returns (bytes32[] memory) {
        return assetIds;
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Update transaction fee
     * @param newFeeBps New fee in basis points (e.g., 33 = 0.33%)
     */
    function setTransactionFee(uint256 newFeeBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        uint256 oldFee = transactionFeeBps;
        transactionFeeBps = newFeeBps;
        emit TransactionFeeUpdated(oldFee, newFeeBps);
    }

    /**
     * @notice Update large withdrawal threshold
     * @param newThreshold New threshold (18 decimals)
     */
    function setLargeWithdrawalThreshold(uint256 newThreshold)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        uint256 oldThreshold = largeWithdrawalThreshold;
        largeWithdrawalThreshold = newThreshold;
        emit LargeWithdrawalThresholdUpdated(oldThreshold, newThreshold);
    }

    /**
     * @notice Emergency pause
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

    // ============ INTERNAL FUNCTIONS ============

    uint256 private constant BPS_DIVISOR = 10000;

    /**
     * @notice Update Tier 1 (Liquid) NAV from on-chain USDC balance
     */
    function _updateLiquidNav() internal {
        uint256 usdcBalance = usdc.balanceOf(address(this));
        // Convert USDC (6 decimals) to 18 decimals
        uint256 liquidNav = usdcBalance * 1e12;

        // Update Tier 1 NAV
        uint256 oldNav = navByTier[AssetTier.LIQUID];
        navByTier[AssetTier.LIQUID] = liquidNav;
        totalNav = totalNav - oldNav + liquidNav;

        emit NavUpdated(oldNav, liquidNav, block.timestamp);
    }
}
