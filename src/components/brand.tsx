import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Marca do sistema: logo configurada (Configurações → Empresa) ou o monograma padrão.
 * A logo fica sobre fundo branco para funcionar no menu escuro e no tema escuro.
 */
export function Brand({
  className,
  subtitle,
  logoUrl,
  nome = "Tonytec",
}: {
  className?: string;
  subtitle?: string;
  logoUrl?: string | null;
  nome?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {logoUrl ? (
        <span className="flex h-9 shrink-0 items-center rounded-md bg-white px-1.5">
          <Image
            src={logoUrl}
            alt={nome}
            width={120}
            height={32}
            className="h-7 w-auto max-w-28 object-contain"
          />
        </span>
      ) : (
        <div className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold tracking-tight">
          TT
        </div>
      )}
      <div className="min-w-0 leading-tight">
        <div className="truncate font-semibold tracking-tight">{logoUrl ? "OS" : "Tonytec OS"}</div>
        {subtitle ? <div className="truncate text-xs opacity-70">{subtitle}</div> : null}
      </div>
    </div>
  );
}
