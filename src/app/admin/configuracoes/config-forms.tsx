"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Controller, useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow } from "@/components/forms/field-row";
import { MaskedInput } from "@/components/forms/masked-input";
import { NumberInput } from "@/components/forms/number-input";
import {
  assinaturaSchema,
  cobrancaSchema,
  empresaSchema,
  horarioComercialSchema,
  pdfSchema,
  slaPadraoSchema,
  type ConfigChave,
  type ConfigValor,
} from "@/lib/config-schemas";
import { DIAS_SEMANA, PRIORIDADE } from "@/lib/labels";
import { enviarLogo, removerLogo, salvarConfiguracao } from "./actions";

/** Formulário de uma chave de configuração (valida com o mesmo schema do servidor). */
function useConfigForm<T extends FieldValues>(chave: ConfigChave, schema: z.ZodType<T>, inicial: T) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<T>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as any,
    defaultValues: inicial as DefaultValues<T>,
  });
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await salvarConfiguracao(chave, values);
      if (!r.ok) {
        Object.entries(r.fieldErrors ?? {}).forEach(([campo, msg]) =>
          form.setError(campo as Path<T>, { message: msg }),
        );
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      form.reset(values);
      router.refresh();
    }),
  );
  return { form, onSubmit, pending };
}

function Salvar({ pending, disabled }: { pending: boolean; disabled?: boolean }) {
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <Spinner /> : null}
      Salvar
    </Button>
  );
}

