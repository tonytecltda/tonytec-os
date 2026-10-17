/**
 * Cria o primeiro administrador.
 * Uso: preencha SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME no .env.local
 *      e rode `npm run seed:admin`. Pode rodar de novo para redefinir a senha.
 */
import { adminClient, requireEnv, upsertUser } from "./_lib";

async function main() {
  const email = requireEnv("SEED_ADMIN_EMAIL").trim().toLowerCase();
  const password = requireEnv("SEED_ADMIN_PASSWORD");
  const nome = process.env.SEED_ADMIN_NAME?.trim() || "Administrador";
  if (password.length < 8) {
    console.error("SEED_ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  const id = await upsertUser(adminClient(), { email, password, nome, role: "admin" });
  console.log(`✓ Admin pronto: ${email} (id ${id})`);
  console.log("  Dica: apague SEED_ADMIN_PASSWORD do .env.local depois do primeiro login.");
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
