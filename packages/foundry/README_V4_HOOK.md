# PumpkinSpiceLatte Uniswap V4 Hook

This document describes the Uniswap V4 hook integration for the PumpkinSpiceLatte project, which bridges DeFi trading with prize-linked savings.

## Overview

The `PumpkinSpiceLatteV4Hook` is a Uniswap V4 hook that captures swap fees from Uniswap V4 pools and funnels them into the PumpkinSpiceLatte prize pool. This creates a unique synergy between DeFi trading and prize-linked savings, where:

- **Liquidity providers** are automatically tracked and can receive bonus rewards
- **Swap fees** are accumulated and distributed to the PumpkinSpiceLatte contract
- **Prize pools** are enhanced by trading activity across multiple pools

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Uniswap V4    │    │  PumpkinSpice    │    │   PumpkinSpice      │
│     Pools       │───▶│  LatteV4Hook     │───▶│     Latte PLSA      │
│                 │    │                  │    │                     │
│ • ETH/USDC      │    │ • Fee Capture    │    │ • Prize Distribution│
│ • USDC/DAI      │    │ • LP Tracking    │    │ • Yield Generation   │
│ • WETH/USDC     │    │ • Round Mgmt     │    │ • Random Winners    │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

## Key Features

### 1. Fee Capture & Distribution
- **80%** of captured fees go to the PumpkinSpiceLatte prize pool
- **20%** of captured fees are distributed as bonuses to liquidity providers
- Automatic fee calculation based on pool fee tiers (0.01%, 0.05%, 0.3%, 1%)

### 2. Liquidity Provider Tracking
- Tracks all liquidity providers across multiple pools
- Maintains proportional liquidity shares for fair bonus distribution
- Automatic cleanup when providers remove all liquidity

### 3. Round-Based Management
- Configurable round duration (default: 1 week)
- Automatic fee distribution at round completion
- Manual fee deposit option for flexibility

### 4. Multi-Pool Support
- Works with any Uniswap V4 pool that uses this hook
- Aggregates fees across all connected pools
- Pool-specific fee tracking and reporting

## Smart Contracts

### PumpkinSpiceLatteV4Hook.sol
The main hook contract that integrates with Uniswap V4.

**Key Functions:**
- `_afterSwap()` - Captures fees from swaps
- `_afterAddLiquidity()` - Tracks new liquidity providers
- `_afterRemoveLiquidity()` - Updates liquidity provider tracking
- `completeRound()` - Distributes accumulated fees
- `depositFeesToPLSA()` - Manual fee deposit

### PumpkinSpiceLatte.sol
The existing PLSA contract that receives fees and manages prize distribution.

## Deployment

### Prerequisites
1. Deployed PumpkinSpiceLatte contract
2. Uniswap V4 Pool Manager address
3. Environment variables set up

### Environment Variables
```bash
# Required
PRIVATE_KEY=<your_private_key>
POOL_MANAGER_ADDRESS=<uniswap_v4_pool_manager_address>
PUMPKIN_SPICE_LATTE_ADDRESS=<deployed_psl_address>

# Optional (for verification)
ETHERSCAN_API_KEY=<your_etherscan_key>
```

### Deployment Commands

#### Standard Deployment
```bash
forge script script/DeployPumpkinSpiceLatteV4Hook.s.sol:DeployPumpkinSpiceLatteV4Hook \
  --rpc-url <your_rpc_url> \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

#### Custom Parameters Deployment
```bash
forge script script/DeployPumpkinSpiceLatteV4Hook.s.sol:DeployPumpkinSpiceLatteV4Hook \
  --sig "runWithCustomParams(address,address,uint256,uint256)" \
  --rpc-url <your_rpc_url> \
  --private-key $PRIVATE_KEY \
  --broadcast \
  <pool_manager_address> \
  <psl_address> \
  <round_duration_seconds> \
  <bonus_bps>
```

### Network-Specific Deployment

#### Sepolia Testnet
```bash
forge script script/DeployPumpkinSpiceLatteV4Hook.s.sol:DeployPumpkinSpiceLatteV4Hook \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

#### Tenderly Virtual Mainnet
```bash
forge script script/DeployPumpkinSpiceLatteV4Hook.s.sol:DeployPumpkinSpiceLatteV4Hook \
  --rpc-url https://virtual.mainnet.us-east.rpc.tenderly.co/15cd7478-f127-4d1a-b1e3-68ab95ae2c13 \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Usage

### 1. Pool Creation with Hook
When creating a Uniswap V4 pool, specify the hook address:

```solidity
PoolKey memory key = PoolKey({
    currency0: Currency.wrap(address(token0)),
    currency1: Currency.wrap(address(token1)),
    fee: 3000, // 0.3%
    tickSpacing: 60,
    hooks: address(pumpkinSpiceLatteHook) // Hook address
});
```

### 2. Fee Distribution
Fees are automatically captured and can be distributed in two ways:

#### Automatic Round Completion
```solidity
// Call after round duration has passed
hook.completeRound();
```

#### Manual Deposit
```solidity
// Call anytime to deposit accumulated fees
hook.depositFeesToPLSA();
```

### 3. Monitoring
```solidity
// Check accumulated fees
uint256 fees = hook.getAccumulatedFees();