// ---------------------------------------------------------------- empresa
export function EmpresaForm({
  inicial,
  logoUrl,
}: {
  inicial: ConfigValor<"empresa">;
  logoUrl: string | null;
}) {
  const { form, onSubmit, pending } = useConfigForm("empresa", empresaSchema, inicial);
  const { errors, isDirty } = form.formState;
  return (
    <div className="grid max-w-3xl gap-6">
      <LogoUpload logoUrl={logoUrl} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da empresa</CardTitle>
          <CardDescription>Aparecem no sistema, no cabeçalho do PDF da OS e nos e-mails.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <FieldRow label="Razão social" htmlFor="e-razao" error={errors.razao_social?.message} required>
                <Input id="e-razao" {...form.register("razao_social")} aria-invalid={!!errors.razao_social} />
              </FieldRow>
              <FieldRow label="Nome fantasia" htmlFor="e-fantasia" error={errors.nome_fantasia?.message}>
                <Input id="e-fantasia" {...form.register("nome_fantasia")} />
              </FieldRow>
              <FieldRow label="CNPJ" htmlFor="e-cnpj" error={errors.cnpj?.message}>
                <Controller
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <MaskedInput id="e-cnpj" mascara="documento" {...field} aria-invalid={!!errors.cnpj} />
                  )}
                />
              </FieldRow>
              <FieldRow label="Telefone" htmlFor="e-tel" error={errors.telefone?.message}>
                <Controller
                  control={form.control}
                  name="telefone"
                  render={({ field }) => <MaskedInput id="e-tel" mascara="telefone" {...field} />}
                />
              </FieldRow>
              <FieldRow label="E-mail" htmlFor="e-email" error={errors.email?.message}>
                <Input id="e-email" type="email" {...form.register("email")} aria-invalid={!!errors.email} />
              </FieldRow>
              <FieldRow label="Site" htmlFor="e-site" error={errors.site?.message}>
                <Input id="e-site" {...form.register("site")} placeholder="www.tonytec.com.br" />
              </FieldRow>
              <FieldRow
                label="Endereço"
                htmlFor="e-end"
                error={errors.endereco?.message}
                className="md:col-span-2"
              >
                <Input id="e-end" {...form.register("endereco")} />
              </FieldRow>
            </FieldGroup>
            <div className="mt-6">
              <Salvar pending={pending} disabled={!isDirty} />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function LogoUpload({ logoUrl }: { logoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const enviar = (arquivo: File) =>
    startTransition(async () => {
      const fd = new FormData();
      fd.append("logo", arquivo);
      const r = await enviarLogo(fd);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
      if (inputRef.current) inputRef.current.value = "";
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Logo</CardTitle>
        <CardDescription>
          PNG, JPG ou WEBP de até 2 MB. Prefira fundo transparente e formato horizontal.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="bg-muted/50 grid h-20 w-48 place-items-center overflow-hidden rounded-lg border">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Logo atual"
              width={192}
              height={80}
              className="max-h-16 w-auto object-contain"
            />
          ) : (
            <span className="text-muted-foreground text-xs">Sem logo</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviar(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
          >
            {pending ? <Spinner /> : <ImageUp />}
            {logoUrl ? "Trocar logo" : "Enviar logo"}
          </Button>
          {logoUrl ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await removerLogo();
                  if (r.ok) {
                    toast.success(r.message);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              <Trash2 /> Remover
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- cobrança
export function CobrancaForm({ inicial }: { inicial: ConfigValor<"cobranca"> }) {
  const { form, onSubmit, pending } = useConfigForm("cobranca", cobrancaSchema, inicial);
  const { errors, isDirty } = form.formState;
  const num = (
    name: Path<ConfigValor<"cobranca">>,
    id: string,
    opts: { decimais?: number; prefixo?: string; sufixo?: string },
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <NumberInput
          id={id}
          value={field.value as number}
          onChange={field.onChange}
          decimais={opts.decimais ?? 2}
          prefixo={opts.prefixo}
          sufixo={opts.sufixo}
          aria-invalid={!!errors[name]}
        />
      )}
    />
  );
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">Valores padrão de cobrança</CardTitle>
        <CardDescription>
          Usados quando o contrato do cliente não define valores próprios, e para clientes sem contrato.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <FieldRow
              label="Valor da hora técnica"
              htmlFor="cb-hora"
              error={errors.valor_hora_padrao?.message}
              required
            >
              {num("valor_hora_padrao", "cb-hora", { prefixo: "R$", sufixo: "/h" })}
            </FieldRow>
            <FieldRow
              label="Valor da visita (valor fixo)"
              htmlFor="cb-visita"
              error={errors.valor_visita_padrao?.message}
              required
            >
              {num("valor_visita_padrao", "cb-visita", { prefixo: "R$" })}
            </FieldRow>
            <FieldRow
              label="Mínimo de horas cobráveis por visita"
              htmlFor="cb-min"
              error={errors.minimo_horas_cobraveis?.message}
              description="Ex.: 1 = toda visita cobrada por hora paga pelo menos 1 hora."
              required
            >
              {num("minimo_horas_cobraveis", "cb-min", { decimais: 2, sufixo: "h" })}
            </FieldRow>
            <FieldRow
              label="Fração de cobrança"
              htmlFor="cb-fracao"
              error={errors.fracao_minutos?.message}
              description="Arredonda o tempo para cima nesta fração."
              required
            >
              <Controller
                control={form.control}
                name="fracao_minutos"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger id="cb-fracao" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 5, 10, 15, 20, 30, 60].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m === 60 ? "Hora cheia (60 min)" : `${m} em ${m} minutos`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldRow>
          </FieldGroup>
          <div className="mt-6">
            <Salvar pending={pending} disabled={!isDirty} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- SLA
export function SlaPadraoForm({ inicial }: { inicial: ConfigValor<"sla_padrao"> }) {
  const { form, onSubmit, pending } = useConfigForm("sla_padrao", slaPadraoSchema, inicial);
  const { errors, isDirty } = form.formState;
  const prioridades = ["urgente", "alta", "media", "baixa"] as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Prazos padrão por prioridade</CardTitle>
        <CardDescription>
          Em horas úteis. Valem para chamados abertos daqui em diante, quando o contrato não define SLA
          próprio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <div className="grid gap-3">
            <div className="text-muted-foreground hidden grid-cols-[1fr_1fr_1fr] gap-3 text-xs font-medium sm:grid">
              <span>Prioridade</span>
              <span>Primeira resposta</span>
              <span>Solução</span>
            </div>
            {prioridades.map((p) => (
              <div key={p} className="grid grid-cols-2 items-start gap-2 sm:grid-cols-[1fr_1fr_1fr] sm:gap-3">
                <Label className="col-span-2 pt-2 sm:col-span-1">{PRIORIDADE[p]}</Label>
                {(["resposta", "solucao"] as const).map((campo) => (
                  <div key={campo} className="grid gap-1">
                    <span className="text-muted-foreground text-xs sm:hidden">
                      {campo === "resposta" ? "Primeira resposta" : "Solução"}
                    </span>
                    <Controller
                      control={form.control}
                      name={`${p}.${campo}`}
                      render={({ field }) => (
                        <NumberInput
                          aria-label={`${PRIORIDADE[p]} — ${campo === "resposta" ? "primeira resposta" : "solução"}`}
                          value={field.value}
                          onChange={field.onChange}
                          decimais={1}
                          sufixo="h"
                          aria-invalid={!!errors[p]?.[campo]}
                        />
                      )}
                    />
                    {errors[p]?.[campo]?.message ? (
                      <span className="text-destructive text-xs">{errors[p]?.[campo]?.message}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Salvar pending={pending} disabled={!isDirty} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function HorarioComercialForm({ inicial }: { inicial: ConfigValor<"sla_horario_comercial"> }) {
  const { form, onSubmit, pending } = useConfigForm("sla_horario_comercial", horarioComercialSchema, inicial);
  const { errors, isDirty } = form.formState;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Horário comercial do SLA</CardTitle>
        <CardDescription>
          O prazo do SLA só corre dentro deste horário (feriados não são descontados).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          <Controller
            control={form.control}
            name="ativo"
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                Contar o SLA só em horário comercial
                <span className="text-muted-foreground">(desligado = 24 horas por dia, 7 dias)</span>
              </label>
            )}
          />
          <div className="grid gap-2">
            <Label>Dias de atendimento</Label>
            <Controller
              control={form.control}
              name="dias"
              render={({ field }) => (
                <div className="flex flex-wrap gap-3">
                  {DIAS_SEMANA.map((d) => {
                    const marcado = field.value.includes(d.valor);
                    return (
                      <label key={d.valor} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={(c) =>
                            field.onChange(
                              c
                                ? [...field.value, d.valor].sort()
                                : field.value.filter((v: number) => v !== d.valor),
                            )
                          }
                        />
                        {d.curto}
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.dias?.message ? (
              <span className="text-destructive text-xs">{errors.dias.message}</span>
            ) : null}
          </div>
          <FieldGroup className="grid max-w-sm grid-cols-2 gap-4">
            <FieldRow label="Início" htmlFor="hc-ini" error={errors.inicio?.message}>
              <Input id="hc-ini" type="time" {...form.register("inicio")} />
            </FieldRow>
            <FieldRow label="Fim" htmlFor="hc-fim" error={errors.fim?.message}>
              <Input id="hc-fim" type="time" {...form.register("fim")} />
            </FieldRow>
          </FieldGroup>
          <div>
            <Salvar pending={pending} disabled={!isDirty} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- assinatura e PDF
export function AssinaturaForm({ inicial }: { inicial: ConfigValor<"assinatura"> }) {
  const { form, onSubmit, pending } = useConfigForm("assinatura", assinaturaSchema, inicial);
  const { errors, isDirty } = form.formState;
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">Assinatura da OS</CardTitle>
        <CardDescription>
          Texto mostrado ao cliente antes de assinar (na tela do técnico ou pelo link remoto).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <FieldRow
              label="Termo de aceite"
              htmlFor="as-termo"
              error={errors.termo_aceite?.message}
              required
            >
              <Textarea
                id="as-termo"
                rows={6}
                {...form.register("termo_aceite")}
                aria-invalid={!!errors.termo_aceite}
              />
            </FieldRow>
            <FieldRow
              label="Validade do link de assinatura remota"
              htmlFor="as-validade"
              error={errors.validade_link_horas?.message}
              className="max-w-xs"
            >
              <Controller
                control={form.control}
                name="validade_link_horas"
                render={({ field }) => (
                  <NumberInput
                    id="as-validade"
                    decimais={0}
                    sufixo="horas"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FieldRow>
          </FieldGroup>
          <div className="mt-6">
            <Salvar pending={pending} disabled={!isDirty} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PdfForm({ inicial }: { inicial: ConfigValor<"pdf"> }) {
  const { form, onSubmit, pending } = useConfigForm("pdf", pdfSchema, inicial);
  const { errors, isDirty } = form.formState;
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">PDF da ordem de serviço</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          <Controller
            control={form.control}
            name="exibir_valores"
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                Mostrar valores (visita, materiais e total) no PDF enviado ao cliente
              </label>
            )}
          />
          <FieldRow label="Rodapé" htmlFor="pdf-rodape" error={errors.rodape?.message}>
            <Textarea id="pdf-rodape" rows={2} {...form.register("rodape")} />
          </FieldRow>
          <div>
            <Salvar pending={pending} disabled={!isDirty} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
