"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
  type Notificacao,
} from "@/actions/notificacoes";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const INTERVALO_MS = 45_000;

function tempoRelativo(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Sino do cabeçalho: contador de não lidas, atualizado a cada 45 s (só com a aba visível). */
export function SinoNotificacoes() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const r = await listarNotificacoes();
      setItens(r.itens);
      setNaoLidas(r.naoLidas);
    } catch {
      // sem rede: mantém o que já está na tela
    }
  }, []);

  useEffect(() => {
    const inicial = setTimeout(() => void carregar(), 0);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void carregar();
    }, INTERVALO_MS);
    const aoVoltar = () => document.visibilityState === "visible" && void carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearTimeout(inicial);
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [carregar]);

  function abrir(n: Notificacao) {
    setAberto(false);
    if (!n.lida) {
      setItens((l) => l.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      setNaoLidas((c) => Math.max(0, c - 1));
      void marcarNotificacaoLida(n.id).then(carregar);
    }
    if (n.link) router.push(n.link);
  }

  function marcarTodas() {
    setItens((l) => l.map((x) => ({ ...x, lida: true })));
    setNaoLidas(0);
    void marcarTodasNotificacoesLidas().then(carregar);
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o);
        if (o) void carregar();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={naoLidas ? `Notificações: ${naoLidas} não lidas` : "Notificações"}
        >
          <Bell />
          {naoLidas > 0 && (
            <span
              data-testid="sino-contador"
              className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold text-white"
            >
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notificações</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!naoLidas}
            onClick={marcarTodas}
          >
            <CheckCheck className="size-3.5" /> Marcar todas como lidas
          </Button>
        </div>
        {itens.length === 0 ? (
          <p className="text-muted-foreground px-3 py-8 text-center text-sm">Nenhuma notificação.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {itens.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => abrir(n)}
                  className={cn(
                    "hover:bg-accent focus-visible:bg-accent flex w-full gap-2 px-3 py-2.5 text-left outline-none",
                    !n.lida && "bg-primary/5",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.lida ? "bg-transparent" : "bg-primary",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", !n.lida && "font-semibold")}>
                      {n.titulo}
                    </span>
                    {n.mensagem && (
                      <span className="text-muted-foreground line-clamp-2 block text-xs">{n.mensagem}</span>
                    )}
                    <span className="text-muted-foreground mt-0.5 block text-[11px]">
                      {tempoRelativo(n.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
