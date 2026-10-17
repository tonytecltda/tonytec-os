"use client";

import { useRef } from "react";
import { FileText, ImageIcon, Paperclip, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ANEXO_ACCEPT, ANEXOS_POR_ENVIO, tamanhoLegivel, validarArquivo } from "@/lib/anexos";

function Icone({ tipo }: { tipo: string }) {
  if (tipo.startsWith("image/")) return <ImageIcon className="size-4 shrink-0" />;
  if (tipo.startsWith("video/")) return <Video className="size-4 shrink-0" />;
  return <FileText className="size-4 shrink-0" />;
}

/** Escolha de arquivos antes de enviar (formulários de abertura de chamado). */
export function SeletorAnexos({
  arquivos,
  onChange,
  disabled,
}: {
  arquivos: File[];
  onChange: (arquivos: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const adicionar = (lista: FileList | null) => {
    if (!lista) return;
    const novos: File[] = [];
    for (const f of Array.from(lista)) {
      const erro = validarArquivo(f);
      if (erro) toast.error(erro);
      else novos.push(f);
    }
    const total = [...arquivos, ...novos];
    if (total.length > ANEXOS_POR_ENVIO)
      toast.warning(`Envie no máximo ${ANEXOS_POR_ENVIO} arquivos por vez.`);
    onChange(total.slice(0, ANEXOS_POR_ENVIO));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ANEXO_ACCEPT}
        className="hidden"
        onChange={(e) => adicionar(e.target.files)}
        aria-label="Selecionar arquivos"
      />
      {arquivos.length ? (
        <ul className="grid gap-1.5">
          {arquivos.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="bg-muted/50 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm"
            >
              <Icone tipo={f.type} />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-muted-foreground text-xs">{tamanhoLegivel(f.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remover ${f.name}`}
                disabled={disabled}
                onClick={() => onChange(arquivos.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || arquivos.length >= ANEXOS_POR_ENVIO}
        >
          <Paperclip /> Anexar fotos, vídeo ou PDF
        </Button>
        <p className="text-muted-foreground mt-1 text-xs">
          Até {ANEXOS_POR_ENVIO} arquivos de até 20 MB cada.
        </p>
      </div>
    </div>
  );
}
