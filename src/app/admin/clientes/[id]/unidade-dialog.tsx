"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow } from "@/components/forms/field-row";
import { MaskedInput } from "@/components/forms/masked-input";
import { UFS } from "@/lib/labels";
import { unidadeSchema, type UnidadeInput } from "@/lib/validators";
import { salvarUnidade } from "../actions";

export type UnidadeEditavel = UnidadeInput & { id: string };

const VAZIO: UnidadeInput = {
  nome: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  contato_local: "",
  telefone_local: "",
  referencia: "",
};

export function UnidadeDialog({
  clienteId,
  unidade,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  clienteId: string;
  unidade?: UnidadeEditavel;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const router = useRouter();
  const [openInterno, setOpenInterno] = useState(false);
  const controlado = openProp !== undefined;
  const open = controlado ? openProp : openInterno;
  const setOpen = (o: boolean) => (controlado ? onOpenChange?.(o) : setOpenInterno(o));
  const [pending, startTransition] = useTransition();
  const [buscandoCep, setBuscandoCep] = useState(false);

  const iniciais = unidade ? { ...VAZIO, ...unidade } : VAZIO;
  const form = useForm<UnidadeInput>({ resolver: zodResolver(unidadeSchema), defaultValues: iniciais });
  const { errors } = form.formState;

  /** Preenche o endereço pelo CEP (ViaCEP). Falhas são silenciosas: o usuário digita. */
  const buscarCep = async (cep: string) => {
    const digitos = cep.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = (await resp.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (dados.erro) {
        toast.warning("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      const opts = { shouldDirty: true, shouldValidate: true };
      if (dados.logradouro) form.setValue("logradouro", dados.logradouro, opts);
      if (dados.bairro) form.setValue("bairro", dados.bairro, opts);
      if (dados.localidade) form.setValue("cidade", dados.localidade, opts);
      if (dados.uf) form.setValue("uf", dados.uf, opts);
      form.setFocus("numero");
    } catch {
      // sem internet ou serviço fora: segue manual
    } finally {
      setBuscandoCep(false);
    }
  };

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await salvarUnidade(clienteId, unidade?.id ?? null, values);
      if (!r.ok) {
        Object.entries(r.fieldErrors ?? {}).forEach(([campo, msg]) =>
          form.setError(campo as keyof UnidadeInput, { message: msg }),
        );
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      setOpen(false);
      router.refresh();
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        if (o) form.reset(iniciais);
        setOpen(o);
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{unidade ? "Editar unidade" : "Nova unidade"}</DialogTitle>
          <DialogDescription>Local de atendimento. O endereço é usado na rota do técnico.</DialogDescription>
        </DialogHeader>
        <form id="unidade-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="grid gap-4 sm:grid-cols-6">
            <FieldRow
              label="Nome da unidade"
              htmlFor="un-nome"
              error={errors.nome?.message}
              required
              className="sm:col-span-6"
            >
              <Input
                id="un-nome"
                placeholder="Ex.: Matriz, Torre 1, Loja Centro"
                {...form.register("nome")}
                aria-invalid={!!errors.nome}
              />
            </FieldRow>
            <FieldRow label="CEP" htmlFor="un-cep" error={errors.cep?.message} className="sm:col-span-2">
              <div className="relative">
                <Controller
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <MaskedInput
                      id="un-cep"
                      mascara="cep"
                      {...field}
                      onChange={(v) => {
                        field.onChange(v);
                        if (v.replace(/\D/g, "").length === 8) void buscarCep(v);
                      }}
                      aria-invalid={!!errors.cep}
                    />
                  )}
                />
                {buscandoCep ? <Spinner className="absolute top-2 right-2" /> : null}
              </div>
            </FieldRow>
            <FieldRow
              label="Logradouro"
              htmlFor="un-log"
              error={errors.logradouro?.message}
              className="sm:col-span-4"
            >
              <Input id="un-log" {...form.register("logradouro")} />
            </FieldRow>
            <FieldRow
              label="Número"
              htmlFor="un-num"
              error={errors.numero?.message}
              className="sm:col-span-2"
            >
              <Input id="un-num" {...form.register("numero")} />
            </FieldRow>
            <FieldRow
              label="Complemento"
              htmlFor="un-comp"
              error={errors.complemento?.message}
              className="sm:col-span-4"
            >
              <Input id="un-comp" {...form.register("complemento")} />
            </FieldRow>
            <FieldRow
              label="Bairro"
              htmlFor="un-bairro"
              error={errors.bairro?.message}
              className="sm:col-span-2"
            >
              <Input id="un-bairro" {...form.register("bairro")} />
            </FieldRow>
            <FieldRow
              label="Cidade"
              htmlFor="un-cidade"
              error={errors.cidade?.message}
              className="sm:col-span-3"
            >
              <Input id="un-cidade" {...form.register("cidade")} />
            </FieldRow>
            <FieldRow label="UF" htmlFor="un-uf" error={errors.uf?.message} className="sm:col-span-1">
              <Controller
                control={form.control}
                name="uf"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="un-uf" className="w-full" aria-invalid={!!errors.uf}>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldRow>
            <FieldRow
              label="Contato no local"
              htmlFor="un-contato"
              error={errors.contato_local?.message}
              className="sm:col-span-3"
            >
              <Input id="un-contato" placeholder="Ex.: Zelador João" {...form.register("contato_local")} />
            </FieldRow>
            <FieldRow
              label="Telefone do local"
              htmlFor="un-tel"
              error={errors.telefone_local?.message}
              className="sm:col-span-3"
            >
              <Controller
                control={form.control}
                name="telefone_local"
                render={({ field }) => (
                  <MaskedInput
                    id="un-tel"
                    mascara="telefone"
                    {...field}
                    aria-invalid={!!errors.telefone_local}
                  />
                )}
              />
            </FieldRow>
            <FieldRow
              label="Ponto de referência / instruções de acesso"
              htmlFor="un-ref"
              error={errors.referencia?.message}
              className="sm:col-span-6"
            >
              <Textarea id="un-ref" rows={2} {...form.register("referencia")} />
            </FieldRow>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="unidade-form" disabled={pending}>
            {pending ? <Spinner /> : null}
            Salvar unidade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
