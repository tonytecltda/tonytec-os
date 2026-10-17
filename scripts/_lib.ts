import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "../src/types/database";

config({ path: ".env.local", quiet: true });

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Variável ${name} não definida no .env.local`);
    process.exit(1);
  }
  return v;
}

export const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
export const ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

/** Cliente service_role (ignora RLS) — só para scripts administrativos. */
export function adminClient() {
  return createClient<Database>(SUPABASE_URL, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Cliente anônimo (sujeito à RLS), para logar como um usuário de teste. */
export function anonClient() {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Admin = ReturnType<typeof adminClient>;

/** Cria (ou atualiza) um usuário do Auth com role/cliente_id no app_metadata. */
export async function upsertUser(
  admin: Admin,
  opts: {
    email: string;
    password: string;
    nome: string;
    role: "admin" | "tecnico" | "cliente";
    cliente_id?: string | null;
  },
) {
  const app_metadata = { role: opts.role, cliente_id: opts.cliente_id ?? null };
  const { data: created, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    app_metadata,
    user_metadata: { nome: opts.nome },
  });

  let userId = created?.user?.id;
  if (error) {
    if (!/already|registered|exists/i.test(error.message)) throw error;
    // Já existe: localiza e atualiza senha/metadata.
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => u.email?.toLowerCase() === opts.email.toLowerCase());
    if (!existing) throw error;
    userId = existing.id;
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: opts.password,
      app_metadata,
      user_metadata: { nome: opts.nome },
    });
    if (updErr) throw updErr;
  }

  // O trigger cria o profile; garantimos role/cliente_id/nome corretos.
  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId!,
    email: opts.email,
    nome: opts.nome,
    role: opts.role,
    cliente_id: opts.cliente_id ?? null,
    ativo: true,
  });
  if (profErr) throw profErr;
  return userId!;
}
