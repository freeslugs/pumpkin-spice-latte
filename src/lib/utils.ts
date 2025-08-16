import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getExplorerBase = (chainId?: number) => {
  if (chainId === 1) return 'https://virtual.mainnet.us-east.rpc.tenderly.co/599cbccf-89bd-4882-a246-be73f62ceda2'
  if (chainId === 11155111) return 'https://sepolia.etherscan.io'
  return 'https://etherscan.io'
}

export const getAddressExplorerUrl = (chainId: number | undefined, address: string) => {
  const base = getExplorerBase(chainId)
  return `${base}/address/${address}`
}

export const getTxExplorerUrl = (chainId: number | undefined, txHash: string) => {
  const base = getExplorerBase(chainId)
  return `${base}/tx/${txHash}`
}
