"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { origemApp } from "@/lib/acesso";
import { AREA_ROLES, ROLE_HOME, isUserRole } from "@/lib/roles";

export type FormState = { error?: string; success?: string } | undefined;

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  password: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
});

/** Só aceita caminhos internos (evita open redirect). */
function safeNext(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    if (error?.code === "user_banned") return { error: "Seu acesso está desativado. Fale com a Tonytec." };
    return { error: "E-mail ou senha incorretos." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, ativo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || !profile.ativo || !isUserRole(profile.role)) {
    await supabase.auth.signOut();
    return { error: "Seu acesso está desativado. Fale com a Tonytec." };
  }

  const home = ROLE_HOME[profile.role];
  const next = safeNext(parsed.data.next);
  const area = next ? AREA_ROLES.find((a) => next.startsWith(a.prefix)) : undefined;
  redirect(next && (!area || area.roles.includes(profile.role)) ? next : home);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const emailSchema = z.object({ email: z.email("Informe um e-mail válido.").trim().toLowerCase() });

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origemApp()}/auth/confirm?next=/definir-senha`,
  });
  // Resposta sempre igual, para não revelar quais e-mails existem.
  return {
    success:
      "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha. " +
      "Se não chegar em alguns minutos, peça um novo link de acesso à Tonytec.",
  };
}

const acessoSchema = z.object({
  token: z.string().min(10).max(500),
  tipo: z.enum(["recovery", "invite", "magiclink", "email"]),
});

/**
 * Consome o token do link de acesso SOMENTE quando o usuário clica em "Continuar"
 * (pré-visualizações de link do WhatsApp/e-mail fazem GET e não podem gastar o token).
 */
export async function ativarAcesso(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acessoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Link inválido. Peça um novo link à Tonytec." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: parsed.data.token, type: parsed.data.tipo });
  if (error) {
    return { error: "Este link é inválido, já foi usado ou expirou. Peça um novo link à Tonytec." };
  }
  redirect("/definir-senha");
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "Link expirado. Solicite um novo link de acesso." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "A nova senha precisa ser diferente da anterior."
          : "Não foi possível salvar a senha. Tente novamente.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  redirect(profile && isUserRole(profile.role) ? ROLE_HOME[profile.role] : "/login");
}
