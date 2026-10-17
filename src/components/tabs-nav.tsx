import Link from "next/link";
import { cn } from "@/lib/utils";

/** Abas baseadas em links (?aba=...), renderizadas no servidor. */
export function TabsNav({
  base,
  abas,
  ativa,
}: {
  base: string;
  abas: { id: string; label: string; contador?: number }[];
  ativa: string;
}) {
  return (
    <div className="-mx-4 mb-6 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0">
      <nav className="flex min-w-max gap-1" aria-label="Seções">
        {abas.map((aba, i) => {
          const selecionada = aba.id === ativa;
          return (
            <Link
              key={aba.id}
              href={i === 0 ? base : `${base}?aba=${aba.id}`}
              scroll={false}
              aria-current={selecionada ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                selecionada
                  ? "border-primary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {aba.label}
              {aba.contador != null ? (
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums">
                  {aba.contador}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
