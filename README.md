# ChainTrust

Public identity registry for Web3 entities on Solana.

ChainTrust links legal entities, wallets, projects, domains, and issuer-signed attestations in a public, append-only graph. The current codebase is a Next.js 14 dApp backed by an Anchor program on Solana. Community comments still exist, but the core product is now the entity and relationship registry rather than a review-first app.

## Overview

- File on-chain `Entity` records and derive stable CT-Numbers from 8-byte entity IDs.
- Register `Issuer` accounts with public trust tiers.
- Create `Project` records under an entity.
- Attest signed relationships such as `OPERATES_PROJECT`, `CONTROLS_WALLET`, `HAS_DOMAIN`, `PARENT_OF`, and `AUDITED_BY`.
- Resolve a CT-Number, wallet, or domain back to an entity and inspect its evidence trail.
- Allow community comments, replies, likes, and append-only official responses.
- Optionally dual-write relationship attestations to the Solana Attestation Service (SAS).

Program ID: `HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt`

## Stack

- Frontend: Next.js 14, React 18, Tailwind CSS
- Wallets: Solana Wallet Adapter, Phantom, Solflare
- On-chain: Anchor 0.30.1 program in `anchor/`
- Storage: local `mock://` storage by default, optional Pinata-backed `ipfs://`
- Human verification: optional World ID gate for profile registration
- Interop: optional SAS dual-write for relationship attestations

## Repository Layout

```text
.
├── app/                         # Next.js App Router pages and API routes
├── components/                  # UI components: forms, graph, review list, wallet UI
├── lib/
│   ├── anchor/                  # IDL, PDA helpers, read/write client, React hooks
│   ├── mock/                    # Mock DNS, storage, and World ID state
│   ├── sas/                     # SAS config, PDA helpers, instruction builders
│   ├── storage/                 # Storage abstraction: mock or Pinata/IPFS
│   └── utils/                   # Hashing, formatting, validation, CT-Number helpers
├── anchor/                      # Anchor workspace and Solana program
├── scripts/sas-bootstrap.ts     # One-time SAS bootstrap script
├── types/                       # TypeScript account and metadata types
├── ChainTrust_Product_Design.md
└── ChainTrust_Product_Design_CN.md
```

## On-Chain Model

### Accounts

| Account | Purpose | PDA seeds |
| --- | --- | --- |
| `UserProfile` | User identity and metadata URI | `["user", wallet]` |
| `Issuer` | Attestor authority, kind, trust tier | `["issuer", authority]` |
| `Entity` | Legal entity anchor for the registry | `["entity", entity_id]` |
| `Project` | Project filed under an entity | `["project", entity, project_id]` |
| `Relationship` | Signed edge from entity to wallet/domain/project/entity/person | `["rel", entity, kind, target_ref, issuer]` |
| `CommentRecord` | Community signal or reply | `["comment", entity, commenter, comment_index]` |
| `LikeRecord` | Like state for a comment | `["like", comment, liker]` |

### Instructions

`register_user`, `update_user_metadata_uri`, `register_issuer`, `create_entity`, `create_project`, `attest_relationship`, `revoke_relationship`, `claim_entity`, `submit_comment`, `submit_reply`, `like_comment`, `unlike_comment`, `add_official_response`

### Important invariants

- No delete path for relationships or comments.
- Revocation marks `Relationship.revoked_at`; it does not erase history.
- Official responses append a new URI; they do not mutate the original comment body or hash.

## Key Screens

- `/`: registry home, stats, recent entities, quick resolve
- `/resolve`: resolve CT-Number, wallet, or domain to an entity
- `/create`: file a new entity
- `/entry/[entryId]`: entity profile, graph, relationships, projects, signals, raw view
- `/attest`: guided attestation flow
- `/issuers`: issuer registry and trust tier list
- `/issuer/register`: issuer self-registration
- `/register`: user registration with optional World ID verification

## Local Development

### Prerequisites

- Node.js 20+
- Rust and Cargo
- Solana CLI 1.18+
- Anchor CLI compatible with `anchor-lang` 0.30.1

If `anchor build` fails with an `edition2024` / platform-tools error, update your Solana platform tools before building.

