import Link from "next/link";

export const metadata = {
  title: "Documentation: PROVENANCE",
};

/**
 * Where the written documentation is, and what each part answers. The
 * repository holds the long form; this page exists so somebody in the console
 * can find it without guessing.
 */
const DOCS: { title: string; answers: string; href: string }[] = [
  {
    title: "Protocol",
    answers: "Claim, policy, evidence, adjudication, verdict, accepted, "
      + "finalized, superseded -- what each one means and when it changes.",
    href: "https://github.com/Olawalter/PROVENANCE/blob/main/docs/protocol.md",
  },
  {
    title: "Adjudication",
    answers: "The non-deterministic boundary, what the leader proposes, what "
      + "every validator does independently, and exactly which fields have to "
      + "agree before anything is written.",
    href: "https://github.com/Olawalter/PROVENANCE/blob/main/docs/adjudication.md",
  },
  {
    title: "Evidence policy",
    answers: "Every source policy, what it requires, and what it refuses to "
      + "accept as a substitute.",
    href: "https://github.com/Olawalter/PROVENANCE/blob/main/docs/evidence-policy.md",
  },
  {
    title: "Security",
    answers: "Prompt injection, stale evidence, source authority, "
      + "contradictions, duplicate evidence, escrow ordering, finality -- and "
      + "what a finalized result does not mean.",
    href: "https://github.com/Olawalter/PROVENANCE/blob/main/docs/security.md",
  },
  {
    title: "Deployment",
    answers: "Deploying, verifying that the chain holds this source, and the "
      + "traps this environment sets.",
    href: "https://github.com/Olawalter/PROVENANCE/blob/main/docs/deployment.md",
  },
  {
    title: "End to end",
    answers: "The live run: every claim, every verdict, every refusal, with "
      + "transaction hashes, generated from the run's own record.",
    href: "https://github.com/Olawalter/PROVENANCE/blob/main/END-TO-END.md",
  },
];

export default function DocumentationPage() {
  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <p className="label">Documentation</p>
        <h1>How this works, in full</h1>
        <p className="lede max-w-2xl">
          The protocol is the product, so the written parts are worth reading
          before trusting anything here. Each one answers a different question.
        </p>
      </header>

      <ul className="panel divide-y divide-[var(--border)]">
        {DOCS.map((doc) => (
          <li key={doc.title}>
            <a href={doc.href} target="_blank" rel="noreferrer"
               className="block p-4 transition-colors hover:bg-[var(--light)]/40">
              <p className="text-[0.95rem] font-[540] underline decoration-dotted
                            underline-offset-2">
                {doc.title}
              </p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{doc.answers}</p>
            </a>
          </li>
        ))}
      </ul>

      <section className="panel grid gap-2 p-4">
        <h2 className="label">GenLayer</h2>
        <p className="text-sm text-[var(--muted)]">
          The protocol underneath this one is documented at{" "}
          <a className="underline decoration-dotted underline-offset-2"
             href="https://docs.genlayer.com" target="_blank" rel="noreferrer">
            docs.genlayer.com
          </a>
          . The parts that shaped this build most are the Equivalence Principle,
          non-determinism, and web access.
        </p>
      </section>

      <p className="text-xs text-[var(--muted)]">
        <Link href="/protocol" className="underline decoration-dotted underline-offset-2">
          The protocol page
        </Link>{" "}
        reads the deployed contract directly, so it describes what is running
        rather than what was written down.
      </p>
    </div>
  );
}
