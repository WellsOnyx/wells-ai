// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title GrainPriceOracle
 * @notice NAV tracking oracle for GRAIN token pricing
 * @dev Calculates and updates GRAIN NAV from Vault assets
 *
 * Key Features:
 * - Calculate GRAIN NAV from Vault total assets
 * - Update frequency control (max 1x per hour)
 * - Circuit breakers (max 5% change per update)
 * - Historical price tracking
 * - Chainlink-style oracle interface
 *
 * Security:
 * - Multi-sig control for updates
 * - Time-lock between updates
 * - Circuit breaker on large price changes
 * - Historical audit trail
 * - Emergency pause mechanism
 *
 * Formula:
 * NAV per GRAIN = (Total Vault Assets - Total Liabilities) / Total GRAIN Supply
 */
contract GrainPriceOracle is AccessControl, Pausable {
    // ============ ROLES ============
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ STRUCTS ============

    struct PriceUpdate {
        uint256 price;          // NAV per GRAIN (18 decimals)
        uint256 totalAssets;    // Total Vault assets (18 decimals)
        uint256 totalLiabilities; // Total Vault liabilities (18 decimals)
        uint256 grainSupply;    // Total GRAIN supply (18 decimals)
        uint256 timestamp;      // Update timestamp
        address updatedBy;      // Address that submitted update
    }

    // ============ STATE VARIABLES ============

    /// @notice Current NAV per GRAIN token (18 decimals)
    uint256 public currentPrice;

    /// @notice Timestamp of last price update
    uint256 public lastUpdateTime;

    /// @notice Minimum time between updates (1 hour)
    uint256 public constant MIN_UPDATE_INTERVAL = 1 hours;

    /// @notice Maximum price change per update (5% = 500 basis points)
    uint256 public constant MAX_PRICE_CHANGE_BPS = 500;

    /// @notice Basis points divisor (10000 = 100%)
    uint256 public constant BPS_DIVISOR = 10000;

    /// @notice Historical price updates
    PriceUpdate[] public priceHistory;

    /// @notice Grain token address
    address public grainToken;

    /// @notice Vault address
    address public vault;

    /// @notice Circuit breaker triggered flag
    bool public circuitBreakerTriggered;

    /// @notice Last known good price (before circuit breaker)
    uint256 public lastGoodPrice;

    // ============ EVENTS ============

    event PriceUpdated(
        uint256 indexed oldPrice,
        uint256 indexed newPrice,
        uint256 totalAssets,
        uint256 totalLiabilities,
        uint256 grainSupply,
        uint256 timestamp,
        address updatedBy
    );

    event CircuitBreakerTriggered(
        uint256 attemptedPrice,
        uint256 currentPrice,
        uint256 changePercent,
        uint256 timestamp
    );

    event CircuitBreakerReset(uint256 timestamp);

    event GrainTokenUpdated(address indexed oldToken, address indexed newToken);
    event VaultUpdated(address indexed oldVault, address indexed newVault);

    // ============ ERRORS ============

    error InvalidAddress();
    error InvalidAmount();
    error UpdateTooFrequent();
    error PriceChangeTooLarge();
    error CircuitBreakerActive();
    error NoHistoricalData();

    // ============ CONSTRUCTOR ============

    /**
     * @notice Initialize price oracle
     * @param _grainToken Address of GRAIN token
     * @param _vault Address of Vault
     * @param _initialPrice Initial NAV per GRAIN (18 decimals)
     */
    constructor(
        address _grainToken,
        address _vault,
        uint256 _initialPrice
    ) {
        if (_grainToken == address(0) || _vault == address(0)) revert InvalidAddress();
        if (_initialPrice == 0) revert InvalidAmount();

        grainToken = _grainToken;
        vault = _vault;
        currentPrice = _initialPrice;
        lastGoodPrice = _initialPrice;
        lastUpdateTime = block.timestamp;
        circuitBreakerTriggered = false;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPDATER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        // Store initial price in history
        priceHistory.push(
            PriceUpdate({
                price: _initialPrice,
                totalAssets: 0,
                totalLiabilities: 0,
                grainSupply: 0,
                timestamp: block.timestamp,
                updatedBy: msg.sender
            })
        );
    }

    // ============ PRICE UPDATE FUNCTIONS ============

    /**
     * @notice Update GRAIN NAV price
     * @dev Calculates NAV = (totalAssets - totalLiabilities) / grainSupply
     * @param totalAssets Total Vault assets (18 decimals)
     * @param totalLiabilities Total Vault liabilities (18 decimals)
     * @param grainSupply Total GRAIN supply (18 decimals)
     */
    function updatePrice(
        uint256 totalAssets,
        uint256 totalLiabilities,
        uint256 grainSupply
    ) external onlyRole(UPDATER_ROLE) whenNotPaused {
        if (grainSupply == 0) revert InvalidAmount();
        if (totalAssets < totalLiabilities) revert InvalidAmount();

        // Check circuit breaker
        if (circuitBreakerTriggered) revert CircuitBreakerActive();

        // Time-lock: minimum 1 hour between updates
        if (block.timestamp < lastUpdateTime + MIN_UPDATE_INTERVAL) {
            revert UpdateTooFrequent();
        }

        // Calculate new NAV per GRAIN
        uint256 netAssets = totalAssets - totalLiabilities;
        uint256 newPrice = (netAssets * 1e18) / grainSupply;

        if (newPrice == 0) revert InvalidAmount();

        // Circuit breaker: check for large price changes
        _checkCircuitBreaker(newPrice);

        // Update price
        uint256 oldPrice = currentPrice;
        currentPrice = newPrice;
        lastGoodPrice = newPrice;
        lastUpdateTime = block.timestamp;

        // Store in history
        priceHistory.push(
            PriceUpdate({
                price: newPrice,
                totalAssets: totalAssets,
                totalLiabilities: totalLiabilities,
                grainSupply: grainSupply,
                timestamp: block.timestamp,
                updatedBy: msg.sender
            })
        );

        emit PriceUpdated(
            oldPrice,
            newPrice,
            totalAssets,
            totalLiabilities,
            grainSupply,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @notice Manually update price (emergency override)
     * @dev Only callable by admin, bypasses circuit breaker
     * @param newPrice New NAV per GRAIN (18 decimals)
     * @param totalAssets Total Vault assets
     * @param totalLiabilities Total Vault liabilities
     * @param grainSupply Total GRAIN supply
     */
    function emergencyUpdatePrice(
        uint256 newPrice,
        uint256 totalAssets,
        uint256 totalLiabilities,
        uint256 grainSupply
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newPrice == 0) revert InvalidAmount();

        uint256 oldPrice = currentPrice;
        currentPrice = newPrice;
        lastGoodPrice = newPrice;
        lastUpdateTime = block.timestamp;

        // Reset circuit breaker
        circuitBreakerTriggered = false;

        // Store in history
        priceHistory.push(
            PriceUpdate({
                price: newPrice,
                totalAssets: totalAssets,
                totalLiabilities: totalLiabilities,
                grainSupply: grainSupply,
                timestamp: block.timestamp,
                updatedBy: msg.sender
            })
        );

        emit PriceUpdated(
            oldPrice,
            newPrice,
            totalAssets,
            totalLiabilities,
            grainSupply,
            block.timestamp,
            msg.sender
        );

        emit CircuitBreakerReset(block.timestamp);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get latest price (Chainlink-style interface)
     * @return price Latest NAV per GRAIN (18 decimals)
     */
    function latestAnswer() external view returns (uint256 price) {
        return currentPrice;
    }

    /**
     * @notice Get latest price with timestamp
     * @return price Latest NAV per GRAIN
     * @return timestamp Last update timestamp
     */
    function getLatestPrice() external view returns (uint256 price, uint256 timestamp) {
        return (currentPrice, lastUpdateTime);
    }

    /**
     * @notice Get historical price at specific index
     * @param index History index
     * @return Price update details
     */
    function getHistoricalPrice(uint256 index)
        external
        view
        returns (PriceUpdate memory)
    {
        if (index >= priceHistory.length) revert NoHistoricalData();
        return priceHistory[index];
    }

    /**
     * @notice Get total number of price updates
     * @return Number of updates
     */
    function getHistoryLength() external view returns (uint256) {
        return priceHistory.length;
    }

    /**
     * @notice Get recent price history
     * @param count Number of recent updates to retrieve
     * @return Recent price updates
     */
    function getRecentHistory(uint256 count)
        external
        view
        returns (PriceUpdate[] memory)
    {
        uint256 length = priceHistory.length;
        if (count > length) {
            count = length;
        }

        PriceUpdate[] memory recent = new PriceUpdate[](count);
        for (uint256 i = 0; i < count; i++) {
            recent[i] = priceHistory[length - count + i];
        }

        return recent;
    }

    /**
     * @notice Get price change percentage since last update
     * @return changePercent Change in basis points (positive or negative)
     * @return isIncrease True if price increased, false if decreased
     */
    function getPriceChange()
        external
        view
        returns (uint256 changePercent, bool isIncrease)
    {
        if (priceHistory.length < 2) {
            return (0, true);
        }

        uint256 previousPrice = priceHistory[priceHistory.length - 2].price;
        uint256 currentPriceValue = currentPrice;

        if (currentPriceValue > previousPrice) {
            changePercent = ((currentPriceValue - previousPrice) * BPS_DIVISOR) / previousPrice;
            isIncrease = true;
        } else {
            changePercent = ((previousPrice - currentPriceValue) * BPS_DIVISOR) / previousPrice;
            isIncrease = false;
        }
    }

    /**
     * @notice Check if circuit breaker is active
     * @return True if circuit breaker triggered
     */
    function isCircuitBreakerActive() external view returns (bool) {
        return circuitBreakerTriggered;
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Reset circuit breaker (after 7-day audit)
     */
    function resetCircuitBreaker() external onlyRole(DEFAULT_ADMIN_ROLE) {
        circuitBreakerTriggered = false;
        emit CircuitBreakerReset(block.timestamp);
    }

    /**
     * @notice Update GRAIN token address
     * @param _grainToken New GRAIN token address
     */
    function setGrainToken(address _grainToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_grainToken == address(0)) revert InvalidAddress();
        address oldToken = grainToken;
        grainToken = _grainToken;
        emit GrainTokenUpdated(oldToken, _grainToken);
    }

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
     * @notice Check if price change exceeds circuit breaker threshold
     * @dev Triggers circuit breaker if change > 5%
     * @param newPrice New price to check
     */
    function _checkCircuitBreaker(uint256 newPrice) internal {
        uint256 oldPrice = currentPrice;
        uint256 changePercent;

        if (newPrice > oldPrice) {
            changePercent = ((newPrice - oldPrice) * BPS_DIVISOR) / oldPrice;
        } else {
            changePercent = ((oldPrice - newPrice) * BPS_DIVISOR) / oldPrice;
        }

        if (changePercent > MAX_PRICE_CHANGE_BPS) {
            circuitBreakerTriggered = true;

            emit CircuitBreakerTriggered(
                newPrice,
                oldPrice,
                changePercent,
                block.timestamp
            );

            revert PriceChangeTooLarge();
        }
    }
}
