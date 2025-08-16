import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import NotFound from "./pages/NotFound";
import PSLHome from "./pages/PSLHome";
import { CONTRACTS } from "@/contracts/PumpkinSpiceLatte";
import { Coffee } from "lucide-react";

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
            <header className="border-b">
              <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                  <Link to="/" className="flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-lg">
                      <Coffee className="w-4 h-4 md:w-6 md:h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        Pumpkin Spice Latte
                      </h1>
                      <p className="text-xs md:text-sm text-muted-foreground hidden md:block">Cozy DeFi Lottery</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    {/* <NetworkIndicator /> */}
                    <ConnectButton />
                  </div>
                </div>
              </div>
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

