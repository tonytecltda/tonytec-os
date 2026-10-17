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
import { Spinner } from "@/components/ui/spinner";
import { FieldRow } from "@/components/forms/field-row";
import { MaskedInput } from "@/components/forms/masked-input";
import { AccessLinkDialog, type LinkAcesso } from "@/components/access-link-dialog";
import { usuarioSchema, type UsuarioInput } from "@/lib/validators";
import { atualizarUsuario, criarUsuario } from "@/app/admin/usuarios/actions";
import type { UserRole } from "@/lib/roles";

const TITULO: Record<UserRole, string> = {
  admin: "administrador",
  tecnico: "técnico",
  cliente: "usuário do portal",
};

export type UsuarioEditavel = { id: string; nome: string; email: string; telefone: string | null };

/**
 * Criação/edição de usuário (técnico, admin ou usuário do portal do cliente).
 * Use com `trigger` ou controlado via `open`/`onOpenChange`.
 */
export function UsuarioDialog({
  role,
  clienteId = null,
  usuario,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  role: UserRole;
  clienteId?: string | null;
  usuario?: UsuarioEditavel;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [openInterno, setOpenInterno] = useState(false);
  const controlado = openProp !== undefined;
  const open = controlado ? openProp : openInterno;
  const setOpen = (o: boolean) => (controlado ? onOpenChange?.(o) : setOpenInterno(o));

  const [link, setLink] = useState<LinkAcesso | null>(null);
  const [pending, startTransition] = useTransition();

  const valoresIniciais = {
    nome: usuario?.nome ?? "",
    email: usuario?.email ?? "",
    telefone: usuario?.telefone ?? "",
  };
  const form = useForm<UsuarioInput>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: valoresIniciais,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      if (usuario) {
        const r = await atualizarUsuario(usuario.id, values);
        if (!r.ok) {
          Object.entries(r.fieldErrors ?? {}).forEach(([campo, msg]) =>
            form.setError(campo as keyof UsuarioInput, { message: msg }),
          );
          toast.error(r.error);
          return;
        }
        toast.success(r.message ?? "Salvo.");
        setOpen(false);
        router.refresh();
        return;
      }

      const r = await criarUsuario({ ...values, role, cliente_id: clienteId });
      if (!r.ok) {
        Object.entries(r.fieldErrors ?? {}).forEach(([campo, msg]) =>
          form.setError(campo as keyof UsuarioInput, { message: msg }),
        );
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Usuário criado.");
      form.reset({ nome: "", email: "", telefone: "" });
      setOpen(false);
      setLink(r.data);
      router.refresh();
    }),
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return;
          if (o) form.reset(valoresIniciais);
          setOpen(o);
        }}
      >
        {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{usuario ? `Editar ${TITULO[role]}` : `Novo ${TITULO[role]}`}</DialogTitle>
            <DialogDescription>
              {usuario
                ? "Alterar o e-mail muda o login do usuário."
                : "Depois de salvar, você recebe um link para enviar ao usuário criar a senha."}
            </DialogDescription>
          </DialogHeader>
          <form id="usuario-form" onSubmit={onSubmit} noValidate>
            <FieldGroup className="gap-4">
              <FieldRow label="Nome" htmlFor="u-nome" error={errors.nome?.message} required>
                <Input
                  id="u-nome"
                  autoComplete="off"
                  {...form.register("nome")}
                  aria-invalid={!!errors.nome}
                />
              </FieldRow>
              <FieldRow label="E-mail (login)" htmlFor="u-email" error={errors.email?.message} required>
                <Input
                  id="u-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  {...form.register("email")}
                  aria-invalid={!!errors.email}
                />
              </FieldRow>
              <FieldRow
                label="Celular / WhatsApp"
                htmlFor="u-tel"
                error={errors.telefone?.message}
                description="Usado para enviar o link de acesso pelo WhatsApp."
              >
                <Controller
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <MaskedInput id="u-tel" mascara="telefone" {...field} aria-invalid={!!errors.telefone} />
                  )}
                />
              </FieldRow>
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" form="usuario-form" disabled={pending}>
              {pending ? <Spinner /> : null}
              {usuario ? "Salvar" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AccessLinkDialog dados={link} onClose={() => setLink(null)} />
    </>
  );
}
