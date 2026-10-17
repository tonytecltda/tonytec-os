import { Download, FileText, Video } from "lucide-react";
import type { AnexoComUrl } from "@/lib/chamados";
import { ehImagem, ehVideo, tamanhoLegivel } from "@/lib/anexos";
import { formatDataHora } from "@/lib/format";

/** Grade de anexos com miniaturas (URLs assinadas de curta duração). */
export function ListaAnexos({ anexos }: { anexos: AnexoComUrl[] }) {
  if (!anexos.length) return <p className="text-muted-foreground text-sm">Nenhum anexo.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {anexos.map((a) => (
        <li key={a.id} className="group overflow-hidden rounded-lg border">
          <a
            href={a.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-muted/50 relative grid aspect-[4/3] place-items-center overflow-hidden"
            title={`Abrir ${a.nome}`}
          >
            {ehImagem(a.mime) && a.url ? (
              // Imagem privada via URL assinada temporária (fora do otimizador do Next).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.url}
                alt={a.nome}
                loading="lazy"
                className="size-full object-cover transition group-hover:scale-105"
              />
            ) : ehVideo(a.mime) ? (
              <Video className="text-muted-foreground size-8" />
            ) : (
              <FileText className="text-muted-foreground size-8" />
            )}
          </a>
          <div className="flex items-center gap-1 p-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium" title={a.nome}>
                {a.nome}
              </p>
              <p className="text-muted-foreground truncate text-[11px]">
                {[tamanhoLegivel(a.tamanho), a.autor, formatDataHora(a.data)].filter(Boolean).join(" · ")}
              </p>
            </div>
            {a.url ? (
              <a
                href={a.url}
                download={a.nome}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label={`Baixar ${a.nome}`}
              >
                <Download className="size-4" />
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
