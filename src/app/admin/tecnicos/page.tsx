import { Plus, Wrench } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ultimosAcessos } from "@/lib/acesso";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { UsuarioDialog } from "@/components/usuarios/usuario-dialog";
import { UsuariosTabela } from "@/components/usuarios/usuarios-tabela";

export const metadata = { title: "Técnicos" };

export default async function TecnicosPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: tecnicos, error }, acessos] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, email, telefone, ativo")
      .eq("role", "tecnico")
      .order("ativo", { ascending: false })
      .order("nome"),
    ultimosAcessos(),
  ]);

  const novo = (
    <UsuarioDialog
      role="tecnico"
      trigger={
        <Button>
          <Plus /> Novo técnico
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader titulo="Técnicos" descricao="Equipe de campo. A produtividade por técnico chega na Fase 5.">
        {novo}
      </PageHeader>
      {error ? (
        <p className="text-destructive text-sm">Não foi possível carregar os técnicos.</p>
      ) : !tecnicos?.length ? (
        <EmptyState icon={Wrench} titulo="Nenhum técnico cadastrado" descricao="Cadastre a equipe de campo.">
          {novo}
        </EmptyState>
      ) : (
        <UsuariosTabela
          role="tecnico"
          usuarios={tecnicos.map((t) => ({ ...t, ultimoAcesso: acessos.get(t.id) ?? null }))}
        />
      )}
    </>
  );
}
