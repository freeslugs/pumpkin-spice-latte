## Flow EVM Testnet Deployment

PumpkinSpiceLatte: [0x7d12DC1eC75675daFcF0E0651A6bC14A94d6E338](https://evm-testnet.flowscan.io/address/0x7d12DC1eC75675daFcF0E0651A6bC14A94d6E338)  
FlowRandomAdapter64 (pending 256 bit entropy adapter): [0xD6FEDeA87e569975Fd2B47f161537470856c872A](https://evm-testnet.flowscan.io/address/0xD6FEDeA87e569975Fd2B47f161537470856c872A)  
MockLendingAdapter (pending MoreMarkets adapter): [0x0ACd55c5A6A2D842d83Fd2f097BE8860eFD0bbcb](https://evm-testnet.flowscan.io/address/0x0acd55c5a6a2d842d83fd2f097be8860efd0bbcb)


## Flare Testnet (Coston2) Deployment

1) Prerequisites
- Export your deployer private key in the shell:
```bash
export PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```
- Fund the account with C2FLR from the Coston2 faucet.

2) Configure RPC (already added in `foundry.toml`)
- RPC alias: `coston2` → `https://coston2-api.flare.network/ext/C/rpc`
- Chain ID: 114

3) Deploy adapter + PSL
- If deploying to Kinetic, set a valid market address in `packages/foundry/script/DeployPumpkinSpiceLatte.s.sol` by replacing `kineticMarket`.
- Run:
```bash
forge script packages/foundry/script/DeployPumpkinSpiceLatte.s.sol:DeployPumpkinSpiceLatte \
  --rpc-url coston2 \
  --broadcast \
  --legacy
```

4) Verify (Blockscout)
```bash
forge verify-contract --chain 114 --etherscan-api-key unused \
  --verifier blockscout --verifier-url https://coston2-explorer.flare.network/api \
  <DEPLOYED_ADDRESS> packages/foundry/src/PumpkinSpiceLatte.sol:PumpkinSpiceLatte
```

5) Frontend
- Add deployed addresses to `src/contracts/PumpkinSpiceLatte.ts` under key `114`.
- The UI will then recognize Coston2 and use the Coston2 explorer links.

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

### Deploy to Flare Testnet (Coston2) [Primary]

You can deploy and test against Flare Coston2. The repository is configured to default to the Flare Coston2 RPC in `foundry.toml`.

- **RPC (HTTP)**: `https://coston2-api.flare.network/ext/C/rpc`
- **Explorer**: `https://coston2-explorer.flare.network`

1. Ensure your `.env` in `packages/foundry` has:

    ```bash
    # In packages/foundry/.env
    PRIVATE_KEY=<YOUR_PRIVATE_KEY>
    ETHERSCAN_API_KEY=<YOUR_ETHERSCAN_KEY>
    ```

2. Deploy using the Flare Coston2 RPC (chain id 114):

    ```bash
    forge script packages/foundry/script/DeployPumpkinSpiceLatte.s.sol \
        --rpc-url coston2 \
        --private-key $PRIVATE_KEY \
        --broadcast \
        --verify \
        -vvvvv
    ```

3. After deployment, copy the deployed address and update the frontend config:

    - Edit `src/contracts/PumpkinSpiceLatte.ts` and set the Coston2 entry under `CONTRACTS[114].pumpkinSpiceLatte` to your new address.
    - The frontend is preconfigured to include Coston2 and will default to it.

4. Verify on Coston2 Blockscout:

    ```bash
    forge verify-contract --chain 114 --etherscan-api-key unused \
      --verifier blockscout --verifier-url https://coston2-explorer.flare.network/api \
      <DEPLOYED_ADDRESS> packages/foundry/src/PumpkinSpiceLatte.sol:PumpkinSpiceLatte
    ```

5. Run the frontend against Flare Coston2:

    ```bash
    # Optional: WalletConnect project id
    export VITE_WALLETCONNECT_PROJECT_ID=<YOUR_WC_ID>
    npm run dev
    ```

Links:

- Tenderly RPC (HTTP): https://virtual.mainnet.us-east.rpc.tenderly.co/420b1805-6a91-4b32-b1c2-d37896a360cb
- Tenderly RPC (WSS): wss://virtual.mainnet.us-east.rpc.tenderly.co/4996bd0e-fa2d-451e-961d-41fad07d2baf
- Tenderly Explorer: https://dashboard.tenderly.co/explorer/vnet/12d3291a-a185-4890-a48a-dd152c871633/transactions

OK New way to deploy 

```
forge script packages/foundry/script/DeployPumpkinSpiceLatte.s.sol \
  --rpc-url $TENDERLY_VIRTUAL_TESTNET_RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

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
forge verify-contract 0x3ecc78c6fea14565affd607bd35b5b8e6dc39778 PumpkinSpiceLatte --etherscan-api-key $TENDERLY_ACCESS_KEY --verifier-url https://virtual.mainnet.us-east.rpc.tenderly.co/420b1805-6a91-4b32-b1c2-d37896a360cb/verify/etherscan --watch
```

## ONLY FLARE 

```
forge script packages/foundry/script/DeployPumpkinSpiceLatte.s.sol:DeployPumpkinSpiceLatte \
  --rpc-url coston2 \
  --broadcast -vvvv
```

