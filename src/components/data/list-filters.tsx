"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

/** Atualiza um search param mantendo os outros e voltando para a página 1. */
function useSetParam() {
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
