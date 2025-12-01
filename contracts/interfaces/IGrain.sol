// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IGrain
 * @notice Interface for Grain token
 */
interface IGrain is IERC20 {
    // ============ EVENTS ============

    event NavUpdated(uint256 oldNav, uint256 newNav, uint256 timestamp);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event FoundingInvestorAdded(address indexed investor, uint256 amount);
    event Minted(address indexed user, uint256 grainAmount, uint256 price);
    event Burned(address indexed user, uint256 grainAmount, uint256 price);

    // ============ FUNCTIONS ============

    function mint(address to, uint256 amount) external returns (uint256 price);
    function mintFoundingInvestor(address investor, uint256 amount) external;
    function burn(uint256 amount) external returns (uint256 price);
    function updateNav(uint256 newNav) external;
    function getPrice() external view returns (uint256);
    function getMarketCap() external view returns (uint256);
    function isFounder(address account) external view returns (bool);
    function navPerToken() external view returns (uint256);
    function vault() external view returns (address);
    function priceOracle() external view returns (address);
}