=== Flare Contract Addresses ===
  FlareSecureRandomAdapter: 0x6e811bC14b656B2A958adEb0f3463df32A21b951
  Random Number Contract: 0x97702e350CaEda540935d92aAf213307e9069784
  Note: Contract addresses are fetched from Flare's ContractRegistry
  For mainnet, verify these addresses match the target network
  === Deployment Complete ===
  PumpkinSpiceLatte deployed: 0xc73ECA128c225564C4151fAa723Ae0527FDB8516
  Kinetic or Morpho4626Adapter: 0x10941C34E3fd1709Dcb73d73442Ca80dF029ce83
  Random Number Provider: FlareSecureRandomAdapter (Secure VRF)
  RNG Address: 0x6e811bC14b656B2A958adEb0f3463df32A21b951
  
=== Flare Network Info ===
  Network: Flare (Coston2/Mainnet)
  Randomness: Secure VRF from Flare network
  Note: This adapter only works on Flare Network
  Kinetic or Morpho4626Adapter: 0x10941C34E3fd1709Dcb73d73442Ca80dF029ce83
  RNG: 0x6e811bC14b656B2A958adEb0f3463df32A21b951



```
# PumpkinSpiceLatte 
forge verify-contract --chain 114 --verifier blockscout \
  --verifier-url https://coston2-explorer.flare.network/api \
  --etherscan-api-key unused \
  0x85b84761d95cc3C4832D941363DCFee17e3d33a4 packages/foundry/src/PumpkinSpiceLatte.sol:PumpkinSpiceLatte
```


```
# Kinetic or Morpho4626Adapter: 0x351957C2D6043B258CCC5f4da5a60a2E132Cf158
forge verify-contract --chain 114 --verifier blockscout \
  --verifier-url https://coston2-explorer.flare.network/api \
  --etherscan-api-key unused \
  0x10941C34E3fd1709Dcb73d73442Ca80dF029ce83 packages/foundry/src/adapters/KineticAdapter.sol:KineticAdapter
```


```
# RNG Address: 0xB21Fb6D1399D08147F192be583340f5D5D0aEd7A
forge verify-contract --chain 114 --verifier blockscout \
  --verifier-url https://coston2-explorer.flare.network/api \
  --etherscan-api-key unused \
  0x97702e350CaEda540935d92aAf213307e9069784 packages/foundry/src/adapters/FlareSecureRandomAdapter.sol:FlareSecureRandomAdapter
```

=== Flare Contract Addresses ===
  FlareSecureRandomAdapter: 0xb2E7683DeD50D370AFeD58B4a2492F7501fAb65E
  Random Number Contract: 0x97702e350CaEda540935d92aAf213307e9069784
  Note: Contract addresses are fetched from Flare's ContractRegistry
  For mainnet, verify these addresses match the target network
  === Deployment Complete ===
  PumpkinSpiceLatte deployed: 0x85b84761d95cc3C4832D941363DCFee17e3d33a4
  Kinetic or Morpho4626Adapter: 0xDc88a57cE0d120B96F06F7328BFAc2C39BC77b66
  Random Number Provider: FlareSecureRandomAdapter (Secure VRF)
  RNG Address: 0xb2E7683DeD50D370AFeD58B4a2492F7501fAb65E
  
=== Flare Network Info ===
  Network: Flare (Coston2/Mainnet)
  Randomness: Secure VRF from Flare network
  Note: This adapter only works on Flare Network
  Kinetic or Morpho4626Adapter: 0xDc88a57cE0d120B96F06F7328BFAc2C39BC77b66
  RNG: 0xb2E7683DeD50D370AFeD58B4a2492F7501fAb65E

== Logs ==
  Deploying Kinetic Adapter
  
=== Flare Contract Addresses ===
  FlareSecureRandomAdapter: 0xB21Fb6D1399D08147F192be583340f5D5D0aEd7A
  Random Number Contract: 0x97702e350CaEda540935d92aAf213307e9069784
  Note: Contract addresses are fetched from Flare's ContractRegistry
  For mainnet, verify these addresses match the target network
  === Deployment Complete ===
  PumpkinSpiceLatte deployed: 0xf94d594A61358761FAcDCe77E5Ff4303dad12a49
  Kinetic or Morpho4626Adapter: 0x351957C2D6043B258CCC5f4da5a60a2E132Cf158
  Random Number Provider: FlareSecureRandomAdapter (Secure VRF)
  RNG Address: 0xB21Fb6D1399D08147F192be583340f5D5D0aEd7A
  
=== Flare Network Info ===
  Network: Flare (Coston2/Mainnet)
  Randomness: Secure VRF from Flare network
  Note: This adapter only works on Flare Network
  Kinetic or Morpho4626Adapter: 0x351957C2D6043B258CCC5f4da5a60a2E132Cf158
  RNG: 0xB21Fb6D1399D08147F192be583340f5D5D0aEd7A


  == Logs ==
  === Deployment Complete ===
  PumpkinSpiceLatte deployed: 0xdB9212aF6019C137AC321d36DCEB3e174D933b37
  Kinetic or Morpho4626Adapter: 0x0D01b15dfDaDE2c33d527AEeb76Eec99CE35e847
  Random Number Provider: PseudoRandomAdapter (devnet only)
  RNG Address: 0xe19a2d787AdF713BA10eFd8d67AdAae16d798d00
  
=== Development Info ===
  Network: Any EVM compatible
  Randomness: Pseudo-random (predictable)
  Warning: Not suitable for production use
  Kinetic or Morpho4626Adapter: 0x0D01b15dfDaDE2c33d527AEeb76Eec99CE35e847
  RNG: 0xe19a2d787AdF713BA10eFd8d67AdAae16d798d00