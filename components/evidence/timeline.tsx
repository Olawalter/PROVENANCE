"use client";

import { formatClock, formatDay } from "@/lib/format/present";

/**
 * The signature component: five different times, never collapsed into one.
 *
 * A source published after an event does not mean the event happened after
 * publication, and a page that changes next week does not rewrite what was
 * observed today. The whole point of showing these separately is that the
 * reader can see which is which.
 */
export type Moment = {
  label: string;
  iso: string;
  detail: string;
  strong?: boolean;
};

export function Timeline({ moments }: { moments: Moment[] }) {
  const present = moments.filter((m) => m.iso);
  if (present.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No times have been established for this claim yet.
      </p>
    );
  }

  return (
    <ol className="timeline">
      {present.map((moment) => (
        <li key={moment.label} className="timeline-step"
            data-strong={moment.strong ? "true" : "false"}>
          <div className="text-right">
            <p className="mono text-[0.78rem] font-[540]">{formatClock(moment.iso)}</p>
            <p className="text-[0.68rem] text-[var(--muted)]">{formatDay(moment.iso)}</p>
          </div>
          <div className="timeline-rail" aria-hidden>
            <span className="timeline-dot" />
          </div>
          <div className="pb-1">
            <p className="label">{moment.label}</p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{moment.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
