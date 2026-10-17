"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow } from "@/components/forms/field-row";
import { MaskedInput } from "@/components/forms/masked-input";
import { clienteSchema, type ClienteInput } from "@/lib/validators";
import { salvarCliente } from "./actions";

export function ClienteForm({ id, inicial }: { id?: string; inicial?: Partial<ClienteInput> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      razao_social: "",
      nome_fantasia: "",
      cnpj_cpf: "",
      inscricao_estadual: "",
      email: "",
      telefone: "",
      observacoes: "",
      ...inicial,
    },
  });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await salvarCliente(id ?? null, values);
      if (!r.ok) {
        Object.entries(r.fieldErrors ?? {}).forEach(([campo, msg]) =>
          form.setError(campo as keyof ClienteInput, { message: msg }),
        );
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      if (id) {
        form.reset(values);
        router.refresh();
      } else {
        router.push(`/admin/clientes/${r.data.id}?aba=unidades`);
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-3xl">
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <FieldRow
          label="Razão social / nome"
          htmlFor="c-razao"
          error={errors.razao_social?.message}
          required
          className="md:col-span-2"
        >
          <Input id="c-razao" {...form.register("razao_social")} aria-invalid={!!errors.razao_social} />
        </FieldRow>
        <FieldRow label="Nome fantasia" htmlFor="c-fantasia" error={errors.nome_fantasia?.message}>
          <Input id="c-fantasia" {...form.register("nome_fantasia")} />
        </FieldRow>
        <FieldRow
          label="CPF / CNPJ"
          htmlFor="c-doc"
          error={errors.cnpj_cpf?.message}
          description="Aceita CNPJ alfanumérico."
        >
          <Controller
            control={form.control}
            name="cnpj_cpf"
            render={({ field }) => (
              <MaskedInput id="c-doc" mascara="documento" {...field} aria-invalid={!!errors.cnpj_cpf} />
            )}
          />
        </FieldRow>
        <FieldRow label="Inscrição estadual" htmlFor="c-ie" error={errors.inscricao_estadual?.message}>
          <Input id="c-ie" {...form.register("inscricao_estadual")} />
        </FieldRow>
        <FieldRow label="Telefone" htmlFor="c-tel" error={errors.telefone?.message}>
          <Controller
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <MaskedInput id="c-tel" mascara="telefone" {...field} aria-invalid={!!errors.telefone} />
            )}
          />
        </FieldRow>
        <FieldRow label="E-mail" htmlFor="c-email" error={errors.email?.message} className="md:col-span-2">
          <Input
            id="c-email"
            type="email"
            inputMode="email"
            {...form.register("email")}
            aria-invalid={!!errors.email}
          />
        </FieldRow>
        <FieldRow
          label="Observações internas"
          htmlFor="c-obs"
          error={errors.observacoes?.message}
          description="Visíveis só para a Tonytec."
          className="md:col-span-2"
        >
          <Textarea id="c-obs" rows={3} {...form.register("observacoes")} />
        </FieldRow>
      </FieldGroup>
      <div className="mt-6 flex gap-2">
        <Button type="submit" disabled={pending || (!!id && !isDirty)}>
          {pending ? <Spinner /> : null}
          {id ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
        {!id ? (
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
