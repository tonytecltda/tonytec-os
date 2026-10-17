import { CalendarRange, Clock, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { mesAtualISO, mesPorExtenso } from "@/lib/export";
import { formatBRL, formatNumero } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Barra({
  usado,
  total,
  rotulo,
  icone,
}: {
  usado: number;
  total: number;
  rotulo: string;
  icone: React.ReactNode;
}) {
  if (total <= 0) return null;
  const pct = Math.min(100, Math.round((usado / total) * 100));
  const estourou = usado > total;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2">
          {icone} {rotulo}
        </span>
        <span className={cn("tabular-nums", estourou && "text-destructive font-medium")}>
          {formatNumero(usado)} de {formatNumero(total)}
        </span>
      </div>
      <div
        className="bg-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={usado}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={rotulo}
      >
        <div
          className={cn("h-full rounded-full", pct >= 100 ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Consumo da franquia do contrato no mês atual (função consumo_contrato_mes).
 * `mostrarValores`: o admin vê o valor dos excedentes; o cliente vê só visitas/horas.
 */
export async function SaldoContratoCard({
  contratoId,
  mostrarValores = false,
}: {
  contratoId: string;
  mostrarValores?: boolean;
}) {
  const supabase = await createClient();
  const mes = mesAtualISO();
  const { data } = await supabase.rpc("consumo_contrato_mes", {
    p_contrato_id: contratoId,
    p_mes: `${mes}-01`,
  });
  const c = data?.[0];
  if (!c) return null;

  const visitasUsadas = Number(c.visitas_usadas);
  const horasUsadas = Number(c.horas_usadas);
  const excedentes = Number(c.visitas_excedentes);
  const semFranquia = c.visitas_inclusas === 0 && Number(c.horas_inclusas) === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Saldo do mês</CardTitle>
        <CardDescription>Uso da franquia em {mesPorExtenso(mes)}.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {semFranquia ? (
          <p className="text-muted-foreground text-sm">Este contrato não tem visitas nem horas inclusas.</p>
        ) : (
          <>
            <Barra
              usado={visitasUsadas}
              total={c.visitas_inclusas}
              rotulo="Visitas incluídas"
              icone={<CalendarRange className="text-primary size-4" />}
            />
            <Barra
              usado={horasUsadas}
              total={Number(c.horas_inclusas)}
              rotulo="Horas incluídas"
              icone={<Clock className="text-primary size-4" />}
            />
          </>
        )}
        {excedentes ? (
          <p className="flex items-start gap-2 text-sm">
            <Receipt className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <span>
              {excedentes} visita(s) além da franquia neste mês
              {mostrarValores ? ` (${formatBRL(Number(c.valor_excedente))})` : ""}.
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
