"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { QuadroAssinatura, type QuadroAssinaturaHandle } from "@/components/os/quadro-assinatura";
import { salvarMinhaAssinatura } from "@/actions/os";

export function MinhaAssinaturaForm({ urlAtual }: { urlAtual: string | null }) {
  const router = useRouter();
  const quadro = useRef<QuadroAssinaturaHandle>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid max-w-xl gap-4">
      {urlAtual ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assinatura atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid h-28 place-items-center rounded-lg border bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlAtual} alt="Assinatura salva" className="max-h-24 object-contain" />
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {urlAtual ? "Trocar assinatura" : "Desenhe sua assinatura"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <QuadroAssinatura ref={quadro} rotulo="Assinatura" />
          <Button
            size="lg"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const imagem = quadro.current?.imagem();
                if (!imagem) return void toast.error("Faça a assinatura no quadro.");
                const r = await salvarMinhaAssinatura(imagem);
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message);
                quadro.current?.limpar();
                router.refresh();
              })
            }
          >
            {pending ? <Spinner /> : <Save />} Salvar assinatura
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
