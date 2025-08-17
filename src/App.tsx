import React, { useState, useEffect } from 'react';
import { Toaster } from './components/ui/toaster';
import { Toaster as Sonner } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import NotFound from './pages/NotFound';
import PSLHome from './pages/PSLHome';
import Pool from './pages/Pool';
import HistoryPage from './pages/History';
import Profile from './pages/Profile';
import { CONTRACTS } from './contracts/PumpkinSpiceLatte';
import { Coffee, Wallet, BarChart3, History, User } from 'lucide-react';
import PumpkinLoader from './components/PumpkinLoader';
import { useIsMobile } from './hooks/use-mobile';
import PageTransition from './components/PageTransition';

const NetworkIndicator = () => {
  const { chain, isConnected } = useAccount();

  if (!isConnected) return null;

  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];

  return (
    <div
      className={`px-3 py-1 rounded-full text-sm font-medium ${
        isSupportedNetwork
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-amber-100 text-amber-800 border border-amber-200'
      }`}
    >
      {chain?.name || 'Unknown Network'}
      {!isSupportedNetwork && ' (Unsupported)'}
    </div>
  );
};

const BottomNavigation = () => {
  const location = useLocation();

  return (
    <div className='fixed bottom-0 left-0 right-0 bg-background border-t border-[#f5f2f0] px-4 pb-3 pt-2 z-50'>
      <div className='flex gap-2'>
        <Link
          to='/'
          className={`flex flex-1 flex-col items-center justify-end gap-1 ${
            location.pathname === '/' ? 'text-[#181411]' : 'text-[#8a7360]'
          }`}
        >
          <div
            className={`flex h-8 items-center justify-center ${
              location.pathname === '/' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            <Wallet className='w-5 h-5' />
          </div>
          <p
            className={`text-xs font-medium leading-normal tracking-[0.015em] ${
              location.pathname === '/' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            Account
          </p>
        </Link>

        <Link
          to='/pool'
          className={`flex flex-1 flex-col items-center justify-end gap-1 ${
            location.pathname === '/pool' ? 'text-[#181411]' : 'text-[#8a7360]'
          }`}
        >
          <div
            className={`flex h-8 items-center justify-center ${
              location.pathname === '/pool'
                ? 'text-[#181411]'
                : 'text-[#8a7360]'
            }`}
          >
            <BarChart3 className='w-5 h-5' />
          </div>
          <p
            className={`text-xs font-medium leading-normal tracking-[0.015em] ${
              location.pathname === '/pool'
                ? 'text-[#181411]'
                : 'text-[#8a7360]'
            }`}
          >
            Pool
          </p>
        </Link>

        <Link
          to='/history'
          className={`flex flex-1 flex-col items-center justify-end gap-1 ${
            location.pathname === '/history'
              ? 'text-[#181411]'
              : 'text-[#8a7360]'
          }`}
        >
          <div
            className={`flex h-8 items-center justify-end gap-1 ${
              location.pathname === '/history'
                ? 'text-[#181411]'
                : 'text-[#8a7360]'
            }`}
          >
            <History className='w-5 h-5' />
          </div>
          <p
            className={`text-xs font-medium leading-normal tracking-[0.015em] ${
              location.pathname === '/history'
                ? 'text-[#181411]'
                : 'text-[#8a7360]'
            }`}
          >
            History
          </p>
        </Link>

        <Link
          to='/profile'
          className={`flex flex-1 flex-col items-center justify-end gap-1 ${
            location.pathname === '/profile'
              ? 'text-[#181411]'
              : 'text-[#8a7360]'
          }`}
        >
          <div
            className={`flex h-8 items-center justify-center ${
              location.pathname === '/profile'
                ? 'text-[#181411]'
                : 'text-[#8a7360]'
            }`}
          >
            <User className='w-5 h-5' />
          </div>
          <p
            className={`text-xs font-medium leading-normal tracking-[0.015em] ${
              location.pathname === '/profile'
                ? 'text-[#181411]'
                : 'text-[#8a7360]'
            }`}
          >
            Profile
          </p>
        </Link>
      </div>
    </div>
  );
};

const DesktopSidebar = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Account', icon: Wallet },
    { path: '/pool', label: 'Pool', icon: BarChart3 },
    { path: '/history', label: 'History', icon: History },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className='w-64 bg-background border-r border-[#f5f2f0] min-h-screen p-6'>
      {/* Logo */}
      <div className='mb-8'>
        <Link to='/' className='flex items-center gap-3'>
          <div className='w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg'>
            <Coffee className='w-5 h-5 text-white' />
          </div>
          <div>
            <h1 className='text-xl font-bold text-orange-500 leading-tight'>
              Pumpkin Spice Latte
            </h1>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className='space-y-2'>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-orange-100 text-orange-700 border-r-2 border-orange-500'
                  : 'text-[#8a7360] hover:bg-orange-50 hover:text-[#181411]'
              }`}
            >
              <Icon className='w-5 h-5' />
              <span className='font-medium'>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Network Status */}
      <div className='mt-8'>
        <NetworkIndicator />
      </div>
    </div>
  );
};

const DesktopHeader = () => {
  return (
    <header className='border-b bg-background px-6 py-4'>
      <div className='flex items-center justify-end'>
        <ConnectButton />
      </div>
    </header>
  );
};

const App = () => {
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // This is a placeholder for actual connection check.
        // In a real app, you'd use wagmi's useNetwork() or similar.
        // For now, we'll just set loading to false after a short delay.
        await new Promise((resolve) => setTimeout(resolve, 4000));
        setLoading(false);
      } catch (error) {
        console.error('Failed to check connection:', error);
        setLoading(false);
      }
    };

    checkConnection();
  }, []);

  if (loading) {
    return <PumpkinLoader isLoading={loading} />;
  }

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {isMobile ? (
          // Mobile Layout
          <div className='flex min-h-screen w-full flex-col bg-background'>
            <div className='flex-1 flex flex-col'>
              <header className='border-b bg-background'>
                <div className='px-4 py-3'>
                  <div className='flex items-center justify-between'>
                    <Link to='/' className='flex items-center gap-2'>
                      <div className='w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center shadow-lg'>
                        <Coffee className='w-4 h-4 text-white' />
                      </div>
                      <div>
                        <h1 className='text-lg font-bold text-orange-500 leading-tight'>
                          Pumpkin Spice Latte
                        </h1>
                      </div>
                    </Link>
                    <div className='flex items-center gap-3'>
                      <ConnectButton />
                    </div>
                  </div>
                </div>
              </header>
              <main className='flex-1 bg-background pb-24 relative overflow-hidden'>
                <PageTransition>
                  <Routes>
                    <Route path='/' element={<PSLHome />} />
                    <Route path='/pool' element={<Pool />} />
                    <Route path='/history' element={<HistoryPage />} />
                    <Route path='/profile' element={<Profile />} />
                    <Route path='*' element={<NotFound />} />
                  </Routes>
                </PageTransition>
              </main>
              <BottomNavigation />
            </div>
          </div>
        ) : (
          // Desktop Layout
          <div className='flex min-h-screen bg-background'>
            <DesktopSidebar />
            <div className='flex-1 flex flex-col'>
              <DesktopHeader />
              <main className='flex-1 p-6 overflow-hidden relative'>
                <PageTransition>
                  <Routes>
                    <Route path='/' element={<PSLHome />} />
                    <Route path='/pool' element={<Pool />} />
                    <Route path='/history' element={<HistoryPage />} />
                    <Route path='/profile' element={<Profile />} />
                    <Route path='*' element={<NotFound />} />
                  </Routes>
                </PageTransition>
              </main>
            </div>
          </div>
        )}
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
