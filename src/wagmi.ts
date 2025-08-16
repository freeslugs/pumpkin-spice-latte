import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains';

const WC_ID = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
const TENDERLY_HTTP = (import.meta as any).env?.VITE_MAINNET_TENDERLY_RPC_HTTP ??
  'https://virtual.mainnet.us-east.rpc.tenderly.co/599cbccf-89bd-4882-a246-be73f62ceda2';

export const config = WC_ID
  ? getDefaultConfig({
      appName: 'Pumpkin Spice Latte',
      projectId: WC_ID,
      chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
      transports: {
        [mainnet.id]: http(TENDERLY_HTTP),
        [polygon.id]: http(polygon.rpcUrls.default.http[0]),
        [optimism.id]: http(optimism.rpcUrls.default.http[0]),
        [arbitrum.id]: http(arbitrum.rpcUrls.default.http[0]),
        [base.id]: http(base.rpcUrls.default.http[0]),
        [sepolia.id]: http(sepolia.rpcUrls.default.http[0]),
      },
      ssr: false,
    })
  : createConfig({
      chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
      connectors: [injected({ shimDisconnect: true })],
      transports: {
        [mainnet.id]: http(TENDERLY_HTTP),
        [polygon.id]: http(polygon.rpcUrls.default.http[0]),
        [optimism.id]: http(optimism.rpcUrls.default.http[0]),
        [arbitrum.id]: http(arbitrum.rpcUrls.default.http[0]),
        [base.id]: http(base.rpcUrls.default.http[0]),
        [sepolia.id]: http(sepolia.rpcUrls.default.http[0]),
      },
      ssr: false,
    });