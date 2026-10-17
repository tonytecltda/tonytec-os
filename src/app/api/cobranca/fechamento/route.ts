import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { carregarFechamento } from "@/lib/cobranca-consulta";
import { COLUNAS_FECHAMENTO, gerarPdfFechamento, linhasFechamento } from "@/lib/cobranca-export";
import { gerarCsv, gerarXlsx, mesPorExtenso, mesValido, nomeArquivo } from "@/lib/export";

export const maxDuration = 60;

/** Fechamento mensal de um cliente em PDF, XLSX ou CSV. Somente admin. */
export async function GET(request: NextRequest) {
  const perfil = await getCurrentProfile();
  if (!perfil || perfil.role !== "admin")
    return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });

  const p = request.nextUrl.searchParams;
  const cliente = p.get("cliente") ?? "";
  const mes = p.get("mes") ?? "";
  const formato = p.get("formato") ?? "pdf";
  if (!mesValido(mes)) return NextResponse.json({ erro: "Mês inválido" }, { status: 400 });

  const f = await carregarFechamento(cliente, mes);
  if (!f) return NextResponse.json({ erro: "Cliente não encontrado" }, { status: 404 });
  const arquivo = nomeArquivo("fechamento", f.cliente.nome, mes);

  if (formato === "pdf") {
    const pdf = await gerarPdfFechamento(f);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${arquivo}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const linhas = linhasFechamento(f);
  if (formato === "xlsx") {
    const buf = await gerarXlsx("Fechamento", COLUNAS_FECHAMENTO, linhas, {
      titulo: `Fechamento ${mesPorExtenso(mes)} — ${f.cliente.nome}`,
      rodape: ["TOTAL DO MÊS", "", "", "", null, null, f.resumo.total, null],
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${arquivo}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (formato === "csv") {
    return new NextResponse(
      gerarCsv(COLUNAS_FECHAMENTO, [
        ...linhas,
        ["TOTAL DO MÊS", "", "", "", null, null, f.resumo.total, null],
      ]),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${arquivo}.csv"`,
          "Cache-Control": "no-store",
        },
      },
    );
  }
  return NextResponse.json({ erro: "Formato inválido" }, { status: 400 });
}
