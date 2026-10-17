"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { FieldRow } from "@/components/forms/field-row";
import { NumberInput } from "@/components/forms/number-input";
import type { ActionResult } from "@/lib/actions";
import { ITEM_TIPO, opcoes } from "@/lib/labels";
import {
  categoriaSchema,
  itemCatalogoSchema,
  tipoProblemaSchema,
  type CategoriaInput,
  type ItemCatalogoInput,
  type TipoProblemaInput,
} from "@/lib/validators";
import {
  definirAtivoCatalogo,
  salvarCategoria,
  salvarItemCatalogo,
  salvarTipoProblema,
  type TabelaCatalogo,
} from "./actions";

type Opcao = { value: string; label: string };

/** Esqueleto comum: diálogo + formulário + submit para uma Server Action. */
function useCatalogoForm<T extends FieldValues>(
  resolver: Resolver<T>,
  iniciais: DefaultValues<T>,
  salvar: (values: T) => Promise<ActionResult<unknown>>,
) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<T>({ resolver, defaultValues: iniciais });
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await salvar(values);
      if (!r.ok) {
        Object.entries(r.fieldErrors ?? {}).forEach(([campo, msg]) =>
          form.setError(campo as Path<T>, { message: msg }),
        );
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Salvo.");
      setOpen(false);
      router.refresh();
    }),
  );
  const onOpenChange = (o: boolean) => {
    if (pending) return;
    if (o) form.reset(iniciais);
    setOpen(o);
  };
  return { form, open, onOpenChange, onSubmit, pending, setOpen };
}

function Rodape({ pending, formId, onCancel }: { pending: boolean; formId: string; onCancel: () => void }) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={pending}>
        Cancelar
      </Button>
      <Button type="submit" form={formId} disabled={pending}>
        {pending ? <Spinner /> : null}
        Salvar
      </Button>
    </DialogFooter>
  );
}

/** Botão "editar" usado como gatilho (repassa props/ref para o DialogTrigger asChild). */
export function EditarTrigger(props: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Editar" title="Editar" {...props}>
      <Pencil />
    </Button>
  );
}

// ---------------------------------------------------------------- categoria
export function CategoriaDialog({
  categoria,
  trigger,
}: {
  categoria?: CategoriaInput & { id: string };
  trigger: React.ReactNode;
}) {
  const { form, open, onOpenChange, onSubmit, pending, setOpen } = useCatalogoForm<CategoriaInput>(
    zodResolver(categoriaSchema),
    { nome: categoria?.nome ?? "", ordem: categoria?.ordem ?? 10 },
    (v) => salvarCategoria(categoria?.id ?? null, v),
  );
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <form id="cat-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <FieldRow label="Nome" htmlFor="cat-nome" error={errors.nome?.message} required>
              <Input id="cat-nome" {...form.register("nome")} aria-invalid={!!errors.nome} />
            </FieldRow>
            <FieldRow label="Ordem de exibição" htmlFor="cat-ordem" error={errors.ordem?.message}>
              <Controller
                control={form.control}
                name="ordem"
                render={({ field }) => (
                  <NumberInput
                    id="cat-ordem"
                    decimais={0}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? 0)}
                  />
                )}
              />
            </FieldRow>
          </FieldGroup>
        </form>
        <Rodape pending={pending} formId="cat-form" onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- tipo de problema
export function TipoProblemaDialog({
  tipo,
  categorias,
  categoriaPadrao,
  trigger,
}: {
  tipo?: TipoProblemaInput & { id: string };
  categorias: Opcao[];
  categoriaPadrao?: string;
  trigger: React.ReactNode;
}) {
  const { form, open, onOpenChange, onSubmit, pending, setOpen } = useCatalogoForm<TipoProblemaInput>(
    zodResolver(tipoProblemaSchema),
    { nome: tipo?.nome ?? "", categoria_id: tipo?.categoria_id ?? categoriaPadrao ?? "" },
    (v) => salvarTipoProblema(tipo?.id ?? null, v),
  );
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tipo ? "Editar tipo de problema" : "Novo tipo de problema"}</DialogTitle>
        </DialogHeader>
        <form id="tp-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <FieldRow label="Categoria" htmlFor="tp-cat" error={errors.categoria_id?.message} required>
              <Controller
                control={form.control}
                name="categoria_id"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="tp-cat" className="w-full" aria-invalid={!!errors.categoria_id}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldRow>
            <FieldRow label="Nome do problema" htmlFor="tp-nome" error={errors.nome?.message} required>
              <Input
                id="tp-nome"
                placeholder="Ex.: Câmera sem imagem"
                {...form.register("nome")}
                aria-invalid={!!errors.nome}
              />
            </FieldRow>
          </FieldGroup>
        </form>
        <Rodape pending={pending} formId="tp-form" onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- item de catálogo
