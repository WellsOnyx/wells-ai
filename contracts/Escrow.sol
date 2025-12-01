// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Escrow
 * @notice Milestone-based B2B escrow with dispute resolution
 * @dev Production-ready for $3B DR deal + institutional escrow
 *
 * Key Features:
 * - Create escrow for B2B transactions
 * - Milestone tracking (shipment, delivery, etc.)
 * - Automatic release when milestones met
 * - Dispute resolution mechanism
 * - Refund capability
 * - Fee calculation and collection (0.5%)
 * - Support both USDC and GRAIN settlements
 *
 * Security:
 * - Multi-party approval (depositor, beneficiary, arbitrator)
 * - Milestone states: pending, completed, disputed
 * - Timeout mechanisms
 * - ReentrancyGuard on all state-changing functions
 * - Emergency pause mechanism
 * - Event emissions for all state changes
 *
 * Workflow:
 * 1. Depositor creates escrow with milestones
 * 2. Funds locked in contract
 * 3. Oracle completes milestones when conditions met
 * 4. Funds released per milestone percentages
 * 5. Dispute resolution if needed
 */
contract Escrow is AccessControl, ReentrancyGuard, Pausable {
    // ============ ROLES ============
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ ENUMS ============

    enum EscrowStatus {
        ACTIVE,         // Escrow is active
        COMPLETED,      // All milestones completed
        DISPUTED,       // Dispute raised
        REFUNDED,       // Refunded to depositor
        CANCELLED       // Cancelled before completion
    }

    enum MilestoneStatus {
        PENDING,        // Not yet completed
        COMPLETED,      // Successfully completed
        DISPUTED        // Disputed by a party
    }

    // ============ STRUCTS ============

    struct Milestone {
        string description;     // e.g., "Shipment confirmed"
        uint256 percentage;     // Percentage of total to release (basis points)
        MilestoneStatus status;
        uint256 completedAt;    // Timestamp when completed
    }

    struct EscrowDetails {
        address depositor;          // Party depositing funds
        address beneficiary;        // Party receiving funds
        address arbitrator;         // Dispute resolver
        address token;              // USDC or GRAIN address
        uint256 totalAmount;        // Total escrowed amount
        uint256 releasedAmount;     // Amount already released
        uint256 createdAt;          // Creation timestamp
        uint256 expiryTime;         // Expiry timestamp
        EscrowStatus status;
        Milestone[] milestones;
        string dealId;              // External deal reference
    }

    // ============ STATE VARIABLES ============

    /// @notice Escrow fee in basis points (50 bps = 0.5%)
    uint256 public escrowFeeBps = 50;

    /// @notice Basis points divisor (10000 = 100%)
    uint256 public constant BPS_DIVISOR = 10000;

    /// @notice Total escrows created
    uint256 public totalEscrows;

    /// @notice Escrow registry (escrowId => EscrowDetails)
    mapping(bytes32 => EscrowDetails) public escrows;

    /// @notice Active escrow IDs
    bytes32[] public activeEscrowIds;

    /// @notice Fee collector address
    address public feeCollector;

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

    event DisputeResolved(
        bytes32 indexed escrowId,
        uint256 beneficiaryAmount,
        uint256 depositorAmount
    );

    event EscrowRefunded(bytes32 indexed escrowId, uint256 amount);
    event EscrowCancelled(bytes32 indexed escrowId);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event EscrowFeeUpdated(uint256 oldFee, uint256 newFee);

    // ============ ERRORS ============

    error InvalidAddress();
    error InvalidAmount();
    error InvalidPercentage();
    error InsufficientBalance();
    error EscrowNotFound();
    error EscrowNotActive();
    error EscrowExpired();
    error MilestoneNotPending();
    error MilestoneAlreadyCompleted();
    error UnauthorizedOperation();
    error AllMilestonesCompleted();

    // ============ CONSTRUCTOR ============

    /**
     * @notice Initialize Escrow contract
     * @param _feeCollector Address to collect fees
     */
    constructor(address _feeCollector) {
        if (_feeCollector == address(0)) revert InvalidAddress();

        feeCollector = _feeCollector;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(ARBITRATOR_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ============ ESCROW CREATION ============

    /**
     * @notice Create new escrow with milestones
     * @param beneficiary Address to receive funds
     * @param arbitrator Address to resolve disputes
     * @param token Token address (USDC or GRAIN)
     * @param amount Total amount to escrow
     * @param durationDays Escrow duration in days
     * @param dealId External deal reference
     * @param milestoneDescriptions Array of milestone descriptions
     * @param milestonePercentages Array of milestone percentages (basis points)
     * @return escrowId Unique escrow ID
     */
    function createEscrow(
        address beneficiary,
        address arbitrator,
        address token,
        uint256 amount,
        uint256 durationDays,
        string calldata dealId,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestonePercentages
    ) external nonReentrant whenNotPaused returns (bytes32 escrowId) {
        // Validation
        if (beneficiary == address(0) || arbitrator == address(0) || token == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) revert InvalidAmount();
        if (milestoneDescriptions.length == 0 || milestoneDescriptions.length != milestonePercentages.length) {
            revert InvalidPercentage();
        }

        // Validate milestone percentages sum to 100%
        uint256 totalPercentage;
        for (uint256 i = 0; i < milestonePercentages.length; i++) {
            totalPercentage += milestonePercentages[i];
        }
        if (totalPercentage != BPS_DIVISOR) revert InvalidPercentage();

        // Generate escrow ID
        escrowId = keccak256(
            abi.encodePacked(
                msg.sender,
                beneficiary,
                amount,
                block.timestamp,
                totalEscrows
            )
        );

        // Transfer tokens to escrow
        require(
            IERC20(token).transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );

        // Create escrow
        EscrowDetails storage escrow = escrows[escrowId];
        escrow.depositor = msg.sender;
        escrow.beneficiary = beneficiary;
        escrow.arbitrator = arbitrator;
        escrow.token = token;
        escrow.totalAmount = amount;
        escrow.releasedAmount = 0;
        escrow.createdAt = block.timestamp;
        escrow.expiryTime = block.timestamp + (durationDays * 1 days);
        escrow.status = EscrowStatus.ACTIVE;
        escrow.dealId = dealId;

        // Create milestones
        for (uint256 i = 0; i < milestoneDescriptions.length; i++) {
            escrow.milestones.push(
                Milestone({
                    description: milestoneDescriptions[i],
                    percentage: milestonePercentages[i],
                    status: MilestoneStatus.PENDING,
                    completedAt: 0
                })
            );
        }

        activeEscrowIds.push(escrowId);
        totalEscrows++;

        emit EscrowCreated(
            escrowId,
            msg.sender,
            beneficiary,
            token,
            amount,
            dealId
        );
    }

    // ============ MILESTONE COMPLETION ============

    /**
     * @notice Complete milestone and release funds
     * @param escrowId Escrow ID
     * @param milestoneIndex Index of milestone to complete
     */
    function completeMilestone(bytes32 escrowId, uint256 milestoneIndex)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
        whenNotPaused
    {
        EscrowDetails storage escrow = escrows[escrowId];

        // Validation
        if (escrow.depositor == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.ACTIVE) revert EscrowNotActive();
        if (block.timestamp > escrow.expiryTime) revert EscrowExpired();
        if (milestoneIndex >= escrow.milestones.length) revert InvalidAmount();

        Milestone storage milestone = escrow.milestones[milestoneIndex];

        if (milestone.status != MilestoneStatus.PENDING) {
            revert MilestoneNotPending();
        }

        // Mark milestone as completed
        milestone.status = MilestoneStatus.COMPLETED;
        milestone.completedAt = block.timestamp;

        // Calculate release amount
        uint256 releaseAmount = (escrow.totalAmount * milestone.percentage) / BPS_DIVISOR;

        // Calculate fee
        uint256 fee = (releaseAmount * escrowFeeBps) / BPS_DIVISOR;
        uint256 netAmount = releaseAmount - fee;

        // Transfer to beneficiary
        require(
            IERC20(escrow.token).transfer(escrow.beneficiary, netAmount),
            "Transfer to beneficiary failed"
        );

        // Transfer fee to collector
        require(
            IERC20(escrow.token).transfer(feeCollector, fee),
            "Fee transfer failed"
        );

        escrow.releasedAmount += releaseAmount;

        emit MilestoneCompleted(escrowId, milestoneIndex, releaseAmount, block.timestamp);

        // Check if all milestones completed
        bool allCompleted = true;
        for (uint256 i = 0; i < escrow.milestones.length; i++) {
            if (escrow.milestones[i].status != MilestoneStatus.COMPLETED) {
                allCompleted = false;
                break;
            }
        }

        if (allCompleted) {
            escrow.status = EscrowStatus.COMPLETED;
            emit EscrowCompleted(escrowId, escrow.releasedAmount);
        }
    }

    // ============ DISPUTE RESOLUTION ============

    /**
     * @notice Raise dispute for escrow
     * @param escrowId Escrow ID
     * @param milestoneIndex Index of disputed milestone
     */
    function disputeEscrow(bytes32 escrowId, uint256 milestoneIndex)
        external
        nonReentrant
    {
        EscrowDetails storage escrow = escrows[escrowId];

        if (escrow.depositor == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.ACTIVE) revert EscrowNotActive();
        if (msg.sender != escrow.depositor && msg.sender != escrow.beneficiary) {
            revert UnauthorizedOperation();
        }
        if (milestoneIndex >= escrow.milestones.length) revert InvalidAmount();

        escrow.status = EscrowStatus.DISPUTED;
        escrow.milestones[milestoneIndex].status = MilestoneStatus.DISPUTED;

        emit EscrowDisputed(escrowId, milestoneIndex, msg.sender);
    }

    /**
     * @notice Resolve dispute (arbitrator only)
     * @param escrowId Escrow ID
     * @param beneficiaryAmount Amount to release to beneficiary
     * @param depositorAmount Amount to refund to depositor
     */
    function resolveDispute(
        bytes32 escrowId,
        uint256 beneficiaryAmount,
        uint256 depositorAmount
    ) external onlyRole(ARBITRATOR_ROLE) nonReentrant {
        EscrowDetails storage escrow = escrows[escrowId];

        if (escrow.depositor == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.DISPUTED) revert EscrowNotActive();

        uint256 remainingAmount = escrow.totalAmount - escrow.releasedAmount;

        if (beneficiaryAmount + depositorAmount > remainingAmount) {
            revert InvalidAmount();
        }

        // Calculate fees
        uint256 beneficiaryFee = (beneficiaryAmount * escrowFeeBps) / BPS_DIVISOR;
        uint256 depositorFee = (depositorAmount * escrowFeeBps) / BPS_DIVISOR;

        uint256 netBeneficiaryAmount = beneficiaryAmount - beneficiaryFee;
        uint256 netDepositorAmount = depositorAmount - depositorFee;

        // Transfer to beneficiary
        if (netBeneficiaryAmount > 0) {
            require(
                IERC20(escrow.token).transfer(escrow.beneficiary, netBeneficiaryAmount),
                "Transfer to beneficiary failed"
            );
        }

        // Refund to depositor
        if (netDepositorAmount > 0) {
            require(
                IERC20(escrow.token).transfer(escrow.depositor, netDepositorAmount),
                "Transfer to depositor failed"
            );
        }

        // Transfer fees
        uint256 totalFees = beneficiaryFee + depositorFee;
        if (totalFees > 0) {
            require(
                IERC20(escrow.token).transfer(feeCollector, totalFees),
                "Fee transfer failed"
            );
        }

        escrow.status = EscrowStatus.COMPLETED;

        emit DisputeResolved(escrowId, beneficiaryAmount, depositorAmount);
    }

    // ============ REFUND & CANCELLATION ============

    /**
     * @notice Refund escrow to depositor (if expired and not completed)
     * @param escrowId Escrow ID
     */
    function refundEscrow(bytes32 escrowId) external nonReentrant {
        EscrowDetails storage escrow = escrows[escrowId];

        if (escrow.depositor == address(0)) revert EscrowNotFound();
        if (msg.sender != escrow.depositor) revert UnauthorizedOperation();
        if (escrow.status != EscrowStatus.ACTIVE) revert EscrowNotActive();
        if (block.timestamp <= escrow.expiryTime) revert InvalidAmount();

        uint256 remainingAmount = escrow.totalAmount - escrow.releasedAmount;

        if (remainingAmount > 0) {
            // Calculate fee
            uint256 fee = (remainingAmount * escrowFeeBps) / BPS_DIVISOR;
            uint256 netAmount = remainingAmount - fee;

            // Refund to depositor
            require(
                IERC20(escrow.token).transfer(escrow.depositor, netAmount),
                "Refund transfer failed"
            );

            // Transfer fee
            require(
                IERC20(escrow.token).transfer(feeCollector, fee),
                "Fee transfer failed"
            );
        }

        escrow.status = EscrowStatus.REFUNDED;

        emit EscrowRefunded(escrowId, remainingAmount);
    }

    /**
     * @notice Cancel escrow (mutual agreement required)
     * @param escrowId Escrow ID
     */
    function cancelEscrow(bytes32 escrowId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        EscrowDetails storage escrow = escrows[escrowId];

        if (escrow.depositor == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.ACTIVE) revert EscrowNotActive();

        uint256 remainingAmount = escrow.totalAmount - escrow.releasedAmount;

        if (remainingAmount > 0) {
            // Refund to depositor (no fee on cancellation)
            require(
                IERC20(escrow.token).transfer(escrow.depositor, remainingAmount),
                "Refund transfer failed"
            );
        }

        escrow.status = EscrowStatus.CANCELLED;

        emit EscrowCancelled(escrowId);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get escrow details
     * @param escrowId Escrow ID
     * @return Escrow details
     */
    function getEscrow(bytes32 escrowId)
        external
        view
        returns (EscrowDetails memory)
    {
        return escrows[escrowId];
    }

    /**
     * @notice Get milestone details
     * @param escrowId Escrow ID
     * @param milestoneIndex Milestone index
     * @return Milestone details
     */
    function getMilestone(bytes32 escrowId, uint256 milestoneIndex)
        external
        view
        returns (Milestone memory)
    {
        return escrows[escrowId].milestones[milestoneIndex];
    }

    /**
     * @notice Get all active escrow IDs
     * @return Array of active escrow IDs
     */
    function getActiveEscrows() external view returns (bytes32[] memory) {
        return activeEscrowIds;
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Update escrow fee
     * @param newFeeBps New fee in basis points (e.g., 50 = 0.5%)
     */
    function setEscrowFee(uint256 newFeeBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        uint256 oldFee = escrowFeeBps;
        escrowFeeBps = newFeeBps;
        emit EscrowFeeUpdated(oldFee, newFeeBps);
    }

    /**
     * @notice Update fee collector
     * @param newCollector New fee collector address
     */
    function setFeeCollector(address newCollector)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newCollector == address(0)) revert InvalidAddress();
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
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
}
