"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClienteCombobox, type OpcaoCliente } from "@/components/forms/cliente-combobox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

/** Atualiza um search param mantendo os outros e voltando para a página 1. */
export function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = (chave: string, valor: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (valor) sp.set(chave, valor);
    else sp.delete(chave);
    sp.delete("page");
    const qs = sp.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { setParam, pending, searchParams };
}

/** Campo de busca com debounce (?q=). */
export function SearchInput({
  placeholder = "Buscar…",
  param = "q",
}: {
  placeholder?: string;
  param?: string;
}) {
  const { setParam, pending, searchParams } = useSetParam();
  const [valor, setValor] = useState(searchParams.get(param) ?? "");
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const t = setTimeout(() => setParam(param, valor.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <InputGroup className="w-full sm:max-w-xs">
      <InputGroupAddon>{pending ? <Spinner /> : <Search />}</InputGroupAddon>
      <InputGroupInput
        type="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </InputGroup>
  );
}

/** Select que grava a escolha num search param. O valor "" remove o filtro. */
export function FilterSelect({
  param,
  opcoes,
  placeholder,
  padrao = "",
  className,
}: {
  param: string;
  opcoes: { value: string; label: string }[];
  placeholder: string;
  padrao?: string;
  className?: string;
}) {
  const { setParam, searchParams } = useSetParam();
  const atual = searchParams.get(param) ?? padrao;
  return (
    <Select value={atual || "__todos"} onValueChange={(v) => setParam(param, v === "__todos" ? "" : v)}>
      <SelectTrigger className={className ?? "w-full sm:w-44"} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.value || "__todos"} value={o.value || "__todos"}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Filtro por cliente com busca (?cliente=). */
export function ClienteFilter({ clientes, param = "cliente" }: { clientes: OpcaoCliente[]; param?: string }) {
  const { setParam, searchParams } = useSetParam();
  const atual = searchParams.get(param) ?? "";
  return (
    <div className="flex w-full items-center gap-1 sm:w-64">
      <ClienteCombobox clientes={clientes} value={atual} onChange={(id) => setParam(param, id)} />
      {atual ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Limpar filtro de cliente"
          onClick={() => setParam(param, "")}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}

/** Período (?de=aaaa-mm-dd&ate=aaaa-mm-dd). */
export function PeriodoFilter() {
  const { searchParams, setParams } = useSetParams();
  const de = searchParams.get("de") ?? "";
  const ate = searchParams.get("ate") ?? "";
  return (
    <div className="flex w-full items-center gap-1 sm:w-auto">
      <Input
        type="date"
        value={de}
        max={ate || undefined}
        onChange={(e) => setParams({ de: e.target.value })}
        aria-label="Abertos a partir de"
        className="w-full sm:w-36"
      />
      <span className="text-muted-foreground text-xs">até</span>
      <Input
        type="date"
        value={ate}
        min={de || undefined}
        onChange={(e) => setParams({ ate: e.target.value })}
        aria-label="Abertos até"
        className="w-full sm:w-36"
      />
    </div>
  );
}

/** Variante que altera vários parâmetros de uma vez. */
function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setParams = (valores: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(valores)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return { searchParams, setParams };
}
