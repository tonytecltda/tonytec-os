import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ClienteForm } from "../cliente-form";

export const metadata = { title: "Novo cliente" };

export default async function NovoClientePage() {
  await requireAdmin();
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/clientes">
          <ArrowLeft /> Clientes
        </Link>
      </Button>
      <PageHeader
        titulo="Novo cliente"
        descricao="Depois de salvar, cadastre as unidades, os usuários do portal e o contrato."
      />
      <ClienteForm />
    </>
  );
}
