# ChainTrust

An on-chain company identity and reputation layer for Web3 teams on Solana.

> Claim gives voice, not control.

A ChainTrust company entry is a public PDA. Any verified user can create one; any verified user can submit an append-only review; a representative can claim the entry and publish official responses — but cannot delete reviews. This is the hackathon MVP: four account types, six instructions, a Next.js UI, and honest mocks for heavy integrations.

---

## Architecture

```
/
├── anchor/                 # Anchor 0.30.1 program
│   └── programs/chaintrust # lib.rs / state.rs / instructions.rs / errors.rs / constants.rs
├── app/                    # Next.js 14 App Router pages + /api/mock/* routes
├── components/             # UI: navbar, forms, review list, attestations, claim card
├── lib/
│   ├── anchor/             # PDA derivation, client helpers, React hooks, IDL
│   ├── mock/               # dns, storage, verification, attestations
│   └── utils/              # hash, format, validation, cn
└── types/                  # TS types mirroring on-chain accounts
```

### On-chain model

| Account         | Seeds                                  |
|-----------------|----------------------------------------|
| `UserProfile`   | `["user", wallet]`                     |
| `CompanyEntry`  | `["entry", entry_id:8]`                |
| `CommentRecord` | `["comment", entry, commenter, idx:4]` |
| `WalletMapping` | `["wallet_map", target, entry]`        |

Instructions: `register_user`, `create_entry`, `add_wallet_mapping`, `submit_comment`, `claim_entry`, `add_official_response`. **There is intentionally no `delete_comment` and no admin override.**

---

## Quick start

### 0. Prerequisites

- Node 20+ (works with 24)
- Rust + Cargo
- Solana CLI ≥ 1.18
- Anchor CLI 0.30.x — this repo uses 0.32 CLI against anchor-lang 0.30.1, which is fine as long as `platform-tools` v1.54+ is available (newer cargo required by transitive deps)

If your `cargo-build-sbf` reports platform-tools v1.51 and fails with "feature `edition2024` is required", upgrade platform-tools:

```bash
# symlink v1.51 to v1.54 (or install v1.54 directly)
curl -L -o /tmp/pt-1.54.tar.bz2 \
  https://github.com/anza-xyz/platform-tools/releases/download/v1.54/platform-tools-linux-x86_64.tar.bz2
mkdir -p ~/.cache/solana/v1.54/platform-tools
tar -xjf /tmp/pt-1.54.tar.bz2 -C ~/.cache/solana/v1.54/platform-tools
mv ~/.cache/solana/v1.51 ~/.cache/solana/v1.51.old 2>/dev/null || true
ln -s v1.54 ~/.cache/solana/v1.51
```

### 1. Install

```bash
npm install          # frontend
( cd anchor && npm install )  # smoke-test deps
```

### 2. Build the program

```bash
( cd anchor && anchor build )
# outputs: anchor/target/deploy/chaintrust.so
#          anchor/target/idl/chaintrust.json
#          anchor/target/types/chaintrust.ts
# Then copy the artifacts used by the frontend:
cp anchor/target/idl/chaintrust.json lib/anchor/idl/chaintrust.json
cp anchor/target/types/chaintrust.ts lib/anchor/idl/chaintrust.ts
```

### 3. Start a local validator and deploy

```bash
solana-test-validator --reset          # terminal A
solana config set --url http://127.0.0.1:8899
solana airdrop 10                       # fund wallet if needed
( cd anchor && anchor deploy --provider.cluster localnet )
```

### 4. Smoke test (end-to-end, CLI)

```bash
( cd anchor && npm run smoke )
```

The smoke test registers two users, creates an entry, adds a wallet mapping, submits a review, claims the entry, adds an official response, and asserts that (a) `content_hash` is **unchanged** after the official response, (b) non-official responses are rejected, and (c) there is no `delete_comment` instruction in the IDL.

### 5. Run the frontend

```bash
npm run dev
# open http://localhost:3000
```

By default the app reads `NEXT_PUBLIC_SOLANA_RPC` (falling back to `http://127.0.0.1:8899`). Point at devnet by exporting `NEXT_PUBLIC_SOLANA_RPC=devnet`.

---

## Demo script (under 3 minutes)

1. **Register** as Alice. Connect wallet → pick a username → "Create profile on-chain".
2. **Create an entry** for `Acme Protocol`. Attach a primary wallet + one community mapping.
3. **Switch wallets** (or use a different browser profile) to Bob. Register Bob.
4. **Submit a review** as Bob from the entry page. Note the hash and PDA shown under the review.
5. **Switch back to Alice** and click "Start claim". Walk through the mock DNS flow, sign the claim.
6. Under Bob's review, click "Publish official response". Write a response.
7. Observe: the review's `content-hash` and `PDA` are unchanged. The official response is a separate, styled-differently card. The reviewer identity, score, timestamp, and body are intact.

Say out loud: **Claim gives voice, not control.**

---

## What's real vs mocked

**Real (on-chain):**
- wallet connection, `UserProfile`, `CompanyEntry`, `WalletMapping`, `CommentRecord`
- append-only model (no delete instruction)
- claim state transition
- official-response signature check
- content-hash anchoring and comment-count invariants

**Mocked (under `lib/mock/*` and `app/api/mock/*`):**
- DNS verification (`_chaintrust.<domain>` TXT lookup)
- platform verification issuer
- third-party attestation
- storage (local JSON files in `data/mock-storage/`)

Each mock has a clean interface, so swapping in a real adapter (IPFS/pin, DNS-over-HTTPS, SAS attestations) is a drop-in change.

---

## Troubleshooting

**Localnet RPC returns `502 Bad Gateway`** — on WSL2 or machines with an `http_proxy` env var, the proxy intercepts `127.0.0.1:8899`. Bypass it for every shell that talks to the validator or the dev server:

```bash
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY
export no_proxy="127.0.0.1,localhost" NO_PROXY="127.0.0.1,localhost"
```

**`anchor build` fails with `feature edition2024 is required`** — platform-tools v1.51's cargo 1.84 can't parse crates that need Rust 2024 edition (indexmap ≥ 2.14, toml_parser 1.1+, cpufeatures ≥ 0.3). Upgrade to platform-tools v1.54 (see Prerequisites above).

---

## Known limitations (post-hackathon)

- Claim flow is wallet-only; a production build should bind DNS proof via a verifiable attestation.
- User registration has no real anti-sybil check.
- Review metadata is keyed by content hash; no media uploads yet.
- No indexer — entry/profile pages query accounts by `memcmp` filters directly.
# ChainTrust
