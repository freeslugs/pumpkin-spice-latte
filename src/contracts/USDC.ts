import { CONTRACTS } from './PumpkinSpiceLatte';

// Use the USDC address from the main contract configuration; default to Flare testnet
export const usdcAddress = CONTRACTS[114].usdc ?? CONTRACTS[11155111].usdc ?? CONTRACTS[1].usdc;

// Minimal ERC-20 ABI needed for approve/allowance/transferFrom/balanceOf/decimals
export const usdcAbi = [
	{
		constant: true,
		inputs: [
			{ name: 'owner', type: 'address' },
			{ name: 'spender', type: 'address' }
		],
		name: 'allowance',
		outputs: [ { name: '', type: 'uint256' } ],
		payable: false,
		stateMutability: 'view',
		type: 'function'
	},
	{
		constant: false,
		inputs: [ { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' } ],
		name: 'approve',
		outputs: [ { name: '', type: 'bool' } ],
		payable: false,
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		constant: false,
		inputs: [ { name: 'sender', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' } ],
		name: 'transferFrom',
		outputs: [ { name: '', type: 'bool' } ],
		payable: false,
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		constant: true,
		inputs: [ { name: 'account', type: 'address' } ],
		name: 'balanceOf',
		outputs: [ { name: '', type: 'uint256' } ],
		payable: false,
		stateMutability: 'view',
		type: 'function'
	},
	{
		constant: true,
		inputs: [],
		name: 'decimals',
		outputs: [ { name: '', type: 'uint8' } ],
		payable: false,
		stateMutability: 'view',
		type: 'function'
	}
] as const;


