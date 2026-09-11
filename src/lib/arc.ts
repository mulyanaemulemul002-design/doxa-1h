import { createWalletClient, createPublicClient, http, decodeFunctionResult, encodeFunctionData, type Hex, type PrivateKeyAccount } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export const ARC_TESTNET = {
  chainId: '0x4cef52',
  chainIdDecimal: 5042002,
  name: 'Arc Testnet',
  rpcUrl: 'https://rpc.testnet.arc.io',
  explorerUrl: 'https://testnet.arcscan.app',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  usdcAddress: '0x3600000000000000000000000000000000000000',
} as const

export const DOXA_LAUNCHPAD_ADDRESS = '0x1fbaaf6fb624d975e89c6e12313a161c38c15904' as const

type RequestArguments = {
  method: string
  params?: unknown[]
}

export type Eip1193Provider = {
  request: (args: RequestArguments) => Promise<unknown>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
}

export type ArcWalletConnection = {
  account: string
  chainId: string
}

export type ArcWalletBalances = {
  nativeUsdc: string
  erc20Usdc: string
}

export type ArcLaunch = {
  token: string
  creator: string
  name: string
  symbol: string
  description: string
  virtualNativeReserve: bigint
  virtualTokenReserve: bigint
  nativeReserve: bigint
  tokenReserve: bigint
  createdAt: bigint
  graduated: boolean
}

const launchpadAbi = [
  {
    type: 'function',
    name: 'createLaunch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'description_', type: 'string' },
    ],
    outputs: [
      { name: 'launchId', type: 'uint256' },
      { name: 'token', type: 'address' },
    ],
  },
  {
    type: 'function',
    name: 'buy',
    stateMutability: 'payable',
    inputs: [
      { name: 'launchId', type: 'uint256' },
      { name: 'minTokenOut', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenOut', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'sell',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'launchId', type: 'uint256' },
      { name: 'tokenIn', type: 'uint256' },
      { name: 'minNativeOut', type: 'uint256' },
    ],
    outputs: [{ name: 'nativeOut', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'quoteBuy',
    stateMutability: 'view',
    inputs: [
      { name: 'launchId', type: 'uint256' },
      { name: 'nativeIn', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'quoteSell',
    stateMutability: 'view',
    inputs: [
      { name: 'launchId', type: 'uint256' },
      { name: 'tokenIn', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'progressBps',
    stateMutability: 'view',
    inputs: [{ name: 'launchId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'launchCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getLaunches',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{
      name: 'page',
      type: 'tuple[]',
      components: [
        { name: 'token', type: 'address' },
        { name: 'creator', type: 'address' },
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'virtualNativeReserve', type: 'uint256' },
        { name: 'virtualTokenReserve', type: 'uint256' },
        { name: 'nativeReserve', type: 'uint256' },
        { name: 'tokenReserve', type: 'uint256' },
        { name: 'createdAt', type: 'uint256' },
        { name: 'graduated', type: 'bool' },
      ],
    }],
  },
] as const

const tokenAbi = [{
  type: 'function',
  name: 'balanceOf',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

export function getInjectedProvider(): Eip1193Provider | undefined {
  return typeof window === 'undefined' ? undefined : window.ethereum
}

let walletConnectProvider: Eip1193Provider | undefined

export async function getWalletConnectProvider(): Promise<Eip1193Provider | undefined> {
  if (typeof window === 'undefined') return undefined
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
  if (!projectId) return undefined
  if (walletConnectProvider) return walletConnectProvider

  const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
  walletConnectProvider = await EthereumProvider.init({
    projectId,
    chains: [ARC_TESTNET.chainIdDecimal],
    optionalChains: [ARC_TESTNET.chainIdDecimal],
    showQrModal: true,
    metadata: {
      name: 'DOXA',
      description: 'DOXA token launchpad on Arc Testnet',
      url: window.location.origin,
      icons: [`${window.location.origin}/doxa-logo.png`],
    },
  }) as unknown as Eip1193Provider
  return walletConnectProvider
}

function normalizeChainId(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return trimmed.toLowerCase()
    if (/^\d+$/.test(trimmed)) return `0x${BigInt(trimmed).toString(16)}`
    throw new Error('Wallet returned an invalid chain ID.')
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return `0x${value.toString(16)}`
  }
  if (typeof value === 'bigint') return `0x${value.toString(16)}`
  throw new Error('Wallet returned an invalid chain ID.')
}

async function getChainId(provider: Eip1193Provider): Promise<string> {
  const chainId = await provider.request({ method: 'eth_chainId' })
  return normalizeChainId(chainId)
}

export function getConnectedProvider(): Eip1193Provider | undefined {
  return getInjectedProvider() ?? walletConnectProvider
}

async function switchToArcTestnet(provider: Eip1193Provider): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_TESTNET.chainId }],
    })
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
    if (code !== 4902) throw error
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: ARC_TESTNET.chainId,
        chainName: ARC_TESTNET.name,
        nativeCurrency: ARC_TESTNET.nativeCurrency,
        rpcUrls: [ARC_TESTNET.rpcUrl],
        blockExplorerUrls: [ARC_TESTNET.explorerUrl],
      }],
    })
  }
}

