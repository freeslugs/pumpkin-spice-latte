// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";
import {IRandomnessProvider} from "./interfaces/IRandomnessProvider.sol";

// Backward compatibility interface
interface IERC4626Vault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function asset() external view returns (address);
    function maxWithdraw(address owner) external view returns (uint256);
}

/**
 * @title PumpkinSpiceLatteEnhanced
 * @dev Enhanced PLSA with adapter pattern + V4 hook integration + multi-participant lottery
 *      Uses adapter pattern for lending protocols and randomness providers.
 *      Supports both depositors (lottery participants) and LPs (liquidity providers).
 *
 * Key Features:
 * - User deposits and withdrawals with lottery participation
 * - LP tracking with bonuses for providing Uniswap liquidity
 * - Dynamic liquidity management between pool and lending protocol
 * - Adapter-based architecture for modularity
 * - Swap fee accumulation from V4 hook
 * - Prize distribution benefiting both depositors and swappers
 */
contract PumpkinSpiceLatteEnhanced is Ownable, ReentrancyGuard {
    //-//////////////////////////////////////////////////////////
    //                           STATE
    //-//////////////////////////////////////////////////////////

    /// @dev The underlying ERC20 asset (USDC)
    address public immutable ASSET;

    /// @dev Lending adapter implementing ERC4626-like interface
    ILendingAdapter public immutable LENDING_ADAPTER;

    /// @dev Randomness provider adapter
    IRandomnessProvider public randomnessProvider;

    /// @dev The Morpho vault contract address (backward compatibility)
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

    /// @dev Enhanced Lottery System
    mapping(address => uint256) public lpTickets; // Bonus lottery tickets for LPs

    /// @dev Pool liquidity management
    uint256 public poolLiquidity; // Amount currently in pool
    uint256 public totalLiquidity; // Total managed liquidity

    /// @dev Configuration
    uint256 public targetPoolBufferBps = 1000; // 10% target in pool
    uint256 public minimumPoolBuffer = 10000 * 10 ** 6; // 10k USDC minimum
    uint256 public lpBonusBps = 500; // 5% bonus for LP depositors
    uint256 public lpLotteryMultiplier = 200; // 2x lottery tickets for LPs
    uint256 public swapperBonusBps = 100; // 1% bonus tickets for swappers

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
    event SwapFeesReceived(uint256 amount, address indexed swapper);
    event LiquidityRequested(uint256 requested, uint256 provided);
    event VaultRebalanced(uint256 amount, bool toVault);
    event HookContractUpdated(address indexed newHook);
    event RandomnessProviderUpdated(address indexed newProvider);
    event LotteryTicketsAwarded(address indexed user, uint256 tickets, string reason);

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

    constructor(address _adapter, address _randomnessProvider, uint256 _roundDuration) Ownable(msg.sender) {
        require(_adapter != address(0), "Invalid adapter");
        require(_randomnessProvider != address(0), "Invalid randomness provider");
        require(_roundDuration > 0, "Invalid round duration");

        ASSET = ILendingAdapter(_adapter).asset();
        LENDING_ADAPTER = ILendingAdapter(_adapter);
        randomnessProvider = IRandomnessProvider(_randomnessProvider);
        VAULT = _adapter; // For backward compatibility
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

        // LP bonus if user is also providing liquidity
        if (lpBalances[msg.sender] > 0) {
            uint256 bonus = (_amount * lpBonusBps) / 10000;
            if (bonus > 0) {
                balanceOf[msg.sender] += bonus;
                totalPrincipal += bonus;
            }
        }

        emit Deposited(msg.sender, _amount);

        // Transfer and deposit via adapter
        require(IERC20(ASSET).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        require(IERC20(ASSET).approve(address(LENDING_ADAPTER), _amount), "Approval failed");
        uint256 sharesOut = LENDING_ADAPTER.deposit(_amount);
        vaultShares += sharesOut;
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

        // Withdraw via adapter to user
        uint256 sharesBurned = LENDING_ADAPTER.withdraw(_amount, msg.sender);
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

        // Award LP lottery tickets
        uint256 bonusTickets = (amount * lpLotteryMultiplier) / 100;
        lpTickets[provider] += bonusTickets;
        emit LotteryTicketsAwarded(provider, bonusTickets, "LP_BONUS");

        // Award bonus if user is also a depositor
        if (balanceOf[provider] > 0) {
            uint256 bonus = (amount * lpBonusBps) / 10000;
            if (bonus > 0) {
                balanceOf[provider] += bonus;
                totalPrincipal += bonus;
            }
        }

        // CRITICAL: USDC was already transferred by hook, now deposit to Morpho vault
        require(IERC20(ASSET).approve(address(LENDING_ADAPTER), amount), "Approval failed");
        uint256 sharesOut = LENDING_ADAPTER.deposit(amount);
        vaultShares += sharesOut;

        emit LiquidityProviderAdded(provider, amount);
        emit VaultRebalanced(amount, true); // Indicates deposit to vault
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

        // Reduce LP lottery tickets proportionally
        if (lpBalances[provider] + amount > 0) {
            uint256 ticketReduction = (lpTickets[provider] * amount) / (lpBalances[provider] + amount);
            lpTickets[provider] = lpTickets[provider] > ticketReduction ? lpTickets[provider] - ticketReduction : 0;
        }

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
            // Calculate how much we can withdraw from adapter
            uint256 totalAdapterAssets = vaultShares > 0 ? LENDING_ADAPTER.convertToAssets(vaultShares) : 0;
            // Allow withdrawing up to total adapter assets for liquidity requests
            uint256 maxWithdrawable = totalAdapterAssets;
            uint256 toWithdraw = needed < maxWithdrawable ? needed : maxWithdrawable;

            if (toWithdraw > 0) {
                uint256 sharesBurned = LENDING_ADAPTER.withdraw(toWithdraw, address(this));
                vaultShares = sharesBurned > vaultShares ? 0 : vaultShares - sharesBurned;
                poolLiquidity += toWithdraw;

                // Transfer USDC back to hook for pool operations
                require(IERC20(ASSET).transfer(msg.sender, toWithdraw), "Transfer to hook failed");

                emit VaultRebalanced(toWithdraw, false);
            }
        }

        available = poolLiquidity > amount ? amount : poolLiquidity;
        poolLiquidity = poolLiquidity > available ? poolLiquidity - available : 0;

        emit LiquidityRequested(amount, available);
        return available;
    }

    /**
     * @notice Deposit swap fees with optional swapper bonus
     * @param amount Fee amount
     * @param swapper Address of the swapper (for bonus tickets)
     */
    function depositSwapFeesWithBonus(uint256 amount, address swapper) external onlyHook {
        accumulatedSwapFees += amount;

        // Award bonus lottery tickets to swapper
        if (swapper != address(0)) {
            uint256 bonusTickets = (amount * swapperBonusBps) / 10000;
            lpTickets[swapper] += bonusTickets;
            emit LotteryTicketsAwarded(swapper, bonusTickets, "SWAPPER_BONUS");
        }

        emit SwapFeesReceived(amount, swapper);
    }

    /**
     * @notice Deposit swap fees (backward compatibility)
     * @param amount Fee amount
     */
    function depositSwapFees(uint256 amount) external onlyHook {
        // Call internal implementation directly instead of external call
        accumulatedSwapFees += amount;
        emit SwapFeesReceived(amount, address(0));
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
     * @notice Award prize using enhanced lottery system
     */
    function awardPrize() external nonReentrant whenNotPaused {
        require(block.timestamp >= nextRoundTimestamp, "Round not finished");
        require(depositors.length > 0 || liquidityProviders.length > 0, "No participants");

        uint256 prize = prizePool();
        require(prize > 0, "No prize to award");

        // Enhanced lottery with LP tickets
        uint256 totalTickets = _calculateTotalLotteryTickets();
        require(totalTickets > 0, "No lottery tickets");

        uint256 winningTicket =
            randomnessProvider.randomUint256(bytes32(abi.encodePacked(block.timestamp, totalTickets))) % totalTickets;

        address winner = _findWinnerByTicket(winningTicket);

        // Award prize to winner's balance
        balanceOf[winner] += prize;
        totalPrincipal += prize;

        lastWinner = winner;
        lastPrizeAmount = prize;
        nextRoundTimestamp = block.timestamp + roundDuration;
        accumulatedSwapFees = 0;

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

            // Deposit excess via adapter
            IERC20(ASSET).approve(address(LENDING_ADAPTER), excess);
            uint256 shares = LENDING_ADAPTER.deposit(excess);
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
        delete lpTickets[provider];
    }

    /**
     * @dev Calculate total lottery tickets across all participants
     */
    function _calculateTotalLotteryTickets() internal view returns (uint256 total) {
        // Depositors get 1 ticket per deposited token
        total += totalPrincipal;

        // LPs get bonus tickets
        for (uint256 i = 0; i < liquidityProviders.length; i++) {
            total += lpTickets[liquidityProviders[i]];
        }

        return total;
    }

    /**
     * @dev Find winner by ticket number
     */
    function _findWinnerByTicket(uint256 winningTicket) internal view returns (address winner) {
        uint256 currentTicket = 0;

        // Check depositors first
        for (uint256 i = 0; i < depositors.length; i++) {
            currentTicket += balanceOf[depositors[i]];
            if (winningTicket < currentTicket) {
                return depositors[i];
            }
        }

        // Check LPs
        for (uint256 i = 0; i < liquidityProviders.length; i++) {
            currentTicket += lpTickets[liquidityProviders[i]];
            if (winningTicket < currentTicket) {
                return liquidityProviders[i];
            }
        }

        // Fallback
        return depositors.length > 0 ? depositors[0] : liquidityProviders[0];
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
        uint256 adapterAssets = vaultShares > 0 ? LENDING_ADAPTER.convertToAssets(vaultShares) : 0;
        return adapterAssets + IERC20(ASSET).balanceOf(address(this));
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

    /**
     * @notice Get lottery tickets for an address
     */
    function getLotteryTickets(address user) external view returns (uint256 depositorTickets, uint256 lpTicketsCount) {
        depositorTickets = balanceOf[user];
        lpTicketsCount = lpTickets[user];
    }

    /**
     * @notice Get total lottery tickets in system
     */
    function getTotalLotteryTickets() external view returns (uint256) {
        return _calculateTotalLotteryTickets();
    }

    // Backward compatibility - VAULT variable provides this functionality

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
     * @notice Set randomness provider
     */
    function setRandomnessProvider(address _provider) external onlyOwner {
        require(_provider != address(0), "Invalid provider");
        randomnessProvider = IRandomnessProvider(_provider);
        emit RandomnessProviderUpdated(_provider);
    }

    /**
     * @notice Set LP bonus percentage
     */
    function setLpBonusBps(uint256 _bps) external onlyOwner {
        require(_bps <= 2000, "Bonus too high"); // Max 20%
        lpBonusBps = _bps;
    }

    /**
     * @notice Set LP lottery multiplier
     */
    function setLpLotteryMultiplier(uint256 _multiplier) external onlyOwner {
        require(_multiplier <= 1000, "Multiplier too high"); // Max 10x
        lpLotteryMultiplier = _multiplier;
    }

    /**
     * @notice Set swapper bonus
     */
    function setSwapperBonusBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Bonus too high"); // Max 10%
        swapperBonusBps = _bps;
    }

    /**
     * @notice Set round duration
     */
    function setRoundDuration(uint256 _roundDuration) external onlyOwner {
        require(_roundDuration > 0, "Duration must be > 0");
        roundDuration = _roundDuration;
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
