import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { injected, walletConnect, metaMask } from 'wagmi/connectors';
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains';

const WC_ID = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
const TENDERLY_HTTP = (import.meta as any).env?.VITE_MAINNET_TENDERLY_RPC_HTTP ??
  'https://virtual.mainnet.us-east.rpc.tenderly.co/420b1805-6a91-4b32-b1c2-d37896a360cb';

export const config = WC_ID
  ? getDefaultConfig({
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
    })
  : createConfig({
      chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
      connectors: [
        injected({ shimDisconnect: true }),
        metaMask({ shimDisconnect: true }),
        // Add WalletConnect as fallback for mobile
        walletConnect({
          projectId: 'c4f79cc821944d9680842e34466bfbd9', // Public demo project ID
          showQrModal: true,
          metadata: {
            name: 'Pumpkin Spice Latte',
            description: 'Prize-linked savings with weekly lottery',
            url: window.location.origin,
            icons: ['https://rainbow.me/rainbow.svg'],
          },
        }),
      ],
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