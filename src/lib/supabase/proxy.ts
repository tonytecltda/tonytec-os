import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { AREA_ROLES, ROLE_HOME, isUserRole } from "@/lib/roles";

/** Rotas acessíveis sem login. */
const PUBLIC_PATHS = ["/login", "/auth", "/definir-senha", "/esqueci-senha", "/assinar", "/sem-acesso"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Renova a sessão do Supabase a cada requisição e faz o roteamento por role.
 * IMPORTANTE: isto é só a "porta de entrada" (UX). A autorização de verdade
 * é refeita nos layouts/actions (requireRole) e garantida pela RLS no banco.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Não coloque código entre createServerClient e getClaims(): é o que renova o token.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (keepNext && pathname !== "/") url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    // Preserva cookies de sessão renovados.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!claims) {
    return isPublic(pathname) ? response : redirectTo("/login", true);
  }

  const appMeta = (claims.app_metadata ?? {}) as { role?: unknown; ativo?: unknown };
  const role = isUserRole(appMeta.role) ? appMeta.role : null;

  if (appMeta.ativo === false || !role) {
    return pathname === "/sem-acesso" ? response : redirectTo("/sem-acesso");
  }

  if (pathname === "/" || pathname === "/login") {
    return redirectTo(ROLE_HOME[role]);
  }

  const area = AREA_ROLES.find((a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`));
  if (area && !area.roles.includes(role)) {
    return redirectTo(ROLE_HOME[role]);
  }

  return response;
}
