# ChainTrust

面向 Web3 实体的 Solana 公开身份注册表。

ChainTrust 把法人实体、钱包、项目、域名以及由签发方签名的证明关系，组织成一个公开、可追溯、追加写入的身份图谱。当前代码库是一个基于 Next.js 14 的 dApp，后端核心是 Solana 上的 Anchor 程序。社区评论功能仍然保留，但这个版本的产品重心已经从“评论站”转向“实体与关系注册表”。

## 项目概览

- 以链上 `Entity` 账户记录实体，并从 8 字节 `entity_id` 派生稳定的 CT-Number。
- 注册 `Issuer` 账户，并公开其信任分层。
- 在实体名下创建 `Project`。
- 为实体签发关系证明，例如 `OPERATES_PROJECT`、`CONTROLS_WALLET`、`HAS_DOMAIN`、`PARENT_OF`、`AUDITED_BY`。
- 通过 CT-Number、钱包或域名反向解析到实体，并查看证据链。
- 支持社区评论、回复、点赞，以及不改原文的官方追加回应。
- 可选把 `Relationship` 证明同步双写到 Solana Attestation Service（SAS）。

Program ID：`HBxcCBx4ZPVnhGazehwZjF72J3neJsz5HyvGoPMTzUPt`

## 技术栈

- 前端：Next.js 14、React 18、Tailwind CSS
- 钱包：Solana Wallet Adapter、Phantom、Solflare
- 链上：`anchor/` 内的 Anchor 0.30.1 程序
- 存储：默认本地 `mock://`，可选 Pinata + `ipfs://`
- 人类验证：注册流程可选接入 World ID
- 互操作：关系证明可选双写到 SAS

## 仓库结构

```text
.
├── app/                         # Next.js App Router 页面与 API 路由
├── components/                  # UI 组件：表单、图谱、评论列表、钱包按钮等
├── lib/
│   ├── anchor/                  # IDL、PDA 工具、链上读写客户端、React hooks
│   ├── mock/                    # Mock DNS、存储、World ID 状态
│   ├── sas/                     # SAS 配置、PDA、指令构造
│   ├── storage/                 # 存储抽象：mock 或 Pinata/IPFS
│   └── utils/                   # 哈希、格式化、校验、CT-Number 工具
├── anchor/                      # Anchor 工作区与 Solana 程序
├── scripts/sas-bootstrap.ts     # 一次性 SAS 初始化脚本
├── types/                       # TypeScript 账户类型与 metadata 类型
├── ChainTrust_Product_Design.md
└── ChainTrust_Product_Design_CN.md
```

## 链上模型

### 账户类型

| 账户 | 用途 | PDA seeds |
| --- | --- | --- |
| `UserProfile` | 用户身份与 metadata URI | `["user", wallet]` |
| `Issuer` | 证明签发方、类型、信任层级 | `["issuer", authority]` |
| `Entity` | 注册表中的法人锚点 | `["entity", entity_id]` |
| `Project` | 归属某个实体的项目 | `["project", entity, project_id]` |
| `Relationship` | 从实体指向钱包/域名/项目/实体/人物的签名边 | `["rel", entity, kind, target_ref, issuer]` |
| `CommentRecord` | 社区信号或回复 | `["comment", entity, commenter, comment_index]` |
| `LikeRecord` | 评论点赞状态 | `["like", comment, liker]` |

### 指令

`register_user`、`update_user_metadata_uri`、`register_issuer`、`create_entity`、`create_project`、`attest_relationship`、`revoke_relationship`、`claim_entity`、`submit_comment`、`submit_reply`、`like_comment`、`unlike_comment`、`add_official_response`

### 关键不变量

- 关系和评论都没有删除路径。
- 关系吊销只会写入 `Relationship.revoked_at`，不会擦除历史。
- 官方回应只会追加新的 URI，不会改动原始评论正文或哈希。

## 主要页面

- `/`：注册表首页、统计、最新实体、快捷解析
- `/resolve`：通过 CT-Number、钱包或域名解析实体
- `/create`：创建实体档案
- `/entry/[entryId]`：实体详情、图谱、关系、项目、社区信号、原始数据
- `/attest`：关系证明向导
- `/issuers`：Issuer 名册与信任层定义
- `/issuer/register`：注册成为 Issuer
- `/register`：用户注册，可选 World ID 验证

## 本地开发

### 前置依赖

- Node.js 20+
- Rust 与 Cargo
- Solana CLI 1.18+
- 与 `anchor-lang` 0.30.1 兼容的 Anchor CLI

