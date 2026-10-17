import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { situacaoContrato } from "@/lib/contratos";
import { opcoesClientes } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { SaldoContratoCard } from "@/components/saldo-contrato";
import { ContratoForm } from "../contrato-form";

export const metadata = { title: "Contrato" };

export default async function ContratoPage({ params }: PageProps<"/admin/contratos/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contratos")
    .select("*, clientes(razao_social, nome_fantasia)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const [clientes, cobranca] = await Promise.all([opcoesClientes(c.cliente_id), getConfig("cobranca")]);
  const s = situacaoContrato(c);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href={`/admin/clientes/${c.cliente_id}?aba=contratos`}>
          <ArrowLeft /> {c.clientes?.nome_fantasia || c.clientes?.razao_social}
        </Link>
      </Button>
      <PageHeader titulo={`Contrato ${c.numero}`} descricao={c.descricao ?? undefined}>
        <StatusBadge tom={s.tom}>{s.label}</StatusBadge>
      </PageHeader>
      <div className="mb-6 max-w-xl">
        <SaldoContratoCard contratoId={id} mostrarValores />
      </div>
      <ContratoForm
        id={id}
        clientes={clientes}
        padroes={{ valorHora: cobranca.valor_hora_padrao, valorVisita: cobranca.valor_visita_padrao }}
        inicial={{
          cliente_id: c.cliente_id,
          numero: c.numero,
          descricao: c.descricao ?? "",
          tipo: c.tipo,
          data_inicio: c.data_inicio,
          data_fim: c.data_fim ?? "",
          valor_mensal: Number(c.valor_mensal),
          visitas_inclusas_mes: c.visitas_inclusas_mes,
          horas_inclusas_mes: Number(c.horas_inclusas_mes),
          politica_visita_excedente: c.politica_visita_excedente,
          valor_visita_excedente: c.valor_visita_excedente == null ? null : Number(c.valor_visita_excedente),
          valor_hora_excedente: c.valor_hora_excedente == null ? null : Number(c.valor_hora_excedente),
          sla_resposta_horas: c.sla_resposta_horas == null ? null : Number(c.sla_resposta_horas),
          sla_solucao_horas: c.sla_solucao_horas == null ? null : Number(c.sla_solucao_horas),
          status: c.status,
          observacoes: c.observacoes ?? "",
        }}
      />
    </>
  );
}
