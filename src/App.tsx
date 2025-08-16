import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import NotFound from "./pages/NotFound";
import PSLHome from "./pages/PSLHome";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <div className="flex-1 flex flex-col">
            <header className="flex justify-end p-4 border-b">
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

