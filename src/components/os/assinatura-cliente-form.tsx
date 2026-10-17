"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Download, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/actions";
import { useCamposAssinaturaCliente, type DadosAssinaturaCliente } from "./campos-assinatura";

/**
 * Assinatura do cliente fora do local (link público ou portal).
 * `acao` é uma Server Action já vinculada ao token ou à OS (`.bind`).
 */
export function AssinaturaClienteForm({
  acao,
  termo,
  nomeSugerido,
}: {
  acao: (dados: DadosAssinaturaCliente) => Promise<ActionResult<{ pdf: boolean; pdfUrl: string | null }>>;
  termo: string;
  nomeSugerido?: string;
}) {
  const cliente = useCamposAssinaturaCliente(nomeSugerido);
  const [concluido, setConcluido] = useState<{ pdfUrl: string | null } | null>(null);
  const [pending, startTransition] = useTransition();

  if (concluido) {
    return (
      <Alert className="border-emerald-500/40">
        <CircleCheck className="text-emerald-600" />
        <AlertTitle>Assinatura registrada. Obrigado!</AlertTitle>
        <AlertDescription className="grid gap-3 pt-1">
          <span>A ordem de serviço foi encerrada e uma cópia em PDF foi gerada.</span>
          {concluido.pdfUrl ? (
            <Button asChild className="w-fit">
              <a href={concluido.pdfUrl}>
                <Download /> Baixar PDF
              </a>
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assinatura</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">Termo de aceite</div>
          <p className="text-sm whitespace-pre-wrap">{termo}</p>
        </div>
        {cliente.campos}
        <Button
          size="lg"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const dados = await cliente.coletar();
              if (typeof dados === "string") return void toast.error(dados);
              const r = await acao(dados);
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.message);
              setConcluido({ pdfUrl: r.data.pdfUrl });
            })
          }
        >
          {pending ? <Spinner /> : <FileSignature />} Assinar ordem de serviço
        </Button>
      </CardContent>
    </Card>
  );
}
