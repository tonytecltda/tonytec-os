import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, FileText, MapPin, Plus, ScrollText, UserRound } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ultimosAcessos } from "@/lib/acesso";
import { situacaoContrato, vigenciaTexto } from "@/lib/contratos";
import { formatarDocumento } from "@/lib/documentos";
import { formatBRL, formatData } from "@/lib/format";
import { CHAMADO_STATUS, CONTRATO_TIPO, OS_STATUS, PRIORIDADE } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TabsNav } from "@/components/tabs-nav";
import { AtivoBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UsuarioDialog } from "@/components/usuarios/usuario-dialog";
import { UsuariosTabela } from "@/components/usuarios/usuarios-tabela";
import { ClienteForm } from "../cliente-form";
import { ClienteAtivoButton } from "./cliente-acoes";
import { UnidadeDialog } from "./unidade-dialog";
import { UnidadesLista } from "./unidades-lista";

const ABAS = ["dados", "unidades", "usuarios", "contratos", "historico"] as const;
type Aba = (typeof ABAS)[number];

export async function generateMetadata({ params }: PageProps<"/admin/clientes/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { title: "Cliente" };
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("razao_social, nome_fantasia")
    .eq("id", id)
    .maybeSingle();
  return { title: data ? data.nome_fantasia || data.razao_social : "Cliente" };
}

export default async function ClientePage({ params, searchParams }: PageProps<"/admin/clientes/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const aba: Aba = (ABAS as readonly string[]).includes(String(sp.aba)) ? (sp.aba as Aba) : "dados";

  const supabase = await createClient();
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!cliente) notFound();

  const contar = (tabela: "unidades" | "profiles" | "contratos") =>
    supabase
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", id)
      .then((r) => r.count ?? 0);
  const [nUnidades, nUsuarios, nContratos] = await Promise.all([
    contar("unidades"),
    contar("profiles"),
    contar("contratos"),
  ]);

  const nome = cliente.nome_fantasia || cliente.razao_social;
  const base = `/admin/clientes/${id}`;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/clientes">
          <ArrowLeft /> Clientes
        </Link>
      </Button>
      <PageHeader
        titulo={nome}
        descricao={[
          cliente.nome_fantasia ? cliente.razao_social : null,
          cliente.cnpj_cpf ? formatarDocumento(cliente.cnpj_cpf) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <AtivoBadge ativo={cliente.ativo} />
        <ClienteAtivoButton id={id} ativo={cliente.ativo} nome={nome} />
      </PageHeader>

      <TabsNav
        base={base}
        ativa={aba}
        abas={[
          { id: "dados", label: "Dados" },
          { id: "unidades", label: "Unidades", contador: nUnidades },
          { id: "usuarios", label: "Usuários do portal", contador: nUsuarios },
          { id: "contratos", label: "Contratos", contador: nContratos },
          { id: "historico", label: "Histórico" },
        ]}
      />

      {aba === "dados" ? (
        <ClienteForm
          id={id}
          inicial={{
            razao_social: cliente.razao_social,
            nome_fantasia: cliente.nome_fantasia ?? "",
            cnpj_cpf: cliente.cnpj_cpf ?? "",
            inscricao_estadual: cliente.inscricao_estadual ?? "",
            email: cliente.email ?? "",
            telefone: cliente.telefone ?? "",
            observacoes: cliente.observacoes ?? "",
          }}
        />
      ) : null}

      {aba === "unidades" ? <AbaUnidades clienteId={id} ativo={cliente.ativo} /> : null}
      {aba === "usuarios" ? <AbaUsuarios clienteId={id} ativo={cliente.ativo} /> : null}
      {aba === "contratos" ? <AbaContratos clienteId={id} /> : null}
      {aba === "historico" ? <AbaHistorico clienteId={id} /> : null}
    </>
  );
}

async function AbaUnidades({ clienteId, ativo }: { clienteId: string; ativo: boolean }) {
  const supabase = await createClient();
  const { data: unidades } = await supabase
    .from("unidades")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("ativo", { ascending: false })
    .order("nome");

  const nova = ativo ? (
    <UnidadeDialog
      clienteId={clienteId}
      trigger={
        <Button>
          <Plus /> Nova unidade
        </Button>
      }
    />
  ) : null;

  if (!unidades?.length) {
    return (
      <EmptyState
        icon={MapPin}
        titulo="Nenhuma unidade"
        descricao="Cadastre os locais onde a Tonytec atende este cliente."
      >
        {nova}
      </EmptyState>
    );
  }
  return (
    <>
      <div className="mb-4 flex justify-end">{nova}</div>
      <UnidadesLista
        clienteId={clienteId}
        unidades={unidades.map((u) => ({
          id: u.id,
          ativo: u.ativo,
          nome: u.nome,
          cep: u.cep ?? "",
          logradouro: u.logradouro ?? "",
          numero: u.numero ?? "",
          complemento: u.complemento ?? "",
          bairro: u.bairro ?? "",
          cidade: u.cidade ?? "",
          uf: u.uf ?? "",
          contato_local: u.contato_local ?? "",
          telefone_local: u.telefone_local ?? "",
          referencia: u.referencia ?? "",
        }))}
      />
    </>
  );
}

