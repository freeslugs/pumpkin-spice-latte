import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains';

const WC_ID = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
const TENDERLY_HTTP = (import.meta as any).env?.VITE_MAINNET_TENDERLY_RPC_HTTP ??
  'https://virtual.mainnet.us-east.rpc.tenderly.co/15cd7478-f127-4d1a-b1e3-68ab95ae2c13';

export const config = WC_ID
  ? getDefaultConfig({
      appName: 'Pumpkin Spice Latte',
      projectId: WC_ID,
      chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
      transports: {
        [mainnet.id]: http(TENDERLY_HTTP),
      },
      ssr: false,
    })
  : createConfig({
      chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
      connectors: [injected({ shimDisconnect: true })],
      transports: {
        [mainnet.id]: http(TENDERLY_HTTP),
      },
      ssr: false,
    });