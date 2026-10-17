/** Exportação de planilhas (CSV e XLSX) para o financeiro. */

export type Celula = string | number | boolean | Date | null | undefined;
export type Coluna = {
  titulo: string;
  /** Largura aproximada em caracteres (XLSX). */
  largura?: number;
  /** "moeda" e "numero" usam formato numérico no XLSX e vírgula decimal no CSV. */
  formato?: "texto" | "moeda" | "numero" | "inteiro" | "percentual" | "data" | "datahora";
};

function escaparCsv(valor: string) {
  return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

function dataLocal(d: Date, comHora: boolean) {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return comHora ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : `${p.day}/${p.month}/${p.year}`;
}

function textoCsv(valor: Celula, formato: Coluna["formato"]): string {
  if (valor == null || valor === "") return "";
  if (valor instanceof Date) return dataLocal(valor, formato === "datahora");
  if (typeof valor === "number") {
    // Excel brasileiro: separador ";" e vírgula decimal, sem milhar.
    return (formato === "moeda" ? valor.toFixed(2) : String(Math.round(valor * 1e6) / 1e6)).replace(".", ",");
  }
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  // Proteção contra injeção de fórmulas em planilhas (=, +, -, @ no início).
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

/** CSV para Excel brasileiro: UTF-8 com BOM, separador ";" e quebra de linha CRLF. */
export function gerarCsv(colunas: Coluna[], linhas: Celula[][]): string {
  const cab = colunas.map((c) => escaparCsv(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c, i) => escaparCsv(textoCsv(l[i], c.formato))).join(";"));
  return `﻿${[cab, ...corpo].join("\r\n")}\r\n`;
}

/** XLSX (Excel) com cabeçalho formatado e colunas numéricas de verdade. */
export async function gerarXlsx(
  nomeAba: string,
  colunas: Coluna[],
  linhas: Celula[][],
  extras?: { titulo?: string; rodape?: Celula[] },
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tonytec OS";
  wb.created = new Date();
  const ws = wb.addWorksheet(nomeAba.slice(0, 31));

  let primeiraLinha = 1;
  if (extras?.titulo) {
    ws.mergeCells(1, 1, 1, Math.max(colunas.length, 1));
    const t = ws.getCell(1, 1);
    t.value = extras.titulo;
    t.font = { bold: true, size: 13 };
    primeiraLinha = 3;
  }
  const cab = ws.getRow(primeiraLinha);
  colunas.forEach((c, i) => {
    cab.getCell(i + 1).value = c.titulo;
    ws.getColumn(i + 1).width = c.largura ?? 16;
  });
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  cab.alignment = { vertical: "middle" };

  for (const l of linhas) {
    const row = ws.addRow(l.map((v) => (v instanceof Date ? v : (v ?? null))));
    colunas.forEach((c, i) => {
      const cel = row.getCell(i + 1);
      if (c.formato === "moeda") cel.numFmt = '"R$" #,##0.00';
      else if (c.formato === "numero") cel.numFmt = "#,##0.00";
      else if (c.formato === "inteiro") cel.numFmt = "#,##0";
      else if (c.formato === "percentual") cel.numFmt = '0.0"%"';
      else if (c.formato === "data") cel.numFmt = "dd/mm/yyyy";
      else if (c.formato === "datahora") cel.numFmt = "dd/mm/yyyy hh:mm";
    });
  }
  if (extras?.rodape) {
    const row = ws.addRow(extras.rodape);
    row.font = { bold: true };
    colunas.forEach((c, i) => {
      if (c.formato === "moeda") row.getCell(i + 1).numFmt = '"R$" #,##0.00';
    });
  }
  ws.views = [{ state: "frozen", ySplit: primeiraLinha }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Nome de arquivo seguro, ex.: "fechamento-residencial-alfa-2026-10". */
export function nomeArquivo(...partes: string[]) {
  return partes
    .join("-")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export const mesAtualISO = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);

export const mesValido = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

/** "2026-10" -> "outubro de 2026" */
export function mesPorExtenso(m: string) {
  const [a, mm] = m.split("-").map(Number);
  const nomes = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${nomes[mm - 1]} de ${a}`;
}

// ---------------------------------------------------------------- relatórios com várias seções
export type SecaoExport = { titulo: string; colunas: Coluna[]; linhas: Celula[][] };

/** CSV com várias seções separadas por linha em branco (cada uma com seu título e cabeçalho). */
export function gerarCsvSecoes(titulo: string, secoes: SecaoExport[]): string {
  const blocos = secoes.map((s) => {
    const csv = gerarCsv(s.colunas, s.linhas).replace(/^﻿/, "").trimEnd();
    return `${escaparCsv(s.titulo)}\r\n${csv}`;
  });
  return `﻿${escaparCsv(titulo)}\r\n\r\n${blocos.join("\r\n\r\n")}\r\n`;
}

/** XLSX com uma aba por seção. */
export async function gerarXlsxSecoes(titulo: string, secoes: SecaoExport[]): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tonytec OS";
  wb.created = new Date();
  const usados = new Set<string>();
  secoes.forEach((s, idx) => {
    let nome =
      s.titulo
        .replace(/[\/?*[\]:]/g, " ")
        .slice(0, 28)
        .trim() || `Seção ${idx + 1}`;
    while (usados.has(nome.toLowerCase())) nome = `${nome.slice(0, 25)} ${idx + 1}`;
    usados.add(nome.toLowerCase());
    const ws = wb.addWorksheet(nome);
    ws.mergeCells(1, 1, 1, Math.max(s.colunas.length, 1));
    ws.getCell(1, 1).value = `${titulo} — ${s.titulo}`;
    ws.getCell(1, 1).font = { bold: true, size: 13 };
    const cab = ws.getRow(3);
    s.colunas.forEach((c, i) => {
      cab.getCell(i + 1).value = c.titulo;
      ws.getColumn(i + 1).width = c.largura ?? 16;
    });
    cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    for (const l of s.linhas) {
      const row = ws.addRow(l.map((v) => (v instanceof Date ? v : (v ?? null))));
      s.colunas.forEach((c, i) => {
        const cel = row.getCell(i + 1);
        if (c.formato === "moeda") cel.numFmt = '"R$" #,##0.00';
        else if (c.formato === "numero") cel.numFmt = "#,##0.00";
        else if (c.formato === "inteiro") cel.numFmt = "#,##0";
        else if (c.formato === "percentual") cel.numFmt = '0.0"%"';
        else if (c.formato === "data") cel.numFmt = "dd/mm/yyyy";
        else if (c.formato === "datahora") cel.numFmt = "dd/mm/yyyy hh:mm";
      });
    }
    ws.views = [{ state: "frozen", ySplit: 3 }];
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
