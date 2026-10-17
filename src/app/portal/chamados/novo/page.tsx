import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { opcoesCategorias } from "@/lib/chamados";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { NovoChamadoForm } from "./novo-chamado-form";

export const metadata = { title: "Abrir chamado" };

export default async function NovoChamadoPage() {
  const perfil = await requireRole("cliente");
  const supabase = await createClient();
  const [{ data: unidades }, { categorias, tipos }, { data: meuPerfil }] = await Promise.all([
    supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
    opcoesCategorias(),
    supabase.from("profiles").select("telefone").eq("id", perfil.id).maybeSingle(),
  ]);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/portal/chamados">
          <ArrowLeft /> Meus chamados
        </Link>
      </Button>
      <PageHeader
        titulo="Abrir chamado"
        descricao="Conte o que está acontecendo. A Tonytec responde pelo próprio chamado."
      />
      {!unidades?.length ? (
        <EmptyState
          icon={MapPin}
          titulo="Nenhuma unidade cadastrada"
          descricao="Peça à Tonytec para cadastrar o endereço de atendimento antes de abrir chamados."
        />
      ) : (
        <NovoChamadoForm
          unidades={unidades.map((u) => ({ value: u.id, label: u.nome }))}
          categorias={categorias}
          tipos={tipos}
          telefonePadrao={meuPerfil?.telefone ?? ""}
        />
      )}
    </>
  );
}
