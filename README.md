# Pumpkin Spice Latte PLSA

Welcome to the Pumpkin Spice Latte Prize-Linked Savings Account! This is a decentralized application where users can deposit USDC to earn yield from the Morpho Blue protocol. The accumulated yield is then awarded as a prize to a random depositor in a weekly draw. It's a no-loss savings game: you can always withdraw your principal, and you get a chance to win the prize pool!

This project is a full-stack dApp with a Solidity smart contract and a React frontend.

## Project Structure

-   `/packages/foundry`: Contains the Solidity smart contract, tests, and deployment scripts.
-   `/packages/nextjs`: Contains the Next.js frontend application.

## Prerequisites

Before you begin, ensure you have the following installed:

-   [**Node.js**](https://nodejs.org/en/) (v18 or later)
-   [**Foundry**](https://getfoundry.sh/): A blazing fast, portable and modular toolkit for Ethereum application development.

## Getting Started

Follow these steps to set up and run the project locally.

### 1. Clone the Repository

```bash
git clone <repository_url>
cd pumpkin-spice-latte
```

### 2. Install Dependencies

First, install the frontend dependencies:

```bash
cd packages/nextjs
npm install
```

Then, install the smart contract dependencies:

```bash
cd ../foundry
forge install
```

### 3. Set Up Environment Variables

You'll need to create a `.env` file in the `packages/foundry` directory to store your private key and a Sepolia RPC URL. This is required for deploying the contract.

```bash
# In packages/foundry/.env
PRIVATE_KEY=<YOUR_PRIVATE_KEY>
SEPOLIA_RPC_URL=<YOUR_SEPOLIA_RPC_URL>
```

**Note**: Your private key should not have a `0x` prefix. You can get a free RPC URL from services like [Alchemy](https://www.alchemy.com/) or [Infura](https://www.infura.io/).

## Development

### Running the Frontend

To start the local development server for the frontend:

```bash
# From the root directory
cd packages/nextjs
npm run dev
```

The application will be available at `http://localhost:3000`.

### Testing the Smart Contract

To run the Solidity test suite:

```bash
# From the root directory
cd packages/foundry
forge test
```

## Deployment

### Deploying the Smart Contract to Sepolia

A deployment script is included to make deploying to the Sepolia testnet easy.

1.  **Ensure your `.env` file is set up correctly** in `packages/foundry` with your `PRIVATE_KEY` and `SEPOLIA_RPC_URL`.
2.  **Make sure your deployer wallet has some Sepolia ETH** for gas fees. You can get some from a [faucet](https://sepolia-faucet.com/).
3.  **Run the deployment script**:

    ```bash
    # From the packages/foundry directory
    forge script script/DeployPumpkinSpiceLatte.s.sol:DeployPumpkinSpiceLatte --rpc-url ${SEPOLIA_RPC_URL} --broadcast --verify
    ```

4.  **Copy the Deployed Address**: The script will output the address of the newly deployed `PumpkinSpiceLatte` contract. Copy this address.

5.  **Update the Frontend**:
    *   Open `packages/nextjs/src/contracts/PumpkinSpiceLatte.ts`.
    *   Paste the new contract address into the `pumpkinSpiceLatteAddress` variable.
    *   You may also need to update the `usdc` address if you are using a different testnet. The current one is for Sepolia.

### Deploying the Frontend

You can easily deploy the frontend to a service like Vercel or Netlify.

1.  **Push your code to a Git repository** (GitHub, GitLab, etc.).
2.  **Import the repository** into your Vercel/Netlify account.
3.  **Configure the build settings**:
    *   **Framework**: `Next.js`
    *   **Build Command**: `npm run build`
    *   **Output Directory**: `.next`
4.  **Deploy**. Your dApp will be live!



### Deploy to Sepolia 

```
source .env
```

and then 


```
forge script packages/foundry/script/DeployPumpkinSpiceLatte.s.sol \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

### Deploy to Tenderly Virtual Mainnet (Fork)

You can deploy and test against your Tenderly Virtual Mainnet fork. The repository is already configured to default to the Tenderly RPC in `foundry.toml`.

- **RPC (HTTP)**: `https://virtual.mainnet.us-east.rpc.tenderly.co/15cd7478-f127-4d1a-b1e3-68ab95ae2c13`
- **RPC (WSS)**: `wss://virtual.mainnet.us-east.rpc.tenderly.co/559a7b58-b67d-4103-af70-fbc60a502bb0`
- **Explorer**: `https://dashboard.tenderly.co/explorer/vnet/12d3291a-a185-4890-a48a-dd152c871633/transactions`

1. Ensure your `.env` in `packages/foundry` has:

    ```bash
    # In packages/foundry/.env
    PRIVATE_KEY=<YOUR_PRIVATE_KEY>
    ETHERSCAN_API_KEY=<YOUR_ETHERSCAN_KEY>
    ```

2. Deploy using the Tenderly RPC (mainnet chain id 1):

    ```bash
    forge script packages/foundry/script/DeployPumpkinSpiceLatte.s.sol \
      --rpc-url https://virtual.mainnet.us-east.rpc.tenderly.co/15cd7478-f127-4d1a-b1e3-68ab95ae2c13 \
      --private-key $PRIVATE_KEY \
      --broadcast
    ```

3. After deployment, copy the deployed address and update the frontend config:

    - Edit `src/contracts/PumpkinSpiceLatte.ts` and set the mainnet entry under `CONTRACTS[1].pumpkinSpiceLatte` to your new address.
    - The frontend is preconfigured to route mainnet traffic via Tenderly in `src/wagmi.ts`. You can override via env var `VITE_MAINNET_TENDERLY_RPC_HTTP` if needed.

4. Optional: Verify on Etherscan is not applicable for Tenderly forks, but your transactions will appear in the Tenderly explorer above.

5. Run the frontend against the fork:

    ```bash
    # Optional: set RPC via env override
    export VITE_MAINNET_TENDERLY_RPC_HTTP=https://virtual.mainnet.us-east.rpc.tenderly.co/15cd7478-f127-4d1a-b1e3-68ab95ae2c13
    export VITE_WALLETCONNECT_PROJECT_ID=<YOUR_WC_ID>
    npm run dev
    ```

Links:

- Tenderly RPC (HTTP): https://virtual.mainnet.us-east.rpc.tenderly.co/15cd7478-f127-4d1a-b1e3-68ab95ae2c13
- Tenderly RPC (WSS): wss://virtual.mainnet.us-east.rpc.tenderly.co/559a7b58-b67d-4103-af70-fbc60a502bb0
- Tenderly Explorer: https://dashboard.tenderly.co/explorer/vnet/12d3291a-a185-4890-a48a-dd152c871633/transactions

and if it forgets to verify 

```
forge verify-contract \
  --chain-id 11155111 \
  --watch \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  0x3Cb0F6582683204d013c1BaB52067ce351aa3beF \
  packages/foundry/src/PumpkinSpiceLatte.sol:PumpkinSpiceLatte
```

```
forge verify-contract 0x3Cb0F6582683204d013c1BaB52067ce351aa3beF \
PumpkinSpiceLatte \
--etherscan-api-key $TENDERLY_ACCESS_KEY \
--verifier-url https://virtual.mainnet.us-east.rpc.tenderly.co/15cd7478-f127-4d1a-b1e3-68ab95ae2c13/verify/etherscan \
--watch
```