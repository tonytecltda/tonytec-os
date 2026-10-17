import { BookOpen, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import { ITEM_TIPO } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TabsNav } from "@/components/tabs-nav";
import { FilterSelect, SearchInput } from "@/components/data/list-filters";
import { lerParam, termoBusca } from "@/components/data/pagination";
import { AtivoBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AtivoToggle,
  CategoriaDialog,
  EditarTrigger,
  ItemDialog,
  TipoProblemaDialog,
} from "./catalogo-dialogs";

export const metadata = { title: "Catálogos" };

const ABAS = ["categorias", "problemas", "itens"] as const;
type Aba = (typeof ABAS)[number];

export default async function CatalogosPage({ searchParams }: PageProps<"/admin/catalogos">) {
  await requireAdmin();
  const sp = await searchParams;
  const aba: Aba = (ABAS as readonly string[]).includes(String(sp.aba)) ? (sp.aba as Aba) : "categorias";

  const supabase = await createClient();
  const { data: categorias } = await supabase
    .from("categorias_servico")
    .select("id, nome, ordem, ativo, tipos_problema(count)")
    .order("ordem")
    .order("nome");
  const opcoesCategorias = (categorias ?? [])
    .filter((c) => c.ativo)
    .map((c) => ({ value: c.id, label: c.nome }));

  return (
    <>
      <PageHeader
        titulo="Catálogos"
        descricao="Categorias de serviço, tipos de problema (usados na abertura de chamados) e itens/serviços com preço."
      />
      <TabsNav
        base="/admin/catalogos"
        ativa={aba}
        abas={[
          { id: "categorias", label: "Categorias" },
          { id: "problemas", label: "Tipos de problema" },
          { id: "itens", label: "Itens e serviços" },
        ]}
      />

      {aba === "categorias" ? (
        <>
          <div className="mb-4 flex justify-end">
            <CategoriaDialog
              trigger={
                <Button>
                  <Plus /> Nova categoria
                </Button>
              }
            />
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="w-24">Ordem</TableHead>
                  <TableHead className="w-32">Problemas</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(categorias ?? []).map((c) => (
                  <TableRow key={c.id} className={c.ativo ? undefined : "opacity-60"}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="tabular-nums">{c.ordem}</TableCell>
                    <TableCell className="tabular-nums">{c.tipos_problema[0]?.count ?? 0}</TableCell>
                    <TableCell>
                      <AtivoBadge ativo={c.ativo} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CategoriaDialog categoria={c} trigger={<EditarTrigger />} />
                      <AtivoToggle tabela="categorias_servico" id={c.id} ativo={c.ativo} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}

      {aba === "problemas" ? (
        <AbaProblemas categoriaFiltro={lerParam(sp.categoria)} categorias={opcoesCategorias} />
      ) : null}
      {aba === "itens" ? (
        <AbaItens q={termoBusca(lerParam(sp.q))} tipo={lerParam(sp.tipo)} categorias={opcoesCategorias} />
      ) : null}
    </>
  );
}

async function AbaProblemas({
  categoriaFiltro,
  categorias,
}: {
  categoriaFiltro: string;
  categorias: { value: string; label: string }[];
}) {
  const supabase = await createClient();
  let query = supabase
    .from("tipos_problema")
    .select("id, nome, ativo, categoria_id, categorias_servico(nome, ordem)")
    .order("nome");
  if (categoriaFiltro && categorias.some((c) => c.value === categoriaFiltro)) {
    query = query.eq("categoria_id", categoriaFiltro);
  }
  const { data: tipos } = await query;
  const ordenados = (tipos ?? []).sort(
    (a, b) =>
      (a.categorias_servico?.ordem ?? 0) - (b.categorias_servico?.ordem ?? 0) ||
      (a.categorias_servico?.nome ?? "").localeCompare(b.categorias_servico?.nome ?? "") ||
      a.nome.localeCompare(b.nome),
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <FilterSelect
          param="categoria"
          placeholder="Categoria"
          className="w-full sm:w-56"
          opcoes={[{ value: "", label: "Todas as categorias" }, ...categorias]}
        />
        <TipoProblemaDialog
          categorias={categorias}
          categoriaPadrao={categoriaFiltro || undefined}
          trigger={
            <Button>
              <Plus /> Novo tipo de problema
            </Button>
          }
        />
      </div>
      {!ordenados.length ? (
        <EmptyState icon={BookOpen} titulo="Nenhum tipo de problema" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Problema</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenados.map((t) => (
                <TableRow key={t.id} className={t.ativo ? undefined : "opacity-60"}>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{t.categorias_servico?.nome}</TableCell>
                  <TableCell>
                    <AtivoBadge ativo={t.ativo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <TipoProblemaDialog
                      tipo={{ id: t.id, nome: t.nome, categoria_id: t.categoria_id }}
                      categorias={categorias}
                      trigger={<EditarTrigger />}
                    />
                    <AtivoToggle tabela="tipos_problema" id={t.id} ativo={t.ativo} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

async function AbaItens({
  q,
  tipo,
  categorias,
}: {
  q: string;
  tipo: string;
  categorias: { value: string; label: string }[];
}) {
  const supabase = await createClient();
  let query = supabase
    .from("itens_catalogo")
    .select("id, descricao, tipo, unidade, valor_unitario, ativo, categoria_id, categorias_servico(nome)")
    .order("ativo", { ascending: false })
    .order("descricao")
    .limit(500);
  if (q) query = query.ilike("descricao", `%${q}%`);
  if (tipo in ITEM_TIPO) query = query.eq("tipo", tipo as keyof typeof ITEM_TIPO);
  const { data: itens } = await query;

  const novo = (
    <ItemDialog
      categorias={categorias}
      trigger={
        <Button>
          <Plus /> Novo item
        </Button>
      }
    />
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput placeholder="Buscar item" />
          <FilterSelect
            param="tipo"
            placeholder="Tipo"
            opcoes={[
              { value: "", label: "Todos os tipos" },
              ...Object.entries(ITEM_TIPO).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        {novo}
      </div>
      {!itens?.length ? (
        <EmptyState
          icon={BookOpen}
          titulo={q || tipo ? "Nenhum item encontrado" : "Nenhum item cadastrado"}
          descricao="Itens e serviços com preço agilizam o preenchimento da OS pelo técnico."
        >
          {!q && !tipo ? novo : null}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="hidden w-24 sm:table-cell">Status</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((i) => (
                <TableRow key={i.id} className={i.ativo ? undefined : "opacity-60"}>
                  <TableCell className="font-medium">{i.descricao}</TableCell>
                  <TableCell className="hidden sm:table-cell">{ITEM_TIPO[i.tipo]}</TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {i.categorias_servico?.nome ?? "Todas"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(i.valor_unitario)}
                    <span className="text-muted-foreground">/{i.unidade}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <AtivoBadge ativo={i.ativo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ItemDialog
                      item={{
                        id: i.id,
                        descricao: i.descricao,
                        tipo: i.tipo,
                        unidade: i.unidade,
                        valor_unitario: Number(i.valor_unitario),
                        categoria_id: i.categoria_id ?? "",
                      }}
                      categorias={categorias}
                      trigger={<EditarTrigger />}
                    />
                    <AtivoToggle tabela="itens_catalogo" id={i.id} ativo={i.ativo} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
