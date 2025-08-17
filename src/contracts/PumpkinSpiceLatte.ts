// Network-based contract configuration
export const CONTRACTS = {
  747474: { // Katana mainnet
    pumpkinSpiceLatte: '0x2EbDa1531485462F236B4189C2b213008Ec6B5C0', 
    usdc: '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36'
  },
  11155111: { // Sepolia testnet
    pumpkinSpiceLatte: '0x3cb0f6582683204d013c1bab52067ce351aa3bef',
    usdc: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8'
  },
  1: { // Ethereum mainnet (Tenderly VNet)
    // Fresh deploy from your run: PSL
    pumpkinSpiceLatte: '0x057992Ef2b383cFe6b0a2E4df54234B845ec9720',
    // Use canonical mainnet USDC on the fork
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  },
  114: { // Flare testnet (Coston2)
    // Deployed PSL + underlying from Kinetic market
    pumpkinSpiceLatte: '0xf94d594A61358761FAcDCe77E5Ff4303dad12a49',
    usdc: '0xCe987892D5AD2990b8279e8F76530CfF72977666'
  }
} as const;

// Default to Flare testnet (Coston2) as primary; fallback to Sepolia, then Tenderly mainnet
export const pumpkinSpiceLatteAddress =
  CONTRACTS[114].pumpkinSpiceLatte || CONTRACTS[747474].pumpkinSpiceLatte || CONTRACTS[11155111].pumpkinSpiceLatte || CONTRACTS[1].pumpkinSpiceLatte;

export const pumpkinSpiceLatteAbi = [
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'Deposited',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'winner', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'PrizeAwarded',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'caller', type: 'address' }
    ],
    name: 'PrizeNotAwarded',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'Withdrawn',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'uint256', name: 'oldDuration', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'newDuration', type: 'uint256' }
    ],
    name: 'RoundDurationUpdated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'newProvider', type: 'address' }
    ],
    name: 'RandomnessProviderUpdated',
    type: 'event'
  },
  // Read Functions
  { inputs: [], name: 'ASSET', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'vault', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: '', type: 'address' }], name: 'balanceOf', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], name: 'depositors', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'lastPrizeAmount', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'lastWinner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'nextRoundTimestamp', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'numberOfDepositors', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'prizePool', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'roundDuration', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalAssets', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalPrincipal', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'vaultShares', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  // New probability/threshold views
  { inputs: [], name: 'currentWinProbability', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'currentWinThreshold', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'currentEffectiveHalfLife', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  // Write Functions
  { inputs: [], name: 'awardPrize', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }], name: 'deposit', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }], name: 'withdraw', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: '_roundDuration', type: 'uint256' }], name: 'setRoundDuration', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: '_provider', type: 'address' }], name: 'setRandomnessProvider', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'renounceOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }], name: 'transferOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' }
] as const;
