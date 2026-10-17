"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow } from "@/components/forms/field-row";
import { NumberInput } from "@/components/forms/number-input";
import { ClienteCombobox, type OpcaoCliente } from "@/components/forms/cliente-combobox";
import { formatBRL } from "@/lib/format";
import { CONTRATO_STATUS, CONTRATO_TIPO, POLITICA_EXCEDENTE, opcoes } from "@/lib/labels";
import { contratoSchema, type ContratoInput } from "@/lib/validators";
import { salvarContrato } from "./actions";

export function ContratoForm({
  id,
  inicial,
  clientes,
  padroes,
}: {
  id?: string;
  inicial: ContratoInput;
  clientes: OpcaoCliente[];
  padroes: { valorHora: number; valorVisita: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ContratoInput>({ resolver: zodResolver(contratoSchema), defaultValues: inicial });
  const { errors, isDirty } = form.formState;
  const politica = useWatch({ control: form.control, name: "politica_visita_excedente" });
  const tipo = useWatch({ control: form.control, name: "tipo" });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await salvarContrato(id ?? null, values);
      if (!r.ok) {
        Object.entries(r.fieldErrors ?? {}).forEach(([campo, msg]) =>
          form.setError(campo as keyof ContratoInput, { message: msg }),
        );
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      if (id) {
        form.reset(values);
        router.refresh();
      } else {
        router.push(`/admin/contratos/${r.data.id}`);
      }
    }),
  );

  const selectEnum = <K extends "tipo" | "politica_visita_excedente" | "status">(
    name: K,
    mapa: Record<string, string>,
    idCampo: string,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger id={idCampo} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes(mapa).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  const numero = (
    name:
      | "valor_mensal"
      | "visitas_inclusas_mes"
      | "horas_inclusas_mes"
      | "valor_visita_excedente"
      | "valor_hora_excedente"
      | "sla_resposta_horas"
      | "sla_solucao_horas",
    idCampo: string,
    opts: { decimais?: number; prefixo?: string; sufixo?: string; placeholder?: string } = {},
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <NumberInput
          id={idCampo}
          value={field.value ?? null}
          onChange={field.onChange}
          onBlur={field.onBlur}
          decimais={opts.decimais ?? 2}
          prefixo={opts.prefixo}
          sufixo={opts.sufixo}
          placeholder={opts.placeholder}
          aria-invalid={!!errors[name]}
        />
      )}
    />
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-4xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificação</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <FieldRow
              label="Cliente"
              htmlFor="ct-cliente"
              error={errors.cliente_id?.message}
              required
              className="md:col-span-2"
            >
              <Controller
                control={form.control}
                name="cliente_id"
                render={({ field }) => (
                  <ClienteCombobox
                    id="ct-cliente"
                    clientes={clientes}
                    value={field.value}
                    onChange={field.onChange}
                    invalid={!!errors.cliente_id}
                  />
                )}
              />
            </FieldRow>
            <FieldRow
              label="Número"
              htmlFor="ct-numero"
              error={errors.numero?.message}
              description={id ? undefined : "Deixe vazio para gerar automaticamente (CT-AAAA-000001)."}
            >
              <Input id="ct-numero" {...form.register("numero")} placeholder="Automático" />
            </FieldRow>
            <FieldRow label="Tipo" htmlFor="ct-tipo" error={errors.tipo?.message} required>
              {selectEnum("tipo", CONTRATO_TIPO, "ct-tipo")}
            </FieldRow>
            <FieldRow
              label="Descrição"
              htmlFor="ct-desc"
              error={errors.descricao?.message}
              className="md:col-span-2"
            >
              <Input
                id="ct-desc"
                {...form.register("descricao")}
                placeholder="Ex.: Manutenção mensal CFTV + portões"
              />
            </FieldRow>
            <FieldRow label="Início" htmlFor="ct-inicio" error={errors.data_inicio?.message} required>
              <Input
                id="ct-inicio"
                type="date"
                {...form.register("data_inicio")}
                aria-invalid={!!errors.data_inicio}
              />
            </FieldRow>
            <FieldRow
              label="Fim"
              htmlFor="ct-fim"
              error={errors.data_fim?.message}
              description="Vazio = prazo indeterminado."
            >
              <Input
                id="ct-fim"
                type="date"
                {...form.register("data_fim")}
                aria-invalid={!!errors.data_fim}
              />
            </FieldRow>
            <FieldRow label="Status" htmlFor="ct-status" error={errors.status?.message} required>
              {selectEnum("status", CONTRATO_STATUS, "ct-status")}
            </FieldRow>
            <FieldRow label="Valor mensal" htmlFor="ct-valor" error={errors.valor_mensal?.message} required>
              {numero("valor_mensal", "ct-valor", { prefixo: "R$" })}
            </FieldRow>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Franquia mensal e excedentes</CardTitle>
          <CardDescription>
            {tipo === "avulso"
              ? "Contrato avulso normalmente não tem franquia: todas as visitas são cobradas."
              : "Visitas e horas incluídas no valor mensal. O que passar disso segue a política de excedente."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <FieldRow
              label="Visitas inclusas por mês"
              htmlFor="ct-visitas"
              error={errors.visitas_inclusas_mes?.message}
              required
            >
              {numero("visitas_inclusas_mes", "ct-visitas", { decimais: 0, sufixo: "visitas" })}
            </FieldRow>
            <FieldRow
              label="Horas inclusas por mês"
              htmlFor="ct-horas"
              error={errors.horas_inclusas_mes?.message}
              required
            >
              {numero("horas_inclusas_mes", "ct-horas", { decimais: 1, sufixo: "h" })}
            </FieldRow>
            <FieldRow
              label="Política de visita excedente"
              htmlFor="ct-politica"
              error={errors.politica_visita_excedente?.message}
              required
              className="md:col-span-2"
            >
              {selectEnum("politica_visita_excedente", POLITICA_EXCEDENTE, "ct-politica")}
            </FieldRow>
            {politica === "valor_unico" ? (
              <FieldRow
                label="Valor por visita excedente"
                htmlFor="ct-vvisita"
                error={errors.valor_visita_excedente?.message}
                description={`Vazio = valor padrão das Configurações (${formatBRL(padroes.valorVisita)}).`}
              >
                {numero("valor_visita_excedente", "ct-vvisita", { prefixo: "R$" })}
              </FieldRow>
            ) : null}
            {politica === "valor_hora" ? (
              <FieldRow
                label="Valor da hora excedente"
                htmlFor="ct-vhora"
                error={errors.valor_hora_excedente?.message}
                description={`Vazio = valor padrão das Configurações (${formatBRL(padroes.valorHora)}/h).`}
              >
                {numero("valor_hora_excedente", "ct-vhora", { prefixo: "R$", sufixo: "/h" })}
              </FieldRow>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SLA do contrato</CardTitle>
          <CardDescription>
            Em horas úteis. Se vazio, vale o SLA padrão por prioridade (Configurações → SLA).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <FieldRow
              label="Primeira resposta em até"
              htmlFor="ct-sla-r"
              error={errors.sla_resposta_horas?.message}
            >
              {numero("sla_resposta_horas", "ct-sla-r", {
                decimais: 1,
                sufixo: "h úteis",
                placeholder: "Padrão",
              })}
            </FieldRow>
            <FieldRow label="Solução em até" htmlFor="ct-sla-s" error={errors.sla_solucao_horas?.message}>
              {numero("sla_solucao_horas", "ct-sla-s", {
                decimais: 1,
                sufixo: "h úteis",
                placeholder: "Padrão",
              })}
            </FieldRow>
            <FieldRow
              label="Observações"
              htmlFor="ct-obs"
              error={errors.observacoes?.message}
              className="md:col-span-2"
            >
              <Textarea id="ct-obs" rows={3} {...form.register("observacoes")} />
            </FieldRow>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || (!!id && !isDirty)}>
          {pending ? <Spinner /> : null}
          {id ? "Salvar alterações" : "Cadastrar contrato"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
