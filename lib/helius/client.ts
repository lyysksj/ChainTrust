/**
 * Hand-rolled Helius client.
 *
 * Why not the `helius-sdk` npm package:
 *  - We only use 4 endpoints: RPC URL, list/create/delete webhooks. The SDK
 *    pulls ~50 transitive deps and a NodeJS-only default export that doesn't
 *    tree-shake into Next route bundles.
 *  - Same precedent as `lib/storage/pinata.ts` — small, dep-free wrappers.
 *
 * Public surface:
 *   heliusRpcUrl()                        URL string for `new Connection(...)`
 *   isHeliusConfigured()                  did the env supply a key?
 *   listWebhooks() / createWebhook(...)   Helius webhook management API
 *   deleteWebhook(id)                     idempotent delete by id
 *
 * Auth:
 *   HELIUS_API_KEY            server-side, used for RPC + webhook management
 *   NEXT_PUBLIC_HELIUS_RPC_URL  optional, fully-formed RPC URL the client
 *                               can use directly. Set this OR rely on the
 *                               server-side fallback at /api routes.
 *   HELIUS_CLUSTER            "devnet" (default) or "mainnet-beta"
 */

const HELIUS_API_BASE = "https://api.helius.xyz/v0";

export type HeliusCluster = "devnet" | "mainnet-beta";

function cluster(): HeliusCluster {
  const c = (process.env.HELIUS_CLUSTER || "").trim();
  return c === "mainnet-beta" ? "mainnet-beta" : "devnet";
}

export function isHeliusConfigured(): boolean {
  return !!process.env.HELIUS_API_KEY;
}

/** RPC URL for use server-side. Falls back to `null` if unconfigured. */
export function heliusRpcUrl(): string | null {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return null;
  const host =
    cluster() === "mainnet-beta"
      ? "mainnet.helius-rpc.com"
      : "devnet.helius-rpc.com";
  return `https://${host}/?api-key=${key}`;
}

// ──────────────────────────── Webhook management ───────────────────────────

export type WebhookType = "enhanced" | "raw";

/** Helius's documented enum of transaction types. We use "ANY" because
 *  ChainTrust is a custom Anchor program; Helius can't tag our instructions
 *  semantically, and "ANY" delivers every tx that touches the listed
 *  accounts. */
export type TransactionType = "ANY" | string;

export type Webhook = {
  webhookID: string;
  wallet: string;
  webhookURL: string;
  transactionTypes: TransactionType[];
  accountAddresses: string[];
  webhookType: WebhookType;
  authHeader?: string;
};

export type CreateWebhookInput = {
  webhookURL: string;
  accountAddresses: string[];
  transactionTypes?: TransactionType[];
  webhookType?: WebhookType;
  authHeader?: string;
};

async function heliusFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error("HELIUS_API_KEY is not set");
  const sep = path.includes("?") ? "&" : "?";
  const url = `${HELIUS_API_BASE}${path}${sep}api-key=${key}`;
  const resp = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Helius ${resp.status}: ${body || resp.statusText}`);
  }
  return (await resp.json()) as T;
}

export async function listWebhooks(): Promise<Webhook[]> {
  return heliusFetch<Webhook[]>("/webhooks");
}

export async function createWebhook(
  input: CreateWebhookInput,
): Promise<Webhook> {
  const body = {
    webhookURL: input.webhookURL,
    accountAddresses: input.accountAddresses,
    transactionTypes: input.transactionTypes ?? ["ANY"],
    webhookType: input.webhookType ?? "enhanced",
    ...(input.authHeader ? { authHeader: input.authHeader } : {}),
  };
  return heliusFetch<Webhook>("/webhooks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteWebhook(id: string): Promise<void> {
  await heliusFetch<unknown>(`/webhooks/${id}`, { method: "DELETE" });
}
