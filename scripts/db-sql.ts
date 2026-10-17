/**
 * Executa um SQL avulso no projeto remoto (via Management API).
 * Uso: npm run db:sql -- "select count(*) from public.clientes"
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const query = process.argv.slice(2).join(" ");
  if (!query) {
    console.error('Uso: npm run db:sql -- "<sql>"');
    process.exit(1);
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text}`);
    process.exit(1);
  }
  console.table(JSON.parse(text));
}

main();
