# PumpkinSpiceLatte V4 Hook - Consolidated Product Specification

## Overview

PumpkinSpiceLatte V4 Hook is a unified Uniswap V4 hook that combines prize-linked savings account (PLSA) functionality with DeFi trading fee capture. Users get a single contract that provides yield generation, trading fee exposure, and periodic prize distributions.

## Core Value Proposition

**"One deposit, multiple yield streams, one prize pool"**

Users deposit USDC once and automatically benefit from:
1. **Morpho Vault Yield** - Traditional DeFi lending yield
2. **Uniswap V4 Trading Fees** - Captured from multiple pools
3. **Prize Distribution** - Periodic random winner selection

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
│  └─────────────────┘    └─────────────────┘    └─────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Unified Deposit System
- **Single Entry Point**: Users deposit USDC once
- **Automatic Allocation**: Funds are split between Morpho vault and Uniswap V4 liquidity
- **Principal Protection**: Users can only withdraw their deposited principal

### 2. Dual Yield Generation
- **Morpho Vault Yield**: Traditional lending yield (primary source)
- **Uniswap V4 Fees**: Trading fees from multiple pools (secondary source)
- **Combined Prize Pool**: All yield + fees go to the same prize distribution

### 3. Prize Distribution
- **Periodic Rounds**: Configurable duration (e.g., 1 day, 1 week)
- **Random Selection**: Pseudo-random winner selection from all depositors
- **Yield + Fees**: Prize includes both vault yield and trading fees

### 4. Uniswap V4 Integration
- **Hook Permissions**: 
  - `beforeAddLiquidity`: Track liquidity providers
  - `afterAddLiquidity`: Update user liquidity shares
  - `beforeRemoveLiquidity`: Validate removals
  - `afterRemoveLiquidity`: Update tracking
  - `afterSwap`: Capture and distribute fees
- **Multi-Pool Support**: Works with multiple Uniswap V4 pools
- **Fee Distribution**: 80% to prize pool, 20% to liquidity providers

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
    
    // Uniswap V4 Hook Functions (internal)
    function beforeAddLiquidity(...) external returns (bytes4);
    function afterAddLiquidity(...) external returns (bytes4, BalanceDelta);
    function beforeRemoveLiquidity(...) external returns (bytes4);
    function afterRemoveLiquidity(...) external returns (bytes4, BalanceDelta);
    function afterSwap(...) external returns (bytes4, int128);
}
```

### State Variables
- `ASSET`: USDC token address
- `VAULT`: Morpho vault address
- `POOL_MANAGER`: Uniswap V4 pool manager
- `roundDuration`: Prize round duration
- `totalPrincipal`: Total user deposits
- `vaultShares`: Shares in Morpho vault
- `poolFees`: Accumulated fees per pool
- `userLiquidity`: User liquidity tracking
- `liquidityProviders`: Array of LPs for prize selection

### Events
- `Deposited(address user, uint256 amount)`
- `Withdrawn(address user, uint256 amount)`
- `PrizeAwarded(address winner, uint256 amount)`
- `FeesCaptured(PoolId poolId, uint256 fees)`
- `LiquidityAdded(address user, uint256 liquidity)`
- `LiquidityRemoved(address user, uint256 liquidity)`

## User Experience

### For Regular Users (Non-LPs)
1. **Deposit USDC** into the contract
2. **Earn yield** from Morpho vault automatically
3. **Participate in prizes** from trading fees
4. **Withdraw principal** anytime (no loss of principal)

### For Liquidity Providers
1. **Add liquidity** to Uniswap V4 pools (via hook)
2. **Earn trading fees** (20% bonus on top of normal LP fees)
3. **Participate in prizes** from the combined yield pool
4. **Remove liquidity** anytime

## Security Considerations

1. **Principal Protection**: Users can only withdraw their deposited amount
2. **Yield Isolation**: Prize pool only contains generated yield, not principal
3. **Access Control**: Only authorized functions can modify state
4. **Reentrancy Protection**: All external calls use reentrancy guards
5. **Slippage Protection**: Liquidity operations include slippage checks

## Deployment Configuration

- **Asset**: USDC (mainnet: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
- **Morpho Vault**: TBD (ERC4626-compatible vault)
- **Round Duration**: 86400 seconds (1 day)
- **Fee Split**: 80% prize pool, 20% LP bonuses
- **Supported Networks**: Ethereum mainnet, testnets

## Future Enhancements

1. **Multiple Assets**: Support for different underlying assets
2. **Dynamic Fee Splits**: Configurable fee distribution ratios
3. **Governance**: DAO governance for parameter updates
4. **Cross-Chain**: Multi-chain deployment
5. **Advanced Prizes**: Multiple prize tiers, special events