export async function connectArcWallet(): Promise<ArcWalletConnection> {
  const provider = getInjectedProvider() ?? await getWalletConnectProvider()
  if (!provider) throw new Error('WalletConnect is not configured. Add VITE_WALLETCONNECT_PROJECT_ID, or install a browser wallet.')
  const walletConnect = provider as Eip1193Provider & { connect?: () => Promise<void> }
  if (!getInjectedProvider() && walletConnect.connect) await walletConnect.connect()

  if ((await getChainId(provider)).toLowerCase() !== ARC_TESTNET.chainId) {
    await switchToArcTestnet(provider)
  }

  const accounts = await provider.request({ method: 'eth_requestAccounts' })
  const account = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : undefined
  if (!account) throw new Error('The wallet did not return an account.')

  return { account, chainId: await getChainId(provider) }
}

function formatUnits(value: bigint, decimals: number, maximumFractionDigits = 4): string {
  const base = 10n ** BigInt(decimals)
  const whole = value / base
  const fraction = value % base
  if (fraction === 0n) return whole.toString()
  const fractionText = fraction.toString().padStart(decimals, '0').slice(0, maximumFractionDigits).replace(/0+$/, '')
  return `${whole}.${fractionText}`
}

function addressArgument(address: string): string {
  return address.replace(/^0x/, '').toLowerCase().padStart(64, '0')
}

export async function readArcWalletBalances(account: string): Promise<ArcWalletBalances> {
  const provider = getConnectedProvider()
  if (!provider) throw new Error('No wallet connection found.')

  const [nativeBalance, erc20Balance] = await Promise.all([
    provider.request({ method: 'eth_getBalance', params: [account, 'latest'] }),
    provider.request({
      method: 'eth_call',
      params: [{
        to: ARC_TESTNET.usdcAddress,
        data: `0x70a08231${addressArgument(account)}`,
      }, 'latest'],
    }),
  ])

  if (typeof nativeBalance !== 'string' || typeof erc20Balance !== 'string') {
    throw new Error('Wallet returned an invalid balance.')
  }

  return {
    nativeUsdc: formatUnits(BigInt(nativeBalance), ARC_TESTNET.nativeCurrency.decimals),
    erc20Usdc: formatUnits(BigInt(erc20Balance), 6),
  }
}

export async function launchTokenOnArc(account: string, name: string, symbol: string, description: string): Promise<string> {
  const provider = getConnectedProvider()
  if (!provider) throw new Error('No wallet connection found.')
  const data = encodeFunctionData({
    abi: launchpadAbi,
    functionName: 'createLaunch',
    args: [name, symbol, description],
  })
  const hash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from: account, to: DOXA_LAUNCHPAD_ADDRESS, data }],
  })
  if (typeof hash !== 'string') throw new Error('Wallet did not return a transaction hash.')
  return hash
}

export async function readArcLaunches(): Promise<ArcLaunch[]> {
  const provider = getConnectedProvider()
  if (!provider) throw new Error('No wallet connection found.')
  const data = encodeFunctionData({
    abi: launchpadAbi,
    functionName: 'getLaunches',
    args: [0n, 50n],
  })
  const result = await provider.request({
    method: 'eth_call',
    params: [{ to: DOXA_LAUNCHPAD_ADDRESS, data }, 'latest'],
  })
  if (typeof result !== 'string') throw new Error('Wallet returned an invalid launch list.')
  return decodeFunctionResult({
    abi: launchpadAbi,
    functionName: 'getLaunches',
    data: result as `0x${string}`,
  }) as unknown as ArcLaunch[]
}

export async function readTokenBalance(token: string, account: string): Promise<string> {
  const provider = getConnectedProvider()
  if (!provider) throw new Error('No wallet connection found.')
  const data = encodeFunctionData({
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: [account as `0x${string}`],
  })
  const result = await provider.request({
    method: 'eth_call',
    params: [{ to: token, data }, 'latest'],
  })
  if (typeof result !== 'string') throw new Error('Wallet returned an invalid token balance.')
  const balance = decodeFunctionResult({
    abi: tokenAbi,
    functionName: 'balanceOf',
    data: result as `0x${string}`,
  }) as bigint
  return formatUnits(balance, 18, 2)
}

