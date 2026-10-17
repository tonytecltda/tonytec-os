import { CalendarRange, Clock, ScrollText, Timer } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { contratoVigente, situacaoContrato, vigenciaTexto } from "@/lib/contratos";
import { formatBRL, formatNumero } from "@/lib/format";
import { CONTRATO_TIPO } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Contrato" };

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}

export default async function PortalContratoPage() {
  await requireRole("cliente");
  const supabase = await createClient();
  // A RLS limita aos contratos do cliente do usuário.
  const [{ data: contratos }, cobranca] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "id, numero, descricao, tipo, status, data_inicio, data_fim, valor_mensal, visitas_inclusas_mes, horas_inclusas_mes, politica_visita_excedente, valor_visita_excedente, valor_hora_excedente, sla_resposta_horas, sla_solucao_horas",
      )
      .order("data_inicio", { ascending: false }),
    getConfig("cobranca"),
  ]);

  const vigente = contratos?.find(contratoVigente);
  const anteriores = (contratos ?? []).filter((c) => c.id !== vigente?.id);

  if (!vigente) {
    return (
      <>
        <PageHeader titulo="Contrato" />
        <EmptyState
          icon={ScrollText}
          titulo="Nenhum contrato vigente"
          descricao="Os atendimentos são cobrados como avulsos. Fale com a Tonytec para conhecer os planos de manutenção."
        />
      </>
    );
  }

  const s = situacaoContrato(vigente);
  const excedente =
    vigente.politica_visita_excedente === "isento"
      ? "Sem cobrança"
      : vigente.politica_visita_excedente === "valor_unico"
        ? `${formatBRL(vigente.valor_visita_excedente ?? cobranca.valor_visita_padrao)} por visita`
        : `${formatBRL(vigente.valor_hora_excedente ?? cobranca.valor_hora_padrao)} por hora`;

  return (
    <>
      <PageHeader
        titulo={`Contrato ${vigente.numero}`}
        descricao={vigente.descricao ?? CONTRATO_TIPO[vigente.tipo]}
      >
        <StatusBadge tom={s.tom}>{s.label}</StatusBadge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">O que está incluído</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Linha rotulo="Tipo" valor={CONTRATO_TIPO[vigente.tipo]} />
              <Linha rotulo="Vigência" valor={vigenciaTexto(vigente)} />
              <Linha rotulo="Valor mensal" valor={formatBRL(vigente.valor_mensal)} />
              <Linha rotulo="Visitas incluídas por mês" valor={vigente.visitas_inclusas_mes} />
              <Linha
                rotulo="Horas incluídas por mês"
                valor={`${formatNumero(vigente.horas_inclusas_mes)} h`}
              />
              <Linha rotulo="Visitas além da franquia" valor={excedente} />
              <Linha
                rotulo="Prazo de primeira resposta"
                valor={
                  vigente.sla_resposta_horas
                    ? `${formatNumero(vigente.sla_resposta_horas)} h úteis`
                    : "Conforme prioridade"
                }
              />
              <Linha
                rotulo="Prazo de solução"
                valor={
                  vigente.sla_solucao_horas
                    ? `${formatNumero(vigente.sla_solucao_horas)} h úteis`
                    : "Conforme prioridade"
                }
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldo do mês</CardTitle>
            <CardDescription>Visitas e horas já usadas neste mês.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center gap-2">
              <CalendarRange className="text-primary size-4" />
              <span>{vigente.visitas_inclusas_mes} visita(s) por mês</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="text-primary size-4" />
              <span>{formatNumero(vigente.horas_inclusas_mes)} hora(s) por mês</span>
            </div>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <Timer className="mt-0.5 size-3.5 shrink-0" />O consumo do mês passa a aparecer aqui quando os
              atendimentos começarem a ser registrados no sistema.
            </p>
          </CardContent>
        </Card>
      </div>

      {anteriores.length ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Outros contratos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {anteriores.map((c) => {
                const sc = situacaoContrato(c);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-mono">{c.numero}</span>
                      <span className="text-muted-foreground"> · {vigenciaTexto(c)}</span>
                    </span>
                    <StatusBadge tom={sc.tom}>{sc.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
