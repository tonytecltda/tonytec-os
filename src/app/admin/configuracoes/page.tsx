import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaPublica } from "@/lib/config";
import { lerConfig } from "@/lib/config-schemas";
import { ultimosAcessos } from "@/lib/acesso";
import { PageHeader } from "@/components/page-header";
import { TabsNav } from "@/components/tabs-nav";
import { Button } from "@/components/ui/button";
import { UsuarioDialog } from "@/components/usuarios/usuario-dialog";
import { UsuariosTabela } from "@/components/usuarios/usuarios-tabela";
import {
  AssinaturaForm,
  CobrancaForm,
  EmpresaForm,
  HorarioComercialForm,
  PdfForm,
  SlaPadraoForm,
} from "./config-forms";

export const metadata = { title: "Configurações" };

const ABAS = ["empresa", "cobranca", "sla", "assinatura", "administradores"] as const;
type Aba = (typeof ABAS)[number];

export default async function ConfiguracoesPage({ searchParams }: PageProps<"/admin/configuracoes">) {
  const atual = await requireAdmin();
  const sp = await searchParams;
  const aba: Aba = (ABAS as readonly string[]).includes(String(sp.aba)) ? (sp.aba as Aba) : "empresa";

  const supabase = await createClient();
  const { data: linhas } = await supabase.from("configuracoes").select("chave, valor");
  const valor = (chave: string) => linhas?.find((l) => l.chave === chave)?.valor;

  return (
    <>
      <PageHeader titulo="Configurações" descricao="Dados da empresa, valores padrão, SLA e assinatura." />
      <TabsNav
        base="/admin/configuracoes"
        ativa={aba}
        abas={[
          { id: "empresa", label: "Empresa" },
          { id: "cobranca", label: "Cobrança" },
          { id: "sla", label: "SLA" },
          { id: "assinatura", label: "Assinatura e PDF" },
          { id: "administradores", label: "Administradores" },
        ]}
      />

      {aba === "empresa" ? (
        <EmpresaForm
          inicial={lerConfig("empresa", valor("empresa"))}
          logoUrl={(await getEmpresaPublica()).logoUrl}
        />
      ) : null}
      {aba === "cobranca" ? <CobrancaForm inicial={lerConfig("cobranca", valor("cobranca"))} /> : null}
      {aba === "sla" ? (
        <div className="grid max-w-3xl gap-6">
          <SlaPadraoForm inicial={lerConfig("sla_padrao", valor("sla_padrao"))} />
          <HorarioComercialForm
            inicial={lerConfig("sla_horario_comercial", valor("sla_horario_comercial"))}
          />
        </div>
      ) : null}
      {aba === "assinatura" ? (
        <div className="grid gap-6">
          <AssinaturaForm inicial={lerConfig("assinatura", valor("assinatura"))} />
          <PdfForm inicial={lerConfig("pdf", valor("pdf"))} />
        </div>
      ) : null}
      {aba === "administradores" ? <AbaAdministradores usuarioAtualId={atual.id} /> : null}
    </>
  );
}

async function AbaAdministradores({ usuarioAtualId }: { usuarioAtualId: string }) {
  const supabase = await createClient();
  const [{ data: admins }, acessos] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, email, telefone, ativo")
      .eq("role", "admin")
      .order("ativo", { ascending: false })
      .order("nome"),
    ultimosAcessos(),
  ]);
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">Administradores têm acesso total ao sistema.</p>
        <UsuarioDialog
          role="admin"
          trigger={
            <Button>
              <Plus /> Novo administrador
            </Button>
          }
        />
      </div>
      <UsuariosTabela
        role="admin"
        usuarioAtualId={usuarioAtualId}
        usuarios={(admins ?? []).map((a) => ({ ...a, ultimoAcesso: acessos.get(a.id) ?? null }))}
      />
    </>
  );
}
