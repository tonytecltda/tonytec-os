"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORIDADE, PRIORIDADE_DICA } from "@/lib/labels";

export type Opcao = { value: string; label: string };
export type OpcaoTipo = Opcao & { categoriaId: string };

/** Select simples controlado (valor "" = vazio). */
export function SelectSimples({
  id,
  value,
  onChange,
  opcoes,
  placeholder,
  invalid,
  disabled,
  vazio,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  opcoes: Opcao[];
  placeholder: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Rótulo de uma opção "nenhum" que limpa o valor. */
  vazio?: string;
}) {
  return (
    <Select
      // "" mostra o placeholder; desabilitado nunca exibe a opção "vazio" como se estivesse escolhida.
      value={value || (vazio && !disabled ? "__vazio" : "")}
      onValueChange={(v) => onChange(v === "__vazio" ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {vazio ? <SelectItem value="__vazio">{vazio}</SelectItem> : null}
        {opcoes.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Prioridade com a dica de quando usar cada uma. */
export function SelectPrioridade({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: "baixa" | "media" | "alta" | "urgente") => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as "baixa" | "media" | "alta" | "urgente")}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(["baixa", "media", "alta", "urgente"] as const).map((p) => (
          <SelectItem key={p} value={p}>
            <span className="font-medium">{PRIORIDADE[p]}</span>
            <span className="text-muted-foreground hidden text-xs sm:inline">— {PRIORIDADE_DICA[p]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
