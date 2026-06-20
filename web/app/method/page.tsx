import { getMeta } from "@/lib/data";
import Reveal from "@/components/Reveal";

export const metadata = { title: "Methodology — GAFFER" };

const STEPS = [
  {
    n: "01",
    title: "The data",
    body: "Every men's full international since 1872 — roughly 49,000 matches — from the public martj42/international_results dataset. The same file is kept current through the tournament, so finished 2026 games flow straight into the model while upcoming ones stay open. The hard part, as the Double Pivot guys stress, isn't the math: it's matching names and judging which results to trust across confederations that rarely play each other.",
  },
  {
    n: "02",
    title: "Team strength (Elo)",
    body: "Each team carries an Elo rating updated after every match: ΔR = K · G · (W − E). K scales with how much the match mattered (a World Cup knockout moves ratings far more than a friendly), and G is a margin-of-victory multiplier — convincing wins count more, with logarithmic dampening so 7–0 routs don't break the system. This is the 'paddlin'' idea: put a beating on someone and the model notices.",
  },
  {
    n: "03",
    title: "From ratings to goals",
    body: "Win-draw-loss isn't enough — group tiebreakers need scorelines. So a time-weighted Poisson model fits an attack and defense rating for every team from recent results, giving an expected-goals number for each side of a fixture. A Dixon-Coles correction then fixes plain Poisson's habit of under-counting low-scoring draws (0–0, 1–1), producing a full distribution over every possible scoreline.",
  },
  {
    n: "04",
    title: "Squad value",
    body: "Results don't see everything — a team can be loaded with talent and still drop points. So each side's rating is nudged toward what its Transfermarkt squad market value implies. The twist, straight from PADDLIN': lean on value MORE in cross-confederation games (where head-to-head history is thin and unreliable) and on results MORE within a confederation. This is why Argentina, elite on results but a mid-table squad by market value, gets reeled in slightly, while talent-rich underachievers get a small bump.",
  },
  {
    n: "05",
    title: "Simulating the tournament",
    body: "The real 2026 bracket — 12 groups of four, top two plus the eight best third-placed teams into a Round of 32 — is played out tens of thousands of times. Each match draws a scoreline from the goal model; group tables resolve on points, goal difference and goals scored; knockouts go to a coin-weighted shootout when level. Counting how often each team reaches each round gives the probabilities you see across the site.",
  },
  {
    n: "06",
    title: "Live updates",
    body: "Games that have already kicked off are locked to their real results; only the remaining fixtures are simulated. As scores come in, eliminated teams fall to zero and everyone else's path shifts automatically. The whole pipeline re-runs on a schedule, so the board you're looking at reflects the latest results.",
  },
];

export default function MethodPage() {
  const meta = getMeta();
  return (
    <div className="py-12 sm:py-16">
      <Reveal>
        <div className="eyebrow">How it works</div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Methodology</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          GAFFER is a pragmatic reimplementation of the kind of national-team model Michael Caley
          builds as PADDLIN&apos;. Five steps take raw results all the way to title odds.
        </p>
      </Reveal>

      <div className="mt-12 flex flex-col gap-px overflow-hidden rounded-2xl border hairline">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.06}>
            <div className="grid grid-cols-1 gap-4 bg-[var(--color-ink2)] p-6 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-8">
              <div className="display text-5xl text-[var(--color-lime)] opacity-80 sm:text-6xl">{s.n}</div>
              <div>
                <h2 className="display text-2xl">{s.title}</h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">{s.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="panel mt-10 p-7">
          <div className="eyebrow">Credit &amp; caveats</div>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[var(--color-muted)]">
            The approach is lifted, with gratitude, from Michael Caley and Mike Goodman&apos;s{" "}
            <a className="text-[var(--color-lime)] hover:underline" href="https://www.youtube.com/@DoublePivotPod" target="_blank" rel="noreferrer">
              Double Pivot
            </a>{" "}
            series on building a World Cup model, and Caley&apos;s{" "}
            <a className="text-[var(--color-lime)] hover:underline" href="https://www.expectinggoals.com" target="_blank" rel="noreferrer">
              Expecting Goals
            </a>{" "}
            PADDLIN&apos; write-ups. This version uses results, margins, home advantage, a Dixon-Coles
            goal model and Transfermarkt squad value with confederation-aware blending. The one piece
            of Caley&apos;s full model still missing is expected-goals (xG / xElo) data, which is hard to
            source for all international teams. It is a forecast, not a guarantee — football is
            gloriously random.
          </p>
          <div className="mono mt-5 flex flex-wrap gap-x-6 gap-y-1 text-[0.62rem] text-[var(--color-faint)]">
            <span>model v{meta.modelVersion}</span>
            <span>{meta.nSims.toLocaleString()} simulations</span>
            <span>data through {meta.dataThrough}</span>
            <span>home edge ×{meta.homeAdv.toFixed(2)}</span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
