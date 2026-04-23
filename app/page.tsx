import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="space-y-16">
      <section className="pt-8">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-500">
          Solana · On-chain company registry
        </p>
        <h1 className="serif mt-4 text-5xl font-semibold leading-tight text-ink-800 md:text-6xl">
          A public record where<br />
          <span className="text-accent">identity</span>,{" "}
          <span className="text-accent">wallets</span>,{" "}
          <span className="text-accent">reviews</span>, and{" "}
          <span className="text-accent">attestations</span> converge.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-600">
          ChainTrust is an on-chain company identity and reputation layer for
          Web3 teams. Any verified user can open an entry; any verified user can
          review it; a representative can claim it and respond. Nobody can erase it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="btn">
            Register as a verified user
          </Link>
          <Link href="/create" className="btn-outline">
            Create a company entry
          </Link>
        </div>
        <p className="mt-6 serif text-lg italic text-ink-500">
          “Claim gives voice, not control.”
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 border-t border-ink-200 pt-10 md:grid-cols-3">
        <Tile
          n="01"
          title="Public company entry"
          body="Any verified user can open a profile. It's not owned. It's a public record, anchored as a PDA."
        />
        <Tile
          n="02"
          title="Append-only reviews"
          body="Reviews carry a hash, a timestamp, and the reviewer's wallet. The program has no delete instruction."
        />
        <Tile
          n="03"
          title="Claim gives voice"
          body="A representative proves control and can publish official responses — without rewriting history."
        />
      </section>

      <section className="border-t border-ink-200 pt-10">
        <h2 className="serif text-2xl font-semibold text-ink-800">
          The hackathon demo path
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-700">
          <li>Connect a Solana wallet and register a user profile.</li>
          <li>Create a company entry with primary wallet and metadata.</li>
          <li>Link extra project wallets as community mappings.</li>
          <li>Another verified user submits an immutable review.</li>
          <li>A representative claims the entry via the mock DNS flow.</li>
          <li>The official response appears beneath the original review, both visible.</li>
        </ol>
      </section>
    </div>
  );
}

function Tile({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border border-ink-200 bg-white p-5">
      <p className="mono text-ink-400">{n}</p>
      <h3 className="serif mt-2 text-xl font-semibold text-ink-800">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
    </div>
  );
}
