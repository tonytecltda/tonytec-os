/**
 * Limpeza para o go-live: remove os dados de demonstração e de testes (clientes "(DEMO)",
 * "[E2E]", usuários @example.com e tudo ligado a eles), arquivos do Storage correspondentes e,
 * se não sobrar nenhum chamado/OS, zera a numeração (CH-/OS-).
 *
 * Padrão: SIMULA (executa tudo numa transação e desfaz), mostrando o que seria removido.
 *
 *   npm run golive:limpar                         # simulação (nada é alterado)
 *   npm run golive:limpar -- --executar --confirmo=LIMPAR
 *   npm run golive:limpar -- --executar --confirmo=LIMPAR --tudo
 *
 * --tudo também apaga TODOS os chamados/OS/notificações/auditoria (inclusive de clientes reais).
 * Nunca remove: administradores, configurações, catálogos (categorias, tipos de problema, itens).
 * Faça um backup antes (Supabase > Database > Backups). Operação irreversível quando executada.
 */
import { adminClient, requireEnv } from "./_lib";
import { DEMO } from "./demo-data";

const args = process.argv.slice(2);
const executar = args.includes("--executar");
const tudo = args.includes("--tudo");
const confirmado = args.includes("--confirmo=LIMPAR");

const BUCKETS = ["chamado-anexos", "os-anexos", "assinaturas", "os-pdfs"] as const;

async function sql(query: string) {
  const resp = await fetch(
    `https://api.supabase.com/v1/projects/${requireEnv("SUPABASE_PROJECT_REF")}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("SUPABASE_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const corpo = await resp.text();
  if (!resp.ok) throw new Error(corpo);
  return JSON.parse(corpo) as Record<string, unknown>[];
}

const lista = (itens: readonly string[]) => itens.map((i) => `'${i.replace(/'/g, "''")}'`).join(", ");

function montarSql() {
  const cnpjs = [DEMO.clienteA.cnpj_cpf, DEMO.clienteB.cnpj_cpf];
  const chamadosDoEscopo = tudo
    ? "select id from public.chamados"
    : "select id from public.chamados where cliente_id in (select id from _clientes)";
  const osDoEscopo = tudo
    ? "select id from public.ordens_servico"
    : "select id from public.ordens_servico where cliente_id in (select id from _clientes) or chamado_id in (select id from _chamados)";

  return `
begin;
set local session_replication_role = replica;

create temp table _resumo (chave text, valor bigint);
create temp table _clientes as
  select id from public.clientes
  where cnpj_cpf in (${lista(cnpjs)}) or cnpj_cpf like 'E2E%'
     or razao_social ilike '%(DEMO)%' or razao_social ilike '[E2E]%';
create temp table _usuarios as
  select id from public.profiles
  where role <> 'admin'
    and (email ilike '%@example.com' or cliente_id in (select id from _clientes));
create temp table _chamados as ${chamadosDoEscopo};
create temp table _os as ${osDoEscopo};

-- Arquivos do Storage que ficarão órfãos
create temp table _paths (bucket text, path text);
insert into _paths select 'chamado-anexos', storage_path from public.chamado_anexos where chamado_id in (select id from _chamados);
insert into _paths select 'os-anexos', storage_path from public.os_anexos where os_id in (select id from _os);
insert into _paths select 'assinaturas', imagem_path from public.os_assinaturas where os_id in (select id from _os);
insert into _paths select 'assinaturas', assinatura_path from public.profiles where id in (select id from _usuarios) and assinatura_path is not null;
insert into _paths select 'os-pdfs', pdf_path from public.ordens_servico where id in (select id from _os) and pdf_path is not null;

-- Referências a usuários que serão removidos (nulas viram NULL; obrigatórias apagam a linha)
do $$
declare f record;
begin
  for f in
    select c.conrelid::regclass as tabela, a.attname as coluna, a.attnotnull as obrigatoria
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass and c.conrelid <> 'public.profiles'::regclass
  loop
    if f.tabela::text in ('public.notificacoes') or f.obrigatoria then
      execute format('delete from %s where %I in (select id from _usuarios)', f.tabela, f.coluna);
    else
      execute format('update %s set %I = null where %I in (select id from _usuarios)', f.tabela, f.coluna, f.coluna);
    end if;
  end loop;
end $$;

insert into _resumo select 'os_assinaturas', count(*) from public.os_assinaturas where os_id in (select id from _os);
delete from public.os_assinaturas where os_id in (select id from _os);
insert into _resumo select 'os_assinatura_tokens', count(*) from public.os_assinatura_tokens where os_id in (select id from _os);
delete from public.os_assinatura_tokens where os_id in (select id from _os);
insert into _resumo select 'os_anexos', count(*) from public.os_anexos where os_id in (select id from _os);
delete from public.os_anexos where os_id in (select id from _os);
insert into _resumo select 'os_itens', count(*) from public.os_itens where os_id in (select id from _os);
delete from public.os_itens where os_id in (select id from _os);
insert into _resumo select 'os_visitas', count(*) from public.os_visitas where os_id in (select id from _os);
delete from public.os_visitas where os_id in (select id from _os);
insert into _resumo select 'ordens_servico', count(*) from _os;
delete from public.ordens_servico where id in (select id from _os);

insert into _resumo select 'chamado_anexos', count(*) from public.chamado_anexos where chamado_id in (select id from _chamados);
delete from public.chamado_anexos where chamado_id in (select id from _chamados);
insert into _resumo select 'chamado_comentarios', count(*) from public.chamado_comentarios where chamado_id in (select id from _chamados);
delete from public.chamado_comentarios where chamado_id in (select id from _chamados);
insert into _resumo select 'chamado_historico', count(*) from public.chamado_historico where chamado_id in (select id from _chamados);
delete from public.chamado_historico where chamado_id in (select id from _chamados);
insert into _resumo select 'chamados', count(*) from _chamados;
delete from public.chamados where id in (select id from _chamados);

insert into _resumo select 'contratos', count(*) from public.contratos where cliente_id in (select id from _clientes);
delete from public.contratos where cliente_id in (select id from _clientes);
insert into _resumo select 'unidades', count(*) from public.unidades where cliente_id in (select id from _clientes);
delete from public.unidades where cliente_id in (select id from _clientes);
insert into _resumo select 'clientes', count(*) from _clientes;
delete from public.clientes where id in (select id from _clientes);

-- Avisos (de qualquer pessoa) que apontam para chamados/OS removidos
insert into _resumo select 'notificacoes_orfas', count(*) from public.notificacoes
  where substring(link from '[0-9a-f-]{36}$') in (select id::text from _chamados union select id::text from _os);
delete from public.notificacoes
  where substring(link from '[0-9a-f-]{36}$') in (select id::text from _chamados union select id::text from _os);
insert into _resumo select 'usuarios', count(*) from _usuarios;
${tudo ? "insert into _resumo select 'notificacoes', count(*) from public.notificacoes;\ndelete from public.notificacoes;" : ""}
create temp table _ids_usuarios as select id from _usuarios;
delete from public.profiles where id in (select id from _usuarios);

${
  tudo
    ? "insert into _resumo select 'auditoria', count(*) from public.auditoria;\ndelete from public.auditoria;"
    : "insert into _resumo select 'auditoria', count(*) from public.auditoria where autor_id in (select id from _ids_usuarios) or registro_id in (select id from _clientes union select id from _chamados union select id from _os);\ndelete from public.auditoria where autor_id in (select id from _ids_usuarios) or registro_id in (select id from _clientes union select id from _chamados union select id from _os);"
}
delete from private.rate_limit;

-- Numeração: só recomeça do 1 se não restou nenhum registro
do $$
begin
  if not exists (select 1 from public.chamados) then delete from private.contadores where chave like 'CH-%'; end if;
  if not exists (select 1 from public.ordens_servico) then delete from private.contadores where chave like 'OS-%'; end if;
  if not exists (select 1 from public.contratos) then delete from private.contadores where chave like 'CT-%'; end if;
end $$;

${
  executar
    ? `insert into public.auditoria (tabela, registro_id, acao, motivo, dados_depois)
       values ('sistema', null, 'golive_limpeza', 'Limpeza de dados de demonstração/testes para entrada em produção',
               jsonb_build_object('escopo', '${tudo ? "tudo" : "demo"}', 'itens', (select jsonb_object_agg(chave, valor) from _resumo)));`
    : ""
}

select jsonb_build_object(
  'resumo', (select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb) from _resumo),
  'paths', (select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'path', path)), '[]'::jsonb) from _paths where path is not null),
  'usuarios', (select coalesce(jsonb_agg(id), '[]'::jsonb) from _ids_usuarios),
  'restantes', jsonb_build_object(
    'chamados', (select count(*) from public.chamados),
    'ordens_servico', (select count(*) from public.ordens_servico),
    'clientes', (select count(*) from public.clientes),
    'administradores', (select count(*) from public.profiles where role = 'admin'))
) as r;

${executar ? "commit;" : "rollback;"}
`;
}

