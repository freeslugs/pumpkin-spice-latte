import React from 'react';
import { useReadContract, useAccount } from 'wagmi';
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from '../contracts/PumpkinSpiceLatte';
import { formatUnits } from 'viem';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Pool = () => {
  const navigate = useNavigate();
  const { isConnected, chain } = useAccount();

  // Check if we're on a supported network
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const targetChainId = isSupportedNetwork ? chain!.id : 1;
  const contractAddress =
    CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ??
    pumpkinSpiceLatteAddress;

  const { data: totalAssetsData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'totalAssets',
    chainId: targetChainId,
    query: {
      refetchInterval: 30000,
      enabled: true,
    },
  });

  const { data: prizePoolData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'prizePool',
    chainId: targetChainId,
    query: {
      refetchInterval: 30000,
      enabled: true,
    },
  });

  const { data: totalPrincipalData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'totalPrincipal',
    chainId: targetChainId,
    query: {
      refetchInterval: 30000,
      enabled: true,
    },
  });

  // Mock data for number of players (you can replace this with actual contract data)
  const numberOfPlayers = 500;

  const totalDeposits = totalPrincipalData
    ? parseFloat(formatUnits(totalPrincipalData as bigint, 6))
    : 12500;
  const totalPrizeAmount = prizePoolData
    ? parseFloat(formatUnits(prizePoolData as bigint, 6))
    : 2500;

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
          Pool Stats
        </h2>
      </div>

      {/* Pool Stats */}
      <div className='flex flex-wrap gap-4'>
        <div className='flex min-w-[158px] flex-1 flex-col gap-2 rounded-lg p-6 bg-[#f5f2f0]'>
          <p className='text-[#181411] text-base font-medium leading-normal'>
            Total Deposits
          </p>
          <p className='text-[#181411] tracking-light text-2xl font-bold leading-tight'>
            ${totalDeposits.toLocaleString()}
          </p>
        </div>

        <div className='flex min-w-[158px] flex-1 flex-col gap-2 rounded-lg p-6 bg-[#f5f2f0]'>
          <p className='text-[#181411] text-base font-medium leading-normal'>
            Total Prize Amount
          </p>
          <p className='text-[#181411] tracking-light text-2xl font-bold leading-tight'>
            ${totalPrizeAmount.toLocaleString()}
          </p>
        </div>

        <div className='flex min-w-[158px] flex-1 flex-col gap-2 rounded-lg p-6 bg-[#f5f2f0]'>
          <p className='text-[#181411] text-base font-medium leading-normal'>
            Number of Players
          </p>
          <p className='text-[#181411] tracking-light text-2xl font-bold leading-tight'>
            {numberOfPlayers.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pool;
