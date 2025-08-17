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


// Use a default public WalletConnect project ID so MetaMask and other wallets always render in the modal
const WC_ID = ((import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID ?? 'c4f79cc821944d9680842e34466bfbd9') as string;
// const TENDERLY_HTTP = (import.meta as any).env?.VITE_MAINNET_TENDERLY_RPC_HTTP ??
//   'https://virtual.mainnet.us-east.rpc.tenderly.co/420b1805-6a91-4b32-b1c2-d37896a360cb';

// Katana Mainnet chain definition
export const katana = (() => ({
  id: 747474,
  name: 'Katana',
  network: 'katana',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.katana.network'] },
    public: { http: ['https://rpc.katana.network'] },
  },
  blockExplorers: { default: { name: 'Katana Explorer', url: 'https://explorer.katanarpc.com' } },
})) as unknown as Chain;

// Keep Coston2 for current users; add Katana as primary mainnet
export const coston2 = (() => ({
  id: 114,
  name: 'Flare Testnet (Coston2)',
  network: 'coston2',
  nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
    public: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
  },
  blockExplorers: { default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' } },
})) as unknown as Chain;

// Force MetaMask extension via injected connector; this avoids WalletConnect fallback hangs
export const config = createConfig({
  chains: [katana, coston2],
  connectors: [injected()],
  transports: {
    [747474]: http('https://rpc.katana.network'),
    [114]: http('https://coston2-api.flare.network/ext/C/rpc'),
  },
  ssr: false,
});