如果 `anchor build` 因 `edition2024` 或 platform-tools 版本问题失败，需要先升级 Solana platform tools。

### 1. 安装依赖

```bash
npm install
cd anchor && npm install
```

### 2. 让前端连接本地链

当前前端在没有 RPC 环境变量时，默认连的是 `devnet`。如果你要跑本地联调，先设置：

```bash
NEXT_PUBLIC_SOLANA_RPC=http://127.0.0.1:8899
```

建议写入 `.env.local`。

### 3. 编译链上程序

```bash
cd anchor && anchor build
```

如果重新编译了程序，记得同步前端依赖的生成文件：

```bash
cp anchor/target/idl/chaintrust.json lib/anchor/idl/chaintrust.json
cp anchor/target/types/chaintrust.ts lib/anchor/idl/chaintrust.ts
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
cd anchor && anchor deploy --provider.cluster localnet
```

### 5. 启动前端

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 推荐演示流程

1. 连接钱包并注册 `UserProfile`。
2. 进入 `/create` 创建一个 `Entity`。
3. 把同一个钱包注册为 `Issuer`。
4. 在 `/attest` 提交一条关系证明。
5. 在 `/resolve` 用 CT-Number、钱包或域名解析该实体。
6. 打开实体详情页，查看图谱、关系列表、评论与官方回应。

## 环境变量

本地覆盖建议写在 `.env.local`。

| 变量名 | 是否必须 | 作用 |
| --- | --- | --- |
| `NEXT_PUBLIC_SOLANA_RPC` | 推荐 | 前端 RPC 地址。不填时会回退到 `NEXT_PUBLIC_RPC_URL`，再回退到 `devnet`。 |
| `NEXT_PUBLIC_RPC_URL` | 可选 | 旧的 RPC 别名回退字段。 |
| `NEXT_PUBLIC_WORLDID_APP_ID` | 可选 | 与 RP ID 配套时启用 World ID 注册门槛。 |
| `NEXT_PUBLIC_WORLDID_RP_ID` | 可选 | World ID relying party ID。 |
| `NEXT_PUBLIC_WORLDID_ACTION` | 可选 | World ID action 名称，默认 `register-chaintrust-user`。 |
| `NEXT_PUBLIC_WORLDID_ENV` | 可选 | `staging` 或 `production`。 |
| `WORLDID_RP_SIGNING_KEY` | 可选 | `/api/worldid/rp-signature` 使用的服务端签名密钥。 |
| `PINATA_JWT` | 可选 | 服务端 Pinata JWT。不填时上传走本地 mock 存储。 |
| `NEXT_PUBLIC_PINATA_GATEWAY` | 可选 | 前端读取 Pinata 内容时使用的网关域名。 |
| `PINATA_GATEWAY` | 可选 | 服务端备用网关域名。 |
| `NEXT_PUBLIC_SAS_DUAL_WRITE` | 可选 | 启用关系证明双写到 SAS。 |
| `NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY` | 可选 | 用于派生共享 SAS Credential PDA 的 authority。 |

## 存储模式

- 不配置 `PINATA_JWT` 时，上传内容会落到 `data/mock-storage/`，返回 `mock://...` URI。
- 配置 `PINATA_JWT` 后，公开内容会被 pin 到 IPFS，返回 `ipfs://...` URI。
- 敏感证据目前只做“敏感标记”，尚未真正加密；接口层已经为后续接入 Lit Protocol 留好了位置。

## SAS 双写

如果你想把 `Relationship` 同步写入 SAS：

1. 先执行一次初始化脚本：

```bash
npm run sas:bootstrap
```

2. 设置：

```bash
NEXT_PUBLIC_SAS_DUAL_WRITE=true
NEXT_PUBLIC_SAS_CREDENTIAL_AUTHORITY=<bootstrap-authority-pubkey>
```

3. 确保所有要签发 attestation 的钱包，都已经加入该 credential 的 `authorized_signers` 列表。

## 当前限制

- `anchor/tests/smoke.ts` 仍然基于旧版 API 结构，里面还在使用 `create_entry`、`add_wallet_mapping` 等旧接口，当前不能作为可信的最新端到端测试。
- DNS 验证仍然是 mock。
- 敏感证据尚未加密。
- 当前读取依赖 `getProgramAccounts` 过滤，还没有独立索引器。

## 说明

- 当前产品方向详见 `ChainTrust_Product_Design.md`。
- 中文产品说明见 `ChainTrust_Product_Design_CN.md`。
- 英文 README 位于 `README.md`。
