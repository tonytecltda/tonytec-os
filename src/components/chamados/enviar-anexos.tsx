"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ANEXO_ACCEPT, ANEXOS_POR_ENVIO } from "@/lib/anexos";
import { useEnvioAnexos } from "./use-envio-anexos";

/** Botões para anexar arquivos a um chamado existente (e tirar foto no celular). */
export function EnviarAnexos({ chamadoId, camera = false }: { chamadoId: string; camera?: boolean }) {
  const router = useRouter();
  const enviar = useEnvioAnexos();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const processar = (lista: FileList | null) => {
    if (!lista?.length) return;
    const arquivos = Array.from(lista).slice(0, ANEXOS_POR_ENVIO);
    if (lista.length > ANEXOS_POR_ENVIO) toast.warning(`Enviando os primeiros ${ANEXOS_POR_ENVIO} arquivos.`);
    startTransition(async () => {
      const { enviados, erros } = await enviar(chamadoId, arquivos, (atual, total) =>
        setProgresso(`Enviando ${atual}/${total}…`),
      );
      setProgresso(null);
      erros.forEach((e) => toast.error(e));
      if (enviados) {
        toast.success(enviados === 1 ? "Anexo enviado." : `${enviados} anexos enviados.`);
        router.refresh();
      }
      if (arquivoRef.current) arquivoRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={arquivoRef}
        type="file"
        multiple
        accept={ANEXO_ACCEPT}
        className="hidden"
        onChange={(e) => processar(e.target.files)}
        aria-label="Selecionar arquivos"
      />
      {camera ? (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => processar(e.target.files)}
          aria-label="Tirar foto"
        />
      ) : null}
      {camera ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cameraRef.current?.click()}
          disabled={pending}
        >
          <Camera /> Tirar foto
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => arquivoRef.current?.click()}
        disabled={pending}
      >
        {pending ? <Spinner /> : <Paperclip />}
        {progresso ?? "Anexar arquivo"}
      </Button>
    </div>
  );
}
