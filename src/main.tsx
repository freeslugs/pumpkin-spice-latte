import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@rainbow-me/rainbowkit/styles.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { config } from "./wagmi.ts";

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

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <WagmiProvider config={config}>
      <RainbowKitProvider>
        <App />
      </RainbowKitProvider>
    </WagmiProvider>
  </QueryClientProvider>
);

