import { Feed } from "@/components/feed";
import { HomeSearch } from "@/components/home-search";
import { HomeSidebar } from "@/components/home-sidebar";

export default function HomePage() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[18rem_1fr]">
      <div className="md:sticky md:top-6 md:self-start">
        <HomeSidebar />
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-500">
            ChainTrust · Public company registry
          </p>
          <HomeSearch />
          <p className="hint">
            Search by company name, project, domain, or username. Every entry
            and review below is anchored on Solana.
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="serif text-xl font-semibold text-ink-800">
              Review feed
            </h2>
            <span className="text-xs uppercase tracking-wider text-ink-500">
              Latest on-chain reviews
            </span>
          </div>
          <Feed />
        </section>
      </div>
    </div>
  );
}
