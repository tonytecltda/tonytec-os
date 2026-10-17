import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { hojeISO } from "@/lib/format";
import { opcoesClientes } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ContratoForm } from "../contrato-form";

export const metadata = { title: "Novo contrato" };

export default async function NovoContratoPage({ searchParams }: PageProps<"/admin/contratos/novo">) {
  await requireAdmin();
  const { cliente } = await searchParams;
  const clienteId = typeof cliente === "string" && z.uuid().safeParse(cliente).success ? cliente : "";
  const [clientes, cobranca] = await Promise.all([opcoesClientes(), getConfig("cobranca")]);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href={clienteId ? `/admin/clientes/${clienteId}?aba=contratos` : "/admin/contratos"}>
          <ArrowLeft /> Voltar
        </Link>
      </Button>
      <PageHeader titulo="Novo contrato" />
      <ContratoForm
        clientes={clientes}
        padroes={{ valorHora: cobranca.valor_hora_padrao, valorVisita: cobranca.valor_visita_padrao }}
        inicial={{
          cliente_id: clienteId,
          numero: "",
          descricao: "",
          tipo: "manutencao_mensal",
          data_inicio: hojeISO(),
          data_fim: "",
          valor_mensal: 0,
          visitas_inclusas_mes: 0,
          horas_inclusas_mes: 0,
          politica_visita_excedente: "valor_unico",
          valor_visita_excedente: null,
          valor_hora_excedente: null,
          sla_resposta_horas: null,
          sla_solucao_horas: null,
          status: "ativo",
          observacoes: "",
        }}
      />
    </>
  );
}
