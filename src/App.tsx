import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import NotFound from './pages/NotFound';
import PSLHome from './pages/PSLHome';
import Pool from './pages/Pool';
import Tickets from './pages/Tickets';
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
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='24px'
              height='24px'
              fill='currentColor'
              viewBox='0 0 256 256'
            >
              <path d='M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z'></path>
            </svg>
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
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='24px'
              height='24px'
              fill='currentColor'
              viewBox='0 0 256 256'
            >
              <path d='M164.47,195.63a8,8,0,0,1-6.7,12.37H10.23a8,8,0,0,1-6.7-12.37,95.83,95.83,0,0,1,47.22-37.71,60,60,0,1,1,66.5,0A95.83,95.83,0,0,1,164.47,195.63Zm87.91-.15a95.87,95.87,0,0,0-47.13-37.56A60,60,0,0,0,144.7,54.59a4,4,0,0,0-1.33,6A75.83,75.83,0,0,1,147,150.53a4,4,0,0,0,1.07,5.53,112.32,112.32,0,0,1,29.85,30.83,23.92,23.92,0,0,1,3.65,16.47,4,4,0,0,0,3.95,4.64h60.3a8,8,0,0,0,7.73-5.93A8.22,8.22,0,0,0,252.38,195.48Z'></path>
            </svg>
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
          to='/tickets'
          className={`flex flex-1 flex-col items-center justify-end gap-1 ${
            location === '/tickets' ? 'text-[#181411]' : 'text-[#8a7360]'
          }`}
        >
          <div
            className={`flex h-8 items-center justify-center ${
              location === '/tickets' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='24px'
              height='24px'
              fill='currentColor'
              viewBox='0 0 256 256'
            >
              <path d='M227.19,104.48A16,16,0,0,0,240,88.81V64a16,16,0,0,0-16-16H32A16,16,0,0,0,16,64V88.81a16,16,0,0,0,12.81,15.67,24,24,0,0,1,0,47A16,16,0,0,0,16,167.19V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V167.19a16,16,0,0,0-12.81-15.67,24,24,0,0,1,0-47ZM32,167.2a40,40,0,0,0,0-78.39V64H88V192H32Zm192,0V192H104V64H224V88.8a40,40,0,0,0,0,78.39Z'></path>
            </svg>
          </div>
          <p
            className={`text-xs font-medium leading-normal tracking-[0.015em] ${
              location === '/tickets' ? 'text-[#181411]' : 'text-[#8a7360]'
            }`}
          >
            Tickets
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
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='24px'
              height='24px'
              fill='currentColor'
              viewBox='0 0 256 256'
            >
              <path d='M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z'></path>
            </svg>
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
                  <div className='w-8 h-8 bg-gradient-to-br from-orange-600 to-amber-500 rounded-full flex items-center justify-center shadow-lg'>
                    <Coffee className='w-4 h-4 text-white' />
                  </div>
                  <div>
                    <h1 className='text-lg font-bold bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent'>
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
              <Route path='/tickets' element={<Tickets />} />
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
