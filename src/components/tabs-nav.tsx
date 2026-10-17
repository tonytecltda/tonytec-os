"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Abas baseadas em links (?aba=...). No celular a barra rola para os lados: a aba ativa é
 * centralizada ao abrir e um degradê na borda avisa que há mais abas para ver.
 */
export function TabsNav({
  base,
  abas,
  ativa,
}: {
  base: string;
  abas: { id: string; label: string; contador?: number }[];
  ativa: string;
}) {
  const barra = useRef<HTMLDivElement>(null);
  const [maisDireita, setMaisDireita] = useState(false);
  const [maisEsquerda, setMaisEsquerda] = useState(false);

  useEffect(() => {
    const el = barra.current;
    if (!el) return;
    const atualizar = () => {
      setMaisEsquerda(el.scrollLeft > 4);
      setMaisDireita(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    const selecionada = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (selecionada) {
      el.scrollLeft = Math.max(0, selecionada.offsetLeft - (el.clientWidth - selecionada.offsetWidth) / 2);
    }
    atualizar();
    el.addEventListener("scroll", atualizar, { passive: true });
    window.addEventListener("resize", atualizar);
    return () => {
      el.removeEventListener("scroll", atualizar);
      window.removeEventListener("resize", atualizar);
    };
  }, [ativa]);

  return (
    <div className="relative -mx-4 mb-6 border-b lg:mx-0">
      <div
        ref={barra}
        className="[scrollbar-width:none] overflow-x-auto px-4 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
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
                  "-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors md:min-h-0",
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
      <span
        aria-hidden
        className={cn(
          "from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent transition-opacity lg:hidden",
          maisDireita ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "from-background pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r to-transparent transition-opacity lg:hidden",
          maisEsquerda ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
