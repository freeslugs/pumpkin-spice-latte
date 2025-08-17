import { Chain, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';

// Define the Flare testnet chain
const flareTestnet: Chain = {
  id: 114,
  name: 'Flare Testnet (Coston2)',
  nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: { 
    default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
    public: { http: ['https://coston2-api.flare.network/ext/C/rpc'] }
  },
  blockExplorers: { 
    default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' },
    etherscan: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' }
  },
};

// Use getDefaultConfig as recommended by RainbowKit v2
export const config = getDefaultConfig({
  appName: 'Pumpkin Spice Latte',
  projectId: 'c4f79cc821944d9680842e34466bfbd9', // Public demo project ID
  chains: [flareTestnet],
  transports: {
    [flareTestnet.id]: http('https://coston2-api.flare.network/ext/C/rpc'),
  },
  ssr: false,
});

// Debug: Log the config to see what's being created
console.log('RainbowKit config created:', {
  chains: config.chains,
  connectors: config.connectors
});

// Debug: Log each connector
config.connectors.forEach((connector, index) => {
  console.log(`Connector ${index}:`, connector);
});
