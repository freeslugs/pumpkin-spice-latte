import { Chain, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { injected, walletConnect, metaMask, coinbaseWallet } from 'wagmi/connectors';

// // Coston2 (Flare testnet) configuration
// const coston2 = {
//   id: 114,
//   name: 'Coston2',
//   network: 'coston2',
//   nativeCurrency: {
//     decimals: 18,
//     name: 'CFLR',
//     symbol: 'CFLR',
//   },
//   rpcUrls: {
//     public: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
//     default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
//   },
//   blockExplorers: {
//     etherscan: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' },
//     default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' },
//   },
// } as const;

// // Use a working WalletConnect project ID for mobile support
// const WC_ID = 'c4f79cc821944d9680842e34466bfbd9'; // Public demo project ID

// export const config = getDefaultConfig({
//   appName: 'Pumpkin Spice Latte',
//   projectId: WC_ID,
//   chains: [coston2],
//   transports: {
//     [coston2.id]: http(coston2.rpcUrls.default.http[0]),
//   },
//   ssr: false,
// });


const WC_ID = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
// const TENDERLY_HTTP = (import.meta as any).env?.VITE_MAINNET_TENDERLY_RPC_HTTP ??
//   'https://virtual.mainnet.us-east.rpc.tenderly.co/420b1805-6a91-4b32-b1c2-d37896a360cb';

export const config = WC_ID
  ? getDefaultConfig({
      appName: 'Pumpkin Spice Latte',
      projectId: WC_ID,
      chains: [((): Chain => ({
        id: 114,
        name: 'Flare Testnet (Coston2)',
        nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 },
        rpcUrls: { default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] } },
        blockExplorers: { default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' } },
      }))()],
      transports: {
        // [mainnet.id]: http(TENDERLY_HTTP, { batch: true, retryCount: 1 }),
        // [polygon.id]: http(polygon.rpcUrls.default.http[0]),
        // [optimism.id]: http(optimism.rpcUrls.default.http[0]),
        // [arbitrum.id]: http(arbitrum.rpcUrls.default.http[0]),
        // [base.id]: http(base.rpcUrls.default.http[0]),
        // [sepolia.id]: http(sepolia.rpcUrls.default.http[0]),
        [114]: http('https://coston2-api.flare.network/ext/C/rpc'),
      },
      ssr: false,
    })
  : createConfig({
      chains: [((): Chain => ({
        id: 114,
        name: 'Flare Testnet (Coston2)',
        nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 },
        rpcUrls: { default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] } },
        blockExplorers: { default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' } },
      }))()],
      connectors: [injected({ shimDisconnect: true })],
      transports: {
        // [mainnet.id]: http(TENDERLY_HTTP, { batch: true, retryCount: 1 }),
        // [polygon.id]: http(polygon.rpcUrls.default.http[0]),
        // [optimism.id]: http(optimism.rpcUrls.default.http[0]),
        // [arbitrum.id]: http(arbitrum.rpcUrls.default.http[0]),
        // [base.id]: http(base.rpcUrls.default.http[0]),
        // [sepolia.id]: http(sepolia.rpcUrls.default.http[0]),
        [114]: http('https://coston2-api.flare.network/ext/C/rpc'),
      },
      ssr: false,
    });
