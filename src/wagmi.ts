import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Pumpkin Spice Latte',
  projectId: (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
  transports: {
    // Route mainnet traffic through Tenderly Virtual Mainnet by default
    [mainnet.id]: http(
      (import.meta as any).env?.VITE_MAINNET_TENDERLY_RPC_HTTP ??
        'https://virtual.mainnet.us-east.rpc.tenderly.co/15cd7478-f127-4d1a-b1e3-68ab95ae2c13'
    ),
  },
  ssr: false,
});