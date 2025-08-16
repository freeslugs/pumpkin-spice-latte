import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Clock, Wallet } from 'lucide-react';
import { useReadContract } from 'wagmi';
import { pumpkinSpiceLatteAddress, pumpkinSpiceLatteAbi } from '@/contracts/PumpkinSpiceLatte';
import { formatEther } from 'viem';

// Helper function to format time remaining
const formatTimeRemaining = (timestamp: bigint) => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const secondsRemaining = timestamp - now;

  if (secondsRemaining <= 0) {
    return "Next round starting soon!";
  }

  const days = secondsRemaining / BigInt(86400);
  const hours = (secondsRemaining % BigInt(86400)) / BigInt(3600);
  const minutes = (secondsRemaining % BigInt(3600)) / BigInt(60);

  return `${days}d ${hours}h ${minutes}m`;
};


const PrizePool = () => {
  const { data: prizePoolData } = useReadContract({
    address: pumpkinSpiceLatteAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'prizePool',
    query: {
        refetchInterval: 5000, // Refetch every 5 seconds
    }
  });

  const { data: nextRoundTimestampData } = useReadContract({
    address: pumpkinSpiceLatteAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'nextRoundTimestamp',
    query: {
        refetchInterval: 1000, // Refetch every second for the countdown
    }
  });

  const { data: lastWinnerData } = useReadContract({
    address: pumpkinSpiceLatteAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'lastWinner',
  });

  const prizePool = prizePoolData ? `${formatEther(prizePoolData as bigint)} WETH` : "Loading...";
  const timeRemaining = nextRoundTimestampData ? formatTimeRemaining(nextRoundTimestampData as bigint) : "Loading...";
  const lastWinner = lastWinnerData ? `${(lastWinnerData as string).slice(0, 6)}...${(lastWinnerData as string).slice(-4)}` : "N/A";


  return (
    <Card>
      <CardHeader>
        <CardTitle>Prize Pool</CardTitle>
        <CardDescription>The winner takes all the yield generated from the deposits.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div>
          <Award className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
          <p className="text-sm text-muted-foreground">Current Prize</p>
          <p className="text-2xl font-bold">{prizePool}</p>
        </div>
        <div>
          <Clock className="h-8 w-8 mx-auto mb-2 text-blue-500" />
          <p className="text-sm text-muted-foreground">Time Remaining</p>
          <p className="text-2xl font-bold">{timeRemaining}</p>
        </div>
        <div>
          <Wallet className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm text-muted-foreground">Last Winner</p>
          <p className="text-2xl font-bold truncate">{lastWinner}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default PrizePool;