async function AbaUsuarios({ clienteId, ativo }: { clienteId: string; ativo: boolean }) {
  const supabase = await createClient();
  const [{ data: usuarios }, acessos] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, email, telefone, ativo")
      .eq("cliente_id", clienteId)
      .order("ativo", { ascending: false })
      .order("nome"),
    ultimosAcessos(),
  ]);

  const novo = ativo ? (
    <UsuarioDialog
      role="cliente"
      clienteId={clienteId}
      trigger={
        <Button>
          <Plus /> Novo usuário
        </Button>
      }
    />
  ) : null;

  if (!usuarios?.length) {
    return (
      <EmptyState
        icon={UserRound}
        titulo="Nenhum usuário do portal"
        descricao="Usuários do portal abrem e acompanham chamados deste cliente."
      >
        {novo}
      </EmptyState>
    );
  }
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">Cada usuário só enxerga os dados deste cliente.</p>
        {novo}
      </div>
      <UsuariosTabela
        role="cliente"
        usuarios={usuarios.map((u) => ({ ...u, ultimoAcesso: acessos.get(u.id) ?? null }))}
      />
    </>
  );
}

async function AbaContratos({ clienteId }: { clienteId: string }) {
  const supabase = await createClient();
  const { data: contratos } = await supabase
    .from("contratos")
    .select(
      "id, numero, descricao, tipo, status, data_inicio, data_fim, valor_mensal, visitas_inclusas_mes, horas_inclusas_mes",
    )
    .eq("cliente_id", clienteId)
    .order("data_inicio", { ascending: false });

  const novo = (
    <Button asChild>
      <Link href={`/admin/contratos/novo?cliente=${clienteId}`}>
        <Plus /> Novo contrato
      </Link>
    </Button>
  );

  if (!contratos?.length) {
    return (
      <EmptyState
        icon={ScrollText}
        titulo="Nenhum contrato"
        descricao="Sem contrato, os atendimentos são cobrados como avulsos."
      >
        {novo}
      </EmptyState>
    );
  }
  return (
    <>
      <div className="mb-4 flex justify-end">{novo}</div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Vigência</TableHead>
              <TableHead className="hidden md:table-cell">Mensal</TableHead>
              <TableHead className="hidden lg:table-cell">Inclusos/mês</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.map((c) => {
              const s = situacaoContrato(c);
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/admin/contratos/${c.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {c.numero}
                    </Link>
                    {c.descricao ? (
                      <div className="text-muted-foreground max-w-56 truncate text-xs">{c.descricao}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{CONTRATO_TIPO[c.tipo]}</TableCell>
                  <TableCell className="hidden md:table-cell">{vigenciaTexto(c)}</TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">
                    {formatBRL(c.valor_mensal)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {c.visitas_inclusas_mes} visita(s) · {Number(c.horas_inclusas_mes)} h
                  </TableCell>
                  <TableCell>
                    <StatusBadge tom={s.tom}>{s.label}</StatusBadge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        O saldo de visitas e horas do mês aparece no detalhe de cada contrato.
      </p>
    </>
  );
}

async function AbaHistorico({ clienteId }: { clienteId: string }) {
  const supabase = await createClient();
  const [{ data: chamados }, { data: ordens }] = await Promise.all([
    supabase
      .from("chamados")
      .select("id, protocolo, titulo, status, prioridade, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("ordens_servico")
      .select("id, numero, status, tipo_atendimento, created_at, tecnico_nome_snapshot")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4" /> Últimos chamados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!chamados?.length ? (
            <p className="text-muted-foreground text-sm">Nenhum chamado ainda.</p>
          ) : (
            <ul className="divide-y">
              {chamados.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="text-muted-foreground font-mono text-xs">{c.protocolo}</div>
                    <div className="truncate">{c.titulo}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div>{CHAMADO_STATUS[c.status]}</div>
                    <div className="text-muted-foreground text-xs">
                      {PRIORIDADE[c.prioridade]} · {formatData(c.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" /> Últimas ordens de serviço
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!ordens?.length ? (
            <p className="text-muted-foreground text-sm">Nenhuma OS ainda.</p>
          ) : (
            <ul className="divide-y">
              {ordens.map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-mono text-xs">{o.numero}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {o.tecnico_nome_snapshot ?? "—"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div>{OS_STATUS[o.status]}</div>
                    <div className="text-muted-foreground text-xs">{formatData(o.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
