# Carapace Console

The human-facing side of Carapace: view a policy's live spending caps and
allowance, approve or deny pending Intents (wallet-signed), and see a
verifiable activity feed decoded straight from on-chain event logs. See the
[repo root README](../../README.md) and [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)
for how this fits into the rest of Carapace.

This app reads on-chain state directly via `@solana/web3.js` and
`@coral-xyz/anchor` — there is no backend/database beyond Solana's own RPC
and the Blinks API routes (`src/app/api/actions/`), which build unsigned
transactions server-side but never hold a key of their own.

## Running it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Connect any Wallet-Standard-compliant wallet
(Phantom, Solflare, Backpack, ...) — no explicit adapter wiring needed, they
auto-register themselves.

For a quick local loop with no devnet funds required, see the root
`docs/SETUP.md` for spinning up `surfpool` (a local validator), deploying
`programs/carapace`, and running `programs/carapace/manual/init-test-policy.js`
to create a funded, allow-listed test policy — then select **Localnet** from
the cluster dropdown in the header.

## Environment variables

All optional — sensible defaults are baked into `src/lib/config.ts`. Set
these in `.env.local` to point at your own RPC providers (recommended for
anything beyond local development; public RPC endpoints are rate-limited):

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CARAPACE_PROGRAM_ID` | the program ID this repo deploys (`GuZ6yoSDkTcYh2PKAeoDdb51ZhP9i7pRhL6MGrZXST8L`) | Override if you deployed your own instance with a different program keypair. |
| `NEXT_PUBLIC_DEVNET_RPC_URL` | `https://api.devnet.solana.com` | Point at Helius/QuickNode/etc. for a devnet endpoint that isn't rate-limited. |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | `https://api.mainnet-beta.solana.com` | Same, for mainnet-beta. |
| `NEXT_PUBLIC_LOCALNET_RPC_URL` | `http://127.0.0.1:8899` | Only needed if your local validator runs on a non-default port. |
| `NEXT_PUBLIC_DEFAULT_CLUSTER` | `devnet` | Which cluster is pre-selected on load (`localnet`, `devnet`, or `mainnet-beta`). |

If you change `NEXT_PUBLIC_CARAPACE_PROGRAM_ID`, also replace
`src/lib/carapace/idl.json` and `src/lib/carapace/carapace-idl-types.ts` with
your own build's `programs/carapace/target/{idl,types}/carapace.{json,ts}` —
these are checked-in copies of Anchor's generated output, not fetched at
runtime, since regenerating them requires the full Anchor toolchain.

## The Blinks endpoint

`GET /api/actions/intent/[intentAddress]?cluster=<id>` renders a Blink card
for a pending Intent; `POST` (with `{"account": "<pubkey>"}`) returns an
unsigned `approve_intent`/`deny_intent` transaction for that wallet to sign.
`public/actions.json` registers the route pattern so Blink-aware clients
discover it automatically from the domain root.

**To actually test a Blink** (not just curl the JSON) you need an HTTPS URL
a wallet's Blink renderer can fetch — `localhost` won't work from a wallet's
in-app browser or a site like `dial.to`. Either deploy the app (Vercel's
preview URLs are HTTPS by default) or tunnel your local dev server (e.g.
`ngrok http 3000`) and use that origin when building the Blink link. The
in-app "copy Blink link" button on each pending Intent card builds the link
from `window.location.origin`, so it works correctly once served over HTTPS.

## Production build

```bash
npm run build
npm run start
```

No environment-specific build step beyond the variables above — this is a
static-friendly Next.js app (App Router, mostly client components) plus two
lightweight Node.js Route Handlers for the Blinks endpoint, deployable
anywhere Next.js runs (Vercel, or any Node host).