// Check time until next round
uint256 timeLeft = hook.timeUntilNextRound();

// Get liquidity provider count
uint256 providerCount = hook.numberOfLiquidityProviders();
```

## Testing

### Run All Tests
```bash
forge test
```

### Run Hook-Specific Tests
```bash
forge test --match-contract PumpkinSpiceLatteV4HookTest
```

### Test Coverage
```bash
forge coverage --report lcov
```

## Configuration

### Fee Distribution
- **PLSA Fee BPS**: 8000 (80%) - Fixed in contract
- **Liquidity Provider Bonus BPS**: 2000 (20%) - Configurable

### Round Duration
- **Default**: 1 week
- **Minimum**: 1 hour
- **Configurable**: Via `setRoundDuration()`

### Hook Permissions
The hook implements the following Uniswap V4 hook permissions:
- ✅ `beforeAddLiquidity`
- ✅ `afterAddLiquidity`
- ✅ `beforeRemoveLiquidity`
- ✅ `afterRemoveLiquidity`
- ✅ `afterSwap`
- ❌ `beforeInitialize`
- ❌ `afterInitialize`
- ❌ `beforeSwap`
- ❌ `beforeDonate`
- ❌ `afterDonate`

## Security Considerations

### Access Control
- Admin functions should be protected with proper access control
- Consider using OpenZeppelin's `Ownable` or `AccessControl`

### Fee Calculation
- Current implementation uses simplified fee calculation
- In production, implement more sophisticated fee tracking

### Randomness
- Prize selection uses `block.prevrandao` (not secure for production)
- Consider using VRF (Chainlink) for secure randomness

### Reentrancy
- Hook functions are called by the Pool Manager
- Ensure no external calls in critical functions

## Integration Examples

### Frontend Integration
```typescript
// Get hook data
const hookData = await hook.getAccumulatedFees();
const timeLeft = await hook.timeUntilNextRound();
const providers = await hook.getLiquidityProviders();

// Complete round
const tx = await hook.completeRound();
await tx.wait();
```

### Pool Integration
```solidity
// Create pool with hook
IPoolManager poolManager = IPoolManager(poolManagerAddress);
PoolKey memory key = PoolKey({
    currency0: Currency.wrap(address(usdc)),
    currency1: Currency.wrap(address(weth)),
    fee: 3000,
    tickSpacing: 60,
    hooks: address(hook)
});

poolManager.initialize(key, sqrtPriceX96, "");
```

## Monitoring & Analytics

### Key Metrics to Track
1. **Total Fees Accumulated**: `hook.getAccumulatedFees()`
2. **Liquidity Provider Count**: `hook.numberOfLiquidityProviders()`
3. **Round Progress**: `hook.timeUntilNextRound()`
4. **Pool-Specific Fees**: `hook.poolFees(poolId)`

### Events to Monitor
- `FeesAccumulated` - When fees are captured from swaps
- `FeesDepositedToPLSA` - When fees are sent to PLSA contract
- `LiquidityProviderBonus` - When bonuses are distributed
- `RoundCompleted` - When a round is completed

## Troubleshooting

### Common Issues

1. **Hook Not Called**
   - Verify hook address in pool key
   - Check hook permissions
   - Ensure pool manager is correct

2. **Fees Not Accumulating**
   - Check pool fee tier
   - Verify swap parameters
   - Ensure hook has sufficient token balance

3. **Round Not Completing**
   - Check round duration
   - Verify timestamp conditions
   - Ensure fees are accumulated

### Debug Commands
```bash
# Check hook state
cast call <hook_address> "getAccumulatedFees()"

# Check pool fees
cast call <hook_address> "poolFees(bytes32)" <pool_id>

# Check liquidity providers
cast call <hook_address> "numberOfLiquidityProviders()"
```

## Future Enhancements

### Planned Features
1. **Multi-Token Support**: Support for different fee tokens
2. **Dynamic Fee Distribution**: Configurable fee splits
3. **Advanced LP Rewards**: Staking-based bonus system
4. **Governance Integration**: DAO-controlled parameters

### Potential Improvements
1. **Gas Optimization**: More efficient fee calculations
2. **Batch Operations**: Multi-pool fee distribution
3. **Analytics Dashboard**: Real-time fee tracking
4. **Mobile Integration**: Hook status in mobile apps

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

