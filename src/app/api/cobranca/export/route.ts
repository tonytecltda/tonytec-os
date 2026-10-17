import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { consultarVisitasCobranca, lerFiltrosCobranca, type FiltrosCobranca } from "@/lib/cobranca-consulta";
import { COLUNAS_VISITAS, linhasVisitas } from "@/lib/cobranca-export";
import { gerarCsv, gerarXlsx, nomeArquivo } from "@/lib/export";

export const maxDuration = 60;

/** Exporta as visitas da tela de Cobrança (com os filtros ativos) em CSV ou XLSX. Somente admin. */
export async function GET(request: NextRequest) {
  const perfil = await getCurrentProfile();
  if (!perfil || perfil.role !== "admin")
    return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });

  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filtros: FiltrosCobranca = lerFiltrosCobranca(sp);
  const formato = sp.formato === "xlsx" ? "xlsx" : "csv";

  const { data, error } = await consultarVisitasCobranca(filtros);
  if (error) return NextResponse.json({ erro: "Não foi possível consultar as visitas" }, { status: 500 });

  const linhas = linhasVisitas((data ?? []) as unknown as Parameters<typeof linhasVisitas>[0]);
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const arquivo = nomeArquivo("cobranca-visitas", hoje);

  if (formato === "xlsx") {
    const total = linhas.reduce((acc, l) => acc + Number(l[9] ?? 0), 0);
    const buf = await gerarXlsx("Visitas", COLUNAS_VISITAS, linhas, {
      titulo: "Cobrança de visitas — Tonytec",
      rodape: ["TOTAL", "", "", "", null, null, "", null, null, Math.round(total * 100) / 100],
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${arquivo}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(gerarCsv(COLUNAS_VISITAS, linhas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${arquivo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
