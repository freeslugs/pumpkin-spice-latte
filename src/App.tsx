import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import NotFound from './pages/NotFound';
import PSLHome from './pages/PSLHome';
import Pool from './pages/Pool';
import History from './pages/History';
import Profile from './pages/Profile';
import { CONTRACTS } from '@/contracts/PumpkinSpiceLatte';
import { Coffee } from 'lucide-react';

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
  const location = window.location.pathname;

  return (
    <div className='fixed bottom-0 left-0 right-0 bg-white border-t border-[#f5f2f0] px-4 pb-3 pt-2 z-50'>
      <div className='flex gap-2'>
        <Link
          to='/'
          className={`flex flex-1 flex-col items-center justify-end gap-1 ${
            location === '/' ? 'text-[#181411]' : 'text-[#8a7360]'
          }`}
        >
          <div
            className={`flex h-8 items-center justify-center ${
              location === '/' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            <span className='text-2xl'>💰</span>
          </div>
          <p
            className={`text-xs font-medium leading-normal tracking-[0.015em] ${
              location === '/' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            Account
          </p>
        </Link>

        <Link
          to='/pool'
          className={`flex flex-1 flex-col items-center justify-end gap-1 ${
            location === '/pool' ? 'text-[#181411]' : 'text-[#8a7360]'
          }`}
        >
          <div
            className={`flex h-8 items-center justify-center ${
              location === '/pool' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            <span className='text-2xl'>🎃</span>
          </div>
          <p
            className={`text-xs font-medium leading-normal tracking-[0.015em] ${
              location === '/pool' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            Pool
          </p>
        </Link>

        <Link
          to='/history'
          className={`flex flex-1 flex-col items-center justify-end gap-1 ${
            location === '/history' ? 'text-[#181411]' : 'text-[#8a7360]'
          }`}
        >
          <div
            className={`flex h-8 items-center justify-center ${
              location === '/history' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            <span className='text-2xl'>📜</span>
          </div>
          <p
            className={`text-xs font-medium leading-normal tracking-[0.015em] ${
              location === '/history' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            History
          </p>
        </Link>

        <Link
          to='/profile'
          className={`flex flex-1 flex-col items-center justify-end gap-1 ${
            location === '/profile' ? 'text-[#181411]' : 'text-[#8a7360]'
          }`}
        >
          <div
            className={`flex h-8 items-center justify-center ${
              location === '/profile' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            <span className='text-2xl'>👤</span>
          </div>
          <p
            className={`text-xs font-medium leading-normal tracking-[0.015em] ${
              location === '/profile' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            Profile
          </p>
        </Link>
      </div>
      <div className='h-5 bg-white'></div>
    </div>
  );
};

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <div className='flex min-h-screen w-full flex-col bg-white'>
        <div className='flex-1 flex flex-col'>
          <header className='border-b bg-white'>
            <div className='px-4 py-3'>
              <div className='flex items-center justify-between'>
                <Link to='/' className='flex items-center gap-3'>
                  <span className='text-2xl'>🎃</span>
                  <div>
                    <h1 className='text-lg font-bold bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-400 bg-clip-text text-transparent'>
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
          <main className='flex-1 bg-background pb-24'>
            <Routes>
              <Route path='/' element={<PSLHome />} />
              <Route path='/pool' element={<Pool />} />
              <Route path='/history' element={<History />} />
              <Route path='/profile' element={<Profile />} />
              <Route path='*' element={<NotFound />} />
            </Routes>
          </main>
          <BottomNavigation />
        </div>
      </div>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
