import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Params = Record<string, string | string[] | undefined>;

function hrefPara(base: string, params: Params, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || v == null || v === "") continue;
    sp.set(k, Array.isArray(v) ? v[0] : v);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Paginação server-side por links (?page=N), preservando os demais filtros. */
export function Pagination({
  base,
  params,
  page,
  pageSize,
  total,
}: {
  base: string;
  params: Params;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const inicio = (page - 1) * pageSize + 1;
  const fim = Math.min(page * pageSize, total);

  return (
    <nav className="mt-4 flex items-center justify-between gap-2 text-sm" aria-label="Paginação">
      <span className="text-muted-foreground">
        {inicio}–{fim} de {total}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefPara(base, params, page - 1)} aria-label="Página anterior">
              <ChevronLeft /> Anterior
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft /> Anterior
          </Button>
        )}
        <span className="text-muted-foreground px-2 tabular-nums">
          {page}/{totalPaginas}
        </span>
        {page < totalPaginas ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefPara(base, params, page + 1)} aria-label="Próxima página">
              Próxima <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Próxima <ChevronRight />
          </Button>
        )}
      </div>
    </nav>
  );
}

/** Lê ?page= com segurança. */
export function lerPagina(valor: string | string[] | undefined) {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Lê um search param como string simples. */
export function lerParam(valor: string | string[] | undefined) {
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";
}

/** Remove caracteres que quebram filtros do PostgREST (vírgula, parênteses, curingas). */
export function termoBusca(valor: string) {
  return valor
    .replace(/[,()*%\\]/g, " ")
    .trim()
    .slice(0, 80);
}
