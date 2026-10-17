"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, FilePlus2, LogIn, PencilLine, RefreshCcw, RotateCcw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  abrirOsDoChamado,
  cancelarOs,
  iniciarAtendimento,
  iniciarVisita,
  reabrirOs,
  regerarPdf,
  voltarParaEdicao,
} from "@/actions/os";

/** Botão "Iniciar atendimento" do técnico no chamado. */
export function IniciarAtendimentoButton({
  chamadoId,
  rotulo = "Iniciar atendimento",
}: {
  chamadoId: string;
  rotulo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await iniciarAtendimento(chamadoId);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          router.push(`/tecnico/os/${r.data.osId}`);
        })
      }
    >
      {pending ? <Spinner /> : <Wrench />} {rotulo}
    </Button>
  );
}

/** Início de OS avulsa (sem chamado) pelo técnico. */
export function IniciarOsButton({ osId }: { osId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await iniciarVisita(osId);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          router.refresh();
        })
      }
    >
      {pending ? <Spinner /> : <LogIn />} Iniciar atendimento (registrar chegada)
    </Button>
  );
}

export function VoltarEdicaoButton({ osId, destino }: { osId: string; destino: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <PencilLine /> Voltar para edição
        </Button>
      }
      titulo="Voltar a OS para edição?"
      descricao="As assinaturas já coletadas e os links enviados serão descartados. Depois de ajustar, conclua e colete as assinaturas de novo."
      confirmar="Voltar para edição"
      acao={() => voltarParaEdicao(osId)}
      onSucesso={() => router.push(destino)}
    />
  );
}

/** Admin: abrir OS a partir do chamado. */
export function AbrirOsChamadoButton({ chamadoId }: { chamadoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await abrirOsDoChamado(chamadoId);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          router.push(`/admin/os/${r.data.osId}`);
        })
      }
    >
      {pending ? <Spinner /> : <FilePlus2 />} Abrir ordem de serviço
    </Button>
  );
}

/** Admin: reabrir / cancelar / gerar PDF de novo. */
export function AcoesAdminOs({
  osId,
  finalizada,
  cancelada,
  temPdf,
}: {
  osId: string;
  finalizada: boolean;
  cancelada: boolean;
  temPdf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {finalizada ? (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <RotateCcw /> Reabrir OS
            </Button>
          }
          titulo="Reabrir esta OS?"
          descricao="A OS volta para edição, as assinaturas são invalidadas e o chamado volta para “Em atendimento”. Será preciso assinar de novo."
          confirmar="Reabrir"
          pedirMotivo
          destrutivo
          acao={(motivo) => reabrirOs(osId, motivo)}
          onSucesso={() => router.refresh()}
        />
      ) : null}
      {finalizada ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await regerarPdf(osId);
              if (r.ok) {
                toast.success(r.message);
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          {pending ? <Spinner /> : <RefreshCcw />} {temPdf ? "Gerar PDF de novo" : "Gerar PDF"}
        </Button>
      ) : null}
      {!finalizada && !cancelada ? (
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="text-destructive">
              <Ban /> Cancelar OS
            </Button>
          }
          titulo="Cancelar esta OS?"
          descricao="A OS fica registrada como cancelada (não é apagada). O chamado não é alterado."
          confirmar="Cancelar OS"
          pedirMotivo
          destrutivo
          acao={(motivo) => cancelarOs(osId, motivo)}
          onSucesso={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
