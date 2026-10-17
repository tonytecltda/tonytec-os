"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/actions";

/**
 * Confirmação de ação sensível. Com `pedirMotivo`, exige um motivo (vai para a auditoria).
 * Use com `trigger` (abre sozinho) ou controlado via `open`/`onOpenChange`.
 */
export function ConfirmDialog({
  trigger,
  open: openProp,
  onOpenChange,
  titulo,
  descricao,
  confirmar = "Confirmar",
  destrutivo = false,
  pedirMotivo = false,
  acao,
  onSucesso,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  titulo: string;
  descricao?: React.ReactNode;
  confirmar?: string;
  destrutivo?: boolean;
  pedirMotivo?: boolean;
  acao: (motivo: string) => Promise<ActionResult<unknown>>;
  onSucesso?: () => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const controlado = openProp !== undefined;
  const open = controlado ? openProp : openInterno;
  const setOpen = (o: boolean) => (controlado ? onOpenChange?.(o) : setOpenInterno(o));

  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();
  const motivoValido = !pedirMotivo || motivo.trim().length >= 5;

  const executar = () =>
    startTransition(async () => {
      const r = await acao(motivo.trim());
      if (r.ok) {
        toast.success(r.message ?? "Feito.");
        setMotivo("");
        setOpen(false);
        onSucesso?.();
      } else {
        toast.error(r.error);
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descricao ? <AlertDialogDescription>{descricao}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {pedirMotivo ? (
          <div className="grid gap-1.5">
            <Label htmlFor="motivo-confirmacao">Motivo</Label>
            <Textarea
              id="motivo-confirmacao"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo (fica registrado na auditoria)"
              rows={3}
              maxLength={500}
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button
            variant={destrutivo ? "destructive" : "default"}
            onClick={executar}
            disabled={pending || !motivoValido}
          >
            {pending ? <Spinner /> : null}
            {confirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
