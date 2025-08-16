import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pumpkinSpiceLatteAddress, pumpkinSpiceLatteAbi, CONTRACTS } from '@/contracts/PumpkinSpiceLatte';
import { formatUnits } from 'viem';
import { useToast } from '@/components/ui/use-toast';

const formatTimeRemaining = (timestamp: bigint) => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const secondsRemaining = timestamp - now;
  if (secondsRemaining <= 0n) return 'Ready to draw';
  const hours = secondsRemaining / 3600n;
  const minutes = (secondsRemaining % 3600n) / 60n;
  const seconds = secondsRemaining % 60n;
  return `${hours}h ${minutes}m ${seconds}s`;
};

const UserStats = () => {
  const { address, isConnected, chain } = useAccount();
  const { toast } = useToast();
  
  // Check if we're on a supported network
  const isSupportedNetwork = chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const contractAddress = isSupportedNetwork ? CONTRACTS[chain.id as keyof typeof CONTRACTS].pumpkinSpiceLatte : pumpkinSpiceLatteAddress;

  const { writeContract, isPending } = useWriteContract({
    onSuccess: () => {
      toast({
        title: 'Prize Awarded!',
        description: 'The prize has been awarded to a lucky winner.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { data: userBalanceData, isError: balanceError, isLoading: balanceLoading } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'balanceOf',
    args: [address],
    query: {
      enabled: isConnected && !!address && !!isSupportedNetwork,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  const { data: nextRoundTimestampData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'nextRoundTimestamp',
    query: {
      enabled: isConnected && !!isSupportedNetwork,
      refetchInterval: 1000,
    },
  });

  const getUserBalanceDisplay = () => {
    if (!isConnected) return "Connect wallet to view";
    if (!isSupportedNetwork) return "Switch to a supported network";
    if (balanceError) return "Error loading balance";
    if (balanceLoading) return "Loading...";
    if (userBalanceData === undefined) return "0.00 USDC";
    return `${formatUnits(userBalanceData as bigint, 6)} USDC`;
  };

  const userBalance = getUserBalanceDisplay();

  const handleAwardPrize = () => {
    writeContract({
      address: contractAddress,
      abi: pumpkinSpiceLatteAbi,
      functionName: 'awardPrize',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your PSL Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Your Deposits</p>
          <p className="font-bold text-lg">{userBalance}</p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Your Wallet</p>
          <p className="font-bold text-lg truncate">
            {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
          </p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Next Draw</p>
          <p className="font-medium text-sm">
            {nextRoundTimestampData ? formatTimeRemaining(nextRoundTimestampData as bigint) : '-'}
          </p>
        </div>
        <Button 
          className="w-full" 
          variant="outline" 
          disabled={!isConnected || !isSupportedNetwork || isPending}
          onClick={handleAwardPrize}
        >
          {isPending ? 'Awarding...' : 'Award Prize'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default UserStats;
