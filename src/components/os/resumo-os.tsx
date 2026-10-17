import { FileText } from "lucide-react";
import type { Database } from "@/types/database";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatDataHora, formatNumero } from "@/lib/format";
import { ANEXO_OS_TIPO, ITEM_TIPO, OS_STATUS_TOM, TIPO_ATENDIMENTO, rotuloStatusOs } from "@/lib/labels";
import type { FotoOs } from "@/lib/os";

type Enums = Database["public"]["Enums"];

export function OsStatusBadge({ status, recusada }: { status: Enums["os_status"]; recusada: boolean }) {
  return <StatusBadge tom={OS_STATUS_TOM[status]}>{rotuloStatusOs(status, recusada)}</StatusBadge>;
}

export type ResumoOs = {
  numero: string;
  protocolo: string | null;
  cliente: string;
  unidade: string | null;
  endereco: string | null;
  tecnico: string | null;
  tipo: Enums["os_tipo_atendimento"];
  problema: string | null;
  diagnostico: string | null;
  servico: string | null;
  observacoes: string | null;
  recomendacoes: string | null;
  pendencias: string | null;
  visitas: { chegada: string; saida: string | null; horas: number | null }[];
  itens: {
    descricao: string;
    tipo: Enums["os_item_tipo"];
    quantidade: number;
    valor_unitario: number;
    cobrado: boolean;
  }[];
  exibirValores: boolean;
  fotos: FotoOs[];
};

function Texto({ titulo, valor }: { titulo: string; valor: string | null }) {
  if (!valor?.trim()) return null;
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{titulo}</dt>
      <dd className="text-sm whitespace-pre-wrap">{valor}</dd>
    </div>
  );
}

/** Resumo da OS para conferência antes de assinar (e para consulta). */
export function ResumoOsCard({ r }: { r: ResumoOs }) {
  const totalHoras = r.visitas.reduce((acc, v) => acc + (v.horas ?? 0), 0);
  const totalItens = r.itens
    .filter((i) => i.cobrado)
    .reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {r.numero}
          {r.protocolo ? (
            <span className="text-muted-foreground font-normal"> · chamado {r.protocolo}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">Cliente</dt>
            <dd className="text-sm font-medium">{r.cliente}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Local</dt>
            <dd className="text-sm">
              {r.unidade ?? "—"}
              {r.endereco ? <span className="text-muted-foreground block text-xs">{r.endereco}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Técnico</dt>
            <dd className="text-sm">{r.tecnico ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Atendimento</dt>
            <dd className="text-sm">
              {TIPO_ATENDIMENTO[r.tipo]} · {formatNumero(totalHoras)} h em {r.visitas.length} visita(s)
            </dd>
          </div>
        </dl>

        {r.visitas.length ? (
          <ul className="text-muted-foreground grid gap-0.5 text-xs">
            {r.visitas.map((v, i) => (
              <li key={i}>
                Visita {i + 1}: {formatDataHora(v.chegada)} até {v.saida ? formatDataHora(v.saida) : "—"}
                {v.horas != null ? ` (${formatNumero(v.horas)} h)` : ""}
              </li>
            ))}
          </ul>
        ) : null}

        <dl className="grid gap-3">
          <Texto titulo="Problema relatado" valor={r.problema} />
          <Texto titulo="Diagnóstico" valor={r.diagnostico} />
          <Texto titulo="Serviço executado" valor={r.servico} />
          <Texto titulo="Observações técnicas" valor={r.observacoes} />
          <Texto titulo="Recomendações" valor={r.recomendacoes} />
        </dl>

        {r.itens.length ? (
          <div className="grid gap-1">
            <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Materiais e serviços
            </div>
            <ul className="divide-y rounded-lg border text-sm">
              {r.itens.map((i, idx) => (
                <li key={idx} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    {i.descricao}
                    <span className="text-muted-foreground text-xs"> · {ITEM_TIPO[i.tipo]}</span>
                    {!i.cobrado ? (
                      <span className="text-muted-foreground text-xs"> · sem cobrança</span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{formatNumero(i.quantidade)}×</span>
                  {r.exibirValores ? (
                    <span className="w-24 text-right tabular-nums">
                      {i.cobrado ? formatBRL(i.quantidade * i.valor_unitario) : "—"}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {r.exibirValores && totalItens > 0 ? (
              <p className="text-right text-sm">
                Total em itens: <strong>{formatBRL(totalItens)}</strong>
              </p>
            ) : null}
          </div>
        ) : null}

        {r.pendencias ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
            <div className="mb-1 text-xs font-semibold text-amber-700 uppercase dark:text-amber-400">
              Pendências
            </div>
            <p className="whitespace-pre-wrap">{r.pendencias}</p>
          </div>
        ) : null}

        {r.fotos.length ? (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {r.fotos.map((f) => (
              <li key={f.id} className="relative overflow-hidden rounded-md border">
                <a
                  href={f.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-muted/50 block aspect-square"
                >
                  {f.mime?.startsWith("image/") && f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.url}
                      alt={ANEXO_OS_TIPO[f.tipo]}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center">
                      <FileText className="text-muted-foreground size-5" />
                    </span>
                  )}
                </a>
                <span className="bg-background/90 absolute bottom-0.5 left-0.5 rounded px-1 text-[9px]">
                  {ANEXO_OS_TIPO[f.tipo]}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
