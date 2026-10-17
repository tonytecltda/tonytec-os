"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRESETS, type PresetPeriodo } from "@/lib/periodo";

/** Filtro de período (hoje, 7 dias, 30 dias, mês, personalizado) gravado na URL. */
export function FiltroPeriodo({
  preset,
  deData,
  ateData,
}: {
  preset: PresetPeriodo;
  deData: string;
  ateData: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [de, setDe] = useState(deData);
  const [ate, setAte] = useState(ateData);

  const ir = (mudancas: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={preset}
        onValueChange={(v) =>
          v === "custom" ? ir({ periodo: v, de, ate }) : ir({ periodo: v, de: "", ate: "" })
        }
      >
        <SelectTrigger className="w-full sm:w-48" aria-label="Período">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.valor} value={p.valor}>
              {p.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {preset === "custom" ? (
        <>
          <Input
            type="date"
            value={de}
            max={ate}
            onChange={(e) => setDe(e.target.value)}
            aria-label="Data inicial"
            className="w-full sm:w-40"
          />
          <span className="text-muted-foreground text-xs">até</span>
          <Input
            type="date"
            value={ate}
            min={de}
            onChange={(e) => setAte(e.target.value)}
            aria-label="Data final"
            className="w-full sm:w-40"
          />
          <Button variant="outline" onClick={() => ir({ periodo: "custom", de, ate })} disabled={!de || !ate}>
            Aplicar
          </Button>
        </>
      ) : null}
    </div>
  );
}
