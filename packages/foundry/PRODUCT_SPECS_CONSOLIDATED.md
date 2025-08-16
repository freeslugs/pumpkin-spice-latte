# PumpkinSpiceLatte V4 Hook - Consolidated Product Specification

## Overview

PumpkinSpiceLatte V4 Hook is a unified Uniswap V4 hook that combines prize-linked savings account (PLSA) functionality with DeFi trading fee capture. Users get a single contract that provides yield generation, trading fee exposure, and periodic prize distributions through seamless integration between Uniswap V4 pools and Morpho vaults.

## Core Value Proposition

**"One deposit, multiple yield streams, one prize pool"**

Users deposit USDC once and automatically benefit from:
1. **Morpho Vault Yield** - Traditional DeFi lending yield
2. **Uniswap V4 Trading Fees** - Captured from multiple pools
3. **Prize Distribution** - Periodic random winner selection
4. **Liquidity Provider Bonuses** - Extra rewards for PLSA depositors who provide liquidity

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                PumpkinSpiceLatteV4Hook                      │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────┐ │
│  │   Uniswap V4    │    │   Prize-Linked  │    │ Morpho  │ │
│  │   Integration   │    │   Savings Logic │    │ Vault   │ │
│  │                 │    │                 │    │         │ │
│  │ • LP Tracking   │    │ • User deposits │    │ • Yield │ │
│  │ • Fee Capture   │    │ • Prize rounds  │    │ • ERC4626│ │
│  │ • Pool Mgmt     │    │ • Random winners│    │ • USDC  │ │
│  │ • Liquidity Mgmt│    │ • Fee Distribution│   │ • Asset │ │
│  └─────────────────┘    └─────────────────┘    └─────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Unified Deposit System
- **Single Entry Point**: Users deposit USDC once
- **Automatic Allocation**: Funds are deposited into Morpho vault for yield generation
- **Principal Protection**: Users can only withdraw their deposited principal
- **Liquidity Integration**: PLSA depositors who provide Uniswap V4 liquidity get bonuses

### 2. Dual Yield Generation
- **Morpho Vault Yield**: Traditional lending yield (primary source)
- **Uniswap V4 Fees**: Trading fees from multiple pools (secondary source)
- **Combined Prize Pool**: All yield + fees go to the same prize distribution

### 3. Prize Distribution
- **Periodic Rounds**: Configurable duration (e.g., 1 day, 1 week)
- **Random Selection**: Pseudo-random winner selection from all depositors
- **Yield + Fees**: Prize includes both vault yield and trading fees

### 4. Uniswap V4 Integration

#### Hook Permissions and Functions

**`_beforeAddLiquidity`**
- Validates liquidity addition parameters
- Checks if user is a PLSA depositor for bonus eligibility
- Ensures sufficient user balance for the operation

**`_afterAddLiquidity`**
- Tracks liquidity provider and their liquidity amount
- Awards bonus tokens to PLSA depositors who provide liquidity
- Deposits bonus tokens to Morpho vault on user's behalf
- Updates user's PLSA balance with bonus rewards

**`_beforeSwap`**
- Calculates required liquidity for the swap operation
- Checks if contract has sufficient USDC balance
- If needed, withdraws from Morpho vault to fulfill swap requirements
- Validates swap parameters and slippage tolerance

**`_afterSwap`**
- Calculates actual trading fees from the swap
- Distributes fees to PLSA depositors based on their share of total deposits
- Adds remaining fees to the prize pool
- Re-deposits excess liquidity back to Morpho vault
- Handles dual asset scenarios (USDC vs other tokens)

**`_beforeRemoveLiquidity`**
- Validates liquidity removal parameters
- Ensures user has sufficient liquidity to remove
- Checks for any penalties or bonuses for PLSA depositors

**`_afterRemoveLiquidity`**
- Updates liquidity provider tracking
- Removes user from liquidity providers array if they have no liquidity left
- Handles any final bonus distributions

#### Dual Asset Handling
- **Primary Asset**: USDC (handled by PLSA system)
- **Secondary Asset**: Other tokens in Uniswap V4 pools (ETH, WETH, etc.)
- **Asset Conversion**: Secondary assets are converted to USDC for PLSA integration
- **Fee Distribution**: All fees are converted to USDC before distribution

#### Liquidity Management
- **Dynamic Rebalancing**: Contract automatically manages liquidity between Uniswap V4 pools and Morpho vault
- **Target Balance**: Maintains optimal USDC balance for swap operations
- **Vault Integration**: Excess liquidity is automatically deposited to Morpho vault for yield generation

## Technical Specifications

### Contract Interface
```solidity
interface IPumpkinSpiceLatteV4Hook {
    // Core PLSA Functions
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function awardPrize() external;
    
    // View Functions
    function balanceOf(address user) external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function prizePool() external view returns (uint256);
    function nextRoundTimestamp() external view returns (uint256);
    function numberOfLiquidityProviders() external view returns (uint256);
    function getLiquidityProviders() external view returns (address[] memory);
    
    // Uniswap V4 Hook Functions (internal)
    function beforeAddLiquidity(...) external returns (bytes4);
    function afterAddLiquidity(...) external returns (bytes4, BalanceDelta);
    function beforeSwap(...) external returns (bytes4);
    function afterSwap(...) external returns (bytes4, int128);
    function beforeRemoveLiquidity(...) external returns (bytes4);
    function afterRemoveLiquidity(...) external returns (bytes4, BalanceDelta);
}
```

