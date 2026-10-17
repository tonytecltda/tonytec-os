import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino dos links enviados pelo Supabase por e-mail.
 *   ?code=...                 (fluxo PKCE do "esqueci minha senha") -> troca pelo login
 *   ?token_hash=...&type=...  -> NÃO consome aqui: manda para /acesso, onde o usuário
 *                                clica em "Continuar" (pré-visualizações de link não gastam o token)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "recovery";
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/definir-senha";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/definir-senha";

  if (tokenHash) {
    const url = new URL("/acesso", origin);
    url.searchParams.set("token", tokenHash);
    url.searchParams.set("tipo", type);
    return NextResponse.redirect(url);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/login?erro=link", origin));
}
