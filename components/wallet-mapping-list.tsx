import { shortKey } from "@/lib/utils/format";
import { WALLET_ROLE_LABELS } from "@/types";
import type { WalletMapping } from "@/types";

type Item = {
  publicKey: { toBase58(): string };
  account: WalletMapping;
};

export function WalletMappingList({ items }: { items: Item[] }) {
  if (!items.length) {
    return (
      <p className="hint">
        No wallet mappings yet. Add mappings to anchor on-chain activity to this entry.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items
        .slice()
        .sort((a, b) =>
          a.account.isOfficial === b.account.isOfficial
            ? 0
            : a.account.isOfficial
              ? -1
              : 1,
        )
        .map((m) => {
          const addr = m.account.targetWallet.toBase58();
          return (
            <li
              key={m.publicKey.toBase58()}
              className="flex items-center justify-between gap-4 border border-ink-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="mono truncate">{addr}</span>
                  <span className={m.account.isOfficial ? "chip chip-official" : "chip chip-community"}>
                    {m.account.isOfficial ? "Official" : "Community"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {WALLET_ROLE_LABELS[m.account.walletRole] ?? "Unknown"} · added by {shortKey(m.account.addedBy)}
                </p>
              </div>
            </li>
          );
        })}
    </ul>
  );
}