### State Variables
- `ASSET`: USDC token address
- `VAULT`: Morpho vault address (ERC4626-compatible)
- `POOL_MANAGER`: Uniswap V4 pool manager
- `roundDuration`: Prize round duration in seconds
- `totalPrincipal`: Total user deposits (principal only)
- `vaultShares`: Shares in Morpho vault
- `poolFees`: Accumulated fees per pool (PoolId => uint256)
- `currentRoundFees`: Total fees accumulated in current round
- `userLiquidity`: User liquidity tracking (address => uint256)
- `liquidityProviders`: Array of liquidity providers
- `providerIndex`: Mapping for O(1) removal from liquidity providers array
- `liquidityProviderBonusBps`: Bonus percentage for PLSA depositors (basis points)

### Events
- `Deposited(address user, uint256 amount)`
- `Withdrawn(address user, uint256 amount)`
- `PrizeAwarded(address winner, uint256 amount)`
- `FeesAccumulated(PoolId poolId, uint256 fees)`
- `FeesDistributed(address user, uint256 amount)`
- `LiquidityProviderAdded(address user, uint256 liquidity)`
- `LiquidityProviderRemoved(address user, uint256 liquidity)`
- `PLSABonusAwarded(address user, uint256 bonus)`
- `VaultRebalanced(uint256 deposited, uint256 withdrawn)`

## Hook Integration Details

### Fee Distribution Mechanism
1. **Fee Capture**: Trading fees are captured in `_afterSwap`
2. **Fee Calculation**: Based on actual Uniswap V4 fee mechanisms
3. **Distribution**: 80% to prize pool, 20% distributed to PLSA depositors
4. **Conversion**: All fees converted to USDC before distribution

### Liquidity Provider Bonus System
1. **Bonus Eligibility**: Only PLSA depositors who provide liquidity
2. **Bonus Calculation**: `(liquidity * liquidityProviderBonusBps) / 10000`
3. **Bonus Distribution**: Added directly to user's PLSA balance
4. **Vault Integration**: Bonus tokens are deposited to Morpho vault

### Dual Asset Handling
1. **Primary Focus**: USDC (PLSA asset)
2. **Secondary Assets**: Other tokens in pools (ETH, WETH, etc.)
3. **Asset Conversion**: Secondary assets converted to USDC via swaps
4. **Fee Processing**: All fees processed in USDC terms

### Liquidity Management Strategy
1. **Target Balance**: Maintain sufficient USDC for swap operations
2. **Dynamic Withdrawal**: Withdraw from Morpho vault when needed
3. **Automatic Rebalancing**: Re-deposit excess liquidity to vault
4. **Yield Optimization**: Maximize time in yield-generating vault

## User Experience

### For Regular Users (Non-LPs)
1. **Deposit USDC** into the contract
2. **Earn yield** from Morpho vault automatically
3. **Participate in prizes** from trading fees
4. **Withdraw principal** anytime (no loss of principal)

### For Liquidity Providers
1. **Add liquidity** to Uniswap V4 pools (via hook)
2. **Earn trading fees** (normal LP fees + 20% PLSA bonus)
3. **Participate in prizes** from the combined yield pool
4. **Remove liquidity** anytime

### For PLSA + LP Users (Optimal)
1. **Deposit USDC** into PLSA system
2. **Add liquidity** to Uniswap V4 pools
3. **Earn multiple rewards**:
   - Morpho vault yield
   - Trading fees
   - PLSA liquidity provider bonuses
   - Prize pool participation
4. **Maximize returns** through combined yield streams

## Security Considerations

1. **Principal Protection**: Users can only withdraw their deposited amount
2. **Yield Isolation**: Prize pool only contains generated yield, not principal
3. **Access Control**: Only authorized functions can modify state
4. **Reentrancy Protection**: All external calls use reentrancy guards
5. **Slippage Protection**: Liquidity operations include slippage checks
6. **Asset Validation**: Proper validation of USDC vs other assets
7. **Vault Integration**: Secure interaction with Morpho vault
8. **Hook Permissions**: Proper Uniswap V4 hook flag validation

## Deployment Configuration

- **Asset**: USDC (mainnet: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
- **Morpho Vault**: TBD (ERC4626-compatible vault)
- **Round Duration**: 86400 seconds (1 day)
- **Liquidity Provider Bonus**: 2000 basis points (20%)
- **Fee Distribution**: 80% prize pool, 20% to PLSA depositors
- **Supported Networks**: Ethereum mainnet, testnets

## Future Enhancements

1. **Multiple Assets**: Support for different underlying assets
2. **Dynamic Fee Splits**: Configurable fee distribution ratios
3. **Governance**: DAO governance for parameter updates
4. **Cross-Chain**: Multi-chain deployment
5. **Advanced Prizes**: Multiple prize tiers, special events
6. **Advanced Liquidity Management**: Automated strategies for optimal yield
7. **Risk Management**: Dynamic allocation between vault and liquidity based on market conditions
