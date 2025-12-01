// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVault
 * @notice Interface for Vault contract
 */
interface IVault {
    // ============ ENUMS ============

    enum AssetTier {
        LIQUID,
        FLOAT,
        PHYSICAL,
        INVESTMENTS,
        RECEIVABLES
    }

    // ============ STRUCTS ============

    struct Asset {
        string name;
        AssetTier tier;
        uint256 value;
        uint256 lastUpdated;
        bool isActive;
    }

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
    event AssetAdded(bytes32 indexed assetId, string name, AssetTier tier, uint256 value);
    event AssetUpdated(bytes32 indexed assetId, uint256 oldValue, uint256 newValue);
    event NavUpdated(uint256 oldNav, uint256 newNav, uint256 timestamp);

    // ============ FUNCTIONS ============

    function deposit(uint256 amount) external;
    function queueWithdrawal(address to, uint256 amount) external returns (bytes32 withdrawalId);
    function executeWithdrawal(bytes32 withdrawalId) external;
    function addAsset(string calldata name, AssetTier tier, uint256 value) external;
    function updateAsset(bytes32 assetId, uint256 newValue) external;
    function updateLiabilities(uint256 newLiabilities) external;
    function getNav() external view returns (uint256);
    function getBalance() external view returns (uint256);
    function getNavByTier(AssetTier tier) external view returns (uint256);
}
