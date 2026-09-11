# DOXA.xyz on Replit

## Run the web app

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5000
```

The Replit workflow is named `Start application` and serves the Vite app on port 5000.

## Arc Testnet contract

The frontend uses the deployed `DOXALaunchpad` contract at:

`0x1fbaaf6fb624d975e89c6e12313a161c38c15904`

Network details:

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.io`
- Explorer: `https://testnet.arcscan.app`

The Create page calls `createLaunch` and requires a connected wallet on Arc Testnet. The Wallet page reads native USDC, ERC-20 USDC, created launches, and token balances from the connected wallet.

The deployed contract currently sends its 1% trading fee to the treasury and does not implement creator fee sharing. The Wallet page displays this as `0% creator share` rather than showing an invented reward balance.