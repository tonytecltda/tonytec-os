"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow } from "@/components/forms/field-row";
import { MaskedInput } from "@/components/forms/masked-input";
import {
  SelectPrioridade,
  SelectSimples,
  type Opcao,
  type OpcaoTipo,
} from "@/components/chamados/campos-problema";
import { SeletorAnexos } from "@/components/chamados/seletor-anexos";
import { useEnvioAnexos } from "@/components/chamados/use-envio-anexos";
import { abrirChamadoPortal } from "@/actions/chamados";
import { chamadoPortalSchema, type ChamadoPortalInput } from "@/lib/validators";

export function NovoChamadoForm({
  unidades,
  categorias,
  tipos,
  telefonePadrao,
}: {
  unidades: Opcao[];
  categorias: Opcao[];
  tipos: OpcaoTipo[];
  telefonePadrao: string;
}) {
  const router = useRouter();
  const enviarAnexos = useEnvioAnexos();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<ChamadoPortalInput>({
    resolver: zodResolver(chamadoPortalSchema),
    defaultValues: {
      unidade_id: unidades.length === 1 ? unidades[0].value : "",
      categoria_id: "",
      tipo_problema_id: "",
      titulo: "",
      descricao: "",
      prioridade: "media",
      telefone_contato: telefonePadrao,
    },
  });
  const { errors } = form.formState;
  const categoria = useWatch({ control: form.control, name: "categoria_id" });
  const tiposDaCategoria = tipos.filter((t) => t.categoriaId === categoria);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setEtapa("Abrindo chamado…");
      const r = await abrirChamadoPortal(values);
      if (!r.ok) {
        setEtapa(null);
        Object.entries(r.fieldErrors ?? {}).forEach(([campo, msg]) =>
          form.setError(campo as keyof ChamadoPortalInput, { message: msg }),
        );
        toast.error(r.error);
        return;
      }
      if (arquivos.length) {
        const { erros } = await enviarAnexos(r.data.id, arquivos, (atual, total) =>
          setEtapa(`Enviando anexo ${atual} de ${total}…`),
        );
        erros.forEach((e) => toast.error(e));
        if (erros.length)
          toast.info("O chamado foi aberto. Você pode reenviar os anexos na página do chamado.");
      }
      toast.success(r.message);
      router.push(`/portal/chamados/${r.data.id}`);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <Card>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              label="Unidade"
              htmlFor="ch-unidade"
              error={errors.unidade_id?.message}
              required
              className="sm:col-span-2"
            >
              <Controller
                control={form.control}
                name="unidade_id"
                render={({ field }) => (
                  <SelectSimples
                    id="ch-unidade"
                    value={field.value}
                    onChange={field.onChange}
                    opcoes={unidades}
                    placeholder="Onde é o problema?"
                    invalid={!!errors.unidade_id}
                  />
                )}
              />
            </FieldRow>
            <FieldRow label="Categoria" htmlFor="ch-categoria" error={errors.categoria_id?.message} required>
              <Controller
                control={form.control}
                name="categoria_id"
                render={({ field }) => (
                  <SelectSimples
                    id="ch-categoria"
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      form.setValue("tipo_problema_id", "");
                    }}
                    opcoes={categorias}
                    placeholder="Selecione"
                    invalid={!!errors.categoria_id}
                  />
                )}
              />
            </FieldRow>
            <FieldRow label="Tipo de problema" htmlFor="ch-tipo" error={errors.tipo_problema_id?.message}>
              <Controller
                control={form.control}
                name="tipo_problema_id"
                render={({ field }) => (
                  <SelectSimples
                    id="ch-tipo"
                    value={field.value}
                    onChange={field.onChange}
                    opcoes={tiposDaCategoria}
                    placeholder={categoria ? "Selecione" : "Escolha a categoria antes"}
                    disabled={!categoria}
                    vazio="Outro / não sei"
                  />
                )}
              />
            </FieldRow>
            <FieldRow
              label="Título"
              htmlFor="ch-titulo"
              error={errors.titulo?.message}
              required
              className="sm:col-span-2"
            >
              <Input
                id="ch-titulo"
                placeholder="Ex.: Câmera do portão sem imagem"
                maxLength={120}
                {...form.register("titulo")}
                aria-invalid={!!errors.titulo}
              />
            </FieldRow>
            <FieldRow
              label="Descrição"
              htmlFor="ch-desc"
              error={errors.descricao?.message}
              required
              description="Desde quando acontece, o que já foi tentado, horários de acesso ao local."
              className="sm:col-span-2"
            >
              <Textarea
                id="ch-desc"
                rows={5}
                {...form.register("descricao")}
                aria-invalid={!!errors.descricao}
              />
            </FieldRow>
            <FieldRow label="Prioridade" htmlFor="ch-prioridade" error={errors.prioridade?.message} required>
              <Controller
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <SelectPrioridade id="ch-prioridade" value={field.value} onChange={field.onChange} />
                )}
              />
            </FieldRow>
            <FieldRow label="Telefone para contato" htmlFor="ch-tel" error={errors.telefone_contato?.message}>
              <Controller
                control={form.control}
                name="telefone_contato"
                render={({ field }) => (
                  <MaskedInput
                    id="ch-tel"
                    mascara="telefone"
                    {...field}
                    aria-invalid={!!errors.telefone_contato}
                  />
                )}
              />
            </FieldRow>
            <div className="sm:col-span-2">
              <SeletorAnexos arquivos={arquivos} onChange={setArquivos} disabled={pending} />
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Spinner /> : null}
          {etapa ?? "Abrir chamado"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
