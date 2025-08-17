import React from 'react';
import { useReadContract, useAccount } from 'wagmi';
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from '../contracts/PumpkinSpiceLatte';
import { formatUnits } from 'viem';
import { AlertCircle } from 'lucide-react';
import Winners from '../components/Winners';
import { useIsMobile } from '../hooks/use-mobile';

const History = () => {
  const { isConnected, chain, address } = useAccount();
  const isMobile = useIsMobile();

  // Check if we're on a supported network
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const targetChainId = isSupportedNetwork ? chain!.id : 114; // Default to Coston2
  const contractAddress =
    CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ??
    pumpkinSpiceLatteAddress;

  const { data: userBalanceData, isError: balanceError } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'balanceOf',
    chainId: targetChainId,
    args: [address as `0x${string}`],
    query: {
      refetchInterval: 30000,
      enabled:
        isConnected &&
        !!address &&
        contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  const userBalance = userBalanceData
    ? parseFloat(formatUnits(userBalanceData as bigint, 6))
    : 0;

  const isContractDeployed =
    contractAddress !== '0x0000000000000000000000000000000000000000';

  return (
    <div className={`p-4 space-y-6 ${isMobile ? '' : 'max-w-6xl mx-auto'}`}>
      {/* Page Header */}
      <div className='text-center'>
        <h1
          className={`font-bold text-foreground ${
            isMobile ? 'text-3xl' : 'text-4xl'
          }`}
        >
          📜 Lottery History
        </h1>
        <p className='text-muted-foreground mt-2'>
          Track your tickets and view historical winners
        </p>
      </div>

      {/* Network Status */}
      {isConnected && !isSupportedNetwork && (
        <div className='p-4 rounded-lg border bg-amber-50 border-amber-200 text-amber-800'>
          <div className='flex items-center gap-3'>
            <AlertCircle className='h-5 w-5 text-amber-600' />
            <div>
              <p className='font-medium'>Network not supported</p>
              <p className='text-sm'>Please switch to Coston2 network</p>
            </div>
          </div>
        </div>
      )}

      {/* Contract Not Deployed Warning */}
      {isConnected && !isContractDeployed && (
        <div className='p-4 rounded-lg border bg-blue-50 border-blue-200 text-blue-800'>
          <div className='flex items-center gap-3'>
            <AlertCircle className='h-5 w-5 text-blue-600' />
            <div>
              <p className='font-medium'>Contract not deployed yet</p>
              <p className='text-sm'>
                The Pumpkin Spice Latte contract will be available soon on
                Coston2
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
        {/* Ticket Balance - Left Column on Desktop */}
        <div className={`${isMobile ? '' : 'col-span-1'}`}>
          <div className='flex flex-col gap-2 rounded-lg p-6 bg-[#f5f2f0]'>
            <div className='flex items-center gap-3'>
              <span className='text-2xl'>🎫</span>
              <div>
                <p className='text-[#181411] text-base font-medium leading-normal'>
                  Your Ticket Balance
                </p>
                <p className='text-[#181411] tracking-light text-2xl font-bold leading-tight'>
                  {isContractDeployed && !balanceError
                    ? userBalance.toLocaleString()
                    : '0'}{' '}
                  USDC
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works - Right Columns on Desktop */}
        <div className={`${isMobile ? '' : 'col-span-2'}`}>
          <div className='space-y-3'>
            <h3 className='text-lg font-semibold text-[#181411]'>
              How it works
            </h3>
            <div className='space-y-3'>
              <div className='p-4 rounded-lg border border-[#f5f2f0]'>
                <p className='text-sm text-[#181411]'>
                  Each USDC you deposit gives you 1 ticket in the weekly
                  lottery. The more you deposit, the higher your chances of
                  winning!
                </p>
              </div>

              <div className='p-4 rounded-lg border border-[#f5f2f0]'>
                <p className='text-sm text-[#181411]'>
                  Your principal is always safe and can be withdrawn at any
                  time. Only the generated yield goes to the prize pool.
                </p>
              </div>

              <div className='p-4 rounded-lg border border-[#f5f2f0]'>
                <p className='text-sm text-[#181411]'>
                  Winners are selected randomly every week. The more tickets you
                  have, the better your odds!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Winners History - Full Width */}
      <Winners />
    </div>
  );
};

export default History;
