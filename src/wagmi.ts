import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { injected, walletConnect, metaMask, coinbaseWallet } from 'wagmi/connectors';

// Coston2 (Flare testnet) configuration
const coston2 = {
  id: 114,
  name: 'Coston2',
  network: 'coston2',
  nativeCurrency: {
    decimals: 18,
    name: 'CFLR',
    symbol: 'CFLR',
  },
  rpcUrls: {
    public: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
    default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
  },
  blockExplorers: {
    etherscan: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' },
    default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' },
  },
} as const;

// Use a working WalletConnect project ID for mobile support
const WC_ID = 'c4f79cc821944d9680842e34466bfbd9'; // Public demo project ID

export const config = getDefaultConfig({
  appName: 'Pumpkin Spice Latte',
  projectId: WC_ID,
  chains: [coston2],
  transports: {
    [coston2.id]: http(coston2.rpcUrls.default.http[0]),
  },
  ssr: false,
});