### 1. Install dependencies

```bash
npm install
cd anchor && npm install
```

### 2. Point the frontend at localnet

The frontend defaults to `devnet` when no RPC env var is set. For local development, set:

```bash
NEXT_PUBLIC_SOLANA_RPC=http://127.0.0.1:8899
```

Add it to `.env.local` before running the app.

### 3. Build the program

```bash
cd anchor && anchor build
```

If you rebuild the program, sync the generated frontend artifacts:

```bash
cp anchor/target/idl/chaintrust.json lib/anchor/idl/chaintrust.json
cp anchor/target/types/chaintrust.ts lib/anchor/idl/chaintrust.ts
```

### 4. Start a validator and deploy

Terminal A:

```bash
solana-test-validator --reset
```

Terminal B:

```bash
solana config set --url http://127.0.0.1:8899
solana airdrop 10
cd anchor && anchor deploy --provider.cluster localnet
```

### 5. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Suggested Demo Flow

1. Connect a wallet and register a `UserProfile`.
2. File an `Entity` from `/create`.
3. Register the same wallet as an `Issuer`.
4. File an attestation from `/attest`.
5. Resolve the entity by CT-Number, wallet, or domain on `/resolve`.
6. Open the entity page to inspect the graph, relationship list, comments, and official responses.

## Environment Variables

Put local overrides in `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SOLANA_RPC` | Recommended | RPC endpoint for the frontend. If omitted, the app falls back to `NEXT_PUBLIC_RPC_URL`, then `devnet`. |
| `NEXT_PUBLIC_RPC_URL` | Optional | Legacy RPC fallback alias. |
| `NEXT_PUBLIC_WORLDID_APP_ID` | Optional | Enables the World ID registration gate when paired with RP ID. |
| `NEXT_PUBLIC_WORLDID_RP_ID` | Optional | World ID relying party ID. |
| `NEXT_PUBLIC_WORLDID_ACTION` | Optional | World ID action name. Defaults to `register-chaintrust-user`. |
| `NEXT_PUBLIC_WORLDID_ENV` | Optional | `staging` or `production`. |
| `WORLDID_RP_SIGNING_KEY` | Optional | Server-side key for `/api/worldid/rp-signature`. |
| `PINATA_JWT` | Optional | Server-side Pinata JWT. If absent, uploads use local mock storage. |
| `NEXT_PUBLIC_PINATA_GATEWAY` | Optional | Public Pinata gateway host for reading pinned content. |
| `PINATA_GATEWAY` | Optional | Server-side fallback gateway host. |
| `NEXT_PUBLIC_SAS_DUAL_WRITE` | Optional | Enables SAS dual-write on relationship attestations. |
| `NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY` | Optional | Authority used to derive the shared SAS credential PDA. |

## Storage Modes

- Without `PINATA_JWT`, uploads are written to local mock storage under `data/mock-storage/` and returned as `mock://...` URIs.
- With `PINATA_JWT`, public uploads are pinned to IPFS and returned as `ipfs://...` URIs.
- Sensitive evidence is flagged as sensitive today, but not yet encrypted. The storage interface is prepared for a future Lit Protocol layer.

## SAS Dual-Write

To mirror `Relationship` attestations into SAS:

1. Bootstrap the platform credential and schemas:

```bash
npm run sas:bootstrap
```

2. Set:

```bash
NEXT_PUBLIC_SAS_DUAL_WRITE=true
NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY=<bootstrap-authority-pubkey>
```

3. Make sure any wallet that signs attestations is in the credential's `authorized_signers` list.

## Current Limitations

- `anchor/tests/smoke.ts` still targets an older API shape (`create_entry`, `add_wallet_mapping`, older account names) and should be rewritten before relying on it as a current end-to-end test.
- DNS verification is still mocked.
- Sensitive evidence is not encrypted yet.
- Reads currently depend on `getProgramAccounts` filters rather than a dedicated indexer.

## Notes

- The current design direction is documented in `ChainTrust_Product_Design.md`.
- The Chinese product document lives in `ChainTrust_Product_Design_CN.md`.
- A Chinese version of this README is available at `README_CN.md`.
