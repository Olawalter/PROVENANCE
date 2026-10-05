"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NETWORK_NAME, configResult } from "@/lib/config/env";
import { WalletButton } from "@/components/wallet/wallet-button";

/**
 * A persistent sidebar, a contextual top bar, and a large canvas for the
 * record. The navigation is the protocol's own vocabulary, so somebody who has
 * read the documentation can find things by the words it uses.
 */

const SECTIONS: { heading?: string; items: { href: string; label: string }[] }[] = [
  { items: [{ href: "/", label: "Overview" }] },
  {
    heading: "Record",
    items: [
      { href: "/claims", label: "Claims" },
      { href: "/evidence", label: "Evidence" },
      { href: "/adjudications", label: "Adjudications" },
    ],
  },
  { items: [{ href: "/create", label: "Register a claim" }] },
  {
    heading: "Reference",
    items: [
      { href: "/protocol", label: "Protocol" },
      { href: "/documentation", label: "Documentation" },
    ],
  },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[14.5rem_1fr]">
      <a href="#main"
         className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2
                    focus:rounded focus:bg-[var(--surface)] focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className={`border-r border-[var(--border)] bg-[var(--surface)]
                         lg:sticky lg:top-0 lg:h-screen
                         ${open ? "block" : "hidden lg:block"}`}>
        <div className="flex h-full flex-col">
          <div className="px-5 py-5">
            <Link href="/" className="mono text-[0.9rem] font-[560] tracking-[0.14em]">
              PROVENANCE
            </Link>
            <p className="mt-1 text-[0.7rem] text-[var(--muted)]">
              Evidence becomes state.
            </p>
          </div>

          <nav className="flex-1 px-2.5" aria-label="Sections">
            {SECTIONS.map((section, index) => (
              <div key={index} className="mb-4">
                {section.heading ? (
                  <p className="label px-2.5 pb-1.5">{section.heading}</p>
                ) : null}
                <ul>
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href}
                            onClick={() => setOpen(false)}
                            aria-current={active(item.href) ? "page" : undefined}
                            className={`block rounded-[3px] px-2.5 py-1.5 text-[0.86rem]
                                        transition-colors
                                        ${active(item.href)
                                          ? "bg-[var(--light)] text-[var(--primary)] font-[540]"
                                          : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-[var(--border)] px-5 py-3">
            <p className="text-[0.68rem] text-[var(--muted)]">
              Adjudicated by GenLayer validator consensus. The contract is
              authoritative; this console reads it and composes transactions a
              wallet signs.
            </p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b
                           border-[var(--border)] bg-[var(--background)]/90 px-5
                           py-2.5 backdrop-blur">
          <button type="button" className="btn btn-quiet lg:hidden"
                  aria-expanded={open} aria-label="Sections"
                  onClick={() => setOpen((v) => !v)}>
            Menu
          </button>

          <span className="flex items-center gap-1.5 text-[0.76rem] text-[var(--muted)]">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--primary)" }} />
            Network: {NETWORK_NAME}
            {configResult.ok ? (
              <span className="mono">({configResult.config.chainId})</span>
            ) : null}
          </span>

          <div className="ml-auto">
            <WalletButton />
          </div>
        </header>

        <main id="main" className="mx-auto max-w-5xl px-5 py-7">{children}</main>
      </div>
    </div>
  );
}
