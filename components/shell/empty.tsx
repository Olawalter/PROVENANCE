import { configResult } from "@/lib/config/env";

export function Loading({ what }: { what: string }) {
  return (
    <div className="panel p-6 text-center text-sm text-[var(--muted)]"
         role="status" aria-live="polite">
      Reading {what} from the contract&hellip;
    </div>
  );
}

export function Problem({ message }: { message: string }) {
  return (
    <div className="panel p-5" role="alert">
      <h2 className="text-[0.95rem]">This could not be read from the chain</h2>
      <p className="lede mt-1">{message}</p>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Nothing is cached anywhere else, so there is nothing to show instead.
        Reloading asks the contract again.
      </p>
    </div>
  );
}

export function Nothing({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panel p-6">
      <h2 className="text-[0.95rem]">{title}</h2>
      <p className="lede mt-1 max-w-xl">{detail}</p>
    </div>
  );
}

/**
 * When the console is pointed at nothing, say which variable and what it
 * wanted. Rendering "undefined" into a product about what the record says is
 * not an option.
 */
export function ConfigProblem() {
  if (configResult.ok) return null;
  return (
    <section role="alert" className="panel p-5">
      <h1 className="text-lg">This console is not pointed at a contract</h1>
      <p className="lede mt-1">
        The repository ships a default in <span className="mono">.env</span>, so
        something has overridden or removed it. Set these in{" "}
        <span className="mono">.env.local</span>, or as environment variables
        where this is deployed, and rebuild.
      </p>
      <table className="mt-4 text-sm">
        <thead>
          <tr className="label text-left">
            <th className="py-2 pr-4 font-normal">Variable</th>
            <th className="py-2 pr-4 font-normal">Expected</th>
            <th className="py-2 font-normal">Found</th>
          </tr>
        </thead>
        <tbody>
          {configResult.problems.map((problem) => (
            <tr key={problem.variable} className="border-t border-[var(--border)]">
              <td className="mono py-2 pr-4">{problem.variable}</td>
              <td className="py-2 pr-4 text-[var(--muted)]">{problem.expected}</td>
              <td className="mono py-2 text-[var(--refuted)]">{problem.found}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
