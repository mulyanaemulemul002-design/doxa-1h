# DOXA.xyz

DOXA is a meme launchpad UI and testnet contract for Arc.

## Arc Testnet

- RPC: `https://rpc.testnet.arc.io`
- Chain ID: `5042002`
- Explorer: `https://testnet.arcscan.app`
- Native gas token: USDC, 18 decimals
- ERC-20 USDC interface: `0x3600000000000000000000000000000000000000`

## Contract

`contracts/DOXALaunchpad.sol` is a testnet-first pump.fun-style launchpad:

- Each launch deploys a fixed-supply ERC-20 token.
- Buys and sells use the Arc native USDC balance.
- A constant-product curve uses virtual reserves.
- A configurable platform fee is sent to the treasury.
- Trading stops at the graduation target.
- Graduation does not migrate liquidity yet; that requires a separate audited DEX integration.

The configured testnet admin and treasury are:

- Admin: `0x662ddf7d320b229f701e5e628e3ff6dec9c05855`
- Treasury: `0x4b1060f52c4af453d02826cd855f4866a6735190`

These addresses are public configuration, not credentials.

## Compile and deploy

```bash
npm install
npm run contract:compile
```

For a deployment, put the deployer private key in Replit Secrets as `PRIVATE_KEY`; never commit it or paste it into chat. Then run:

```bash
npm run contract:deploy
```

Optional environment variables are documented in `.env.example`. The default testnet parameters are a `10,000 USDC` graduation target and a `1%` fee. The deployment script writes the public result to `deployments/arc-testnet.json`, which is intentionally ignored until the address is reviewed.

This contract is not audited and is intended for Arc Testnet only.