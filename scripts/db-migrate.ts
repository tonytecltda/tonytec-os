/**
 * Aplica as migrações de supabase/migrations no projeto remoto usando a
 * Management API do Supabase (não precisa da senha do banco).
 *
 * Uso: npm run db:migrate            (aplica pendentes)
 *      npm run db:migrate -- --status (só lista)
 *
 * Requer no .env.local: SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF.
 * O histórico fica em supabase_migrations.schema_migrations (mesma tabela da CLI),
 * então `supabase db push` continua compatível.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error("Defina SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF no .env.local");
  process.exit(1);
}

export async function runSql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text ? (JSON.parse(text) as T[]) : [];
}

const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const onlyStatus = process.argv.includes("--status");
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await runSql(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );
  `);
  const applied = new Set(
    (await runSql<{ version: string }>("select version from supabase_migrations.schema_migrations")).map(
      (r) => r.version,
    ),
  );

  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    const name = rest.join("_");
    if (applied.has(version)) {
      console.log(`✓ ${file}`);
      continue;
    }
    if (onlyStatus) {
      console.log(`• ${file} (pendente)`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    process.stdout.write(`→ aplicando ${file} ... `);
    // Migração + registro na mesma transação: ou aplica tudo, ou nada.
    await runSql(`begin;
${sql}
insert into supabase_migrations.schema_migrations (version, name, statements)
values (${literal(version)}, ${literal(name)}, array[${literal(sql)}]);
commit;`);
    console.log("ok");
  }
}

main().catch((err) => {
  console.error("\nFALHOU:", err instanceof Error ? err.message : err);
  process.exit(1);
});
