// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GRAIN Stablecoin
 * @notice Wells AI treasury stablecoin, backed 1:1 by USDC
 * @dev ERC-20 token with minting, burning, and pause capabilities
 *
 * GRAIN is the native currency of the Wells AI ecosystem:
 * - Buyers deposit USDC → receive GRAIN
 * - Suppliers receive GRAIN for completed transactions
 * - GRAIN can be redeemed 1:1 for USDC
 * - All Wells AI escrow and payments happen in GRAIN
 */
contract GRAIN is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // Events for transparency
    event GrainMinted(address indexed to, uint256 amount, string reason);
    event GrainBurned(address indexed from, uint256 amount, string reason);
    event TreasuryTransfer(address indexed from, address indexed to, uint256 amount, string dealId);

    // Total USDC backing (for transparency)
    uint256 public totalUsdcBacking;

    constructor() ERC20("GRAIN", "GRAIN") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
    }

    /**
     * @notice Mint GRAIN tokens (only callable by MINTER_ROLE)
     * @dev Called when user deposits USDC into Grain & Vault
     * @param to Recipient address
     * @param amount Amount to mint (in wei, 18 decimals)
     * @param reason Reason for minting (e.g., "USDC deposit", "Deal escrow")
     */
    function mint(address to, uint256 amount, string calldata reason)
        public
        onlyRole(MINTER_ROLE)
    {
        _mint(to, amount);
        emit GrainMinted(to, amount, reason);
    }

    /**
     * @notice Burn GRAIN tokens with reason logging
     * @dev Called when user withdraws USDC from Grain & Vault
     * @param amount Amount to burn
     * @param reason Reason for burning (e.g., "USDC withdrawal", "Deal completion")
     */
    function burnWithReason(uint256 amount, string calldata reason)
        public
    {
        _burn(msg.sender, amount);
        emit GrainBurned(msg.sender, amount, reason);
    }

    /**
     * @notice Treasury transfer for deals (logs deal ID for audit)
     * @dev Used for escrow releases, supplier payments, fee collection
     * @param from Source address
     * @param to Destination address
     * @param amount Amount to transfer
     * @param dealId Wells AI deal ID for audit trail
     */
    function treasuryTransfer(
        address from,
        address to,
        uint256 amount,
        string calldata dealId
    )
        public
        onlyRole(TREASURY_ROLE)
    {
        _transfer(from, to, amount);
        emit TreasuryTransfer(from, to, amount, dealId);
    }

    /**
     * @notice Update USDC backing amount (for transparency reporting)
     * @param newBacking New total USDC backing amount
     */
    function updateUsdcBacking(uint256 newBacking)
        public
        onlyRole(TREASURY_ROLE)
    {
        totalUsdcBacking = newBacking;
    }

    /**
     * @notice Pause all token transfers
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause token transfers
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Get backing ratio (should always be >= 1.0)
     * @return ratio USDC backing per GRAIN (scaled by 1e18)
     */
    function backingRatio() public view returns (uint256) {
        if (totalSupply() == 0) return 1e18;
        return (totalUsdcBacking * 1e18) / totalSupply();
    }

    // Required overrides
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
