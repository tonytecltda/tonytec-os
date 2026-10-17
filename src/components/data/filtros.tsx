"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Parâmetros da URL que não são filtros (busca, página, visão, aba...). */
const NAO_FILTROS = new Set(["q", "page", "view", "aba", "mes", "data"]);

/**
 * Barra de filtros: no computador mostra tudo; no celular a busca fica sempre à vista e
 * os demais filtros ficam atrás do botão "Filtros" (com a contagem dos que estão ativos).
 */
export function Filtros({ busca, children }: { busca?: ReactNode; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const sp = useSearchParams();
  const ativos = [...sp.entries()].filter(([k, v]) => v && !NAO_FILTROS.has(k)).length;

  return (
    <div className="mb-4 grid gap-2 md:flex md:flex-wrap">
      <div className="flex gap-2 md:contents">
        {busca ? <div className="min-w-0 flex-1 md:flex-none">{busca}</div> : null}
        <Button
          type="button"
          variant="outline"
          className="shrink-0 md:hidden"
          aria-expanded={aberto}
          aria-controls="filtros-extras"
          onClick={() => setAberto((v) => !v)}
        >
          <SlidersHorizontal />
          Filtros{ativos ? ` (${ativos})` : ""}
          <ChevronDown className={cn("transition-transform", aberto && "rotate-180")} />
        </Button>
      </div>
      <div id="filtros-extras" className={cn("gap-2", aberto ? "grid grid-cols-2" : "hidden", "md:contents")}>
        {children}
      </div>
    </div>
  );
}
