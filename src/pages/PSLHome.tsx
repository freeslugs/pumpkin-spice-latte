import React from 'react';
import PrizePool from '../components/PrizePool';
import Actions from '../components/Actions';
import UserStats from '../components/UserStats';
import Winners from '../components/Winners';
import { useAccount } from 'wagmi';
import {
  CONTRACTS,
  pumpkinSpiceLatteAddress,
} from '../contracts/PumpkinSpiceLatte';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { getAddressExplorerUrl } from '../lib/utils';

const PSLHome = () => {
  const { chain, isConnected } = useAccount();
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const chainId = chain?.id ?? 1;
  const contractAddress = isSupportedNetwork
    ? CONTRACTS[chain.id as keyof typeof CONTRACTS].pumpkinSpiceLatte
    : pumpkinSpiceLatteAddress;
  const contractExplorerUrl = getAddressExplorerUrl(chainId, contractAddress);

  return (
    <div className='p-4 space-y-6'>
      {/* Header */}
      <div className='text-center space-y-4'>
        <h1 className='text-3xl font-bold bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-400 bg-clip-text text-transparent'>
          Pumpkin Spice Latte ☕️🎃
        </h1>
        <p className='text-base text-muted-foreground max-w-2xl mx-auto'>
          Deposit USDC, brew some yield, and sip the spice of winning the weekly
          prize pool. No loss, just cozy vibes.
        </p>
        <div className='flex justify-center'>
          <a
            href={contractExplorerUrl}
            target='_blank'
            rel='noreferrer'
            className='inline-flex items-center gap-1 text-sm text-blue-600 hover:underline'
          >
            View contract on explorer
            <ExternalLink className='h-3 w-3' />
          </a>
        </div>
      </div>

      {/* Network Status */}
      {isConnected && !isSupportedNetwork && (
        <div className='p-4 rounded-lg border bg-amber-50 border-amber-200 text-amber-800'>
          <div className='flex items-center gap-3'>
            <AlertCircle className='h-5 w-5 text-amber-600' />
            <div>
              <p className='font-medium'>Network not supported</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Mobile First */}
      <div className='space-y-6'>
        <PrizePool />
        <Actions />
        <UserStats />
        <Winners />
      </div>
    </div>
  );
};

export default PSLHome;
