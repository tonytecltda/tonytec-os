/** Regenera src/types/database.ts a partir do banco remoto. Uso: npm run db:types */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { requireEnv } from "./_lib";

const ref = requireEnv("SUPABASE_PROJECT_REF");
requireEnv("SUPABASE_ACCESS_TOKEN");

const out = execSync(`npx supabase gen types typescript --project-id ${ref} --schema public`, {
  env: process.env,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
writeFileSync("src/types/database.ts", out, "utf8");
console.log("✓ src/types/database.ts atualizado");
