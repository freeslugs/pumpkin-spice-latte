import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pumpkinSpiceLatteAddress, pumpkinSpiceLatteAbi } from '@/contracts/PumpkinSpiceLatte';
import { formatEther } from 'viem';
import { useToast } from '@/components/ui/use-toast';

const UserStats = () => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const { writeContract, isPending } = useWriteContract({
    onSuccess: () => {
      toast({
        title: "Prize Awarded!",
        description: "The prize has been awarded to a lucky winner.",
      });
    },
    onError: (error) => {
        toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
        });
    }
  });

  const { data: userBalanceData, refetch } = useReadContract({
    address: pumpkinSpiceLatteAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'balanceOf',
    args: [address],
    query: {
        enabled: isConnected,
        refetchInterval: 5000, // Refetch every 5 seconds
    }
  });

  const userBalance = userBalanceData ? `${formatEther(userBalanceData as bigint)} WETH` : "0.00 WETH";

  const handleAwardPrize = () => {
    writeContract({
      address: pumpkinSpiceLatteAddress,
      abi: pumpkinSpiceLatteAbi,
      functionName: 'awardPrize',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Your Deposits</p>
          <p className="font-bold text-lg">{isConnected ? userBalance : "N/A"}</p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Your Wallet</p>
          <p className="font-bold text-lg truncate">{isConnected ? `${address.slice(0, 6)}...${address.slice(-4)}` : "N/A"}</p>
        </div>
        <Button 
            className="w-full" 
            variant="outline" 
            disabled={!isConnected || isPending}
            onClick={handleAwardPrize}
        >
          {isPending ? "Awarding..." : "Award Prize"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default UserStats;
