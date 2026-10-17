"use client";

import { useRouter } from "next/navigation";
import { Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { definirAtivoCliente } from "../actions";

export function ClienteAtivoButton({ id, ativo, nome }: { id: string; ativo: boolean; nome: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant={ativo ? "outline" : "default"} className={ativo ? "text-destructive" : undefined}>
          {ativo ? <PowerOff /> : <Power />}
          {ativo ? "Desativar" : "Reativar"}
        </Button>
      }
      titulo={ativo ? `Desativar ${nome}?` : `Reativar ${nome}?`}
      descricao={
        ativo
          ? "O cliente some das listas de seleção e os usuários do portal dele perdem o acesso. Chamados, OS e histórico são mantidos."
          : "O cliente volta a ficar disponível. Os usuários do portal precisam ser reativados um a um."
      }
      confirmar={ativo ? "Desativar cliente" : "Reativar cliente"}
      destrutivo={ativo}
      pedirMotivo={ativo}
      acao={(motivo) => definirAtivoCliente(id, !ativo, motivo)}
      onSucesso={() => router.refresh()}
    />
  );
}
