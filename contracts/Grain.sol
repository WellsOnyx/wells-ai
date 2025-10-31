// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Grain Token
 * @notice The Ultimate B2B Stablecoin - 0% transaction fees, backed 1:1 by USDC
 * @dev ERC-20 token on Base L2 with minting/burning controlled by Vault contract
 *
 * Key Features:
 * - 1 GRAIN = 1 USD (pegged via USDC backing)
 * - Only Vault contract can mint/burn
 * - Pausable for emergency situations
 * - Compliance: freeze/unfreeze capabilities
 * - Role-based access control
 */
contract Grain is ERC20, ERC20Burnable, AccessControl, Pausable {
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    // Frozen accounts (for compliance/fraud prevention)
    mapping(address => bool) private _frozen;

    // Events
    event AccountFrozen(address indexed account, string reason);
    event AccountUnfrozen(address indexed account);

    /**
     * @dev Constructor sets up roles and initial state
     * @param defaultAdmin Address that will receive DEFAULT_ADMIN_ROLE
     * @param minter Address that will receive MINTER_ROLE (Vault contract)
     */
    constructor(address defaultAdmin, address minter) ERC20("Grain", "GRAIN") {
        require(defaultAdmin != address(0), "Grain: zero admin address");
        require(minter != address(0), "Grain: zero minter address");

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(COMPLIANCE_ROLE, defaultAdmin);
    }

    /**
     * @dev Mint new GRAIN tokens
     * @param to Address to receive minted tokens
     * @param amount Amount of tokens to mint (in wei, 18 decimals)
     *
     * Requirements:
     * - Caller must have MINTER_ROLE (Vault contract)
     * - Contract must not be paused
     * - Recipient must not be frozen
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(!_frozen[to], "Grain: recipient is frozen");
        _mint(to, amount);
    }

    /**
     * @dev Burn GRAIN tokens
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     *
     * Requirements:
     * - Caller must have MINTER_ROLE (Vault contract)
     * - Account must not be frozen
     */
    function burn(address from, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(!_frozen[from], "Grain: account is frozen");
        _burn(from, amount);
    }

    /**
     * @dev Freeze an account (compliance)
     * @param account Address to freeze
     * @param reason Reason for freezing (for audit trail)
     *
     * Requirements:
     * - Caller must have COMPLIANCE_ROLE
     */
    function freeze(address account, string memory reason) public onlyRole(COMPLIANCE_ROLE) {
        require(!_frozen[account], "Grain: account already frozen");
        _frozen[account] = true;
        emit AccountFrozen(account, reason);
    }

    /**
     * @dev Unfreeze an account
     * @param account Address to unfreeze
     *
     * Requirements:
     * - Caller must have COMPLIANCE_ROLE
     */
    function unfreeze(address account) public onlyRole(COMPLIANCE_ROLE) {
        require(_frozen[account], "Grain: account not frozen");
        _frozen[account] = false;
        emit AccountUnfrozen(account);
    }

    /**
     * @dev Check if an account is frozen
     * @param account Address to check
     * @return bool True if account is frozen
     */
    function isFrozen(address account) public view returns (bool) {
        return _frozen[account];
    }

    /**
     * @dev Pause all token transfers
     *
     * Requirements:
     * - Caller must have PAUSER_ROLE
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     *
     * Requirements:
     * - Caller must have PAUSER_ROLE
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Hook that is called before any transfer of tokens
     * Prevents transfers from/to frozen accounts and when paused
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        require(!_frozen[from], "Grain: sender is frozen");
        require(!_frozen[to], "Grain: recipient is frozen");
        super._beforeTokenTransfer(from, to, amount);
    }
}
