"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { comentarChamado } from "@/actions/chamados";

/** Caixa de mensagem do chamado. `permitirInterno` = equipe Tonytec (admin/técnico). */
export function ComentarioForm({
  chamadoId,
  permitirInterno,
}: {
  chamadoId: string;
  permitirInterno: boolean;
}) {
  const router = useRouter();
  const [mensagem, setMensagem] = useState("");
  const [interno, setInterno] = useState(false);
  const [pending, startTransition] = useTransition();

  const enviar = () => {
    // Limpa já no envio: o que for digitado em seguida não é apagado quando a resposta chegar.
    const texto = mensagem;
    setMensagem("");
    startTransition(async () => {
      const r = await comentarChamado(chamadoId, { mensagem: texto, interno: permitirInterno && interno });
      if (!r.ok) {
        toast.error(r.error);
        setMensagem((atual) => atual || texto); // devolve o texto para tentar de novo
        return;
      }
      toast.success(r.message);
      router.refresh();
    });
  };

  return (
    <div className={interno ? "rounded-lg border border-amber-500/40 p-2" : undefined}>
      <Textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        placeholder={
          interno
            ? "Nota interna: visível só para a equipe Tonytec"
            : permitirInterno
              ? "Mensagem para o cliente…"
              : "Escreva uma mensagem para a Tonytec…"
        }
        rows={3}
        maxLength={4000}
        aria-label="Mensagem"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && mensagem.trim()) enviar();
        }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {permitirInterno ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={interno} onCheckedChange={setInterno} aria-label="Nota interna" />
            <Lock className="size-3.5 text-amber-600" />
            Nota interna
          </label>
        ) : (
          <span />
        )}
        <Button onClick={enviar} disabled={pending || !mensagem.trim()}>
          {pending ? <Spinner /> : <Send />}
          {interno ? "Registrar nota" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
