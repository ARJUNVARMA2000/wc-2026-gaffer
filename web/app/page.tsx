import { getMeta, getTeams } from "@/lib/data";
import { pct } from "@/lib/ui";
import ProjectionsTable from "@/components/ProjectionsTable";
import CountUp from "@/components/CountUp";
import Reveal from "@/components/Reveal";
import Flag from "@/components/Flag";

export default function Home() {
  const teams = getTeams();
  const meta = getMeta();
  const fav = teams[0];

  const stats = [
    { label: "Simulations", value: meta.nSims.toLocaleString() },
    { label: "Group games", value: `${meta.groupMatchesPlayed}/${meta.groupMatchesTotal}` },
    { label: "Teams", value: String(meta.nTeams) },
    { label: "Goals / game", value: meta.avgGoals.toFixed(2) },
    { label: "Home edge", value: `×${meta.homeAdv.toFixed(2)}` },
  ];

  return (
    <div className="py-10 sm:py-16">
      {/* HERO */}
      <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <Reveal>
            <div className="eyebrow flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-lime)] live-dot" />
              FIFA World Cup 2026 · Live Forecast
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="display mt-4 text-[clamp(2.8rem,7vw,5.5rem)] text-[var(--color-text)]">
              Who wins the
              <br />
              <span className="text-[var(--color-lime)]">World Cup?</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
              GAFFER rates every national team from 150 years of international results, blends in
              Transfermarkt squad value, turns it into goal expectations with a Dixon-Coles model,
              and plays the tournament out{" "}
              <span className="text-[var(--color-text)]">{meta.nSims.toLocaleString()} times</span>.
              These are the odds it spits back — updated as the games are played.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="display text-2xl text-[var(--color-text)]">{s.value}</div>
                  <div className="eyebrow mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Favorite spotlight */}
        <Reveal delay={0.2} className="relative">
          <div className="panel relative overflow-hidden p-7">
            <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-[var(--color-gold)] opacity-[0.07] blur-2xl" />
            <div className="eyebrow flex items-center justify-between">
              <span>Current favorite</span>
              <span className="text-[var(--color-gold)]">#1</span>
            </div>
            <div className="mt-5 flex items-center gap-4">
              <Flag iso={fav.iso} name={fav.name} size={54} />
              <div>
                <div className="display text-4xl leading-none">{fav.name}</div>
                <div className="mono mt-1 text-xs text-[var(--color-muted)]">
                  {fav.confederation} · Group {fav.group} · Elo {Math.round(fav.elo)}
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-end gap-2">
              <span className="display text-[5rem] leading-none text-[var(--color-gold)]">
                <CountUp value={fav.champion * 100} decimals={1} />
              </span>
              <span className="display mb-2 text-2xl text-[var(--color-muted)]">%</span>
              <span className="mb-2 ml-1 text-sm text-[var(--color-muted)]">to lift the trophy</span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t hairline pt-5">
              {[
                ["Reach final", fav.final],
                ["Semis", fav.sf],
                ["Make KO", fav.ko],
              ].map(([label, v]) => (
                <div key={label as string}>
                  <div className="mono text-lg text-[var(--color-text)]">{pct(v as number, 0)}</div>
                  <div className="eyebrow mt-1">{label as string}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* PROJECTIONS */}
      <section className="mt-20">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="eyebrow">The full board</div>
            <h2 className="display mt-2 text-3xl sm:text-4xl">Title &amp; advancement odds</h2>
          </div>
        </div>
        <ProjectionsTable teams={teams} />
      </section>
    </div>
  );
}
