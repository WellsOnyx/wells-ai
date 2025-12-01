// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGrainPriceOracle
 * @notice Interface for Grain price oracle
 */
interface IGrainPriceOracle {
    // ============ STRUCTS ============

    struct PriceUpdate {
        uint256 price;
        uint256 totalAssets;
        uint256 totalLiabilities;
        uint256 grainSupply;
        uint256 timestamp;
        address updatedBy;
    }

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

    // ============ FUNCTIONS ============

    function updatePrice(
        uint256 totalAssets,
        uint256 totalLiabilities,
        uint256 grainSupply
    ) external;

    function latestAnswer() external view returns (uint256 price);
    function getLatestPrice() external view returns (uint256 price, uint256 timestamp);
    function getHistoricalPrice(uint256 index) external view returns (PriceUpdate memory);
    function getRecentHistory(uint256 count) external view returns (PriceUpdate[] memory);
    function isCircuitBreakerActive() external view returns (bool);
}
