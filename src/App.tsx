import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import NotFound from "./pages/NotFound";
import PSLHome from "./pages/PSLHome";
import { CONTRACTS } from "@/contracts/PumpkinSpiceLatte";

const NetworkIndicator = () => {
  const { chain, isConnected } = useAccount();
  
  if (!isConnected) return null;
  
  const isSupportedNetwork = chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  
  return (
    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
      isSupportedNetwork 
        ? 'bg-green-100 text-green-800 border border-green-200' 
        : 'bg-amber-100 text-amber-800 border border-amber-200'
    }`}>
      {chain?.name || 'Unknown Network'}
      {!isSupportedNetwork && ' (Unsupported)'}
    </div>
  );
};

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <div className="flex-1 flex flex-col">
            <header className="flex justify-between items-center p-4 border-b">
              <NetworkIndicator />
              <ConnectButton />
            </header>
            <main className="flex-1 p-6 bg-background">
              <Routes>
                <Route path="/" element={<PSLHome />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;