export function ItemDialog({
  item,
  categorias,
  trigger,
}: {
  item?: ItemCatalogoInput & { id: string };
  categorias: Opcao[];
  trigger: React.ReactNode;
}) {
  const { form, open, onOpenChange, onSubmit, pending, setOpen } = useCatalogoForm<ItemCatalogoInput>(
    zodResolver(itemCatalogoSchema),
    {
      descricao: item?.descricao ?? "",
      tipo: item?.tipo ?? "material",
      unidade: item?.unidade ?? "un",
      valor_unitario: item?.valor_unitario ?? 0,
      categoria_id: item?.categoria_id ?? "",
    },
    (v) => salvarItemCatalogo(item?.id ?? null, v),
  );
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item" : "Novo item / serviço"}</DialogTitle>
        </DialogHeader>
        <form id="item-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              label="Descrição"
              htmlFor="it-desc"
              error={errors.descricao?.message}
              required
              className="sm:col-span-2"
            >
              <Input
                id="it-desc"
                placeholder="Ex.: Câmera bullet 2MP, Fonte 12V 5A, Visita técnica"
                {...form.register("descricao")}
                aria-invalid={!!errors.descricao}
              />
            </FieldRow>
            <FieldRow label="Tipo" htmlFor="it-tipo" error={errors.tipo?.message} required>
              <Controller
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="it-tipo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoes(ITEM_TIPO).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldRow>
            <FieldRow
              label="Unidade"
              htmlFor="it-un"
              error={errors.unidade?.message}
              required
              description="un, m, h, cx, rolo…"
            >
              <Input id="it-un" {...form.register("unidade")} aria-invalid={!!errors.unidade} />
            </FieldRow>
            <FieldRow
              label="Preço de venda"
              htmlFor="it-valor"
              error={errors.valor_unitario?.message}
              required
            >
              <Controller
                control={form.control}
                name="valor_unitario"
                render={({ field }) => (
                  <NumberInput
                    id="it-valor"
                    prefixo="R$"
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? 0)}
                    aria-invalid={!!errors.valor_unitario}
                  />
                )}
              />
            </FieldRow>
            <FieldRow label="Categoria (opcional)" htmlFor="it-cat" error={errors.categoria_id?.message}>
              <Controller
                control={form.control}
                name="categoria_id"
                render={({ field }) => (
                  <Select
                    value={field.value || "__nenhuma"}
                    onValueChange={(v) => field.onChange(v === "__nenhuma" ? "" : v)}
                  >
                    <SelectTrigger id="it-cat" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__nenhuma">Todas</SelectItem>
                      {categorias.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldRow>
          </FieldGroup>
        </form>
        <Rodape pending={pending} formId="item-form" onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- ativar/desativar
export function AtivoToggle({ tabela, id, ativo }: { tabela: TabelaCatalogo; id: string; ativo: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={ativo ? "Desativar" : "Reativar"}
      title={ativo ? "Desativar" : "Reativar"}
      disabled={pending}
      className={ativo ? "text-muted-foreground hover:text-destructive" : "text-emerald-600"}
      onClick={() =>
        startTransition(async () => {
          const r = await definirAtivoCatalogo(tabela, id, !ativo);
          if (r.ok) {
            toast.success(r.message);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      {pending ? <Spinner /> : ativo ? <PowerOff /> : <Power />}
    </Button>
  );
}
