import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDataHora } from "@/lib/format";
import {
  ACOES_AUDITORIA,
  CAMPOS_IDENTIFICACAO,
  TABELAS_AUDITORIA,
  diffAuditoria,
  rotuloAcao,
  rotuloRegistro,
  rotuloTabela,
} from "@/lib/auditoria-view";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect, PeriodoFilter } from "@/components/data/list-filters";
import { lerPagina, lerParam, Pagination } from "@/components/data/pagination";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Auditoria" };

const PAGE_SIZE = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AuditoriaPage({ searchParams }: PageProps<"/admin/auditoria">) {
  await requireAdmin();
  const sp = await searchParams;
  const tabela = lerParam(sp.tabela);
  const acao = lerParam(sp.acao);
  const autor = lerParam(sp.autor);
  const de = lerParam(sp.de);
  const ate = lerParam(sp.ate);
  const page = lerPagina(sp.page);

  const supabase = await createClient();
  const { data: equipe } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .in("role", ["admin", "tecnico"])
    .order("nome");

  let query = supabase
    .from("auditoria")
    .select("id, tabela, registro_id, acao, motivo, dados_antes, dados_depois, autor_id, created_at", {
      count: "exact",
    });
  if (tabela in TABELAS_AUDITORIA) query = query.eq("tabela", tabela);
  if (acao in ACOES_AUDITORIA) query = query.eq("acao", acao);
  if (autor === "sistema") query = query.is("autor_id", null);
  else if (UUID.test(autor)) query = query.eq("autor_id", autor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(de)) query = query.gte("created_at", `${de}T00:00:00-03:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ate)) query = query.lte("created_at", `${ate}T23:59:59.999-03:00`);

  const {
    data: registros,
    count,
    error,
  } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  // Autores que aparecem na página (podem ser usuários de cliente, fora da lista de filtro).
  const idsAutores = [...new Set((registros ?? []).map((r) => r.autor_id).filter((x): x is string => !!x))];
  const { data: autores } = idsAutores.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsAutores)
    : { data: [] };
  const nomeAutor = new Map((autores ?? []).map((a) => [a.id, a.nome]));

  // Nome atual dos registros (alterações guardam só os campos que mudaram, sem o nome).
  const nomeRegistro = new Map<string, string>();
  const idsPorTabela = new Map<string, string[]>();
  for (const r of registros ?? []) {
    if (r.registro_id && CAMPOS_IDENTIFICACAO[r.tabela]) {
      idsPorTabela.set(r.tabela, [...(idsPorTabela.get(r.tabela) ?? []), r.registro_id]);
    }
  }
  await Promise.all(
    [...idsPorTabela].map(async ([t, ids]) => {
      const campos = CAMPOS_IDENTIFICACAO[t];
      const { data } = await supabase
        .from(t as "clientes")
        .select(["id", ...campos].join(","))
        .in("id", [...new Set(ids)]);
      for (const linha of (data ?? []) as unknown as Record<string, unknown>[]) {
        const nome = campos.map((c) => linha[c]).find((v) => typeof v === "string" && v.trim());
        if (nome) nomeRegistro.set(`${t}:${linha.id}`, nome as string);
      }
    }),
  );

  return (
    <>
      <PageHeader
        titulo="Auditoria"
        descricao="Quem fez o quê, e quando: cadastros, contratos, usuários, cobrança e ciclo de vida das OS. Registros não podem ser apagados."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterSelect
          param="tabela"
          placeholder="Área"
          opcoes={[
            { value: "", label: "Todas as áreas" },
            ...Object.entries(TABELAS_AUDITORIA).map(([value, label]) => ({ value, label })),
          ]}
        />
        <FilterSelect
          param="acao"
          placeholder="Ação"
          className="w-full sm:w-56"
          opcoes={[
            { value: "", label: "Todas as ações" },
            ...Object.entries(ACOES_AUDITORIA).map(([value, label]) => ({ value, label })),
          ]}
        />
        <FilterSelect
          param="autor"
          placeholder="Autor"
          opcoes={[
            { value: "", label: "Todos os autores" },
            { value: "sistema", label: "Sistema / link público" },
            ...(equipe ?? []).map((p) => ({ value: p.id, label: p.nome })),
          ]}
        />
        <PeriodoFilter rotuloDe="Registrado a partir de" rotuloAte="Registrado até" />
      </div>

      {error ? (
        <p className="text-destructive text-sm">Não foi possível carregar a auditoria.</p>
      ) : !registros?.length ? (
        <EmptyState icon={ShieldCheck} titulo="Nenhum registro encontrado" descricao="Ajuste os filtros." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((r) => {
                  const linhas = diffAuditoria(r.dados_antes, r.dados_depois);
                  return (
                    <TableRow key={r.id} className="align-top">
                      <TableCell className="whitespace-nowrap">{formatDataHora(r.created_at)}</TableCell>
                      <TableCell className="max-w-40 truncate">
                        {r.autor_id
                          ? (nomeAutor.get(r.autor_id) ?? "Usuário removido")
                          : "Sistema / link público"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{rotuloAcao(r.acao)}</div>
                        <Badge variant="outline" className="mt-1">
                          {rotuloTabela(r.tabela)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {nomeRegistro.get(`${r.tabela}:${r.registro_id}`) ??
                          rotuloRegistro(r.tabela, r.dados_antes, r.dados_depois, r.registro_id)}
                      </TableCell>
                      <TableCell className="max-w-sm min-w-64">
                        {r.motivo && <p className="mb-1 text-sm">Motivo: {r.motivo}</p>}
                        {linhas.length > 0 ? (
                          <details className="text-xs">
                            <summary className="text-primary cursor-pointer">
                              {linhas.length} campo{linhas.length > 1 ? "s" : ""}
                            </summary>
                            <dl className="mt-2 grid w-64 gap-2 sm:w-80">
                              {linhas.map((l) => (
                                <div key={l.campo} className="grid gap-0.5">
                                  <dt className="text-muted-foreground truncate font-mono">{l.campo}</dt>
                                  <dd className="min-w-0 break-words">
                                    {l.antes !== null && l.depois !== null ? (
                                      <>
                                        <span className="text-muted-foreground line-through">{l.antes}</span>
                                        {" → "}
                                        <span className="font-medium">{l.depois}</span>
                                      </>
                                    ) : (
                                      (l.depois ?? l.antes)
                                    )}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </details>
                        ) : (
                          !r.motivo && <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination
            base="/admin/auditoria"
            params={sp}
            page={page}
            pageSize={PAGE_SIZE}
            total={count ?? 0}
          />
        </>
      )}
    </>
  );
}
