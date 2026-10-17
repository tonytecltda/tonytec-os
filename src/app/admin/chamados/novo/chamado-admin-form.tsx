"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow } from "@/components/forms/field-row";
import { MaskedInput } from "@/components/forms/masked-input";
import { ClienteCombobox, type OpcaoCliente } from "@/components/forms/cliente-combobox";
import {
  SelectPrioridade,
  SelectSimples,
  type Opcao,
  type OpcaoTipo,
} from "@/components/chamados/campos-problema";
import { SeletorAnexos } from "@/components/chamados/seletor-anexos";
import { useEnvioAnexos } from "@/components/chamados/use-envio-anexos";
import { criarChamadoAdmin, listarUnidadesCliente } from "@/actions/chamados";
import { ORIGEM } from "@/lib/labels";
import { chamadoAdminSchema, type ChamadoAdminInput } from "@/lib/validators";

const ORIGENS: Opcao[] = (["telefone", "whatsapp", "admin"] as const).map((o) => ({
  value: o,
  label: ORIGEM[o],
}));

export function ChamadoAdminForm({
  clientes,
  categorias,
  tipos,
  tecnicos,
  clienteInicial,
  unidadesIniciais,
}: {
  clientes: OpcaoCliente[];
  categorias: Opcao[];
  tipos: OpcaoTipo[];
  tecnicos: Opcao[];
  clienteInicial: string;
  unidadesIniciais: Opcao[];
}) {
  const router = useRouter();
  const enviarAnexos = useEnvioAnexos();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [unidades, setUnidades] = useState<Opcao[]>(unidadesIniciais);
  const [carregandoUnidades, setCarregandoUnidades] = useState(false);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<ChamadoAdminInput>({
    resolver: zodResolver(chamadoAdminSchema),
    defaultValues: {
      cliente_id: clienteInicial,
      unidade_id: unidadesIniciais.length === 1 ? unidadesIniciais[0].value : "",
      categoria_id: "",
      tipo_problema_id: "",
      titulo: "",
      descricao: "",
      prioridade: "media",
      telefone_contato: "",
      origem: "telefone",
      tecnico_id: "",
      data_agendada: "",
    },
  });
  const { errors } = form.formState;
  const clienteId = useWatch({ control: form.control, name: "cliente_id" });
  const categoria = useWatch({ control: form.control, name: "categoria_id" });
  const tiposDaCategoria = tipos.filter((t) => t.categoriaId === categoria);

  // Ao trocar o cliente, carrega as unidades dele.
  const trocarCliente = async (id: string) => {
    form.setValue("cliente_id", id, { shouldValidate: true });
    form.setValue("unidade_id", "");
    setUnidades([]);
    if (!id) return;
    setCarregandoUnidades(true);
    const lista = await listarUnidadesCliente(id);
    if (form.getValues("cliente_id") !== id) return; // trocou de novo enquanto carregava
    const opcoesUnidades = lista.map((u) => ({ value: u.id, label: u.nome }));
    setUnidades(opcoesUnidades);
    if (opcoesUnidades.length === 1) form.setValue("unidade_id", opcoesUnidades[0].value);
    setCarregandoUnidades(false);
  };

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setEtapa("Abrindo chamado…");
      const r = await criarChamadoAdmin(values);
      if (!r.ok) {
        setEtapa(null);
        Object.entries(r.fieldErrors ?? {}).forEach(([campo, msg]) =>
          form.setError(campo as keyof ChamadoAdminInput, { message: msg }),
        );
        toast.error(r.error);
        return;
      }
      if (arquivos.length) {
        const { erros } = await enviarAnexos(r.data.id, arquivos, (atual, total) =>
          setEtapa(`Enviando anexo ${atual} de ${total}…`),
        );
        erros.forEach((e) => toast.error(e));
      }
      toast.success(r.message);
      router.push(`/admin/chamados/${r.data.id}`);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-4xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente e problema</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <FieldRow label="Cliente" htmlFor="ca-cliente" error={errors.cliente_id?.message} required>
              <Controller
                control={form.control}
                name="cliente_id"
                render={({ field }) => (
                  <ClienteCombobox
                    id="ca-cliente"
                    clientes={clientes}
                    value={field.value}
                    onChange={(id) => void trocarCliente(id)}
                    invalid={!!errors.cliente_id}
                  />
                )}
              />
            </FieldRow>
            <FieldRow label="Unidade" htmlFor="ca-unidade" error={errors.unidade_id?.message}>
              <Controller
                control={form.control}
                name="unidade_id"
                render={({ field }) => (
                  <SelectSimples
                    id="ca-unidade"
                    value={field.value}
                    onChange={field.onChange}
                    opcoes={unidades}
                    placeholder={
                      !clienteId
                        ? "Escolha o cliente antes"
                        : carregandoUnidades
                          ? "Carregando…"
                          : "Selecione"
                    }
                    disabled={!clienteId || carregandoUnidades}
                    vazio="Sem unidade definida"
                  />
                )}
              />
            </FieldRow>
            <FieldRow label="Categoria" htmlFor="ca-categoria" error={errors.categoria_id?.message} required>
              <Controller
                control={form.control}
                name="categoria_id"
                render={({ field }) => (
                  <SelectSimples
                    id="ca-categoria"
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
            <FieldRow label="Tipo de problema" htmlFor="ca-tipo" error={errors.tipo_problema_id?.message}>
              <Controller
                control={form.control}
                name="tipo_problema_id"
                render={({ field }) => (
                  <SelectSimples
                    id="ca-tipo"
                    value={field.value}
                    onChange={field.onChange}
                    opcoes={tiposDaCategoria}
                    placeholder={categoria ? "Selecione" : "Escolha a categoria antes"}
                    disabled={!categoria}
                    vazio="Outro"
                  />
                )}
              />
            </FieldRow>
            <FieldRow
              label="Título"
              htmlFor="ca-titulo"
              error={errors.titulo?.message}
              required
              className="md:col-span-2"
            >
              <Input
                id="ca-titulo"
                maxLength={120}
                {...form.register("titulo")}
                aria-invalid={!!errors.titulo}
              />
            </FieldRow>
            <FieldRow
              label="Descrição"
              htmlFor="ca-desc"
              error={errors.descricao?.message}
              className="md:col-span-2"
            >
              <Textarea id="ca-desc" rows={4} {...form.register("descricao")} />
            </FieldRow>
            <FieldRow label="Prioridade" htmlFor="ca-prioridade" error={errors.prioridade?.message} required>
              <Controller
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <SelectPrioridade id="ca-prioridade" value={field.value} onChange={field.onChange} />
                )}
              />
            </FieldRow>
            <FieldRow label="Origem" htmlFor="ca-origem" error={errors.origem?.message} required>
              <Controller
                control={form.control}
                name="origem"
                render={({ field }) => (
                  <SelectSimples
                    id="ca-origem"
                    value={field.value}
                    onChange={field.onChange}
                    opcoes={ORIGENS}
                    placeholder="Origem"
                  />
                )}
              />
            </FieldRow>
            <FieldRow label="Telefone para contato" htmlFor="ca-tel" error={errors.telefone_contato?.message}>
              <Controller
                control={form.control}
                name="telefone_contato"
                render={({ field }) => <MaskedInput id="ca-tel" mascara="telefone" {...field} />}
              />
            </FieldRow>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atribuição (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <FieldRow label="Técnico" htmlFor="ca-tecnico" error={errors.tecnico_id?.message}>
              <Controller
                control={form.control}
                name="tecnico_id"
                render={({ field }) => (
                  <SelectSimples
                    id="ca-tecnico"
                    value={field.value}
                    onChange={field.onChange}
                    opcoes={tecnicos}
                    placeholder="Definir depois"
                    vazio="Definir depois"
                  />
                )}
              />
            </FieldRow>
            <FieldRow label="Visita agendada para" htmlFor="ca-agenda" error={errors.data_agendada?.message}>
              <Input id="ca-agenda" type="datetime-local" {...form.register("data_agendada")} />
            </FieldRow>
            <div className="md:col-span-2">
              <SeletorAnexos arquivos={arquivos} onChange={setArquivos} disabled={pending} />
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          {etapa ?? "Abrir chamado"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
