# ChainTrust

**Public identity & attestation registry for Web3 entities, on Solana.**

ChainTrust links legal entities, wallets, projects, domains, officers, and issuer-signed attestations into one public, append-only graph. Anyone can resolve a wallet, domain, or short CT-Number back to the entity behind it and inspect every piece of signed evidence on the way.

The current codebase is a Next.js 14 dApp backed by an Anchor program on Solana. Community comments, replies, likes, and append-only official responses are still part of the surface, but the core product is the entity / relationship graph — not a review-first app.

> **Hackathon submission for Solana Colosseum.**
> Program is live on **devnet**: [`4RXkYhxr3xJ4YitCibcwA1CRpNpY7YgX6m3rv2uxPfBg`](https://explorer.solana.com/address/4RXkYhxr3xJ4YitCibcwA1CRpNpY7YgX6m3rv2uxPfBg?cluster=devnet)
> (The earlier v4.1 deployment `HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt` is retired — the governance/attestor split changed the `RegistryConfig` layout, so the new build deploys under a fresh id. New versions are currently being built under a private repo. )
> -- https://chaintrust-staging.vercel.app/ --This is the latest prject website. (chaintrust-web3.vercel.app was the old version)

[中文版 README](./README_CN.md)

---

## What it does

- File on-chain `Entity` records keyed by a **deterministic** 5-byte `entity_id` derived from `(country, id_type, id_value)`. The CT-Number — formatted `CT-1XXX-XXXXXC` (version + 8 Crockford-base32 chars + mod-37 check char) — is a 1:1 encoding of `entity_id`, so the same primary identifier always yields the same Entity PDA, computable client-side from public inputs alone.
- Attach **multiple identifiers** to one Entity via `IdClaim` PDAs (e.g. EIN + SEC CIK + state filing — up to 5). Each IdClaim is a global uniqueness reservation that resolves `(country, id_type, id_value) → Entity` in O(1).
- Register `Issuer` accounts with a public 3-tier trust level (1 = platform, 2 = known third party, 3 = community / self).
- Create `Project` records under an entity.
- Attest signed `Relationship` edges between entities, wallets, domains, projects, officers, UBOs, auditors, and parent / subsidiary entities.
- Resolve any CT-Number, registry identifier, wallet, or domain back to the entity that owns it and inspect the full evidence trail.
- Allow community comments, threaded replies, likes, and append-only official responses.
- Gate user registration with an on-chain proof-of-personhood PDA backed by World ID.
- Optionally dual-write relationship attestations to the Solana Attestation Service (SAS).

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS |
| Wallets | Solana Wallet Adapter (Phantom, Solflare, …) |
| On-chain | Anchor 0.30.1 program in [`anchor/`](anchor/) |
| Storage | Pinata IPFS (`ipfs://`) when configured, local mock fallback (`mock://`) otherwise |
| RPC / indexing | Helius RPC (devnet/mainnet), optional Helius webhook receiver |
| Identity gate | World ID IDKit on the client, server-verified, anchored on-chain via `HumanProof` PDA |
| i18n | English / 中文 toggle |
| Interop | Optional Solana Attestation Service dual-write |

## Repository layout

```text
.
├── app/                          # Next.js App Router pages and API routes
│   ├── (pages)                   # /, /resolve, /create, /entry/[id], /attest,
│   │                             # /issuers, /issuer/register, /issuer/admin,
│   │                             # /register, /profile/[wallet]
│   └── api/                      # worldid, upload, helius, mock, dev/humanproof
├── components/                   # Forms, identity graph, comment list, navbar, …
├── lib/
│   ├── anchor/                   # IDL, PDA helpers, read/write client, React hooks
│   ├── helius/                   # RPC URL resolution, webhook helpers
│   ├── i18n/                     # Language provider + dictionary (en / zh)
│   ├── mock/                     # Mock DNS, local storage, World ID staging cache
│   ├── sas/                      # SAS config, PDA helpers, instruction builders
│   ├── server/                   # Admin keypair, audit log, rate limit, nonce,
│   │                             # signature verification, anchor-server provider
│   ├── storage/                  # Storage abstraction: Pinata or mock
│   └── utils/                    # CT-Number, hash, format, validation
├── anchor/                       # Anchor workspace (program in programs/chaintrust)
├── scripts/
│   ├── init-registry.ts          # One-time RegistryConfig PDA bootstrap
│   ├── sas-bootstrap.ts          # One-time SAS credential + 9 schemas
│   └── helius-setup-webhook.ts   # CRUD for the Helius transaction webhook
├── types/                        # TypeScript account snapshots & metadata shapes
├── ChainTrust_Product_Design.md  # Product design (EN)
└── ChainTrust_Product_Design_CN.md
```

---

## On-chain model

### Accounts

| Account              | Purpose                                                                  | PDA seeds                                       |
|----------------------|--------------------------------------------------------------------------|-------------------------------------------------|
| `RegistryConfig`     | Holds the registry admin authority. Created once after deploy.           | `["config"]`                                    |
| `UserProfile`        | User identity + metadata URI                                             | `["user", wallet]`                              |
| `HumanProof`         | Anti-sybil gate — proves a wallet was bound to a unique World ID         | `["humanproof", wallet]`                        |
| `NullifierRecord`    | Companion of `HumanProof`, indexed by World ID nullifier                 | `["nullifier", nullifier_hash]`                 |
| `Issuer`             | Attestor authority: kind, trust tier, name hash, metadata URI            | `["issuer", authority]`                         |
| `IssuerTierRequest`  | Pending / approved / rejected tier-upgrade request                       | `["issuer_tier_request", issuer, requested_tier]` |
| `Entity`             | Legal-entity anchor; carries the 5-byte deterministic `entity_id`        | `["entity", entity_id]` (5-byte id)             |
| `IdClaim`            | Global uniqueness reservation for one `(country, id_type, id_value)` tuple, pointing at the Entity. Up to 5 per Entity. | `["id-claim", sha256(country\|id_type\|normalize(id_value))]` |
| `Project`            | A project filed under an entity                                          | `["project", entity, project_id]`               |
| `Relationship`       | Signed edge from entity to wallet / domain / project / entity / person   | `["rel", entity, kind, target_ref, issuer]`     |
| `CommentRecord`      | Top-level community signal or threaded reply (max depth 2)               | `["comment", entity, commenter, comment_index]` |
| `LikeRecord`         | Per-wallet like state for a comment                                      | `["like", comment, liker]`                      |

### Instructions

```
initialize_registry_config   update_registry_admin

register_user                update_user_metadata_uri
attest_human_proof           (admin only — anti-sybil gate)

register_issuer              request_issuer_tier   review_issuer_tier (admin)

create_entity                register_additional_id   update_entity_metadata_uri
create_project               claim_entity
attest_relationship          revoke_relationship

submit_comment               submit_reply
like_comment                 unlike_comment
add_official_response
```

### Deterministic CT-Number

The CT-Number is **not allocated**, it is **computed**:

```
primary_id = (country, id_type, normalize(id_value))
hash       = SHA-256(`${country}|${id_type}|${normalized}`)
entity_id  = hash[0..5]                       // 5 bytes
payload    = base32Crockford(entity_id)       // 8 chars
check      = mod37CheckChar(entity_id)        // 1 char
ct         = `CT-1<3 payload>-<5 payload><check>`   // e.g. CT-1ABC-DEFGHK
```

The leading `1` is a version letter so the encoding can be widened later without breaking historical CTs. The trailing check char catches ~95% of single-character typos and adjacent transpositions when the CT is dictated, photographed, or re-typed. Older `CT-XXXX-XXXX` strings (no version, no check) from the prior random-id design are explicitly rejected by the parser. See [`lib/utils/ct-number.ts`](lib/utils/ct-number.ts) for the reference implementation.

### Multi-identifier filing

`create_entity` atomically creates an `Entity` PDA and the **primary** `IdClaim` PDA for the identifier you filed it under. Additional identifiers (e.g. a US company that wants to publish both EIN and SEC CIK) go through `register_additional_id`:

- Pre-claim, only the original `created_by` wallet can attach more identifiers.
- Post-claim, only the `official_wallet` can — the legal entity now controls its own identity record.
- Hard cap of 5 identifiers per Entity (`MAX_IDENTIFIERS_PER_ENTITY`).
- Each new identifier gets its own `IdClaim` PDA, so it's both globally unique (Anchor `init` rejects duplicates) and individually resolvable in O(1).

Legal name and the human-readable identifier values are intentionally stored only in IPFS metadata — see [Storage modes](#storage-modes) and the `On-chain vs Off-chain Split` section of [`ChainTrust_Product_Design_2.md`](ChainTrust_Product_Design_2.md) for the rationale.

### Relationship kinds

| Kind | Code | `target_ref` interpretation     |
|------|------|----------------------------------|
| `OPERATES_PROJECT` | 1 | Project PDA                       |
| `DEPLOYS_WALLET`   | 2 | Wallet pubkey                     |
| `CONTROLS_WALLET`  | 3 | Wallet pubkey                     |
| `HAS_DOMAIN`       | 4 | `sha256(domain)`                  |
| `SUBSIDIARY_OF`    | 5 | Parent Entity PDA                 |
| `PARENT_OF`        | 6 | Child Entity PDA                  |
| `HAS_UBO`          | 7 | `sha256(person_id)`               |
| `HAS_OFFICER`      | 8 | Officer wallet pubkey             |
| `AUDITED_BY`       | 9 | Issuer PDA                        |

### Anti-sybil gate (`HumanProof`)

`register_user` requires a `HumanProof` PDA at `["humanproof", wallet]`. The PDA can only be created by the registry admin via `attest_human_proof`. The flow is:

1. Client passes World ID IDKit, gets a proof + nullifier hash.
2. Client signs a fresh server-issued nonce with the wallet (proves the caller actually controls the wallet).
3. `POST /api/worldid/verify` verifies the proof upstream against `developer.worldcoin.org`, verifies the wallet signature, then sends an `attest_human_proof` tx signed by `REGISTRY_ADMIN_KEYPAIR`.
4. The instruction `init`s both `HumanProof[wallet]` and `NullifierRecord[nullifier_hash]`. The `init` on the nullifier record is what makes binding the same World ID to a second wallet fail.
5. `register_user` is now unblocked for that wallet.

### Issuer trust tiers

Self-registration is restricted to **Tier 3** (community). Upgrades go through review:

1. Issuer calls `request_issuer_tier(2 or 1, note_hash, note_uri)`.
2. Registry admin reviews and calls `review_issuer_tier(approve)`.
3. On approval, `Issuer.trust_tier` is updated. On rejection, the request is closed.

The `/issuer/admin` page lets the admin wallet review pending requests interactively.

### Claiming an entity

`claim_entity` flips `Entity.is_claimed = true` and sets `official_wallet`, but only if the caller can present a `HAS_OFFICER` relationship that:
- targets exactly the caller's wallet,
- belongs to the entity being claimed,
- is not revoked,
- was issued by an issuer of trust tier 1 or 2.

This is what unlocks `add_official_response` for community comments.

### Invariants

- No delete path for `Relationship`, `CommentRecord`, `Entity`, `IdClaim`, `Issuer`, or `Project`. `LikeRecord` is the only account that can be closed (via `unlike_comment`); the parent comment stays.
- Revocation only writes `Relationship.revoked_at`; history is never erased.
- `add_official_response` only appends a URI; the original comment body and hash are immutable.
- Top-level comments allow at most one official response.
- Reply depth is hard-capped at 2.
- `entity_id` is a deterministic function of the primary identifier — there is no `entity_id` argument that callers can supply. Anchor `init` on the Entity PDA + the primary IdClaim PDA atomically rejects duplicate filings of the same `(country, id_type, id_value)`.
- `register_additional_id` is hard-capped at 5 identifiers per Entity. Pre-claim, only `Entity.created_by` can extend; post-claim, only `Entity.official_wallet` can.
- `update_entity_metadata_uri` rotates the IPFS pointer only — the CT-Number, the `entity_id`, and every IdClaim attached to the Entity are immutable.

---

## Pages

| Route                 | Purpose                                                                 |
|-----------------------|-------------------------------------------------------------------------|
| `/`                   | Stats, recent entities, quick resolve, attestation sample               |
| `/resolve`            | Resolve a CT-Number, wallet, or domain to its entity                    |
| `/create`             | File a new entity                                                       |
| `/entry/[entryId]`    | Entity profile: identity graph, relationships, projects, signals, raw   |
| `/attest`             | Guided attestation form (8 relationship verbs)                          |
| `/issuers`            | Issuer registry + trust-tier reference                                  |
| `/issuer/register`    | Self-register as a Tier 3 issuer; request upgrade to Tier 2/1           |
| `/issuer/admin`       | Admin-only: review pending tier requests                                |
| `/register`           | World ID + wallet-signature gate, then `register_user`                  |
| `/profile/[wallet]`   | Profile, entities created, attestations issued                          |

## API routes

| Route                          | Method | Purpose                                                                |
|--------------------------------|--------|------------------------------------------------------------------------|
| `/api/worldid/challenge`       | GET    | Mint a single-use nonce for a wallet to sign                           |
| `/api/worldid/verify`          | POST   | Verify IDKit proof + wallet signature, then `attest_human_proof`        |
| `/api/worldid/check`           | GET    | Cheap pre-check: has this wallet already passed the gate?              |
| `/api/worldid/rp-signature`    | POST   | Server-side signature for IDKit relying-party flow                     |
| `/api/upload/challenge`        | GET    | Mint a single-use nonce for the upload flow                            |
| `/api/upload`                  | POST   | Auth + rate-limited binary upload (PDF / PNG / JPEG / WebP)            |
| `/api/upload/image`            | POST   | Auth + rate-limited image-only upload                                  |
| `/api/upload/metadata`         | POST   | Auth + rate-limited JSON metadata upload                               |
| `/api/helius/webhook`          | POST   | Receives Helius enhanced-tx deliveries; appends to chain-events log    |
| `/api/dev/humanproof`          | POST   | Dev-only shortcut to mint HumanProof without World ID (disabled in prod) |
| `/api/mock/upload` / `fetch` / `verify` / `upload-image` | GET/POST | Local dev fallbacks when Pinata / IDKit aren't configured |

All write-heavy routes require:
- A wallet pubkey header
- An ed25519 signature over a server-issued nonce
- A per-wallet rate-limit token bucket
- An entry in [`data/audit/upload.log`](data/audit/) (file is created on first request)

---

## Local development

### Prerequisites

- Node.js 20+
- Rust + Cargo
- Solana CLI 1.18+
- Anchor CLI compatible with `anchor-lang` 0.30.1

If `anchor build` fails with an `edition2024` / platform-tools error, install platform-tools v1.54+ first.

### 1. Install

```bash
npm install
cd anchor && npm install && cd ..
```

### 2. Configure env

Copy `.env.local.example` (or copy from the table below) into `.env.local`. For pure local dev:

```bash
NEXT_PUBLIC_SOLANA_RPC=http://127.0.0.1:8899
SOLANA_RPC_URL=http://127.0.0.1:8899
REGISTRY_ADMIN_KEYPAIR_JSON=<JSON array of your local admin keypair>
```

### 3. Build the program

```bash
cd anchor && anchor build
# Sync the generated artifacts back to the frontend:
cp anchor/target/idl/chaintrust.json lib/anchor/idl/chaintrust.json
cp anchor/target/types/chaintrust.ts  lib/anchor/idl/chaintrust.ts
```

### 4. Validator + deploy

Terminal A:

```bash
solana-test-validator --reset
```

Terminal B:

```bash
solana config set --url http://127.0.0.1:8899
solana airdrop 10
cd anchor && anchor deploy --provider.cluster localnet && cd ..
# One-time: create the RegistryConfig PDA. Requires bootstrap admin signer.
npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/init-registry.ts
```

> The bootstrap admin pubkey is **hardcoded** in [`anchor/programs/chaintrust/src/constants.rs`](anchor/programs/chaintrust/src/constants.rs) as `REGISTRY_BOOTSTRAP_ADMIN`. Edit the constant and rebuild before deploying somewhere new.

### 5. Run the app

```bash
npm run dev   # http://localhost:3000
```

### Suggested demo flow

1. Connect a wallet, go to `/register`, pass the World ID + signature gate, then `register_user`.
2. File an `Entity` from `/create` — pick a country + identifier type + identifier value (e.g. `US` / `EIN` / `94-2404110`). The CT-Number previewed in the form is computed locally before the tx, and will be the same for anyone else who files the same identifier.
3. (Optional) On the entity page, attach a second identifier (e.g. `US` / `SEC_CIK` / `0000320193`) — both identifiers will resolve to the same Entity.
4. Self-register the same wallet as a Tier 3 issuer at `/issuer/register`.
5. From `/attest`, sign an `OPERATES_PROJECT` or `HAS_DOMAIN` attestation.
6. From `/resolve`, search by CT-Number, by `country:id_type:id_value`, by wallet, or by domain — you should land on the entity page in every case.
7. Open the entity page: identity graph, relationships, projects, comments, raw view.
8. (Optional) From the entity page, leave a comment; if claimed, post an official response.

---

## Environment variables

Put local overrides in `.env.local`. Mark the sensitive ones as Sensitive when promoting to a host like Vercel.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SOLANA_RPC`               | recommended | Frontend RPC endpoint. Falls back to `NEXT_PUBLIC_RPC_URL`, then `NEXT_PUBLIC_HELIUS_RPC_URL`, then `devnet`. |
| `NEXT_PUBLIC_HELIUS_RPC_URL`           | recommended | Helius RPC URL with API key, used by client + server when set. |
| `SOLANA_RPC_URL`                       | recommended | Server-side RPC (admin-keypair routes). |
| `NEXT_PUBLIC_RPC_URL`                  | optional | Legacy alias. |
| `NEXT_PUBLIC_WORLDID_APP_ID`           | required for prod | World ID app id (`app_…`). |
| `NEXT_PUBLIC_WORLDID_RP_ID`            | optional | Relying-party id (`rp_…`). |
| `NEXT_PUBLIC_WORLDID_ACTION`           | optional | Action name. Defaults to `register-chaintrust-user`. |
| `NEXT_PUBLIC_WORLDID_ENV`              | optional | `staging` or `production`. |
| `WORLDID_RP_SIGNING_KEY`               | optional | **Sensitive.** Server-side key for `/api/worldid/rp-signature`. |
| `REGISTRY_ADMIN_KEYPAIR_JSON`          | required | **Sensitive.** JSON array of 64 bytes. Signs `attest_human_proof`. |
| `REGISTRY_ADMIN_KEYPAIR_BASE58`        | optional | **Sensitive.** Base58 alternative to the JSON form. |
| `PINATA_JWT`                           | required for prod | **Sensitive.** Pinata JWT. Without it, uploads fall back to local mock and **break on serverless**. |
| `NEXT_PUBLIC_PINATA_GATEWAY`           | optional | Public Pinata gateway hostname (no scheme). |
| `PINATA_GATEWAY`                       | optional | Server-side gateway fallback. |
| `HELIUS_API_KEY`                       | optional | Used by `npm run helius:*` scripts to manage the webhook. |
| `HELIUS_CLUSTER`                       | optional | `devnet` or `mainnet-beta`. |
| `HELIUS_WEBHOOK_URL`                   | optional | Public URL of `/api/helius/webhook`. |
| `HELIUS_WEBHOOK_AUTH`                  | optional | **Sensitive.** Shared secret enforced by the webhook route. |
| `NEXT_PUBLIC_SAS_DUAL_WRITE`           | optional | `true` enables SAS dual-write on relationship attestations. |
| `NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY` | optional | Authority used to derive the shared SAS credential PDA. |

---

## Storage modes

- **Pinata IPFS (recommended)** — set `PINATA_JWT` and the gateway hostname. Public payloads return `ipfs://<cid>` URIs; binary uploads carry an extension hint (`ipfs://<cid>.png`) so the fetch route can pick a Content-Type without a metadata round-trip.
- **Local mock** — without `PINATA_JWT`, uploads land in `data/mock-storage/` and return `mock://<id>` URIs. This works on a dev machine but **does not work on serverless hosts** (filesystem is ephemeral).
- **Sensitive evidence** — currently only flagged sensitive, not encrypted. The storage interface is shaped to drop a Lit Protocol layer in later.

## Helius webhook (optional)

Helius can stream every transaction touching the program ID into `/api/helius/webhook`. The receiver appends each tx to [`data/audit/chain-events.log`](data/audit/) without decoding the instructions yet — an indexer can read that log later.

```bash
# Set HELIUS_API_KEY, HELIUS_CLUSTER, HELIUS_WEBHOOK_URL, HELIUS_WEBHOOK_AUTH first.
npm run helius:list      # list webhooks under the API key
npm run helius:create    # register the program ID filter pointing at HELIUS_WEBHOOK_URL
npm run helius:delete    # tear down the webhook
```

## SAS dual-write (optional)

To mirror `Relationship` attestations into the Solana Attestation Service:

```bash
npm run sas:bootstrap          # creates the platform Credential + 9 Schemas, one-time
# Then in .env.local:
NEXT_PUBLIC_SAS_DUAL_WRITE=true
NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY=<runner pubkey from the bootstrap step>
```

Any wallet that signs attestations must be listed in the credential's `authorized_signers`.

---

## Deploying

The Anchor program is already live on **devnet** at `HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt`. Frontend is a standard Next.js 14 App Router build (`npm run build`) — Vercel is the easiest host:

1. Push the repo to GitHub.
2. Import into Vercel (Next.js preset auto-detected).
3. In **Environment Variables**, set everything from the table above. Mark `REGISTRY_ADMIN_KEYPAIR_JSON`, `WORLDID_RP_SIGNING_KEY`, `HELIUS_WEBHOOK_AUTH`, and `PINATA_JWT` as Sensitive.
4. Deploy.

To redeploy the program to mainnet later, swap the cluster in `anchor/Anchor.toml`, `anchor build`, `anchor deploy --provider.cluster mainnet`, then flip the RPC env vars.

---

## Current limitations

- `anchor/tests/smoke.ts` still targets an older API shape (`create_entry`, `add_wallet_mapping`) and is not a faithful end-to-end test today.
- DNS verification is mocked (the on-chain `target_ref` is `sha256(domain)`; the off-chain proof of control is a demo).
- Sensitive evidence is not encrypted yet.
- Reads currently rely on `getProgramAccounts` filters; there is no dedicated indexer (the Helius log is a foothold for one).

## Notes

- Product design is documented in [`ChainTrust_Product_Design.md`](ChainTrust_Product_Design.md) and [`ChainTrust_Product_Design_CN.md`](ChainTrust_Product_Design_CN.md).
- A Chinese version of this README lives at [`README_CN.md`](README_CN.md).
