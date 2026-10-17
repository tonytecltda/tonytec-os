"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useSetParam } from "@/components/data/list-filters";
import { faturarFechamento } from "@/actions/cobranca";

/** Seleção do mês (aaaa-mm) que atualiza a URL. */
export function SeletorMes({ mes }: { mes: string }) {
  const { setParam } = useSetParam();
  return (
    <Input
      type="month"
      value={mes}
      onChange={(e) => e.target.value && setParam("mes", e.target.value)}
      aria-label="Mês do fechamento"
      className="w-full sm:w-44"
    />
  );
}

/** Marca todo o mês do cliente como faturado (ou desfaz). */
export function FaturarFechamento({
  clienteId,
  mes,
  faturado,
  habilitado,
}: {
  clienteId: string;
  mes: string;
  faturado: boolean;
  habilitado: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (faturado) {
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await faturarFechamento(clienteId, mes, false);
            if (!r.ok) return void toast.error(r.error);
            toast.success(r.message);
            router.refresh();
          })
        }
      >
        {pending ? <Spinner /> : <Undo2 />} Desfazer faturamento do mês
      </Button>
    );
  }
  return (
    <ConfirmDialog
      trigger={
        <Button disabled={!habilitado}>
          <BadgeCheck /> Marcar mês como faturado
        </Button>
      }
      titulo="Marcar o mês como faturado?"
      descricao="Todas as visitas deste mês e os materiais cobrados das OS encerradas no mês passam para “faturado” e deixam de poder ser alterados."
      confirmar="Marcar como faturado"
      acao={() => faturarFechamento(clienteId, mes, true)}
      onSucesso={() => router.refresh()}
    />
  );
}
