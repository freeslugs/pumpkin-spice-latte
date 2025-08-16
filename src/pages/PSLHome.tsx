import PrizePool from '@/components/PrizePool';
import Actions from '@/components/Actions';
import UserStats from '@/components/UserStats';

const PSLHome = () => {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
          Pumpkin Spice Latte PLSA
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Deposit WETH, earn yield, and get a chance to win the prize pool. No loss, just juicy prizes!
        </p>
      </div>

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
