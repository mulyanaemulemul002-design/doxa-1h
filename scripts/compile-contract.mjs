import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import solc from 'solc'

const root = resolve(import.meta.dirname, '..')
const sourcePath = resolve(root, 'contracts/DOXALaunchpad.sol')
const source = await readFile(sourcePath, 'utf8')
const input = {
  language: 'Solidity',
  sources: { 'DOXALaunchpad.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] },
    },
  },
}

const output = JSON.parse(solc.compile(JSON.stringify(input)))
const errors = output.errors || []
for (const error of errors) console.error(error.formattedMessage)
if (errors.some((error) => error.severity === 'error')) {
  process.exitCode = 1
  throw new Error('Solidity compilation failed.')
}

const launchpad = output.contracts['DOXALaunchpad.sol'].DOXALaunchpad
const token = output.contracts['DOXALaunchpad.sol'].DOXAToken
const artifactDirectory = resolve(root, 'contract-artifacts')
await mkdir(artifactDirectory, { recursive: true })
await writeFile(resolve(artifactDirectory, 'DOXALaunchpad.json'), JSON.stringify({
  contractName: 'DOXALaunchpad',
  sourceName: 'contracts/DOXALaunchpad.sol',
  abi: launchpad.abi,
  bytecode: `0x${launchpad.evm.bytecode.object}`,
  deployedBytecode: `0x${launchpad.evm.deployedBytecode.object}`,
}, null, 2))
await writeFile(resolve(artifactDirectory, 'DOXAToken.json'), JSON.stringify({
  contractName: 'DOXAToken',
  sourceName: 'contracts/DOXALaunchpad.sol',
  abi: token.abi,
  bytecode: `0x${token.evm.bytecode.object}`,
  deployedBytecode: `0x${token.evm.deployedBytecode.object}`,
}, null, 2))
console.log('Compiled DOXALaunchpad and DOXAToken into contract-artifacts/.')