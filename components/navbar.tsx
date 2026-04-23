import Link from "next/link";
import { WalletButton } from "./wallet-button";

export function Navbar() {
  return (
    <header className="border-b border-ink-200 bg-ink-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="serif text-xl font-semibold text-ink-800">
            ChainTrust
          </span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-ink-500 md:inline">
            Public Company Registry
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/create" className="text-ink-600 hover:text-ink-800">
            Create entry
          </Link>
          <Link href="/register" className="text-ink-600 hover:text-ink-800">
            Register
          </Link>
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
