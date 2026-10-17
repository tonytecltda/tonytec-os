"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow } from "@/components/forms/field-row";
import { SelectSimples, type Opcao } from "@/components/chamados/campos-problema";
import { atualizarChamado } from "@/actions/chamados";
import { CHAMADO_STATUS, PRIORIDADE, opcoes } from "@/lib/labels";
import { gestaoChamadoSchema, type GestaoChamadoInput } from "@/lib/validators";

export function GestaoChamadoForm({
  chamadoId,
  inicial,
  tecnicos,
}: {
  chamadoId: string;
  inicial: GestaoChamadoInput;
  tecnicos: Opcao[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<GestaoChamadoInput>({
    resolver: zodResolver(gestaoChamadoSchema),
    defaultValues: inicial,
  });
  const { errors, isDirty } = form.formState;
  const status = useWatch({ control: form.control, name: "status" });
  const cancelando = status === "cancelado" && inicial.status !== "cancelado";

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await atualizarChamado(chamadoId, values);
      if (!r.ok) {
        Object.entries(r.fieldErrors ?? {}).forEach(([campo, msg]) =>
          form.setError(campo as keyof GestaoChamadoInput, { message: msg }),
        );
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-4">
        <FieldRow label="Status" htmlFor="g-status" error={errors.status?.message}>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <SelectSimples
                id="g-status"
                value={field.value}
                onChange={field.onChange}
                opcoes={opcoes(CHAMADO_STATUS)}
                placeholder="Status"
              />
            )}
          />
        </FieldRow>
        {cancelando ? (
          <FieldRow label="Motivo do cancelamento" htmlFor="g-motivo" error={errors.motivo?.message} required>
            <Textarea
              id="g-motivo"
              rows={2}
              {...form.register("motivo")}
              placeholder="Fica registrado como nota interna"
            />
          </FieldRow>
        ) : null}
        <FieldRow label="Prioridade" htmlFor="g-prioridade" error={errors.prioridade?.message}>
          <Controller
            control={form.control}
            name="prioridade"
            render={({ field }) => (
              <SelectSimples
                id="g-prioridade"
                value={field.value}
                onChange={field.onChange}
                opcoes={opcoes(PRIORIDADE)}
                placeholder="Prioridade"
              />
            )}
          />
        </FieldRow>
        <FieldRow label="Técnico responsável" htmlFor="g-tecnico" error={errors.tecnico_id?.message}>
          <Controller
            control={form.control}
            name="tecnico_id"
            render={({ field }) => (
              <SelectSimples
                id="g-tecnico"
                value={field.value}
                onChange={field.onChange}
                opcoes={tecnicos}
                placeholder="Sem técnico"
                vazio="Sem técnico"
              />
            )}
          />
        </FieldRow>
        <FieldRow
          label="Visita agendada para"
          htmlFor="g-agenda"
          error={errors.data_agendada?.message}
          description="Ao agendar um chamado aberto, o status passa para “Agendado”."
        >
          <Input id="g-agenda" type="datetime-local" {...form.register("data_agendada")} />
        </FieldRow>
      </FieldGroup>
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={pending || !isDirty} className="flex-1">
          {pending ? <Spinner /> : null}
          Salvar
        </Button>
        {isDirty ? (
          <Button type="button" variant="outline" onClick={() => form.reset(inicial)} disabled={pending}>
            Desfazer
          </Button>
        ) : null}
      </div>
    </form>
  );
}
