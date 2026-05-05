# ChainTrust

**Solana 上的 Web3 实体公开身份与证明注册表。**

ChainTrust 把法人实体、钱包、项目、域名、董事/UBO，以及所有由签发方签名的证明关系，组织成一个**公开、可追溯、只追加**的身份图谱。任何人都能用 CT-Number、钱包地址或域名反查到实体本身，并查看每一条证据的签发链路。

代码库整体是一个 Next.js 14 dApp + Solana 上的 Anchor 程序。社区评论、回复、点赞与"官方追加回应"仍在产品里，但当前主线是**实体与关系图谱**，而不是评论站。

> **Solana Colosseum 黑客松参赛项目。**
> 程序已部署到 **devnet**：[`HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt`](https://explorer.solana.com/address/HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt?cluster=devnet)

[English README](./README.md)

---

## 它能做什么

- 把实体写到链上 `Entity` 账户，并从 8 字节 `entity_id` 派生稳定的 `CT-XXXX-XXXX` 短码。
- 注册 `Issuer`（签发方）账户，公开 3 级信任分层（1=平台，2=已知第三方，3=社区/自助）。
- 在实体名下创建 `Project`。
- 为实体签发 `Relationship` 边：实体 ↔ 钱包 / 域名 / 项目 / 董事 / UBO / 审计方 / 母公司 / 子公司。
- 通过 CT-Number、钱包或域名反向解析到实体，并查看完整证据链。
- 支持社区评论、二级回复、点赞，以及"不改原文"的官方追加回应。
- 注册用户必须先通过链上反女巫闸门（World ID + 钱包签名 → `HumanProof` PDA）。
- 关系证明可选同步双写到 Solana Attestation Service（SAS）。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Next.js 14 App Router、React 18、TypeScript、Tailwind CSS |
| 钱包 | Solana Wallet Adapter（Phantom、Solflare …） |
| 链上 | [`anchor/`](anchor/) 内的 Anchor 0.30.1 程序 |
| 存储 | 配置 Pinata 时使用 IPFS（`ipfs://`），未配置则回退本地 mock（`mock://`） |
| RPC / 索引 | Helius RPC（devnet/mainnet），可选 Helius webhook 接收器 |
| 真人验证 | World ID IDKit（前端）+ 服务端校验 + 链上 `HumanProof` PDA |
| 国际化 | English / 中文 切换 |
| 互操作 | 关系证明可选写入 Solana Attestation Service |

## 仓库结构

```text
.
├── app/                          # Next.js App Router 页面与 API 路由
│   ├── (页面)                    # /, /resolve, /create, /entry/[id], /attest,
│   │                             # /issuers, /issuer/register, /issuer/admin,
│   │                             # /register, /profile/[wallet]
│   └── api/                      # worldid, upload, helius, mock, dev/humanproof
├── components/                   # 表单、身份图谱、评论列表、导航栏等
├── lib/
│   ├── anchor/                   # IDL、PDA 工具、链上读写客户端、React hooks
│   ├── helius/                   # RPC URL 解析、webhook 工具
│   ├── i18n/                     # 语言 Provider 与字典（en / zh）
│   ├── mock/                     # Mock DNS、本地存储、World ID staging 缓存
│   ├── sas/                      # SAS 配置、PDA、指令构造
│   ├── server/                   # admin keypair、审计日志、限流、nonce、
│   │                             # 签名校验、服务端 anchor provider
│   ├── storage/                  # 存储抽象：Pinata 或 mock
│   └── utils/                    # CT-Number、哈希、格式化、校验
├── anchor/                       # Anchor 工作区（程序在 programs/chaintrust）
├── scripts/
│   ├── init-registry.ts          # RegistryConfig PDA 初始化（一次性）
│   ├── sas-bootstrap.ts          # SAS Credential + 9 个 Schema 初始化（一次性）
│   └── helius-setup-webhook.ts   # Helius 交易 webhook 增删查
├── types/                        # TS 账户快照与 metadata 类型
├── ChainTrust_Product_Design.md  # 产品设计（英文）
└── ChainTrust_Product_Design_CN.md
```

---

## 链上模型

### 账户

| 账户 | 用途 | PDA seeds |
|---|---|---|
| `RegistryConfig`     | 保存注册表 admin authority；部署后一次性创建 | `["config"]` |
| `UserProfile`        | 用户身份 + metadata URI | `["user", wallet]` |
| `HumanProof`         | 反女巫闸门——证明该钱包已绑定唯一 World ID | `["humanproof", wallet]` |
| `NullifierRecord`    | 与 `HumanProof` 配对，按 nullifier 索引 | `["nullifier", nullifier_hash]` |
| `Issuer`             | 证明签发方：种类、信任层级、名称哈希、metadata | `["issuer", authority]` |
| `IssuerTierRequest`  | 签发方层级升级请求（pending / approved / rejected） | `["issuer_tier_request", issuer, requested_tier]` |
| `Entity`             | 注册表中的法人锚点 | `["entity", entity_id]`（8 字节 id） |
| `Project`            | 归属某个实体的项目 | `["project", entity, project_id]` |
| `Relationship`       | 从实体指向钱包/域名/项目/实体/人物的签名边 | `["rel", entity, kind, target_ref, issuer]` |
| `CommentRecord`      | 顶层社区评论或回复（最多嵌套 2 层） | `["comment", entity, commenter, comment_index]` |
| `LikeRecord`         | 单个钱包对单条评论的点赞状态 | `["like", comment, liker]` |

### 指令

```
register_user                update_user_metadata_uri
attest_human_proof           （仅 admin —— 反女巫闸门）
initialize_registry_config   update_registry_admin

register_issuer              request_issuer_tier   review_issuer_tier（admin）

create_entity                create_project        claim_entity
attest_relationship          revoke_relationship

submit_comment               submit_reply
like_comment                 unlike_comment
add_official_response
```

### 关系类型

| 类型 | 编码 | `target_ref` 含义 |
|------|------|--------------------|
| `OPERATES_PROJECT` | 1 | Project PDA |
| `DEPLOYS_WALLET`   | 2 | 钱包 pubkey |
| `CONTROLS_WALLET`  | 3 | 钱包 pubkey |
| `HAS_DOMAIN`       | 4 | `sha256(domain)` |
| `SUBSIDIARY_OF`    | 5 | 母公司 Entity PDA |
| `PARENT_OF`        | 6 | 子公司 Entity PDA |
| `HAS_UBO`          | 7 | `sha256(person_id)` |
| `HAS_OFFICER`      | 8 | 该高管的钱包 pubkey |
| `AUDITED_BY`       | 9 | 审计方 Issuer PDA |

### 反女巫闸门（`HumanProof`）

`register_user` 强制要求 `["humanproof", wallet]` PDA 存在；这个 PDA **只能**由注册表 admin 通过 `attest_human_proof` 创建。流程：

1. 客户端走 World ID IDKit，拿到证明 + nullifier hash。
2. 客户端用钱包对服务端发的一次性 nonce 签名（证明请求确实来自该钱包持有者，避免"我把你钱包绑到我 World ID"的攻击）。
3. `POST /api/worldid/verify` 在 `developer.worldcoin.org` 上游验证证明、校验钱包签名，然后用 `REGISTRY_ADMIN_KEYPAIR` 发起一笔 `attest_human_proof` 交易。
4. 该指令同时 `init` 出 `HumanProof[wallet]` 与 `NullifierRecord[nullifier_hash]`；`init` 在 nullifier 这条上的失败，正是用来阻止"同一个 World ID 绑定到第二个钱包"。
5. 之后 `register_user` 才放行。

### 签发方信任层

自助注册只能拿到 **Tier 3**（社区）。要上 Tier 1/2 必须走审批：

1. Issuer 调用 `request_issuer_tier(2 或 1, note_hash, note_uri)`。
2. 注册表 admin 在 `/issuer/admin` 页面审核，调用 `review_issuer_tier(approve)`。
3. 通过后 `Issuer.trust_tier` 被更新；不通过则关闭请求。

### 实体认领

`claim_entity` 会把 `Entity.is_claimed = true` 并写入 `official_wallet`，但要求调用方能出示一条 `HAS_OFFICER` 关系，且：
- target 正好等于调用方钱包；
- 归属于正在认领的实体；
- 未被吊销；
- 由信任层 1 或 2 的 issuer 签发。

通过认领后，该钱包才有资格用 `add_official_response` 在评论下追加官方回应。

### 关键不变量

- `Relationship`、`CommentRecord` 没有删除路径。
- 关系吊销只写 `Relationship.revoked_at`，历史永远保留。
- `add_official_response` 只追加 URI，不修改原始评论正文或哈希。
- 顶层评论最多被官方回应一次。
- 回复嵌套深度硬上限为 2。

---

## 页面

| 路由 | 用途 |
|---|---|
| `/`                   | 注册表统计、最新实体、快捷解析、证明示例 |
| `/resolve`            | 用 CT-Number、钱包或域名解析到实体 |
| `/create`             | 创建一个新实体 |
| `/entry/[entryId]`    | 实体详情：身份图谱、关系列表、项目、社区信号、原始数据 |
| `/attest`             | 关系证明向导（8 个动词） |
| `/issuers`            | 签发方名册与信任层定义 |
| `/issuer/register`    | 自助注册为 Tier 3，可申请升级到 Tier 1/2 |
| `/issuer/admin`       | 仅 admin：审核待批层级升级请求 |
| `/register`           | World ID + 钱包签名闸门，通过后 `register_user` |
| `/profile/[wallet]`   | 用户档案、创建过的实体、签发过的证明 |

## API 路由

| 路由 | 方法 | 用途 |
|---|---|---|
| `/api/worldid/challenge`       | GET    | 为某个钱包发一次性签名 nonce |
| `/api/worldid/verify`          | POST   | 校验 IDKit 证明 + 钱包签名，再发 `attest_human_proof` |
| `/api/worldid/check`           | GET    | 廉价预查：该钱包是否已经过闸门 |
| `/api/worldid/rp-signature`    | POST   | IDKit relying-party 流的服务端签名 |
| `/api/upload/challenge`        | GET    | 为上传发一次性 nonce |
| `/api/upload`                  | POST   | 鉴权 + 限流的二进制上传（PDF / PNG / JPEG / WebP） |
| `/api/upload/image`            | POST   | 鉴权 + 限流的图片上传 |
| `/api/upload/metadata`         | POST   | 鉴权 + 限流的 JSON metadata 上传 |
| `/api/helius/webhook`          | POST   | 接收 Helius 增强交易投递，写入链上事件日志 |
| `/api/dev/humanproof`          | POST   | 开发快捷通道：跳过 World ID 直接发 HumanProof（生产关闭） |
| `/api/mock/upload` / `fetch` / `verify` / `upload-image` | GET/POST | 没配 Pinata / IDKit 时的本地兜底 |

所有写入路由统一具备：钱包 pubkey 头 + 对一次性 nonce 的 ed25519 签名 + 按钱包的滑窗限流 + [`data/audit/upload.log`](data/audit/) 审计日志（首次请求时创建）。

---

## 本地开发

### 前置依赖

- Node.js 20+
- Rust + Cargo
- Solana CLI 1.18+
- 与 `anchor-lang` 0.30.1 兼容的 Anchor CLI

如果 `anchor build` 报 `edition2024` / platform-tools 相关错误，请先升级到 platform-tools v1.54+。

### 1. 安装依赖

```bash
npm install
cd anchor && npm install && cd ..
```

### 2. 配置环境变量

把下面表格里的内容复制进 `.env.local`。纯本地联调最少需要：

```bash
NEXT_PUBLIC_SOLANA_RPC=http://127.0.0.1:8899
SOLANA_RPC_URL=http://127.0.0.1:8899
REGISTRY_ADMIN_KEYPAIR_JSON=<本地 admin keypair 的 64 字节 JSON 数组>
```

### 3. 编译程序

```bash
cd anchor && anchor build
# 同步生成的 IDL / TS 类型回前端：
cp anchor/target/idl/chaintrust.json lib/anchor/idl/chaintrust.json
cp anchor/target/types/chaintrust.ts  lib/anchor/idl/chaintrust.ts
```

### 4. 启动 validator 并部署

终端 A：

```bash
solana-test-validator --reset
```

终端 B：

```bash
solana config set --url http://127.0.0.1:8899
solana airdrop 10
cd anchor && anchor deploy --provider.cluster localnet && cd ..
# 一次性创建 RegistryConfig PDA，需要 bootstrap admin 签名：
npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/init-registry.ts
```

> Bootstrap admin pubkey **硬编码**在 [`anchor/programs/chaintrust/src/constants.rs`](anchor/programs/chaintrust/src/constants.rs) 的 `REGISTRY_BOOTSTRAP_ADMIN`。换部署目标前要改这个常量并重新编译。

### 5. 启动前端

```bash
npm run dev   # http://localhost:3000
```

### 推荐演示流程

1. 连接钱包，进 `/register`，过 World ID + 签名闸门，再 `register_user`。
2. 在 `/create` 创建一个 `Entity`。
3. 在 `/issuer/register` 把同一个钱包自助注册为 Tier 3 issuer。
4. 在 `/attest` 签发一条 `OPERATES_PROJECT` 或 `HAS_DOMAIN` 关系。
5. 在 `/resolve` 用 CT-Number / 钱包 / 域名搜索，看是否落到对的实体页。
6. 打开实体详情页：身份图谱、关系列表、项目、评论、原始数据。
7. （可选）在实体页留评论；如果实体已认领，可发官方追加回应。

---

## 环境变量

本地覆盖写在 `.env.local`。部署到 Vercel 等平台时，敏感变量记得勾 Sensitive。

| 变量名 | 必要性 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SOLANA_RPC`               | 推荐 | 前端 RPC。回退顺序：→ `NEXT_PUBLIC_RPC_URL` → `NEXT_PUBLIC_HELIUS_RPC_URL` → `devnet`。 |
| `NEXT_PUBLIC_HELIUS_RPC_URL`           | 推荐 | 带 API key 的 Helius RPC，前后端都会用。 |
| `SOLANA_RPC_URL`                       | 推荐 | 服务端 RPC（admin keypair 路由用）。 |
| `NEXT_PUBLIC_RPC_URL`                  | 可选 | 旧别名。 |
| `NEXT_PUBLIC_WORLDID_APP_ID`           | 生产必填 | World ID app id（`app_…`）。 |
| `NEXT_PUBLIC_WORLDID_RP_ID`            | 可选 | Relying-party id（`rp_…`）。 |
| `NEXT_PUBLIC_WORLDID_ACTION`           | 可选 | action 名，默认 `register-chaintrust-user`。 |
| `NEXT_PUBLIC_WORLDID_ENV`              | 可选 | `staging` 或 `production`。 |
| `WORLDID_RP_SIGNING_KEY`               | 可选 | **敏感。**`/api/worldid/rp-signature` 的服务端签名密钥。 |
| `REGISTRY_ADMIN_KEYPAIR_JSON`          | 必填 | **敏感。**64 字节 JSON 数组，用来签 `attest_human_proof`。 |
| `REGISTRY_ADMIN_KEYPAIR_BASE58`        | 可选 | **敏感。**Base58 替代格式。 |
| `PINATA_JWT`                           | 生产必填 | **敏感。**Pinata JWT；不填会回退到本地 mock，**Vercel 等无状态环境会坏**。 |
| `NEXT_PUBLIC_PINATA_GATEWAY`           | 可选 | Pinata 网关域名（不带 scheme）。 |
| `PINATA_GATEWAY`                       | 可选 | 服务端备用网关域名。 |
| `HELIUS_API_KEY`                       | 可选 | 给 `npm run helius:*` 用。 |
| `HELIUS_CLUSTER`                       | 可选 | `devnet` 或 `mainnet-beta`。 |
| `HELIUS_WEBHOOK_URL`                   | 可选 | `/api/helius/webhook` 的公网 URL。 |
| `HELIUS_WEBHOOK_AUTH`                  | 可选 | **敏感。**Webhook 路由强制校验的共享密钥。 |
| `NEXT_PUBLIC_SAS_DUAL_WRITE`           | 可选 | `true` 时启用 SAS 双写。 |
| `NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY` | 可选 | 用来派生共享 SAS Credential PDA 的 authority。 |

---

## 存储模式

- **Pinata IPFS（推荐）**——配 `PINATA_JWT` + 网关域名后，公开内容返回 `ipfs://<cid>`；二进制上传带扩展名 hint（`ipfs://<cid>.png`），让 fetch 路由不用查 metadata 就能选对 Content-Type。
- **本地 mock**——不配 `PINATA_JWT` 时，上传落到 `data/mock-storage/`，返回 `mock://<id>`。本地能跑，但 **serverless 平台上必坏**（文件系统无状态）。
- **敏感证据**目前只是被打了"敏感"标签，并没有真正加密。存储抽象层已经为后续接 Lit Protocol 留好接口。

## Helius webhook（可选）

Helius 可以把所有触碰程序 ID 的交易实时投递到 `/api/helius/webhook`。接收端会原样追加到 [`data/audit/chain-events.log`](data/audit/)（暂不做 Anchor 指令解码），后续可以用一个独立索引器消费这份日志。

```bash
# 先设好 HELIUS_API_KEY、HELIUS_CLUSTER、HELIUS_WEBHOOK_URL、HELIUS_WEBHOOK_AUTH。
npm run helius:list      # 列出该 API key 下的所有 webhook
npm run helius:create    # 注册一个匹配 PROGRAM_ID 的 webhook，指向你的 URL
npm run helius:delete    # 删掉
```

## SAS 双写（可选）

把 `Relationship` 同步写入 Solana Attestation Service：

```bash
npm run sas:bootstrap          # 一次性建 Credential + 9 个 Schema
# 然后在 .env.local：
NEXT_PUBLIC_SAS_DUAL_WRITE=true
NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY=<bootstrap 时使用的钱包 pubkey>
```

任何要签 attestation 的钱包，都要被加进该 credential 的 `authorized_signers` 列表。

---

## 部署

链上程序已在 **devnet** 部署：`HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt`。前端是标准 Next.js 14 App Router 构建（`npm run build`），用 Vercel 最省事：

1. 把仓库推到 GitHub。
2. Vercel 导入（自动识别 Next.js）。
3. 在 **Environment Variables** 里把上面表格里的全部填上；`REGISTRY_ADMIN_KEYPAIR_JSON`、`WORLDID_RP_SIGNING_KEY`、`HELIUS_WEBHOOK_AUTH`、`PINATA_JWT` 一定要勾 Sensitive。
4. Deploy。

要把程序也升到 mainnet，改 `anchor/Anchor.toml` 的 cluster，`anchor build`、`anchor deploy --provider.cluster mainnet`，然后把所有 RPC 环境变量切到 mainnet。

---

## 当前局限

- `anchor/tests/smoke.ts` 还是旧版接口（`create_entry`、`add_wallet_mapping` 等），不再代表真实端到端流程。
- DNS 验证仍然是 mock：链上 `target_ref` 写的是 `sha256(domain)`，但链下"控制权证明"目前只是演示。
- 敏感证据未加密。
- 当前读取依赖 `getProgramAccounts` 过滤；尚无独立索引器（Helius 日志已经为它做了铺垫）。

## 说明

- 产品设计文档：[`ChainTrust_Product_Design.md`](ChainTrust_Product_Design.md)、[`ChainTrust_Product_Design_CN.md`](ChainTrust_Product_Design_CN.md)。
- 英文 README：[`README.md`](README.md)。
