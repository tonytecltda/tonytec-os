"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { get, set } from "idb-keyval";
import { Camera, CloudUpload, FileText, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { prepararUploadFotoOs, registrarFotoOs, removerFotoOs } from "@/actions/os";
import { comprimirImagem } from "@/lib/imagens";
import { ANEXO_MAX_BYTES } from "@/lib/anexos";
import { ANEXO_OS_TIPO } from "@/lib/labels";
import type { FotoOs } from "@/lib/os";

type Categoria = FotoOs["tipo"];
type ItemFila = { id: string; categoria: Categoria; nome: string; tipo: string; blob: Blob };

const TIPOS_ACEITOS = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

/** Envia uma foto: URL assinada -> Storage -> registro. "rede" = tentar de novo depois. */
async function enviarArquivo(
  supabase: ReturnType<typeof createClient>,
  osId: string,
  item: ItemFila,
): Promise<"ok" | "rede" | string> {
  const meta = { nome: item.nome, tipo: item.tipo, tamanho: item.blob.size, categoria: item.categoria };
  try {
    const preparo = await prepararUploadFotoOs(osId, meta);
    if (!preparo.ok) return preparo.error;
    const { error } = await supabase.storage
      .from("os-anexos")
      .uploadToSignedUrl(preparo.data.path, preparo.data.token, item.blob, { contentType: item.tipo });
    // Falha de rede (sem sinal) fica na fila; outros erros são reportados.
    if (error)
      return /fetch|network|timeout|load failed/i.test(error.message)
        ? "rede"
        : `Falha no envio de “${item.nome}”.`;
    const registro = await registrarFotoOs(osId, { ...meta, path: preparo.data.path, legenda: "" });
    return registro.ok ? "ok" : registro.error;
  } catch {
    return "rede"; // sem conexão / servidor inacessível
  }
}

export function FotosOs({ osId, fotos, editavel }: { osId: string; fotos: FotoOs[]; editavel: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const chaveFila = `tonytec-fila-fotos-${osId}`;
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const categoriaAtual = useRef<Categoria>("foto_antes");

  /** Processa a fila guardada no aparelho (IndexedDB). */
  const processarFila = useCallback(async () => {
    const itens: ItemFila[] = (await get(chaveFila)) ?? [];
    // Sempre tenta enviar (navigator.onLine não é confiável); sem sinal, os itens ficam na fila.
    if (!itens.length) {
      setFila(itens);
      return;
    }
    setEnviando(true);
    const restantes: ItemFila[] = [];
    let enviados = 0;
    for (const item of itens) {
      const r = await enviarArquivo(supabase, osId, item);
      if (r === "ok") enviados++;
      else if (r === "rede") restantes.push(item);
      else toast.error(r);
    }
    await set(chaveFila, restantes);
    setFila(restantes);
    setEnviando(false);
    if (enviados) {
      toast.success(enviados === 1 ? "Foto enviada." : `${enviados} fotos enviadas.`);
      startTransition(() => router.refresh());
    }
    if (restantes.length) toast.warning(`${restantes.length} foto(s) aguardando conexão para envio.`);
  }, [chaveFila, osId, router, supabase]);

  // Ao abrir a tela e ao voltar a conexão: tenta enviar o que ficou na fila do aparelho.
  useEffect(() => {
    const inicial = window.setTimeout(() => void processarFila(), 0);
    const aoVoltar = () => void processarFila();
    window.addEventListener("online", aoVoltar);
    return () => {
      window.clearTimeout(inicial);
      window.removeEventListener("online", aoVoltar);
    };
  }, [processarFila]);

  const adicionar = async (lista: FileList | null) => {
    if (!lista?.length) return;
    const novos: ItemFila[] = [];
    for (const original of Array.from(lista).slice(0, 10)) {
      if (original.size > ANEXO_MAX_BYTES) {
        toast.error(`“${original.name}” tem mais de 20 MB.`);
        continue;
      }
      const arquivo = await comprimirImagem(original);
      novos.push({
        id: crypto.randomUUID(),
        categoria: categoriaAtual.current,
        nome: arquivo.name,
        tipo: arquivo.type || "image/jpeg",
        blob: arquivo,
      });
    }
    // Entra na fila primeiro (sobrevive a recarregar a página sem sinal), depois tenta enviar.
    const atual: ItemFila[] = (await get(chaveFila)) ?? [];
    await set(chaveFila, [...atual, ...novos]);
    await processarFila();
    Object.values(inputs.current).forEach((el) => el && (el.value = ""));
  };

  const abrir = (categoria: Categoria, chave: string) => {
    categoriaAtual.current = categoria;
    inputs.current[chave]?.click();
  };

  const remover = (foto: FotoOs) =>
    startTransition(async () => {
      const r = await removerFotoOs(foto.id);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Fotos e documentos</CardTitle>
        {fila.length ? (
          <Button variant="outline" size="sm" onClick={() => void processarFila()} disabled={enviando}>
            {enviando ? <Spinner /> : <CloudUpload />} {fila.length} aguardando envio
          </Button>
        ) : enviando ? (
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <Spinner /> Enviando…
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {editavel ? (
          <div className="grid grid-cols-3 gap-2">
            <input
              ref={(el) => {
                inputs.current.camera = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void adicionar(e.target.files)}
              aria-label="Tirar foto"
            />
            <input
              ref={(el) => {
                inputs.current.arquivo = el;
              }}
              type="file"
              accept={TIPOS_ACEITOS}
              multiple
              className="hidden"
              onChange={(e) => void adicionar(e.target.files)}
              aria-label="Escolher arquivos"
            />
            <Button
              type="button"
              variant="outline"
              className="h-auto flex-col py-3"
              onClick={() => abrir("foto_antes", "camera")}
            >
              <Camera /> <span className="text-xs">Foto antes</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto flex-col py-3"
              onClick={() => abrir("foto_depois", "camera")}
            >
              <Camera /> <span className="text-xs">Foto depois</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto flex-col py-3"
              onClick={() => abrir("documento", "arquivo")}
            >
              <ImagePlus /> <span className="text-xs">Galeria / PDF</span>
            </Button>
          </div>
        ) : null}

        {fotos.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fotos.map((f) => (
              <li key={f.id} className="group relative overflow-hidden rounded-lg border">
                <a
                  href={f.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-muted/50 block aspect-square"
                >
                  {f.mime?.startsWith("image/") && f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.url}
                      alt={ANEXO_OS_TIPO[f.tipo]}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center">
                      <FileText className="text-muted-foreground size-6" />
                    </span>
                  )}
                </a>
                <span className="bg-background/90 absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  {ANEXO_OS_TIPO[f.tipo]}
                </span>
                {editavel ? (
                  <Button
                    variant="secondary"
                    size="icon-xs"
                    className="absolute top-1 right-1 opacity-90"
                    aria-label="Remover foto"
                    onClick={() => remover(f)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            Nenhuma foto. Registre o antes e o depois do serviço.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
