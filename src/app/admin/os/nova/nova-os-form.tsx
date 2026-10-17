"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow } from "@/components/forms/field-row";
import { ClienteCombobox, type OpcaoCliente } from "@/components/forms/cliente-combobox";
import { SelectSimples, type Opcao } from "@/components/chamados/campos-problema";
import { listarUnidadesCliente } from "@/actions/chamados";
import { criarOsAvulsa } from "@/actions/os";
import { TIPO_ATENDIMENTO, opcoes } from "@/lib/labels";
import { osAvulsaSchema, type OsAvulsaInput } from "@/lib/validators";

export function NovaOsForm({ clientes, tecnicos }: { clientes: OpcaoCliente[]; tecnicos: Opcao[] }) {
  const router = useRouter();
  const [unidades, setUnidades] = useState<Opcao[]>([]);
  const [pending, startTransition] = useTransition();
  const form = useForm<OsAvulsaInput>({
    resolver: zodResolver(osAvulsaSchema),
    defaultValues: {
      cliente_id: "",
      unidade_id: "",
      tecnico_id: "",
      tipo_atendimento: "preventivo",
      problema_relatado: "",
    },
  });
  const { errors } = form.formState;

  const trocarCliente = async (id: string) => {
    form.setValue("cliente_id", id, { shouldValidate: true });
    form.setValue("unidade_id", "");
    setUnidades([]);
    if (!id) return;
    const lista = (await listarUnidadesCliente(id)).map((u) => ({ value: u.id, label: u.nome }));
    if (form.getValues("cliente_id") !== id) return;
    setUnidades(lista);
    if (lista.length === 1) form.setValue("unidade_id", lista[0].value);
  };

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await criarOsAvulsa(values);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message);
      router.push(`/admin/os/${r.data.osId}`);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <Card>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              label="Cliente"
              htmlFor="no-cliente"
              error={errors.cliente_id?.message}
              required
              className="sm:col-span-2"
            >
              <Controller
                control={form.control}
                name="cliente_id"
                render={({ field }) => (
                  <ClienteCombobox
                    id="no-cliente"
                    clientes={clientes}
                    value={field.value}
                    onChange={(v) => void trocarCliente(v)}
                  />
                )}
              />
            </FieldRow>
            <FieldRow label="Unidade" htmlFor="no-unidade" error={errors.unidade_id?.message}>
              <Controller
                control={form.control}
                name="unidade_id"
                render={({ field }) => (
                  <SelectSimples
                    id="no-unidade"
                    value={field.value}
                    onChange={field.onChange}
                    opcoes={unidades}
                    placeholder="Selecione"
                    disabled={!unidades.length}
                  />
                )}
              />
            </FieldRow>
            <FieldRow label="Técnico" htmlFor="no-tecnico" error={errors.tecnico_id?.message} required>
              <Controller
                control={form.control}
                name="tecnico_id"
                render={({ field }) => (
                  <SelectSimples
                    id="no-tecnico"
                    value={field.value}
                    onChange={field.onChange}
                    opcoes={tecnicos}
                    placeholder="Selecione"
                  />
                )}
              />
            </FieldRow>
            <FieldRow label="Tipo de atendimento" htmlFor="no-tipo" required>
              <Controller
                control={form.control}
                name="tipo_atendimento"
                render={({ field }) => (
                  <SelectSimples
                    id="no-tipo"
                    value={field.value}
                    onChange={field.onChange}
                    opcoes={opcoes(TIPO_ATENDIMENTO)}
                    placeholder="Tipo"
                  />
                )}
              />
            </FieldRow>
            <FieldRow
              label="O que deve ser feito"
              htmlFor="no-problema"
              error={errors.problema_relatado?.message}
              className="sm:col-span-2"
            >
              <Textarea id="no-problema" rows={4} {...form.register("problema_relatado")} />
            </FieldRow>
          </FieldGroup>
        </CardContent>
      </Card>
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null} Criar OS
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
