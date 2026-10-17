"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { calcularPendentes } from "@/actions/cobranca";

/** Calcula a cobrança das visitas de OS encerradas que ainda não têm sugestão. */
export function CalcularPendentesButton({ pendentes }: { pendentes: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={pendentes ? "default" : "outline"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await calcularPendentes();
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          router.refresh();
        })
      }
    >
      {pending ? <Spinner /> : <Calculator />} Calcular pendentes{pendentes ? ` (${pendentes})` : ""}
    </Button>
  );
}
