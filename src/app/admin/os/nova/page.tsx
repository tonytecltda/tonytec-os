import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { opcoesTecnicos } from "@/lib/chamados";
import { opcoesClientes } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { NovaOsForm } from "./nova-os-form";

export const metadata = { title: "Nova OS" };

export default async function NovaOsPage() {
  await requireAdmin();
  const [clientes, tecnicos] = await Promise.all([opcoesClientes(), opcoesTecnicos()]);
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/os">
          <ArrowLeft /> Ordens de serviço
        </Link>
      </Button>
      <PageHeader
        titulo="Nova OS"
        descricao="OS sem chamado (ex.: preventiva, instalação). Para atendimentos de chamado, abra a OS pelo próprio chamado."
      />
      <NovaOsForm clientes={clientes} tecnicos={tecnicos} />
    </>
  );
}
