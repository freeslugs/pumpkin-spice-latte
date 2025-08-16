import PrizePool from '@/components/PrizePool';
import Actions from '@/components/Actions';
import UserStats from '@/components/UserStats';
import { useAccount } from 'wagmi';
import { CONTRACTS } from '@/contracts/PumpkinSpiceLatte';
import { AlertCircle, CheckCircle } from 'lucide-react';

const PSLHome = () => {
  const { chain, isConnected } = useAccount();
  const isSupportedNetwork = chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
          Pumpkin Spice Latte PLSA
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Deposit USDC, earn yield, and get a chance to win the prize pool. No loss, just juicy prizes!
        </p>
      </div>

      {/* Network Status */}
      {isConnected && (
        <div className={`p-4 rounded-lg border ${
          isSupportedNetwork 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div className="flex items-center gap-3">
            {isSupportedNetwork ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            )}
            <div>
              <p className="font-medium">
                {isSupportedNetwork ? 'Ready to interact!' : 'Network not supported'}
              </p>
              <p className="text-sm">
                {isSupportedNetwork 
                  ? `You're connected to ${chain?.name} and can interact with the contract.`
                  : `Please switch to Sepolia testnet to interact with the Pumpkin Spice Latte contract.`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Prize Info and Actions */}
        <div className="lg:col-span-2 space-y-8">
          <PrizePool />
          <Actions />
        </div>

        {/* Right Column: User Stats */}
        <div className="space-y-8">
          <UserStats />
        </div>

      </div>
    </div>
  );
};

export default PSLHome;
