import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { injected, walletConnect, metaMask, coinbaseWallet } from 'wagmi/connectors';
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains';

// Use a working WalletConnect project ID for mobile support
const WC_ID = 'c4f79cc821944d9680842e34466bfbd9'; // Public demo project ID
const TENDERLY_HTTP = (import.meta as { env?: { VITE_MAINNET_TENDERLY_RPC_HTTP?: string } }).env?.VITE_MAINNET_TENDERLY_RPC_HTTP ??
  'https://virtual.mainnet.us-east.rpc.tenderly.co/420b1805-6a91-4b32-b1c2-d37896a360cb';

export const config = getDefaultConfig({
  appName: 'Pumpkin Spice Latte',
  projectId: WC_ID,
  chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
  transports: {
    [mainnet.id]: http(TENDERLY_HTTP, { batch: true, retryCount: 1 }),
    [polygon.id]: http(polygon.rpcUrls.default.http[0]),
    [optimism.id]: http(optimism.rpcUrls.default.http[0]),
    [arbitrum.id]: http(arbitrum.rpcUrls.default.http[0]),
    [base.id]: http(base.rpcUrls.default.http[0]),
    [sepolia.id]: http(sepolia.rpcUrls.default.http[0]),
  },
  ssr: false,
});