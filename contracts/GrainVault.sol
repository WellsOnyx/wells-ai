// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./Grain.sol";

/**
 * @title GrainVault
 * @notice Treasury contract that manages GRAIN minting, USDC collateral, and credit lines
 * @dev Holds USDC collateral, mints/burns GRAIN, manages credit lines
 *
 * Core Functions:
 * - Deposit USDC → Mint GRAIN + Open credit line (1:1)
 * - Withdraw USDC → Burn GRAIN (requires closed credit line)
 * - Pay with credit → Mint GRAIN for seller, reduce buyer's credit
 * - Repay credit → Restore buyer's credit line
 *
 * Revenue Model:
 * - Invests USDC collateral in yield strategies (8-12% APY)
 * - 0% transaction fees for users
 * - Revenue from float investing
 */
contract GrainVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CREDIT_MANAGER_ROLE = keccak256("CREDIT_MANAGER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // Token contracts
    IERC20 public immutable usdc; // USDC on Base L2
    Grain public immutable grain; // GRAIN token

    // Accounting
    mapping(address => uint256) public deposits; // User USDC deposits
    mapping(address => uint256) public creditLines; // Available credit per user
    mapping(address => uint256) public creditUsed; // Credit currently outstanding
    mapping(address => uint256) public creditTier; // 1 = 1:1, 2 = 1.5:1, 3 = 2:1

    uint256 public totalCollateral; // Total USDC in vault
    uint256 public totalGrainSupply; // Total GRAIN minted
    uint256 public totalCreditExtended; // Total credit outstanding

    // Constants
    uint256 public constant MIN_COLLATERAL_RATIO = 110; // 110% overcollateralization
    uint256 public constant TIER1_LEVERAGE = 100; // 1:1 (100%)
    uint256 public constant TIER2_LEVERAGE = 150; // 1.5:1 (150%)
    uint256 public constant TIER3_LEVERAGE = 200; // 2:1 (200%)

    // Events
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event CreditLineOpened(address indexed user, uint256 amount, uint256 tier);
    event CreditLineIncreased(address indexed user, uint256 newLimit);
    event PaidWithCredit(address indexed buyer, address indexed seller, uint256 amount);
    event CreditRepaid(address indexed user, uint256 amount);
    event TierUpgraded(address indexed user, uint256 oldTier, uint256 newTier);
    event CollateralRatioWarning(uint256 currentRatio, uint256 minRatio);

    /**
     * @dev Constructor
     * @param _usdc USDC token address on Base L2
     * @param _grain GRAIN token address
     * @param _admin Admin address (receives DEFAULT_ADMIN_ROLE and all other roles initially)
     */
    constructor(address _usdc, address _grain, address _admin) {
        require(_usdc != address(0), "GrainVault: zero USDC address");
        require(_grain != address(0), "GrainVault: zero GRAIN address");
        require(_admin != address(0), "GrainVault: zero admin address");

        usdc = IERC20(_usdc);
        grain = Grain(_grain);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(CREDIT_MANAGER_ROLE, _admin);
        _grantRole(TREASURY_ROLE, _admin);
    }

    /**
     * @dev Deposit USDC, mint GRAIN, open credit line
     * @param amount Amount of USDC to deposit (6 decimals for USDC)
     *
     * Flow:
     * 1. Transfer USDC from user to vault
     * 2. Mint GRAIN to user (1:1)
     * 3. Open credit line (1:1 for Tier 1, can upgrade later)
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "GrainVault: zero amount");

        // Transfer USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Update accounting
        deposits[msg.sender] += amount;
        totalCollateral += amount;

        // Convert USDC (6 decimals) to GRAIN (18 decimals)
        uint256 grainAmount = amount * 1e12; // USDC has 6 decimals, GRAIN has 18

        // Mint GRAIN to user
        grain.mint(msg.sender, grainAmount);
        totalGrainSupply += grainAmount;

        // Open/increase credit line (Tier 1: 1:1 leverage initially)
        if (creditTier[msg.sender] == 0) {
            creditTier[msg.sender] = 1; // Default to Tier 1
        }

        uint256 creditIncrease = (amount * getTierLeverage(msg.sender)) / 100;
        creditLines[msg.sender] += creditIncrease;

        emit Deposited(msg.sender, amount);
        emit CreditLineOpened(msg.sender, creditLines[msg.sender], creditTier[msg.sender]);

        _checkCollateralRatio();
    }

    /**
     * @dev Withdraw USDC, burn GRAIN
     * @param amount Amount of USDC to withdraw
     *
     * Requirements:
     * - User must have sufficient deposits
     * - User must have no outstanding credit (or sufficient remaining collateral)
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "GrainVault: zero amount");
        require(deposits[msg.sender] >= amount, "GrainVault: insufficient balance");

        // Check credit constraint: can't withdraw collateral backing outstanding credit
        uint256 requiredCollateral = (creditUsed[msg.sender] * 100) / getTierLeverage(msg.sender);
        require(
            deposits[msg.sender] - amount >= requiredCollateral,
            "GrainVault: outstanding credit"
        );

        // Convert USDC to GRAIN
        uint256 grainAmount = amount * 1e12;

        // Burn GRAIN from user
        grain.burn(msg.sender, grainAmount);
        totalGrainSupply -= grainAmount;

        // Update accounting
        deposits[msg.sender] -= amount;
        totalCollateral -= amount;

        // Reduce credit line proportionally
        uint256 creditReduction = (amount * getTierLeverage(msg.sender)) / 100;
        creditLines[msg.sender] -= creditReduction;

        // Transfer USDC to user
        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);

        _checkCollateralRatio();
    }

    /**
     * @dev Pay seller using credit line
     * @param seller Address of seller to pay
     * @param amount Amount to pay (in USDC terms, 6 decimals)
     *
     * Flow:
     * 1. Check buyer has sufficient credit
     * 2. Mint GRAIN to seller
     * 3. Reduce buyer's available credit
     * 4. Increase buyer's credit used
     */
    function payWithCredit(address seller, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "GrainVault: zero amount");
        require(seller != address(0), "GrainVault: zero seller address");
        require(creditLines[msg.sender] >= amount, "GrainVault: insufficient credit");

        // Convert to GRAIN
        uint256 grainAmount = amount * 1e12;

        // Mint GRAIN to seller
        grain.mint(seller, grainAmount);
        totalGrainSupply += grainAmount;

        // Update buyer's credit accounting
        creditLines[msg.sender] -= amount;
        creditUsed[msg.sender] += amount;
        totalCreditExtended += amount;

        emit PaidWithCredit(msg.sender, seller, amount);

        _checkCollateralRatio();
    }

    /**
     * @dev Repay credit line
     * @param amount Amount of USDC to repay
     *
     * Flow:
     * 1. Transfer USDC from user to vault
     * 2. Restore user's credit line
     * 3. Reduce credit used
     */
    function repayCredit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "GrainVault: zero amount");
        require(creditUsed[msg.sender] >= amount, "GrainVault: repay exceeds debt");

        // Transfer USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Update accounting
        totalCollateral += amount;
        deposits[msg.sender] += amount;

        // Restore credit line
        creditLines[msg.sender] += amount;
        creditUsed[msg.sender] -= amount;
        totalCreditExtended -= amount;

        emit CreditRepaid(msg.sender, amount);

        _checkCollateralRatio();
    }

    /**
     * @dev Upgrade user to higher credit tier
     * @param user Address of user to upgrade
     * @param newTier New tier (1, 2, or 3)
     *
     * Requirements:
     * - Caller must have CREDIT_MANAGER_ROLE
     * - New tier must be higher than current
     */
    function upgradeTier(address user, uint256 newTier) external onlyRole(CREDIT_MANAGER_ROLE) {
        require(newTier >= 1 && newTier <= 3, "GrainVault: invalid tier");
        require(newTier > creditTier[user], "GrainVault: tier not higher");

        uint256 oldTier = creditTier[user];
        creditTier[user] = newTier;

        // Recalculate credit line with new leverage
        uint256 baseDeposit = deposits[user];
        uint256 newCreditLine = (baseDeposit * getTierLeverage(user)) / 100;
        creditLines[user] = newCreditLine;

        emit TierUpgraded(user, oldTier, newTier);
        emit CreditLineIncreased(user, newCreditLine);
    }

    /**
     * @dev Get leverage percentage for a tier
     * @param user Address of user
     * @return uint256 Leverage percentage (100 = 1:1, 150 = 1.5:1, 200 = 2:1)
     */
    function getTierLeverage(address user) public view returns (uint256) {
        uint256 tier = creditTier[user];
        if (tier == 3) return TIER3_LEVERAGE;
        if (tier == 2) return TIER2_LEVERAGE;
        return TIER1_LEVERAGE;
    }

    /**
     * @dev Get current collateralization ratio
     * @return uint256 Ratio as percentage (e.g., 150 = 150%)
     */
    function getCollateralRatio() public view returns (uint256) {
        if (totalGrainSupply == 0) return type(uint256).max;
        return (totalCollateral * 1e12 * 100) / totalGrainSupply;
    }

    /**
     * @dev Check if collateral ratio is healthy, emit warning if not
     */
    function _checkCollateralRatio() internal {
        uint256 ratio = getCollateralRatio();
        if (ratio < MIN_COLLATERAL_RATIO) {
            emit CollateralRatioWarning(ratio, MIN_COLLATERAL_RATIO);
        }
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Withdraw yield earned from treasury strategies
     * @param token Token address to withdraw (for yield in other tokens)
     * @param amount Amount to withdraw
     * @param recipient Address to send withdrawn funds
     *
     * Requirements:
     * - Caller must have TREASURY_ROLE
     * - Cannot withdraw USDC collateral below required ratio
     */
    function withdrawYield(
        address token,
        uint256 amount,
        address recipient
    ) external onlyRole(TREASURY_ROLE) nonReentrant {
        require(recipient != address(0), "GrainVault: zero recipient");

        if (token == address(usdc)) {
            // If withdrawing USDC, ensure collateral ratio stays healthy
            uint256 newCollateral = totalCollateral - amount;
            uint256 newRatio = (newCollateral * 1e12 * 100) / totalGrainSupply;
            require(newRatio >= MIN_COLLATERAL_RATIO, "GrainVault: would break collateral ratio");
            totalCollateral = newCollateral;
        }

        IERC20(token).safeTransfer(recipient, amount);
    }

    /**
     * @dev Get user account summary
     * @param user Address of user
     * @return deposited USDC deposited
     * @return creditAvailable Credit line available
     * @return creditOutstanding Credit currently used
     * @return tier Credit tier (1, 2, or 3)
     */
    function getAccountSummary(address user)
        external
        view
        returns (
            uint256 deposited,
            uint256 creditAvailable,
            uint256 creditOutstanding,
            uint256 tier
        )
    {
        return (
            deposits[user],
            creditLines[user],
            creditUsed[user],
            creditTier[user]
        );
    }
}
