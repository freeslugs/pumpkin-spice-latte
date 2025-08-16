import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getExplorerBase = (chainId?: number) => {
  if (chainId === 1) return 'https://virtual.mainnet.us-east.rpc.tenderly.co/15cd7478-f127-4d1a-b1e3-68ab95ae2c13'
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
