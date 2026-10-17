"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/format";

type Ponto = { nome: string; qtd: number };

const EIXO = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const TOOLTIP = {
  contentStyle: {
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
  },
  cursor: { fill: "var(--muted)", opacity: 0.5 },
} as const;

const fmtNum = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR");
const fmtMoeda = (v: unknown) => formatBRL(Number(v ?? 0));

/** Resumo textual para leitores de tela (o gráfico em si é visual). */
function resumo(dados: Ponto[], unidade: string) {
  if (!dados.length) return "Sem dados no período.";
  return dados
    .slice(0, 6)
    .map((d) => `${d.nome}: ${unidade === "moeda" ? fmtMoeda(d.qtd) : fmtNum(d.qtd)}`)
    .join("; ");
}

export function Vazio({ texto = "Sem dados no período." }: { texto?: string }) {
  return <p className="text-muted-foreground grid h-40 place-items-center text-sm">{texto}</p>;
}

/** Barras (horizontais por padrão: nomes longos de clientes/problemas ficam legíveis). */
export function GraficoBarras({
  dados,
  horizontal = true,
  formato = "inteiro",
  cor = "var(--chart-1)",
  rotulo,
}: {
  dados: Ponto[];
  horizontal?: boolean;
  formato?: "inteiro" | "moeda";
  cor?: string;
  rotulo: string;
}) {
  if (!dados.length) return <Vazio />;
  const altura = horizontal ? Math.max(160, dados.length * 36 + 24) : 240;
  const fmt = formato === "moeda" ? fmtMoeda : fmtNum;
  return (
    <div role="img" aria-label={`${rotulo}. ${resumo(dados, formato === "moeda" ? "moeda" : "")}`}>
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart
          data={dados}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ left: horizontal ? 8 : 0, right: 16 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            horizontal={!horizontal}
            vertical={horizontal}
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={EIXO}
                tickFormatter={(v) =>
                  formato === "moeda" && Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : fmtNum(v)
                }
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="nome"
                tick={EIXO}
                width={130}
                interval={0}
                tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
              />
            </>
          ) : (
            <>
              <XAxis dataKey="nome" tick={EIXO} />
              <YAxis
                tick={EIXO}
                allowDecimals={false}
                tickFormatter={(v) =>
                  formato === "moeda" && Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : fmtNum(v)
                }
              />
            </>
          )}
          <Tooltip {...TOOLTIP} formatter={(v) => [fmt(v), rotulo]} labelFormatter={(l) => String(l)} />
          <Bar
            dataKey="qtd"
            fill={cor}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Chamados abertos x resolvidos por dia. */
export function GraficoDias({ dados }: { dados: { dia: string; abertos: number; resolvidos: number }[] }) {
  if (!dados.length) return <Vazio />;
  const serie = dados.map((d) => ({ ...d, nome: d.dia.split("-").reverse().slice(0, 2).join("/") }));
  const totalAbertos = dados.reduce((a, d) => a + d.abertos, 0);
  const totalResolvidos = dados.reduce((a, d) => a + d.resolvidos, 0);
  return (
    <div
      role="img"
      aria-label={`Chamados por dia. Total no período: ${totalAbertos} abertos e ${totalResolvidos} resolvidos.`}
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={serie} margin={{ left: 0, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="nome" tick={EIXO} minTickGap={24} />
          <YAxis tick={EIXO} allowDecimals={false} width={32} />
          <Tooltip {...TOOLTIP} cursor={{ stroke: "var(--border)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="abertos"
            name="Abertos"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={serie.length <= 31}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="resolvidos"
            name="Resolvidos"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={serie.length <= 31}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Evolução mensal (abertos, resolvidos e backlog). */
export function GraficoEvolucao({
  dados,
}: {
  dados: { mes: string; abertos: number; resolvidos: number; backlog_final: number }[];
}) {
  if (!dados.length) return <Vazio />;
  const serie = dados.map((d) => ({ ...d, nome: d.mes.split("-").reverse().join("/") }));
  return (
    <div role="img" aria-label="Evolução mensal de chamados: abertos, resolvidos e backlog.">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={serie} margin={{ left: 0, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="nome" tick={EIXO} />
          <YAxis tick={EIXO} allowDecimals={false} width={32} />
          <Tooltip {...TOOLTIP} cursor={{ stroke: "var(--border)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="abertos"
            name="Abertos"
            stroke="var(--chart-1)"
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="resolvidos"
            name="Resolvidos"
            stroke="var(--chart-3)"
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="backlog_final"
            name="Backlog no fim do mês"
            stroke="var(--chart-4)"
            strokeWidth={2}
            strokeDasharray="5 3"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Mapa de calor: chamados por dia da semana (linhas) e hora (colunas). */
export function MapaCalor({ dados }: { dados: { dia_semana: number; hora: number; chamados: number }[] }) {
  if (!dados.length) return <Vazio />;
  const mapa = new Map(dados.map((d) => [`${d.dia_semana}-${d.hora}`, Number(d.chamados)]));
  const maximo = Math.max(...dados.map((d) => Number(d.chamados)), 1);
  const horas = Array.from({ length: 24 }, (_, h) => h);
  return (
    <div
      className="overflow-x-auto"
      role="img"
      aria-label="Mapa de calor de chamados por dia da semana e hora. Detalhes na tabela de categorias por dia."
    >
      <div
        className="grid min-w-[640px] gap-1"
        style={{ gridTemplateColumns: "2.5rem repeat(24, minmax(0, 1fr))" }}
      >
        <span />
        {horas.map((h) => (
          <span key={h} className="text-muted-foreground text-center text-[10px]">
            {h}
          </span>
        ))}
        {DIAS.map((nome, dia) => (
          <div key={nome} className="contents">
            <span className="text-muted-foreground self-center text-xs">{nome}</span>
            {horas.map((h) => {
              const q = mapa.get(`${dia}-${h}`) ?? 0;
              const intensidade = q ? Math.max(0.12, q / maximo) : 0;
              return (
                <span
                  key={h}
                  title={`${nome} às ${String(h).padStart(2, "0")}h: ${q} chamado(s)`}
                  className="grid aspect-square place-items-center rounded-sm border text-[10px]"
                  style={{
                    background: q
                      ? `color-mix(in oklab, var(--primary) ${Math.round(intensidade * 100)}%, transparent)`
                      : "transparent",
                    color: intensidade > 0.55 ? "var(--primary-foreground)" : "var(--foreground)",
                  }}
                >
                  {q || ""}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
