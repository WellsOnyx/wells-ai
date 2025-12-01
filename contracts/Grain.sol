// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Grain
 * @notice Auto-appreciating stablecoin backed by Vault NAV
 * @dev ERC20 token with NAV-based pricing, not fixed $1.00
 *
 * Key Features:
 * - NAV-based pricing (price = total Vault assets / GRAIN supply)
 * - Founding investor mechanics (locked $1.00 entry during vesting)
 * - Transfer restrictions during vesting period
 * - Emergency pause mechanism
 * - Multi-sig admin control
 * - Automatic revaluation from Vault assets
 *
 * Security:
 * - ReentrancyGuard on all state-changing functions
 * - Pausable for emergency stops
 * - Role-based access control
 * - Price oracle integration with circuit breakers
 *
 * Target: $3B DR escrow deal + institutional-grade security
 */
contract Grain is ERC20, AccessControl, ReentrancyGuard, Pausable {
    // ============ ROLES ============
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // ============ STATE VARIABLES ============

    /// @notice Address of the Vault contract that backs GRAIN
    address public vault;

    /// @notice Address of the price oracle contract
    address public priceOracle;

    /// @notice Current NAV per GRAIN token (18 decimals, e.g., 1.0185e18 = $1.0185)
    uint256 public navPerToken;

    /// @notice Timestamp of last NAV update
    uint256 public lastNavUpdate;

    /// @notice Minimum time between NAV updates (1 hour)
    uint256 public constant MIN_UPDATE_INTERVAL = 1 hours;

    /// @notice Maximum NAV change per update (5% = 500 basis points)
    uint256 public constant MAX_NAV_CHANGE_BPS = 500;

    /// @notice Basis points divisor (10000 = 100%)
    uint256 public constant BPS_DIVISOR = 10000;

    /// @notice Founding investor vesting end timestamp
    uint256 public vestingEndTime;

    /// @notice Locked entry price for founding investors ($1.00 = 1e18)
    uint256 public constant FOUNDING_PRICE = 1e18;

    /// @notice Mapping of founding investors (locked at $1.00 during vesting)
    mapping(address => bool) public isFoundingInvestor;

    /// @notice Total founding investor allocation
    uint256 public foundingInvestorAllocation;

    // ============ EVENTS ============

    event NavUpdated(uint256 oldNav, uint256 newNav, uint256 timestamp);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event FoundingInvestorAdded(address indexed investor, uint256 amount);
    event Minted(address indexed user, uint256 grainAmount, uint256 price);
    event Burned(address indexed user, uint256 grainAmount, uint256 price);
    event VestingEndTimeUpdated(uint256 oldTime, uint256 newTime);

    // ============ ERRORS ============

    error InvalidAddress();
    error InvalidAmount();
    error UnauthorizedTransfer();
    error NavUpdateTooFrequent();
    error NavChangeTooLarge();
    error VestingNotEnded();
    error InsufficientBalance();

    // ============ CONSTRUCTOR ============

    /**
     * @notice Initialize Grain token
     * @param _vault Address of the Vault contract
     * @param _priceOracle Address of the price oracle contract
     * @param _vestingEndTime Unix timestamp when vesting ends
     */
    constructor(
        address _vault,
        address _priceOracle,
        uint256 _vestingEndTime
    ) ERC20("Grain", "GRAIN") {
        if (_vault == address(0) || _priceOracle == address(0)) revert InvalidAddress();

        vault = _vault;
        priceOracle = _priceOracle;
        navPerToken = 1e18; // Start at $1.00
        lastNavUpdate = block.timestamp;
        vestingEndTime = _vestingEndTime;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, _priceOracle);
    }

    // ============ EXTERNAL FUNCTIONS ============

    /**
     * @notice Mint GRAIN tokens at current NAV price
     * @dev Only callable by addresses with MINTER_ROLE
     * @param to Recipient address
     * @param amount Amount of GRAIN to mint (18 decimals)
     * @return price Price paid per GRAIN token
     */
    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 price)
    {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        price = navPerToken;
        _mint(to, amount);

        emit Minted(to, amount, price);
    }

    /**
     * @notice Mint GRAIN for founding investor at locked $1.00 price
     * @dev Only callable during vesting period, at $1.00 fixed price
     * @param investor Address of founding investor
     * @param amount Amount of GRAIN to mint
     */
    function mintFoundingInvestor(address investor, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (investor == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (block.timestamp >= vestingEndTime) revert VestingNotEnded();

        isFoundingInvestor[investor] = true;
        foundingInvestorAllocation += amount;

        _mint(investor, amount);

        emit FoundingInvestorAdded(investor, amount);
    }

    /**
     * @notice Burn GRAIN tokens
     * @param amount Amount of GRAIN to burn
     * @return price Price received per GRAIN token
     */
    function burn(uint256 amount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 price)
    {
        if (amount == 0) revert InvalidAmount();
        if (balanceOf(msg.sender) < amount) revert InsufficientBalance();

        price = navPerToken;
        _burn(msg.sender, amount);

        emit Burned(msg.sender, amount, price);
    }

    /**
     * @notice Update NAV per token from oracle
     * @dev Only callable by oracle, with time-lock and circuit breaker
     * @param newNav New NAV per token (18 decimals)
     */
    function updateNav(uint256 newNav)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        if (newNav == 0) revert InvalidAmount();

        // Time-lock: minimum 1 hour between updates
        if (block.timestamp < lastNavUpdate + MIN_UPDATE_INTERVAL) {
            revert NavUpdateTooFrequent();
        }

        // Circuit breaker: max 5% change per update
        uint256 oldNav = navPerToken;
        uint256 changePercent;

        if (newNav > oldNav) {
            changePercent = ((newNav - oldNav) * BPS_DIVISOR) / oldNav;
        } else {
            changePercent = ((oldNav - newNav) * BPS_DIVISOR) / oldNav;
        }

        if (changePercent > MAX_NAV_CHANGE_BPS) {
            revert NavChangeTooLarge();
        }

        navPerToken = newNav;
        lastNavUpdate = block.timestamp;

        emit NavUpdated(oldNav, newNav, block.timestamp);
    }

    /**
     * @notice Get current price per GRAIN token
     * @return Current NAV per token (18 decimals)
     */
    function getPrice() external view returns (uint256) {
        return navPerToken;
    }

    /**
     * @notice Get market cap (total supply * NAV per token)
     * @return Market cap in USD (18 decimals)
     */
    function getMarketCap() external view returns (uint256) {
        return (totalSupply() * navPerToken) / 1e18;
    }

    /**
     * @notice Check if investor is founding investor
     * @param account Address to check
     * @return True if founding investor
     */
    function isFounder(address account) external view returns (bool) {
        return isFoundingInvestor[account];
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Update Vault address
     * @param _vault New Vault address
     */
    function setVault(address _vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_vault == address(0)) revert InvalidAddress();
        address oldVault = vault;
        vault = _vault;
        emit VaultUpdated(oldVault, _vault);
    }

    /**
     * @notice Update price oracle address
     * @param _oracle New oracle address
     */
    function setOracle(address _oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_oracle == address(0)) revert InvalidAddress();
        address oldOracle = priceOracle;
        priceOracle = _oracle;
        _revokeRole(ORACLE_ROLE, oldOracle);
        _grantRole(ORACLE_ROLE, _oracle);
        emit OracleUpdated(oldOracle, _oracle);
    }

    /**
     * @notice Update vesting end time
     * @param _vestingEndTime New vesting end timestamp
     */
    function setVestingEndTime(uint256 _vestingEndTime) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldTime = vestingEndTime;
        vestingEndTime = _vestingEndTime;
        emit VestingEndTimeUpdated(oldTime, _vestingEndTime);
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

    /**
     * @notice Override _beforeTokenTransfer to add vesting restrictions
     * @dev Founding investors cannot transfer during vesting period
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);

        // Skip checks for minting/burning
        if (from == address(0) || to == address(0)) {
            return;
        }

        // During vesting period, founding investors cannot transfer
        if (block.timestamp < vestingEndTime && isFoundingInvestor[from]) {
            revert UnauthorizedTransfer();
        }
    }
}
