import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from "@/contracts/PumpkinSpiceLatte";
import { formatUnits } from "viem";
import { useToast } from "@/components/ui/use-toast";

const UserStats = () => {
  const { address, isConnected, chain } = useAccount();
  const { toast } = useToast();

  // Check if we're on a supported network
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const contractAddress = isSupportedNetwork
    ? CONTRACTS[chain.id as keyof typeof CONTRACTS].pumpkinSpiceLatte
    : pumpkinSpiceLatteAddress;

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
    },
  } as any);

  const {
    data: userBalanceData,
    isError: balanceError,
    isLoading: balanceLoading,
  } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: "balanceOf",
    args: [address],
    query: {
      enabled: isConnected && !!address && !!isSupportedNetwork,
      refetchInterval: 30000,
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
      functionName: "awardPrize",
    });
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Your PSL Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-[#f5f2f0] rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">Your Deposits</p>
            <p className="font-bold text-lg">{userBalance}</p>
          </div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">Your Wallet</p>
            <p className="font-bold text-sm truncate">
              {isConnected && address
                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                : "Not connected"}
            </p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Next Draw</p>
            <p className="font-medium text-sm">
              {nextRoundTimestampData
                ? formatTimeRemaining(nextRoundTimestampData as bigint)
                : "-"}
            </p>
          </div>
        </div>
        <Button
          className="w-full h-12 text-base"
          variant="outline"
          disabled={!isConnected || !isSupportedNetwork || isPending}
          onClick={handleAwardPrize}
        >
          {isPending ? "Awarding..." : "Award Prize"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default UserStats;