export function formatWalletAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

// --- Direct RPC reads (no wallet connection needed) ---

const publicClient = createPublicClient({
  chain: {
    id: ARC_TESTNET.chainIdDecimal,
    name: ARC_TESTNET.name,
    nativeCurrency: ARC_TESTNET.nativeCurrency,
    rpcUrls: { default: { http: [ARC_TESTNET.rpcUrl] } },
  },
  transport: http(ARC_TESTNET.rpcUrl),
})

export async function readLaunchCount(): Promise<number> {
  const result = await publicClient.readContract({
    address: DOXA_LAUNCHPAD_ADDRESS,
    abi: launchpadAbi,
    functionName: 'launchCount',
  })
  return Number(result)
}

export async function readLaunchesDirect(): Promise<ArcLaunch[]> {
  const count = await readLaunchCount()
  if (count === 0) return []
  const result = await publicClient.readContract({
    address: DOXA_LAUNCHPAD_ADDRESS,
    abi: launchpadAbi,
    functionName: 'getLaunches',
    args: [0n, BigInt(count)],
  })
  return result as unknown as ArcLaunch[]
}

export async function readQuoteBuy(launchId: number, nativeIn: bigint): Promise<bigint> {
  const result = await publicClient.readContract({
    address: DOXA_LAUNCHPAD_ADDRESS,
    abi: launchpadAbi,
    functionName: 'quoteBuy',
    args: [BigInt(launchId), nativeIn],
  })
  return result as bigint
}

export async function readProgressBps(launchId: number): Promise<number> {
  const result = await publicClient.readContract({
    address: DOXA_LAUNCHPAD_ADDRESS,
    abi: launchpadAbi,
    functionName: 'progressBps',
    args: [BigInt(launchId)],
  })
  return Number(result)
}

export async function readTokenBalanceDirect(token: string, account: string): Promise<string> {
  const result = await publicClient.readContract({
    address: token as Hex,
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: [account as Hex],
  })
  return formatUnits(result as bigint, 18, 2)
}

export async function readNativeBalanceDirect(account: string): Promise<string> {
  const balance = await publicClient.getBalance({ address: account as Hex })
  return formatUnits(balance, 18)
}

// --- Private-key signed transactions (for admin bot) ---

function getPrivateKeyAccount(privateKey: string): PrivateKeyAccount {
  const normalized = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  return privateKeyToAccount(normalized as Hex)
}

export async function createLaunchWithPrivateKey(
  privateKey: string,
  name: string,
  symbol: string,
  description: string,
): Promise<string> {
  const account = getPrivateKeyAccount(privateKey)
  const client = createWalletClient({
    account,
    chain: {
      id: ARC_TESTNET.chainIdDecimal,
      name: ARC_TESTNET.name,
      nativeCurrency: ARC_TESTNET.nativeCurrency,
      rpcUrls: { default: { http: [ARC_TESTNET.rpcUrl] } },
    },
    transport: http(ARC_TESTNET.rpcUrl),
  })
  const hash = await client.writeContract({
    address: DOXA_LAUNCHPAD_ADDRESS,
    abi: launchpadAbi,
    functionName: 'createLaunch',
    args: [name, symbol, description],
    account,
    chain: undefined,
  })
  return hash
}

export async function buyWithPrivateKey(
  privateKey: string,
  launchId: number,
  nativeIn: bigint,
  minTokenOut: bigint = 0n,
): Promise<string> {
  const account = getPrivateKeyAccount(privateKey)
  const client = createWalletClient({
    account,
    chain: {
      id: ARC_TESTNET.chainIdDecimal,
      name: ARC_TESTNET.name,
      nativeCurrency: ARC_TESTNET.nativeCurrency,
      rpcUrls: { default: { http: [ARC_TESTNET.rpcUrl] } },
    },
    transport: http(ARC_TESTNET.rpcUrl),
  })
  const hash = await client.writeContract({
    address: DOXA_LAUNCHPAD_ADDRESS,
    abi: launchpadAbi,
    functionName: 'buy',
    args: [BigInt(launchId), minTokenOut],
    value: nativeIn,
    account,
    chain: undefined,
  })
  return hash
}

export function getAccountFromPrivateKey(privateKey: string): string {
  return getPrivateKeyAccount(privateKey).address
}
