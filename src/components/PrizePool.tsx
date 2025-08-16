import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Clock, Wallet, PiggyBank, Coins, AlertCircle } from 'lucide-react';
import { useReadContract, useAccount } from 'wagmi';
import { pumpkinSpiceLatteAddress, pumpkinSpiceLatteAbi, CONTRACTS } from '@/contracts/PumpkinSpiceLatte';
import { formatUnits } from 'viem';

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
  const isSupportedNetwork = chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const contractAddress = isSupportedNetwork ? CONTRACTS[chain.id as keyof typeof CONTRACTS].pumpkinSpiceLatte : pumpkinSpiceLatteAddress;

  const { data: prizePoolData, isError: prizePoolError, isLoading: prizePoolLoading } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'prizePool',
    query: {
      refetchInterval: 1000, // Refetch every 10 seconds
      enabled: isConnected && !!isSupportedNetwork,
      onSuccess: (data) => {
        try {
          const formatted = typeof data !== 'undefined' ? `${formatUnits(data as bigint, 6)} USDC` : 'undefined';
          // Log both formatted and raw data for debugging/visibility
          // eslint-disable-next-line no-console
          console.log('[PSL] Current Prize (refetched):', { formatted, raw: data });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log('[PSL] Failed to format Current Prize for logging:', e);
        }
      },
      onError: (error) => {
        // eslint-disable-next-line no-console
        console.error('[PSL] Error fetching Current Prize:', error);
      },
    },
  });

  const { data: totalAssetsData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'totalAssets',
    query: {
      refetchInterval: 5000,
      enabled: isConnected && !!isSupportedNetwork,
    },
  });

  const { data: totalPrincipalData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'totalPrincipal',
    query: {
      refetchInterval: 5000,
      enabled: isConnected && !!isSupportedNetwork,
    },
  });

  const { data: nextRoundTimestampData, isError: timestampError, isLoading: timestampLoading } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'nextRoundTimestamp',
    query: {
      refetchInterval: 1000, // Refetch every second for the countdown
      enabled: isConnected && !!isSupportedNetwork,
    },
  });

  const { data: lastWinnerData, isError: winnerError, isLoading: winnerLoading } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'lastWinner',
    query: {
      enabled: isConnected && !!isSupportedNetwork,
    },
  });

  const getPrizePoolDisplay = () => {
    if (!isConnected) return "Connect wallet to view";
    if (!isSupportedNetwork) return "Switch to a supported network";
    if (prizePoolError) return "Error loading data";
    if (prizePoolLoading) return "Loading...";
    if (prizePoolData === undefined) return "No data";
    return `${formatUnits(prizePoolData as bigint, 6)} USDC`;
  };

  const getTimeRemainingDisplay = () => {
    if (!isConnected) return 'Connect wallet to view';
    if (!isSupportedNetwork) return 'Switch to a supported network';
    if (timestampError) return 'Error loading data';
    if (timestampLoading) return 'Loading...';
    if (nextRoundTimestampData === undefined) return 'No data';
    return formatTimeRemaining(nextRoundTimestampData as bigint);
  };

  const getLastWinnerDisplay = () => {
    if (!isConnected) return 'Connect wallet to view';
    if (!isSupportedNetwork) return 'Switch to a supported network';
    if (winnerError) return 'Error loading data';
    if (winnerLoading) return 'Loading...';
    if (lastWinnerData === undefined) return 'No data';
    if (lastWinnerData === '0x0000000000000000000000000000000000000000') return 'No winner yet';
    return `${(lastWinnerData as string).slice(0, 6)}...${(lastWinnerData as string).slice(-4)}`;
  };

  const prizePool = getPrizePoolDisplay();
  const timeRemaining = getTimeRemainingDisplay();
  const lastWinner = getLastWinnerDisplay();

  const totalAssets = totalAssetsData ? `${formatUnits(totalAssetsData as bigint, 6)} USDC` : '-';
  const totalPrincipal = totalPrincipalData ? `${formatUnits(totalPrincipalData as bigint, 6)} USDC` : '-';

  const chainId = chain?.id ?? 11155111;
  const explorerBase = chainId === 1 ? 'https://etherscan.io' : chainId === 11155111 ? 'https://sepolia.etherscan.io' : 'https://etherscan.io';
  const lastWinnerLink = typeof lastWinnerData === 'string' && lastWinnerData !== '0x0000000000000000000000000000000000000000'
    ? `${explorerBase}/address/${lastWinnerData}`
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-block text-2xl">🎃</span>
          Prize Pool
        </CardTitle>
        <CardDescription>The winner takes all the yield generated from the deposits.</CardDescription>
        {!isSupportedNetwork && isConnected && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
            <AlertCircle className="h-4 w-4" />
            Please switch to a supported network to interact with the contract
          </div>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div>
          <Award className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
          <p className="text-sm text-muted-foreground">Current Prize</p>
          <p className="text-2xl font-bold">{prizePool}</p>
        </div>
        <div>
          <Clock className="h-8 w-8 mx-auto mb-2 text-orange-500" />
          <p className="text-sm text-muted-foreground">Time Remaining</p>
          <p className="text-2xl font-bold">{timeRemaining}</p>
        </div>
        <div>
          <Wallet className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm text-muted-foreground">Last Winner</p>
          {lastWinnerLink ? (
            <a href={lastWinnerLink} target="_blank" rel="noreferrer" className="text-2xl font-bold truncate text-blue-600 hover:underline">
              {lastWinner}
            </a>
          ) : (
            <p className="text-2xl font-bold truncate">{lastWinner}</p>
          )}
        </div>
        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div className="rounded border p-4 text-center">
            <PiggyBank className="h-6 w-6 mx-auto mb-1 text-pink-600" />
            <p className="text-xs text-muted-foreground">Total Assets (principal + yield)</p>
            <p className="text-lg font-semibold">{totalAssets}</p>
          </div>
          <div className="rounded border p-4 text-center">
            <Coins className="h-6 w-6 mx-auto mb-1 text-amber-600" />
            <p className="text-xs text-muted-foreground">Total Principal</p>
            <p className="text-lg font-semibold">{totalPrincipal}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PrizePool;
