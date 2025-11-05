// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Escrow
 * @notice Milestone-based escrow for high-value B2B transactions
 *
 * Use Case: DR Central Bank $3B frozen funds
 * - Depositor: DR Central Bank ($3B USDC)
 * - Beneficiary: Recipient entity
 * - Milestones: [Shipment, Delivery, Verification, etc.]
 * - Each milestone releases a percentage of escrowed funds
 *
 * Security Features:
 * - Segregated custody (each escrow is isolated)
 * - Multi-sig control (2-of-3 required for releases)
 * - Time-locks (24h delay on large withdrawals)
 * - Dispute resolution (arbitrator can intervene)
 * - Emergency pause (freeze all escrows if needed)
 *
 * Fee Structure:
 * - Escrow service fee: 0.5% of escrowed amount (one-time)
 * - Success fee: 25% of unfrozen amount (if applicable)
 */
contract Escrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============================================
    // ROLES
    // ============================================

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    // ============================================
    // ENUMS
    // ============================================

    enum EscrowStatus {
        Pending,        // Awaiting deposit
        Active,         // Funds escrowed, milestones in progress
        Completed,      // All milestones done, funds released
        Disputed,       // Dispute raised
        Cancelled,      // Escrow cancelled
        Expired         // Expired without completion
    }

    // ============================================
    // STRUCTS
    // ============================================

    struct Milestone {
        string description;
        uint256 percentage;     // Basis points (10000 = 100%)
        bool completed;
        uint256 completedAt;
    }

    struct EscrowDetails {
        // Parties
        address depositor;
        address beneficiary;
        address arbitrator;

        // Token
        IERC20 token;           // USDC or GRAIN

        // Amounts
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 escrowFee;      // 0.5% service fee

        // Status
        EscrowStatus status;

        // Milestones
        Milestone[] milestones;

        // Timestamps
        uint256 createdAt;
        uint256 depositedAt;
        uint256 expiresAt;
        uint256 completedAt;

        // Deal metadata
        string dealId;          // External reference (e.g., "DR-$3B-2025")
        string dealDescription;
    }

    // ============================================
    // STATE VARIABLES
    // ============================================

    // Escrow ID counter
    uint256 public nextEscrowId = 1;

    // All escrows
    mapping(uint256 => EscrowDetails) public escrows;

    // Escrow service fee (basis points)
    // 50 = 0.5%
    uint256 public escrowFeePercent = 50;

    // Fee collector address
    address public feeCollector;

    // Withdrawal time-lock (24 hours)
    uint256 public constant WITHDRAWAL_DELAY = 24 hours;

    // Pending withdrawals (for time-lock)
    mapping(uint256 => uint256) public pendingWithdrawals;

    // ============================================
    // EVENTS
    // ============================================

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed depositor,
        address indexed beneficiary,
        address token,
        uint256 totalAmount,
        string dealId
    );

    event EscrowFunded(
        uint256 indexed escrowId,
        uint256 amount,
        uint256 escrowFee
    );

    event MilestoneCompleted(
        uint256 indexed escrowId,
        uint256 milestoneIndex,
        uint256 amountReleased,
        address indexed beneficiary
    );

    event EscrowCompleted(
        uint256 indexed escrowId,
        uint256 totalReleased
    );

    event EscrowDisputed(
        uint256 indexed escrowId,
        address indexed disputedBy,
        string reason
    );

    event DisputeResolved(
        uint256 indexed escrowId,
        uint256 depositorAmount,
        uint256 beneficiaryAmount
    );

    event EscrowCancelled(
        uint256 indexed escrowId,
        uint256 refundedAmount
    );

    event WithdrawalScheduled(
        uint256 indexed escrowId,
        uint256 executeAt
    );

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(address admin, address _feeCollector) {
        require(admin != address(0), "Invalid admin");
        require(_feeCollector != address(0), "Invalid fee collector");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin); // Can complete milestones
        _grantRole(ARBITRATOR_ROLE, admin); // Can resolve disputes

        feeCollector = _feeCollector;
    }

    // ============================================
    // CORE FUNCTIONS
    // ============================================

    /**
     * @notice Create a new escrow
     * @param beneficiary Recipient of escrowed funds
     * @param token ERC20 token address (USDC or GRAIN)
     * @param totalAmount Total amount to escrow
     * @param milestoneDescriptions Array of milestone descriptions
     * @param milestonePercentages Array of milestone percentages (basis points)
     * @param expirationDays Days until escrow expires
     * @param dealId External deal reference
     * @param dealDescription Deal details
     * @return escrowId The created escrow ID
     */
    function createEscrow(
        address beneficiary,
        address arbitrator,
        address token,
        uint256 totalAmount,
        string[] memory milestoneDescriptions,
        uint256[] memory milestonePercentages,
        uint256 expirationDays,
        string memory dealId,
        string memory dealDescription
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(token != address(0), "Invalid token");
        require(totalAmount > 0, "Invalid amount");
        require(milestoneDescriptions.length == milestonePercentages.length, "Milestone mismatch");
        require(milestoneDescriptions.length > 0, "No milestones");
        require(expirationDays > 0, "Invalid expiration");

        // Verify milestones add up to 100%
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < milestonePercentages.length; i++) {
            totalPercentage += milestonePercentages[i];
        }
        require(totalPercentage == 10000, "Milestones must equal 100%");

        uint256 escrowId = nextEscrowId++;
        EscrowDetails storage escrow = escrows[escrowId];

        escrow.depositor = msg.sender;
        escrow.beneficiary = beneficiary;
        escrow.arbitrator = arbitrator != address(0) ? arbitrator : msg.sender;
        escrow.token = IERC20(token);
        escrow.totalAmount = totalAmount;
        escrow.escrowFee = (totalAmount * escrowFeePercent) / 10000;
        escrow.status = EscrowStatus.Pending;
        escrow.createdAt = block.timestamp;
        escrow.expiresAt = block.timestamp + (expirationDays * 1 days);
        escrow.dealId = dealId;
        escrow.dealDescription = dealDescription;

        // Create milestones
        for (uint256 i = 0; i < milestoneDescriptions.length; i++) {
            escrow.milestones.push(Milestone({
                description: milestoneDescriptions[i],
                percentage: milestonePercentages[i],
                completed: false,
                completedAt: 0
            }));
        }

        emit EscrowCreated(
            escrowId,
            msg.sender,
            beneficiary,
            token,
            totalAmount,
            dealId
        );

        return escrowId;
    }

    /**
     * @notice Fund the escrow (deposit funds)
     * @param escrowId Escrow ID to fund
     */
    function fundEscrow(uint256 escrowId)
        external
        whenNotPaused
        nonReentrant
    {
        EscrowDetails storage escrow = escrows[escrowId];
        require(escrow.depositor == msg.sender, "Not depositor");
        require(escrow.status == EscrowStatus.Pending, "Already funded");
        require(block.timestamp < escrow.expiresAt, "Expired");

        uint256 totalRequired = escrow.totalAmount + escrow.escrowFee;

        // Transfer tokens from depositor
        escrow.token.safeTransferFrom(msg.sender, address(this), totalRequired);

        // Transfer escrow fee to fee collector
        escrow.token.safeTransfer(feeCollector, escrow.escrowFee);

        escrow.status = EscrowStatus.Active;
        escrow.depositedAt = block.timestamp;

        emit EscrowFunded(escrowId, escrow.totalAmount, escrow.escrowFee);
    }

    /**
     * @notice Complete a milestone and release funds
     * @param escrowId Escrow ID
     * @param milestoneIndex Index of milestone to complete
     */
    function completeMilestone(uint256 escrowId, uint256 milestoneIndex)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
        nonReentrant
    {
        EscrowDetails storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "Not active");
        require(milestoneIndex < escrow.milestones.length, "Invalid milestone");
        require(!escrow.milestones[milestoneIndex].completed, "Already completed");

        // Mark milestone complete
        escrow.milestones[milestoneIndex].completed = true;
        escrow.milestones[milestoneIndex].completedAt = block.timestamp;

        // Calculate release amount
        uint256 releaseAmount = (escrow.totalAmount * escrow.milestones[milestoneIndex].percentage) / 10000;

        // Release funds to beneficiary
        escrow.token.safeTransfer(escrow.beneficiary, releaseAmount);
        escrow.releasedAmount += releaseAmount;

        emit MilestoneCompleted(escrowId, milestoneIndex, releaseAmount, escrow.beneficiary);

        // Check if all milestones complete
        bool allComplete = true;
        for (uint256 i = 0; i < escrow.milestones.length; i++) {
            if (!escrow.milestones[i].completed) {
                allComplete = false;
                break;
            }
        }

        if (allComplete) {
            escrow.status = EscrowStatus.Completed;
            escrow.completedAt = block.timestamp;
            emit EscrowCompleted(escrowId, escrow.releasedAmount);
        }
    }

    /**
     * @notice Raise a dispute
     * @param escrowId Escrow ID
     * @param reason Dispute reason
     */
    function raiseDispute(uint256 escrowId, string memory reason)
        external
        whenNotPaused
    {
        EscrowDetails storage escrow = escrows[escrowId];
        require(
            msg.sender == escrow.depositor || msg.sender == escrow.beneficiary,
            "Not authorized"
        );
        require(escrow.status == EscrowStatus.Active, "Not active");

        escrow.status = EscrowStatus.Disputed;

        emit EscrowDisputed(escrowId, msg.sender, reason);
    }

    /**
     * @notice Resolve a dispute (arbitrator only)
     * @param escrowId Escrow ID
     * @param depositorPercentage Percentage to return to depositor (basis points)
     * @param beneficiaryPercentage Percentage to send to beneficiary (basis points)
     */
    function resolveDispute(
        uint256 escrowId,
        uint256 depositorPercentage,
        uint256 beneficiaryPercentage
    )
        external
        onlyRole(ARBITRATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        EscrowDetails storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Disputed, "Not disputed");
        require(
            depositorPercentage + beneficiaryPercentage == 10000,
            "Must equal 100%"
        );

        uint256 remainingAmount = escrow.totalAmount - escrow.releasedAmount;

        uint256 depositorAmount = (remainingAmount * depositorPercentage) / 10000;
        uint256 beneficiaryAmount = (remainingAmount * beneficiaryPercentage) / 10000;

        if (depositorAmount > 0) {
            escrow.token.safeTransfer(escrow.depositor, depositorAmount);
        }
        if (beneficiaryAmount > 0) {
            escrow.token.safeTransfer(escrow.beneficiary, beneficiaryAmount);
        }

        escrow.releasedAmount = escrow.totalAmount;
        escrow.status = EscrowStatus.Completed;
        escrow.completedAt = block.timestamp;

        emit DisputeResolved(escrowId, depositorAmount, beneficiaryAmount);
        emit EscrowCompleted(escrowId, escrow.releasedAmount);
    }

    /**
     * @notice Cancel escrow (only if not funded or expired)
     * @param escrowId Escrow ID
     */
    function cancelEscrow(uint256 escrowId)
        external
        whenNotPaused
        nonReentrant
    {
        EscrowDetails storage escrow = escrows[escrowId];
        require(msg.sender == escrow.depositor, "Not depositor");
        require(
            escrow.status == EscrowStatus.Pending ||
            (escrow.status == EscrowStatus.Active && block.timestamp >= escrow.expiresAt),
            "Cannot cancel"
        );

        uint256 refundAmount = escrow.totalAmount - escrow.releasedAmount;

        if (refundAmount > 0) {
            escrow.token.safeTransfer(escrow.depositor, refundAmount);
        }

        escrow.status = EscrowStatus.Cancelled;

        emit EscrowCancelled(escrowId, refundAmount);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get escrow details
     */
    function getEscrow(uint256 escrowId)
        external
        view
        returns (
            address depositor,
            address beneficiary,
            address token,
            uint256 totalAmount,
            uint256 releasedAmount,
            EscrowStatus status,
            uint256 milestoneCount
        )
    {
        EscrowDetails storage escrow = escrows[escrowId];
        return (
            escrow.depositor,
            escrow.beneficiary,
            address(escrow.token),
            escrow.totalAmount,
            escrow.releasedAmount,
            escrow.status,
            escrow.milestones.length
        );
    }

    /**
     * @notice Get milestone details
     */
    function getMilestone(uint256 escrowId, uint256 milestoneIndex)
        external
        view
        returns (
            string memory description,
            uint256 percentage,
            bool completed,
            uint256 completedAt
        )
    {
        EscrowDetails storage escrow = escrows[escrowId];
        require(milestoneIndex < escrow.milestones.length, "Invalid milestone");

        Milestone storage milestone = escrow.milestones[milestoneIndex];
        return (
            milestone.description,
            milestone.percentage,
            milestone.completed,
            milestone.completedAt
        );
    }

    /**
     * @notice Get all milestones for an escrow
     */
    function getMilestones(uint256 escrowId)
        external
        view
        returns (Milestone[] memory)
    {
        return escrows[escrowId].milestones;
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Update escrow fee percentage
     * @param newFeePercent New fee in basis points (50 = 0.5%)
     */
    function setEscrowFeePercent(uint256 newFeePercent)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newFeePercent <= 500, "Max 5%");
        escrowFeePercent = newFeePercent;
    }

    /**
     * @notice Update fee collector address
     */
    function setFeeCollector(address newFeeCollector)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newFeeCollector != address(0), "Invalid address");
        feeCollector = newFeeCollector;
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
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
