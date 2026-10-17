"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CompartilharLinkDialog, type DadosCompartilhar } from "@/components/compartilhar-link-dialog";
import { gerarLinkAssinatura } from "@/actions/os";
import { formatDataHora } from "@/lib/format";

/** Admin: gera (ou reenvia) o link de assinatura — exige a assinatura do técnico já registrada. */
export function LinkAssinaturaAdmin({ osId, numero }: { osId: string; numero: string }) {
  const [dados, setDados] = useState<DadosCompartilhar | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await gerarLinkAssinatura(osId, null);
            if (!r.ok) return void toast.error(r.error);
            const validade = formatDataHora(r.data.expiraEm);
            setDados({
              titulo: "Link para o cliente assinar",
              descricao: (
                <>
                  Links anteriores desta OS deixam de valer. Este vale até <strong>{validade}</strong>.
                </>
              ),
              link: r.data.link,
              assunto: `Assinatura da Ordem de Serviço ${numero}`,
              mensagem: `Olá! Segue o link para conferir e assinar a Ordem de Serviço ${numero} (válido até ${validade}):\n\n${r.data.link}`,
              telefone: r.data.telefone,
              email: r.data.email,
            });
          })
        }
      >
        {pending ? <Spinner /> : <Link2 />} Enviar link de assinatura
      </Button>
      <CompartilharLinkDialog dados={dados} onClose={() => setDados(null)} />
    </>
  );
}
