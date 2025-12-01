// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEscrow
 * @notice Interface for Escrow contract
 */
interface IEscrow {
    // ============ ENUMS ============

    enum EscrowStatus {
        ACTIVE,
        COMPLETED,
        DISPUTED,
        REFUNDED,
        CANCELLED
    }

    enum MilestoneStatus {
        PENDING,
        COMPLETED,
        DISPUTED
    }

    // ============ STRUCTS ============

    struct Milestone {
        string description;
        uint256 percentage;
        MilestoneStatus status;
        uint256 completedAt;
    }

    struct EscrowDetails {
        address depositor;
        address beneficiary;
        address arbitrator;
        address token;
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 createdAt;
        uint256 expiryTime;
        EscrowStatus status;
        Milestone[] milestones;
        string dealId;
    }

    // ============ EVENTS ============

    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed depositor,
        address indexed beneficiary,
        address token,
        uint256 amount,
        string dealId
    );

    event MilestoneCompleted(
        bytes32 indexed escrowId,
        uint256 indexed milestoneIndex,
        uint256 amountReleased,
        uint256 timestamp
    );

    event EscrowCompleted(bytes32 indexed escrowId, uint256 totalReleased);

    event EscrowDisputed(
        bytes32 indexed escrowId,
        uint256 milestoneIndex,
        address indexed disputedBy
    );

    // ============ FUNCTIONS ============

    function createEscrow(
        address beneficiary,
        address arbitrator,
        address token,
        uint256 amount,
        uint256 durationDays,
        string calldata dealId,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestonePercentages
    ) external returns (bytes32 escrowId);

    function completeMilestone(bytes32 escrowId, uint256 milestoneIndex) external;
    function disputeEscrow(bytes32 escrowId, uint256 milestoneIndex) external;
    function resolveDispute(bytes32 escrowId, uint256 beneficiaryAmount, uint256 depositorAmount) external;
    function refundEscrow(bytes32 escrowId) external;
    function getEscrow(bytes32 escrowId) external view returns (EscrowDetails memory);
    function getMilestone(bytes32 escrowId, uint256 milestoneIndex) external view returns (Milestone memory);
}
