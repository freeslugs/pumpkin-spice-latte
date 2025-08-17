import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import '@rainbow-me/rainbowkit/styles.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from './wagmi.ts';

// Debug: Log the config chains for RainbowKit
console.log('Config chains for RainbowKit:', config.chains);

// Add network switching helper for MetaMask
if (typeof window !== 'undefined' && window.ethereum?.isMetaMask) {
  const addFlareTestnet = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x72', // 114 in hex
            chainName: 'Flare Testnet (Coston2)',
            nativeCurrency: {
              name: 'C2FLR',
              symbol: 'C2FLR',
              decimals: 18,
            },
            rpcUrls: ['https://coston2-api.flare.network/ext/C/rpc'],
            blockExplorerUrls: ['https://coston2-explorer.flare.network'],
          },
        ],
      });
      console.log('Flare testnet added to MetaMask');
    } catch (error) {
      console.log('Error adding Flare testnet to MetaMask:', error);
    }
  };

  // Make it available in console for manual use
  console.log(
    'MetaMask detected - you can call addFlareTestnet() in console to add the network'
  );

  // Try to automatically add the network
  addFlareTestnet().catch(console.error);
}

const queryClient = new QueryClient({
  // defaultOptions: {
  //   queries: {
  //     staleTime: 30_000,
  //     refetchOnWindowFocus: false,
  //     refetchOnReconnect: true,
  //     retry: 1,
  //   },
  // },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <WagmiProvider config={config}>
      <RainbowKitProvider modalSize='compact' showRecentTransactions={true}>
        <App />
      </RainbowKitProvider>
    </WagmiProvider>
  </QueryClientProvider>
);
