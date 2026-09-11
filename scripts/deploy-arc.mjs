import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const root = resolve(import.meta.dirname, '..')
const artifact = JSON.parse(await readFile(resolve(root, 'contract-artifacts/DOXALaunchpad.json'), 'utf8'))
const rpcUrl = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io'
const admin = getAddress(process.env.DOXA_ADMIN || '0x662ddf7d320b229f701e5e628e3ff6dec9c05855')
const treasury = getAddress(process.env.DOXA_TREASURY || '0x4b1060f52c4af453d02826cd855f4866a6735190')
const graduationTarget = process.env.DOXA_GRADUATION_TARGET_USDC || '10000'
const feeBps = BigInt(process.env.DOXA_FEE_BPS || '100')
const privateKey = process.env.DEPLOYER_PRIVATE_KEY

if (!privateKey) throw new Error('DEPLOYER_PRIVATE_KEY is required in Vercel Environment Variables.')
if (feeBps > 500n) throw new Error('DOXA_FEE_BPS cannot exceed 500 (5%).')

const chain = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
})
const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`)
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

console.log(JSON.stringify({ deployer: account.address, admin, treasury, graduationTarget, feeBps: feeBps.toString(), chainId: chain.id }, null, 2))
const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [admin, treasury, parseUnits(graduationTarget, 18), feeBps],
})
console.log(`Deployment transaction: ${hash}`)
const receipt = await publicClient.waitForTransactionReceipt({ hash })
if (!receipt.contractAddress) throw new Error('The deployment receipt did not contain a contract address.')

const deploymentDirectory = resolve(root, 'deployments')
await mkdir(deploymentDirectory, { recursive: true })
await writeFile(resolve(deploymentDirectory, 'arc-testnet.json'), JSON.stringify({
  chainId: chain.id,
  network: chain.name,
  address: receipt.contractAddress,
  deployer: account.address,
  admin,
  treasury,
  graduationTargetUsdc: graduationTarget,
  feeBps: Number(feeBps),
  transactionHash: receipt.transactionHash,
  blockNumber: receipt.blockNumber.toString(),
  explorerUrl: `https://testnet.arcscan.app/address/${receipt.contractAddress}`,
}, null, 2))
console.log(`DOXALaunchpad deployed at ${receipt.contractAddress}`)
