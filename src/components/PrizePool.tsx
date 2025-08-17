import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Award,
  Clock,
  Wallet,
  PiggyBank,
  Coins,
  AlertCircle,
} from 'lucide-react';
import { useReadContract, useAccount } from 'wagmi';
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from '../contracts/PumpkinSpiceLatte';
import { formatUnits } from 'viem';
import { getAddressExplorerUrl } from '../lib/utils';

// Helper function to format time remaining
const formatTimeRemaining = (timestamp: bigint) => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const secondsRemaining = timestamp - now;

  if (secondsRemaining <= 0n) {
    return 'Next round starting soon!';
  }

  const days = secondsRemaining / 86400n;
  const hours = (secondsRemaining % 86400n) / 3600n;
  const minutes = (secondsRemaining % 3600n) / 60n;
  const seconds = secondsRemaining % 60n;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const PrizePool = () => {
  const { isConnected, chain } = useAccount();

  // Check if we're on a supported network
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const targetChainId = isSupportedNetwork ? chain!.id : 1;
  const contractAddress =
    CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ??
    pumpkinSpiceLatteAddress;

  const {
    data: prizePoolData,
    isError: prizePoolError,
    isLoading: prizePoolLoading,
  } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'prizePool',
    chainId: targetChainId,
    query: {
      refetchInterval: 30000,
      enabled: true,
    },
  });

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

  const { data: nextRoundTimestampData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'nextRoundTimestamp',
    chainId: targetChainId,
    query: {
      refetchInterval: 30000,
      enabled: true,
    },
  });

  const {
    data: lastWinnerData,
    isError: winnerError,
    isLoading: winnerLoading,
  } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'lastWinner',
    chainId: targetChainId,
    query: {
      enabled: true,
    },
  });

  const getPrizePoolDisplay = () => {
    if (prizePoolError) return 'Error loading data';
    if (prizePoolLoading) return 'Loading...';
    if (prizePoolData === undefined) return 'No data';
    return `${formatUnits(prizePoolData as bigint, 6)} USDC`;
  };

  const [nowTick, setNowTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setNowTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const getTimeRemainingDisplay = () => {
    if (nextRoundTimestampData === undefined) return 'No data';
    void nowTick; // trigger re-render each second without new RPC call
    return formatTimeRemaining(nextRoundTimestampData as bigint);
  };

  const getLastWinnerDisplay = () => {
    if (winnerError) return 'Error loading data';
    if (winnerLoading) return 'Loading...';
    if (lastWinnerData === undefined) return 'No data';
    if (lastWinnerData === '0x0000000000000000000000000000000000000000')
      return 'No winner yet';
    return `${(lastWinnerData as string).slice(0, 6)}...${(
      lastWinnerData as string
    ).slice(-4)}`;
  };

  const prizePool = getPrizePoolDisplay();
  const timeRemaining = getTimeRemainingDisplay();
  const lastWinner = getLastWinnerDisplay();

  const totalAssets = totalAssetsData
    ? `${formatUnits(totalAssetsData as bigint, 6)} USDC`
    : '-';
  const totalPrincipal = totalPrincipalData
    ? `${formatUnits(totalPrincipalData as bigint, 6)} USDC`
    : '-';

  const chainId = targetChainId;
  const lastWinnerLink =
    typeof lastWinnerData === 'string' &&
    lastWinnerData !== '0x0000000000000000000000000000000000000000'
      ? getAddressExplorerUrl(chainId, lastWinnerData)
      : undefined;

  return (
    <Card className='border-0 shadow-none bg-transparent'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-xl'>
          <span className='inline-block text-2xl'>🎃</span>
          Prize Pool
        </CardTitle>
        <CardDescription className='text-sm'>
          The winner takes all the yield generated from the deposits.
        </CardDescription>
        {!isSupportedNetwork && isConnected && (
          <div className='flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded'>
            <AlertCircle className='h-4 w-4' />
            Please switch to a supported network to interact with the contract
          </div>
        )}
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Main Stats Grid */}
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 text-center'>
          <div className='bg-[#f5f2f0] rounded-lg p-4'>
            <span className='text-2xl'>🏆</span>
            <p className='text-xs text-muted-foreground mb-1'>Current Prize</p>
            <p className='text-lg font-bold'>{prizePool}</p>
          </div>
          <div className='bg-[#f5f2f0] rounded-lg p-4'>
            <span className='text-2xl'>⏰</span>
            <p className='text-xs text-muted-foreground mb-1'>Time Remaining</p>
            <p className='text-lg font-bold text-sm'>{timeRemaining}</p>
          </div>
          <div className='bg-[#f5f2f0] rounded-lg p-4'>
            <span className='text-2xl'>👑</span>
            <p className='text-xs text-muted-foreground mb-1'>Last Winner</p>
            {lastWinnerLink ? (
              <a
                href={lastWinnerLink}
                target='_blank'
                rel='noreferrer'
                className='text-lg font-bold truncate text-blue-600 hover:underline'
              >
                {lastWinner}
              </a>
            ) : (
              <p className='text-lg font-bold truncate'>{lastWinner}</p>
            )}
          </div>
        </div>

        {/* Additional Stats */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <div className='bg-[#f5f2f0] rounded-lg p-4 text-center'>
            <span className='text-xl'>💰</span>
            <p className='text-xs text-muted-foreground mb-1'>Total Assets</p>
            <p className='text-base font-semibold'>{totalAssets}</p>
          </div>
          <div className='bg-[#f5f2f0] rounded-lg p-4 text-center'>
            <span className='text-xl'>🪙</span>
            <p className='text-xs text-muted-foreground mb-1'>
              Total Principal
            </p>
            <p className='text-base font-semibold'>{totalPrincipal}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrizePool;
