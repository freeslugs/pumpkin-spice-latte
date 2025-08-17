import React from 'react';
import { useReadContract, useAccount } from 'wagmi';
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from '../contracts/PumpkinSpiceLatte';
import { formatUnits } from 'viem';
import { Card, CardContent } from '../components/ui/card';

const Pool = () => {
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

  const totalAssets = totalAssetsData
    ? parseFloat(formatUnits(totalAssetsData as bigint, 6))
    : 0;
  const prizePool = prizePoolData
    ? parseFloat(formatUnits(prizePoolData as bigint, 6))
    : 0;
  const totalPrincipal = totalPrincipalData
    ? parseFloat(formatUnits(totalPrincipalData as bigint, 6))
    : 0;

  return (
    <div className='p-4 space-y-6'>
      {/* Pool Statistics */}
      <div className='space-y-4'>
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
          <div className='bg-white p-6 rounded-xl border border-[#f5f2f0] text-center'>
            <div className='text-3xl mb-3'>💰</div>
            <p className='text-sm text-muted-foreground mb-1'>Total Assets</p>
            <p className='text-2xl font-bold'>{totalAssets} USDC</p>
          </div>

          <div className='bg-white p-6 rounded-xl border border-[#f5f2f0] text-center'>
            <div className='text-3xl mb-3'>🏆</div>
            <p className='text-sm text-muted-foreground mb-1'>Prize Pool</p>
            <p className='text-2xl font-bold'>{prizePool} USDC</p>
          </div>

          <div className='bg-white p-6 rounded-xl border border-[#f5f2f0] text-center'>
            <div className='text-3xl mb-3'>👑</div>
            <p className='text-sm text-muted-foreground mb-1'>
              Total Principal
            </p>
            <p className='text-2xl font-bold'>{totalPrincipal} USDC</p>
          </div>
        </div>
      </div>

      {/* Network Status */}
      {!isSupportedNetwork && (
        <div className='bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg'>
          <div className='flex items-center gap-2'>
            <span className='text-lg'>⚠️</span>
            <span className='font-medium'>Network not supported</span>
          </div>
          <p className='text-sm mt-1'>
            Please switch to a supported network to view pool information.
          </p>
        </div>
      )}
    </div>
  );
};

export default Pool;
