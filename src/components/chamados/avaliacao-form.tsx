"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { avaliarChamado } from "@/actions/os";
import { cn } from "@/lib/utils";

const ROTULOS = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];

/** Avaliação do atendimento (1 a 5 estrelas + comentário). */
export function AvaliacaoForm({ chamadoId }: { chamadoId: string }) {
  const router = useRouter();
  const [nota, setNota] = useState(0);
  const [foco, setFoco] = useState(0);
  const [comentario, setComentario] = useState("");
  const [pending, startTransition] = useTransition();
  const exibida = foco || nota;

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Nota do atendimento">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={nota === n}
            aria-label={`${n} estrela${n > 1 ? "s" : ""} — ${ROTULOS[n]}`}
            className="rounded p-1 outline-none focus-visible:ring-3"
            onMouseEnter={() => setFoco(n)}
            onMouseLeave={() => setFoco(0)}
            onClick={() => setNota(n)}
          >
            <Star
              className={cn(
                "size-8",
                n <= exibida ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
        <span className="text-muted-foreground ml-2 text-sm">{ROTULOS[exibida]}</span>
      </div>
      <Textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Quer deixar um comentário? (opcional)"
        aria-label="Comentário"
      />
      <Button
        className="w-fit"
        disabled={!nota || pending}
        onClick={() =>
          startTransition(async () => {
            const r = await avaliarChamado(chamadoId, { nota, comentario });
            if (!r.ok) return void toast.error(r.error);
            toast.success(r.message);
            router.refresh();
          })
        }
      >
        {pending ? <Spinner /> : null} Enviar avaliação
      </Button>
    </div>
  );
}
