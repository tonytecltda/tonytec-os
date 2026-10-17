"use server";

import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Notificacao = {
  id: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
};

const vazio = { itens: [] as Notificacao[], naoLidas: 0 };

/** Últimas notificações do usuário logado + total de não lidas (a RLS já restringe às próprias). */
export async function listarNotificacoes(): Promise<{ itens: Notificacao[]; naoLidas: number }> {
  const perfil = await getCurrentProfile();
  if (!perfil) return vazio;
  const supabase = await createClient();
  const [lista, naoLidas] = await Promise.all([
    supabase
      .from("notificacoes")
      .select("id, titulo, mensagem, link, lida, created_at")
      .eq("profile_id", perfil.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", perfil.id)
      .eq("lida", false),
  ]);
  return { itens: lista.data ?? [], naoLidas: naoLidas.count ?? 0 };
}

export async function marcarNotificacaoLida(id: string) {
  const perfil = await getCurrentProfile();
  if (!perfil || !z.uuid().safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("notificacoes").update({ lida: true }).eq("id", id).eq("profile_id", perfil.id);
}

export async function marcarTodasNotificacoesLidas() {
  const perfil = await getCurrentProfile();
  if (!perfil) return;
  const supabase = await createClient();
  await supabase.from("notificacoes").update({ lida: true }).eq("profile_id", perfil.id).eq("lida", false);
}
