"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hourglass, PackageSearch, Wrench } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { moverStatusChamado } from "@/actions/chamados";

type Status = Database["public"]["Enums"]["chamado_status"];

const ACOES: { status: Status; label: string; icon: typeof Wrench }[] = [
  { status: "em_atendimento", label: "Em atendimento", icon: Wrench },
  { status: "aguardando_peca", label: "Aguardando peça", icon: PackageSearch },
  { status: "aguardando_cliente", label: "Aguardando cliente", icon: Hourglass },
];

/** Atalhos de status do técnico (o encerramento acontece pela OS, na Fase 3). */
export function StatusAcoesTecnico({ chamadoId, status }: { chamadoId: string; status: Status }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (status === "resolvido" || status === "cancelado") return null;

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {ACOES.filter((a) => a.status !== status).map((a) => (
        <Button
          key={a.status}
          variant={a.status === "em_atendimento" ? "default" : "outline"}
          size="lg"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await moverStatusChamado(chamadoId, a.status);
              if (r.ok) {
                toast.success(r.message);
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          {pending ? <Spinner /> : <a.icon />}
          {a.label}
        </Button>
      ))}
    </div>
  );
}