async function main() {
  if (executar && !confirmado) {
    console.error("Para executar de verdade, acrescente --confirmo=LIMPAR (e faça um backup antes).");
    process.exit(1);
  }
  console.log(
    executar
      ? `\n⚠ EXECUTANDO a limpeza (${tudo ? "TODOS os chamados/OS" : "somente demonstração/testes"})...`
      : `\nSimulação (nada será alterado). Escopo: ${tudo ? "TODOS os chamados/OS" : "demonstração/testes"}.`,
  );

  const [linha] = await sql(montarSql());
  const r = linha.r as {
    resumo: Record<string, number>;
    paths: { bucket: string; path: string }[];
    usuarios: string[];
    restantes: Record<string, number>;
  };
  console.log("\nRegistros removidos:");
  for (const [k, v] of Object.entries(r.resumo)) console.log(`  ${k.padEnd(22)} ${v}`);
  console.log(`  arquivos no Storage    ${r.paths.length}`);
  console.log("\nO que permanece:");
  for (const [k, v] of Object.entries(r.restantes)) console.log(`  ${k.padEnd(22)} ${v}`);

  if (!executar) {
    console.log("\nSimulação concluída — nenhuma alteração foi gravada.");
    return;
  }

  const sa = adminClient();
  let removidos = 0;
  for (const bucket of BUCKETS) {
    const caminhos = r.paths.filter((p) => p.bucket === bucket).map((p) => p.path);
    for (let i = 0; i < caminhos.length; i += 100) {
      const { error } = await sa.storage.from(bucket).remove(caminhos.slice(i, i + 100));
      if (error) console.error(`  Storage ${bucket}:`, error.message);
      else removidos += caminhos.slice(i, i + 100).length;
    }
  }
  let usuarios = 0;
  for (const id of r.usuarios) {
    const { error } = await sa.auth.admin.deleteUser(id);
    if (error) console.error(`  Usuário ${id}:`, error.message);
    else usuarios++;
  }
  console.log(`\n✓ Limpeza concluída: ${removidos} arquivos e ${usuarios} contas de acesso removidos.`);
  console.log(
    "Próximos passos: cadastrar clientes/usuários reais e conferir o checklist em docs/CHECKLIST-PRODUCAO.md.",
  );
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
