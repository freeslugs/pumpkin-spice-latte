import React from 'react';
import { useReadContract, useAccount } from 'wagmi';
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from '../contracts/PumpkinSpiceLatte';
import { formatUnits } from 'viem';
import { ArrowLeft, Ticket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Tickets = () => {
  const navigate = useNavigate();
  const { isConnected, chain, address } = useAccount();

  // Check if we're on a supported network
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const targetChainId = isSupportedNetwork ? chain!.id : 1;
  const contractAddress =
    CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ??
    pumpkinSpiceLatteAddress;

  const { data: userBalanceData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'balanceOf',
    chainId: targetChainId,
    args: [address as `0x${string}`],
    query: {
      refetchInterval: 30000,
      enabled: isConnected && !!address,
    },
  });

  const userBalance = userBalanceData
    ? parseFloat(formatUnits(userBalanceData as bigint, 6))
    : 0;

  return (
    <div className='p-4 space-y-6'>
      {/* Header */}
      <div className='flex items-center bg-white pb-2 justify-between'>
        <button
          onClick={() => navigate(-1)}
          className='text-[#181411] flex size-12 shrink-0 items-center'
        >
          <ArrowLeft className='w-6 h-6' />
        </button>
        <h2 className='text-[#181411] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12'>
          My Tickets
        </h2>
      </div>

      {/* Ticket Balance */}
      <div className='flex flex-col gap-2 rounded-lg p-6 bg-[#f5f2f0]'>
        <div className='flex items-center gap-3'>
          <Ticket className='w-8 h-8 text-orange-600' />
          <div>
            <p className='text-[#181411] text-base font-medium leading-normal'>
              Your Ticket Balance
            </p>
            <p className='text-[#181411] tracking-light text-2xl font-bold leading-tight'>
              {userBalance.toLocaleString()} USDC
            </p>
          </div>
        </div>
      </div>

      {/* Ticket Information */}
      <div className='space-y-3'>
        <h3 className='text-lg font-semibold text-[#181411]'>How it works</h3>
        <div className='space-y-3'>
          <div className='p-4 rounded-lg border border-[#f5f2f0]'>
            <p className='text-sm text-[#181411]'>
              Each USDC you deposit gives you 1 ticket in the weekly lottery.
              The more you deposit, the higher your chances of winning!
            </p>
          </div>

          <div className='p-4 rounded-lg border border-[#f5f2f0]'>
            <p className='text-sm text-[#181411]'>
              Your principal is always safe and can be withdrawn at any time.
              Only the generated yield goes to the prize pool.
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
  );
};

export default Tickets;
