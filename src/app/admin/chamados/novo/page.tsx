import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { opcoesCategorias, opcoesTecnicos } from "@/lib/chamados";
import { opcoesClientes } from "@/lib/queries";
import { listarUnidadesCliente } from "@/actions/chamados";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ChamadoAdminForm } from "./chamado-admin-form";

export const metadata = { title: "Novo chamado" };

export default async function NovoChamadoAdminPage({ searchParams }: PageProps<"/admin/chamados/novo">) {
  await requireAdmin();
  const { cliente } = await searchParams;
  const clienteInicial = typeof cliente === "string" && z.uuid().safeParse(cliente).success ? cliente : "";
  const [clientes, tecnicos, { categorias, tipos }, unidades] = await Promise.all([
    opcoesClientes(),
    opcoesTecnicos(),
    opcoesCategorias(),
    clienteInicial ? listarUnidadesCliente(clienteInicial) : Promise.resolve([]),
  ]);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/chamados">
          <ArrowLeft /> Chamados
        </Link>
      </Button>
      <PageHeader
        titulo="Novo chamado"
        descricao="Registro de chamado recebido por telefone, WhatsApp ou aberto internamente."
      />
      <ChamadoAdminForm
        clientes={clientes}
        categorias={categorias}
        tipos={tipos}
        tecnicos={tecnicos}
        clienteInicial={clienteInicial}
        unidadesIniciais={unidades.map((u) => ({ value: u.id, label: u.nome }))}
      />
    </>
  );
}
