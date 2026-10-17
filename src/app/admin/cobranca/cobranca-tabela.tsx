"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Pencil, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/types/database";
import { FieldRow } from "@/components/forms/field-row";
import { NumberInput } from "@/components/forms/number-input";
import { SelectSimples } from "@/components/chamados/campos-problema";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { definirFaturamento, recalcularCobrancaVisita, salvarCobrancaVisita } from "@/actions/cobranca";
import { formatBRL, formatDataHora, formatNumero } from "@/lib/format";
import { COBRANCA_TIPO, COBRANCA_TIPO_TOM, opcoes } from "@/lib/labels";
import { cobrancaVisitaSchema, type CobrancaVisitaInput } from "@/lib/validators";

type Tipo = Database["public"]["Enums"]["cobranca_tipo"];

export type LinhaCobranca = {
  id: string;
  cliente: string;
  osNumero: string;
  protocolo: string | null;
  contrato: string | null;
  chegada: string;
  horas: number | null;
  tipo: Tipo | null;
  valorUnitario: number | null;
  quantidadeHoras: number | null;
  valor: number;
  justificativa: string | null;
  observacoes: string | null;
  manual: boolean;
  faturado: boolean;
};

export function CobrancaTabela({ linhas }: { linhas: LinhaCobranca[] }) {
  const router = useRouter();
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<LinhaCobranca | null>(null);
  const [pending, startTransition] = useTransition();

  const todas = linhas.length > 0 && linhas.every((l) => selecionadas.has(l.id));
  const alguma = selecionadas.size > 0;
  const totalSelecionado = useMemo(
    () => linhas.filter((l) => selecionadas.has(l.id)).reduce((acc, l) => acc + l.valor, 0),
    [linhas, selecionadas],
  );

  const alternar = (id: string, marcado: boolean) =>
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(id);
      else novo.delete(id);
      return novo;
    });

  const aplicar = (faturado: boolean) =>
    startTransition(async () => {
      const r = await definirFaturamento([...selecionadas], faturado);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message);
      setSelecionadas(new Set());
      router.refresh();
    });

  return (
    <>
      <div
        className="bg-muted/40 mb-3 flex min-h-12 flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        role="region"
        aria-label="Ações em lote"
      >
        {alguma ? (
          <>
            <span className="font-medium">
              {selecionadas.size} selecionada(s) · {formatBRL(totalSelecionado)}
            </span>
            <span className="flex-1" />
            <Button size="sm" disabled={pending} onClick={() => aplicar(true)}>
              {pending ? <Spinner /> : <BadgeCheck />} Marcar como faturado
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => aplicar(false)}>
              <Undo2 /> Desfazer faturamento
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelecionadas(new Set())}>
              Limpar seleção
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">Selecione visitas para faturar em lote.</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Selecionar todas"
                  checked={todas}
                  onCheckedChange={(c) =>
                    setSelecionadas(c === true ? new Set(linhas.map((l) => l.id)) : new Set())
                  }
                />
              </TableHead>
              <TableHead>Visita</TableHead>
              <TableHead className="hidden lg:table-cell">Horas</TableHead>
              <TableHead>Cobrança</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="hidden sm:table-cell">Faturamento</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Ajustar</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.id} data-state={selecionadas.has(l.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Selecionar visita ${l.osNumero}`}
                    checked={selecionadas.has(l.id)}
                    onCheckedChange={(c) => alternar(l.id, c === true)}
                  />
                </TableCell>
                <TableCell className="max-w-64">
                  <div className="truncate font-medium">{l.cliente}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    <span className="font-mono">{l.osNumero}</span>
                    {l.protocolo ? ` · ${l.protocolo}` : ""} · {formatDataHora(l.chegada)}
                  </div>
                </TableCell>
                <TableCell className="hidden tabular-nums lg:table-cell">
                  {l.horas == null ? "—" : `${formatNumero(l.horas)} h`}
                </TableCell>
                <TableCell>
                  {l.tipo ? (
                    <div className="grid gap-0.5">
                      <StatusBadge tom={COBRANCA_TIPO_TOM[l.tipo]} className="w-fit">
                        {COBRANCA_TIPO[l.tipo]}
                      </StatusBadge>
                      {l.tipo === "valor_por_hora" ? (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {formatNumero(l.quantidadeHoras)} h × {formatBRL(l.valorUnitario)}
                        </span>
                      ) : null}
                      {l.manual ? (
                        <span className="text-muted-foreground text-[11px]">ajuste manual</span>
                      ) : null}
                    </div>
                  ) : (
                    <StatusBadge tom="amarelo">Sem cálculo</StatusBadge>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatBRL(l.valor)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge tom={l.faturado ? "verde" : "cinza"}>
                    {l.faturado ? "Faturado" : "A faturar"}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ajustar cobrança da ${l.osNumero}`}
                    onClick={() => setEditando(l)}
                  >
                    <Pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editando ? (
        <AjusteDialog
          key={editando.id}
          linha={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function AjusteDialog({
  linha,
  onFechar,
  onSalvo,
}: {
  linha: LinhaCobranca;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<CobrancaVisitaInput>({
    resolver: zodResolver(cobrancaVisitaSchema),
    defaultValues: {
      cobranca_tipo: linha.tipo ?? "valor_unico",
      valor_unitario: linha.valorUnitario ?? 0,
      quantidade_horas: linha.quantidadeHoras,
      justificativa_isencao: linha.justificativa ?? "",
      observacoes_financeiras: linha.observacoes ?? "",
    },
  });
  const { errors } = form.formState;
  const tipo = useWatch({ control: form.control, name: "cobranca_tipo" });
  const valorUnitario = useWatch({ control: form.control, name: "valor_unitario" });
  const horas = useWatch({ control: form.control, name: "quantidade_horas" });
  const semValor = tipo === "isento_contrato" || tipo === "garantia" || tipo === "cortesia";
  const total = semValor ? 0 : tipo === "valor_unico" ? valorUnitario : (horas ?? 0) * valorUnitario;

  const salvar = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await salvarCobrancaVisita(linha.id, values);
      if (!r.ok) {
        Object.entries(r.fieldErrors ?? {}).forEach(([c, m]) =>
          form.setError(c as keyof CobrancaVisitaInput, { message: m }),
        );
        return void toast.error(r.error);
      }
      toast.success(r.message);
      onSalvo();
    }),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onFechar()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cobrança da visita</DialogTitle>
          <DialogDescription>
            {linha.cliente} · {linha.osNumero} · {formatDataHora(linha.chegada)}
            {linha.horas != null ? ` · ${formatNumero(linha.horas)} h trabalhadas` : ""}
          </DialogDescription>
        </DialogHeader>
        {linha.faturado ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
            Esta visita já foi faturada. Desfaça o faturamento para poder alterá-la.
          </p>
        ) : null}
        <form id="cobranca-form" onSubmit={salvar} noValidate>
          <FieldGroup className="gap-4">
            <FieldRow label="Tipo de cobrança" htmlFor="cb-tipo" error={errors.cobranca_tipo?.message}>
              <Controller
                control={form.control}
                name="cobranca_tipo"
                render={({ field }) => (
                  <SelectSimples
                    id="cb-tipo"
                    value={field.value}
                    onChange={(v) => field.onChange(v as Tipo)}
                    opcoes={opcoes(COBRANCA_TIPO)}
                    placeholder="Tipo"
                    disabled={linha.faturado}
                  />
                )}
              />
            </FieldRow>
            {tipo === "valor_unico" || tipo === "valor_por_hora" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow
                  label={tipo === "valor_unico" ? "Valor da visita" : "Valor da hora"}
                  htmlFor="cb-valor"
                  error={errors.valor_unitario?.message}
                >
                  <Controller
                    control={form.control}
                    name="valor_unitario"
                    render={({ field }) => (
                      <NumberInput
                        id="cb-valor"
                        prefixo="R$"
                        value={field.value}
                        onChange={(v) => field.onChange(v ?? 0)}
                        disabled={linha.faturado}
                      />
                    )}
                  />
                </FieldRow>
                {tipo === "valor_por_hora" ? (
                  <FieldRow
                    label="Horas cobradas"
                    htmlFor="cb-horas"
                    error={errors.quantidade_horas?.message}
                    description="Já com fração e mínimo aplicados."
                  >
                    <Controller
                      control={form.control}
                      name="quantidade_horas"
                      render={({ field }) => (
                        <NumberInput
                          id="cb-horas"
                          sufixo="h"
                          value={field.value}
                          onChange={field.onChange}
                          disabled={linha.faturado}
                        />
                      )}
                    />
                  </FieldRow>
                ) : null}
              </div>
            ) : null}
            {tipo === "garantia" || tipo === "cortesia" ? (
              <FieldRow
                label="Justificativa (obrigatória)"
                htmlFor="cb-just"
                error={errors.justificativa_isencao?.message}
                required
              >
                <Textarea
                  id="cb-just"
                  rows={2}
                  {...form.register("justificativa_isencao")}
                  disabled={linha.faturado}
                />
              </FieldRow>
            ) : null}
            <FieldRow
              label="Observações financeiras"
              htmlFor="cb-obs"
              error={errors.observacoes_financeiras?.message}
            >
              <Textarea
                id="cb-obs"
                rows={2}
                {...form.register("observacoes_financeiras")}
                disabled={linha.faturado}
              />
            </FieldRow>
            <p className="text-right text-sm">
              Valor da visita: <strong className="tabular-nums">{formatBRL(total)}</strong>
            </p>
          </FieldGroup>
        </form>
        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={pending || linha.faturado}
            onClick={() =>
              startTransition(async () => {
                const r = await recalcularCobrancaVisita(linha.id);
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message);
                onSalvo();
              })
            }
          >
            <RotateCcw /> Recalcular sugestão
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onFechar} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" form="cobranca-form" disabled={pending || linha.faturado}>
              {pending ? <Spinner /> : null} Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
