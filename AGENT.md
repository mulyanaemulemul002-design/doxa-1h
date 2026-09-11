# DOXA.xyz — Meme Launchpad on ARC (Testnet Phase)

## 1. Project Overview
DOXA.xyz is a meme coin launchpad built on ARC Network (Circle's EVM-compatible, USDC-gas L1, currently in public testnet). It follows a bonding-curve launch model similar to pump.fun, adapted for ARC's USDC-native economics.

**Current phase:** UI/UX build only. No smart contracts yet — all on-chain logic (bonding curve, token factory, oracle, migration) is placeholder/mock at this stage. Contracts will be built afterward in a separate pass.

## 2. Brand & Visual Identity

- **Primary color:** Mint / spring green — approx `#2EE6A0` (sample and lock the exact hex from the provided logo asset before implementation)
- **Background:** Pure black `#000000` or near-black `#0A0A0A`
- **Logo:** Geometric "D" mark built from angular, monoline strokes forming an X/arrow motif inside the D — sharp edges, no gradients, no rounded softness
- **Design principles:**
  - Minimal color palette — mint green + black + white/gray text only. No rainbow accents, no gradient noise.
  - Clean, proper, uncluttered layouts — generous whitespace, no visual clutter
  - Sharp/geometric edges over soft rounded corners, echoing the logo's angular style
  - Typography: bold, modern, monospace or geometric sans for headers (crypto-native feel); clean sans for body text
  - Avoid busy dashboards — prioritize clarity over density

## 3. Tech Approach (this phase)

- Frontend only — no wallet transaction logic wired to real contracts yet
- All token/price/bonding-curve data should be **mocked/hardcoded or from local state**, structured so it's easy to swap in real contract calls later
- Price logic should assume USDC as the base/quote currency (matching ARC's native gas token), even though the oracle feeding it is fake for now
- Build with swap-in points clearly marked (e.g. `// TODO: replace mock oracle with real price feed`, `// TODO: wire to token factory contract`)

## 4. Core Screens / Features (UI-first scope)

1. **Landing / Explore page**
   - Grid or list of launched tokens (mock data)
   - Each card: token image, name/ticker, bonding curve progress %, market cap (USDC), 24h change (mock)
   - Sort/filter: trending, new, about to graduate

2. **Create Token page**
   - Form: name, ticker, description, image upload, optional socials
   - Preview card before "launch" (submit is mocked — no real deploy yet)

3. **Token Detail / Trade page**
   - Price chart (mock data, USDC-denominated)
   - Bonding curve progress bar toward graduation threshold
   - Buy/Sell panel (UI only — amounts calculated against mock oracle price, no real transaction)
   - Holder list / recent trades (mock)

4. **Graduation / Migration indicator**
   - Visual state showing "Graduated → Migrating to Uniswap (ARC Mainnet)" as a future-state placeholder — not functional yet, just UI communicating the roadmap

## 5. Mock Data Layer Requirements

- Mock oracle: a simple local module/service returning a fake USDC price per token, structured so it can later be replaced by a real price feed call
- Mock token list: seed with several sample tokens with varying bonding curve progress (0%, 40%, 90%, graduated) to test all UI states
- Migration status field per token: `active | graduating | migrated` — drives the graduation UI state

## 6. Explicitly Out of Scope (this phase)

- Real smart contract deployment or calls
- Real wallet connection / signing transactions
- Real Uniswap migration logic
- Real oracle/price feed integration

## 7. Naming & Domain
- Project name: **DOXA.xyz**
- All UI copy, page titles, and metadata should reference this name consistently
