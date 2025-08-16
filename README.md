# Pumpkin Spice Latte PLSA

Welcome to the Pumpkin Spice Latte Prize-Linked Savings Account! This is a decentralized application where users can deposit WETH to earn yield from the Morpho Blue protocol. The accumulated yield is then awarded as a prize to a random depositor in a weekly draw. It's a no-loss savings game: you can always withdraw your principal, and you get a chance to win the prize pool!

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
    *   You may also need to update the `wethAddress` if you are using a different testnet. The current one is for Sepolia.

### Deploying the Frontend

You can easily deploy the frontend to a service like Vercel or Netlify.

1.  **Push your code to a Git repository** (GitHub, GitLab, etc.).
2.  **Import the repository** into your Vercel/Netlify account.
3.  **Configure the build settings**:
    *   **Framework**: `Next.js`
    *   **Build Command**: `npm run build`
    *   **Output Directory**: `.next`
4.  **Deploy**. Your dApp will be live!

