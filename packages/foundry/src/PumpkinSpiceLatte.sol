// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC4626Vault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function asset() external view returns (address);
    function maxWithdraw(address owner) external view returns (uint256);
}

/**
 * @title PumpkinSpiceLatteEnhanced
 * @dev Enhanced PLSA contract that works with Uniswap V4 hook for dynamic liquidity management.
 *      Handles all business logic while the hook provides V4 integration.
 * 
 * Key Features:
 * - User deposits and withdrawals
 * - Morpho vault integration for yield
 * - Dynamic liquidity management (pool vs vault)
 * - Prize distribution system
 * - Liquidity provider tracking and bonuses
 * - Swap fee accumulation
 */
contract PumpkinSpiceLatteEnhanced is Ownable, ReentrancyGuard {

    //-//////////////////////////////////////////////////////////
    //                           STATE
    //-//////////////////////////////////////////////////////////

    /// @dev The underlying ERC20 asset (USDC)
    address public immutable ASSET;

    /// @dev The Morpho vault contract address
    address public immutable VAULT;

    /// @dev The V4 hook contract address
    address public hookContract;

    /// @dev Prize round duration in seconds
    uint256 public roundDuration;

    /// @dev Timestamp when next prize round ends
    uint256 public nextRoundTimestamp;
    
    /// @dev Total principal deposited by users
    uint256 public totalPrincipal;

    /// @dev User balances (principal + prizes won)
    mapping(address => uint256) public balanceOf;

    /// @dev Array of depositors for prize draw
    address[] public depositors;

    /// @dev Depositor index mapping for O(1) removal
    mapping(address => uint256) private depositorIndex;

    /// @dev Last prize winner
    address public lastWinner;

    /// @dev Last prize amount
    uint256 public lastPrizeAmount;

    /// @dev Vault shares owned by this contract
    uint256 public vaultShares;

    /// @dev Liquidity provider tracking
    mapping(address => uint256) public lpBalances;
    address[] public liquidityProviders;
    mapping(address => uint256) private lpIndex;

    /// @dev Accumulated swap fees from hook
    uint256 public accumulatedSwapFees;

    /// @dev Pool liquidity management
    uint256 public poolLiquidity; // Amount currently in pool
    uint256 public totalLiquidity; // Total managed liquidity

    /// @dev Configuration
    uint256 public targetPoolBufferBps = 1000; // 10% target in pool
    uint256 public minimumPoolBuffer = 10000 * 10**6; // 10k USDC minimum
    uint256 public lpBonusBps = 500; // 5% bonus for LP depositors

    /// @dev Emergency pause
    bool public paused = false;

    //-//////////////////////////////////////////////////////////
    //                          EVENTS
    //-//////////////////////////////////////////////////////////

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event PrizeAwarded(address indexed winner, uint256 amount, uint256 round);
    event LiquidityProviderAdded(address indexed provider, uint256 amount);
    event LiquidityProviderRemoved(address indexed provider, uint256 amount);
    event SwapFeesReceived(uint256 amount);
    event LiquidityRequested(uint256 requested, uint256 provided);
    event VaultRebalanced(uint256 amount, bool toVault);
    event HookContractUpdated(address indexed newHook);

    //-//////////////////////////////////////////////////////////
    //                        MODIFIERS
    //-//////////////////////////////////////////////////////////

    modifier onlyHook() {
        require(msg.sender == hookContract, "Only hook contract");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    //-//////////////////////////////////////////////////////////
    //                        CONSTRUCTOR
    //-//////////////////////////////////////////////////////////

    constructor(
        address _asset,
        address _vault,
        uint256 _roundDuration
    ) Ownable(msg.sender) {
        require(_asset != address(0), "Invalid asset");
        require(_vault != address(0), "Invalid vault");
        require(_roundDuration > 0, "Invalid round duration");
        require(IERC4626Vault(_vault).asset() == _asset, "Vault asset mismatch");
        
        ASSET = _asset;
        VAULT = _vault;
        roundDuration = _roundDuration;
        nextRoundTimestamp = block.timestamp + _roundDuration;
    }

    //-//////////////////////////////////////////////////////////
    //                     USER FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Deposit assets into the PLSA
     * @param _amount Amount to deposit
     */
    function deposit(uint256 _amount) external nonReentrant whenNotPaused {
        require(_amount > 0, "Amount must be greater than zero");

        if (balanceOf[msg.sender] == 0) {
            depositors.push(msg.sender);
            depositorIndex[msg.sender] = depositors.length - 1;
        }

        balanceOf[msg.sender] += _amount;
        totalPrincipal += _amount;

        emit Deposited(msg.sender, _amount);

        // Transfer from user and deposit to vault
        require(IERC20(ASSET).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        IERC20(ASSET).approve(VAULT, _amount);
        uint256 shares = IERC4626Vault(VAULT).deposit(_amount, address(this));
        vaultShares += shares;
        totalLiquidity += _amount;
    }

    /**
     * @notice Withdraw principal from PLSA
     * @param _amount Amount to withdraw
     */
    function withdraw(uint256 _amount) external nonReentrant whenNotPaused {
        require(_amount > 0, "Amount must be greater than zero");
        require(balanceOf[msg.sender] >= _amount, "Insufficient balance");
        require(totalAssets() >= totalPrincipal, "Contract undercollateralized");

        balanceOf[msg.sender] -= _amount;
        totalPrincipal -= _amount;
        totalLiquidity -= _amount;

        if (balanceOf[msg.sender] == 0) {
            _removeDepositor(msg.sender);
        }

        emit Withdrawn(msg.sender, _amount);

        // Withdraw from vault to user
        uint256 sharesBurned = IERC4626Vault(VAULT).withdraw(_amount, msg.sender, address(this));
        vaultShares = sharesBurned > vaultShares ? 0 : vaultShares - sharesBurned;
    }

    //-//////////////////////////////////////////////////////////
    //                     HOOK INTERFACE
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Handle liquidity addition from hook
     * @param provider LP address
     * @param amount Liquidity amount
     */
    function handleLiquidityAdded(address provider, uint256 amount) external onlyHook {
        if (lpBalances[provider] == 0) {
            liquidityProviders.push(provider);
            lpIndex[provider] = liquidityProviders.length - 1;
        }

        lpBalances[provider] += amount;
        poolLiquidity += amount;
        totalLiquidity += amount;

        // Award bonus if user is also a depositor
        if (balanceOf[provider] > 0) {
            uint256 bonus = (amount * lpBonusBps) / 10000;
            if (bonus > 0) {
                balanceOf[provider] += bonus;
                totalPrincipal += bonus;
            }
        }

        emit LiquidityProviderAdded(provider, amount);
    }

    /**
     * @notice Handle liquidity removal from hook
     * @param provider LP address  
     * @param amount Liquidity amount
     */
    function handleLiquidityRemoved(address provider, uint256 amount) external onlyHook {
        require(lpBalances[provider] >= amount, "Insufficient LP balance");

        lpBalances[provider] -= amount;
        poolLiquidity = poolLiquidity > amount ? poolLiquidity - amount : 0;
        totalLiquidity = totalLiquidity > amount ? totalLiquidity - amount : 0;

        if (lpBalances[provider] == 0) {
            _removeLiquidityProvider(provider);
        }

        emit LiquidityProviderRemoved(provider, amount);
    }

    /**
     * @notice Request liquidity for swap (called by hook)
     * @param amount Requested liquidity amount
     * @return available Amount of liquidity made available
     */
    function requestLiquidity(uint256 amount) external onlyHook returns (uint256 available) {
        uint256 needed = amount > poolLiquidity ? amount - poolLiquidity : 0;
        
        if (needed > 0) {
            // Withdraw from vault to increase pool liquidity
            uint256 maxWithdraw = IERC4626Vault(VAULT).maxWithdraw(address(this));
            uint256 toWithdraw = needed < maxWithdraw ? needed : maxWithdraw;
            
            if (toWithdraw > 0) {
                uint256 sharesBurned = IERC4626Vault(VAULT).withdraw(toWithdraw, address(this), address(this));
                vaultShares = sharesBurned > vaultShares ? 0 : vaultShares - sharesBurned;
                poolLiquidity += toWithdraw;
                
                emit VaultRebalanced(toWithdraw, false);
            }
        }

        available = poolLiquidity > amount ? amount : poolLiquidity;
        poolLiquidity = poolLiquidity > available ? poolLiquidity - available : 0;
        
        emit LiquidityRequested(amount, available);
        return available;
    }

    /**
     * @notice Deposit swap fees from hook
     * @param amount Fee amount
     */
    function depositSwapFees(uint256 amount) external onlyHook {
        accumulatedSwapFees += amount;
        emit SwapFeesReceived(amount);
    }

    /**
     * @notice Rebalance excess liquidity to vault
     * @param amount Excess amount
     */
    function rebalanceExcess(uint256 amount) external onlyHook {
        poolLiquidity += amount;
        _rebalanceToVault();
    }

    //-//////////////////////////////////////////////////////////
    //                     PRIZE FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Award prize to random depositor
     */
    function awardPrize() external nonReentrant whenNotPaused {
        require(block.timestamp >= nextRoundTimestamp, "Round not finished");
        require(depositors.length > 0, "No depositors");

        uint256 prize = prizePool();
        require(prize > 0, "No prize to award");

        // Pseudo-random selection (use Chainlink VRF in production)
        uint256 idx = uint256(
            keccak256(abi.encodePacked(block.prevrandao, block.timestamp, depositors.length))
        ) % depositors.length;
        address winner = depositors[idx];

        // Award prize
        balanceOf[winner] += prize;
        totalPrincipal += prize;

        lastWinner = winner;
        lastPrizeAmount = prize;
        nextRoundTimestamp = block.timestamp + roundDuration;
        accumulatedSwapFees = 0; // Reset fees

        emit PrizeAwarded(winner, prize, _getCurrentRound());
    }

    //-//////////////////////////////////////////////////////////
    //                  INTERNAL FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @dev Rebalance excess pool liquidity to vault
     */
    function _rebalanceToVault() internal {
        if (totalLiquidity == 0) return;

        uint256 targetPool = (totalLiquidity * targetPoolBufferBps) / 10000;
        if (targetPool < minimumPoolBuffer) {
            targetPool = minimumPoolBuffer;
        }

        if (poolLiquidity > targetPool) {
            uint256 excess = poolLiquidity - targetPool;
            poolLiquidity -= excess;

            // Deposit excess to vault
            IERC20(ASSET).approve(VAULT, excess);
            uint256 shares = IERC4626Vault(VAULT).deposit(excess, address(this));
            vaultShares += shares;

            emit VaultRebalanced(excess, true);
        }
    }

    /**
     * @dev Remove depositor from array
     */
    function _removeDepositor(address _depositor) private {
        uint256 index = depositorIndex[_depositor];
        address lastDepositor = depositors[depositors.length - 1];

        if (index < depositors.length - 1) {
            depositors[index] = lastDepositor;
            depositorIndex[lastDepositor] = index;
        }

        depositors.pop();
        delete depositorIndex[_depositor];
    }

    /**
     * @dev Remove liquidity provider from array
     */
    function _removeLiquidityProvider(address provider) private {
        uint256 index = lpIndex[provider];
        address lastProvider = liquidityProviders[liquidityProviders.length - 1];

        if (index < liquidityProviders.length - 1) {
            liquidityProviders[index] = lastProvider;
            lpIndex[lastProvider] = index;
        }

        liquidityProviders.pop();
        delete lpIndex[provider];
    }

    /**
     * @dev Get current round number
     */
    function _getCurrentRound() private view returns (uint256) {
        return (block.timestamp - (nextRoundTimestamp - roundDuration)) / roundDuration;
    }

    //-//////////////////////////////////////////////////////////
    //                         VIEW FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Get total assets (vault + pool)
     */
    function totalAssets() public view returns (uint256) {
        uint256 vaultAssets = vaultShares > 0 ? IERC4626Vault(VAULT).convertToAssets(vaultShares) : 0;
        return vaultAssets + IERC20(ASSET).balanceOf(address(this));
    }

    /**
     * @notice Get current prize pool
     */
    function prizePool() public view returns (uint256) {
        uint256 ta = totalAssets();
        uint256 yield = ta > totalPrincipal ? ta - totalPrincipal : 0;
        return yield + accumulatedSwapFees;
    }

    /**
     * @notice Check if address is a liquidity provider
     */
    function isProvider(address provider) external view returns (bool) {
        return lpBalances[provider] > 0;
    }

    /**
     * @notice Get depositor count
     */
    function numberOfDepositors() public view returns (uint256) {
        return depositors.length;
    }

    /**
     * @notice Get LP count
     */
    function numberOfLiquidityProviders() public view returns (uint256) {
        return liquidityProviders.length;
    }

    /**
     * @notice Time until next prize
     */
    function timeUntilNextPrize() public view returns (uint256) {
        return block.timestamp >= nextRoundTimestamp ? 0 : nextRoundTimestamp - block.timestamp;
    }

    //-//////////////////////////////////////////////////////////
    //                      ADMIN FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Set hook contract address
     */
    function setHookContract(address _hookContract) external onlyOwner {
        hookContract = _hookContract;
        emit HookContractUpdated(_hookContract);
    }

    /**
     * @notice Set target pool buffer
     */
    function setTargetPoolBufferBps(uint256 _bps) external onlyOwner {
        require(_bps <= 5000, "Buffer too high"); // Max 50%
        targetPoolBufferBps = _bps;
    }

    /**
     * @notice Set LP bonus percentage
     */
    function setLpBonusBps(uint256 _bps) external onlyOwner {
        require(_bps <= 2000, "Bonus too high"); // Max 20%
        lpBonusBps = _bps;
    }

    /**
     * @notice Emergency pause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @notice Emergency withdraw (when paused)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(paused, "Must be paused");
        IERC20(token).transfer(owner(), amount);
    }
}
