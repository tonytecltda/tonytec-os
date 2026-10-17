"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, LogIn, LogOut, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ajustarVisita, iniciarVisita, registrarSaida } from "@/actions/os";
import { formatDataHora, formatNumero, paraInputDataHora } from "@/lib/format";
import { duracao } from "@/lib/sla";

export type VisitaOs = { id: string; chegada: string; saida: string | null; horas: number | null };

function Cronometro({ desde }: { desde: string }) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setAgora(Date.now());
    const primeiro = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(primeiro);
      window.clearInterval(id);
    };
  }, []);
  if (agora == null) return null;
  return <span className="tabular-nums">{duracao(agora - Date.parse(desde))}</span>;
}

export function VisitasOs({
  osId,
  visitas,
  editavel,
}: {
  osId: string;
  visitas: VisitaOs[];
  editavel: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<VisitaOs | null>(null);
  const aberta = visitas.find((v) => !v.saida);
  const totalHoras = visitas.reduce((acc, v) => acc + (v.horas ?? 0), 0);

  const executar = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Feito.");
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Visitas e horas</CardTitle>
        <span className="text-muted-foreground text-sm">Total: {formatNumero(totalHoras)} h</span>
      </CardHeader>
      <CardContent className="grid gap-3">
        {aberta ? (
          <div className="bg-primary/5 border-primary/30 flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <Clock className="text-primary size-5" />
            <div className="min-w-48 flex-1 text-sm">
              <div className="font-medium">Em atendimento desde {formatDataHora(aberta.chegada)}</div>
              <div className="text-muted-foreground">
                Tempo no local: <Cronometro desde={aberta.chegada} />
              </div>
            </div>
            {editavel ? (
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                disabled={pending}
                onClick={() => executar(() => registrarSaida(aberta.id))}
              >
                {pending ? <Spinner /> : <LogOut />} Registrar saída
              </Button>
            ) : null}
          </div>
        ) : editavel ? (
          <Button
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => executar(() => iniciarVisita(osId))}
          >
            {pending ? <Spinner /> : <LogIn />}
            {visitas.length ? "Nova visita (retorno)" : "Registrar chegada"}
          </Button>
        ) : null}

        {visitas.length ? (
          <ul className="divide-y rounded-lg border">
            {visitas.map((v, i) => (
              <li key={v.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-muted-foreground w-6 text-xs">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div>
                    {formatDataHora(v.chegada)} → {v.saida ? formatDataHora(v.saida) : "em andamento"}
                  </div>
                </div>
                <span className="tabular-nums">{v.horas != null ? `${formatNumero(v.horas)} h` : "—"}</span>
                {editavel ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ajustar visita ${i + 1}`}
                    onClick={() => setEditando(v)}
                  >
                    <Pencil />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Nenhuma visita registrada ainda.</p>
        )}
      </CardContent>

      {editando ? (
        <AjusteVisitaDialog
          key={editando.id}
          visita={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      ) : null}
    </Card>
  );
}

function AjusteVisitaDialog({
  visita,
  onFechar,
  onSalvo,
}: {
  visita: VisitaOs;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [chegada, setChegada] = useState(paraInputDataHora(visita.chegada));
  const [saida, setSaida] = useState(paraInputDataHora(visita.saida));
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar horários</DialogTitle>
          <DialogDescription>
            As horas trabalhadas são recalculadas a partir da chegada e da saída.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="aj-chegada">Chegada</Label>
            <Input
              id="aj-chegada"
              type="datetime-local"
              value={chegada}
              onChange={(e) => setChegada(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="aj-saida">Saída</Label>
            <Input
              id="aj-saida"
              type="datetime-local"
              value={saida}
              onChange={(e) => setSaida(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await ajustarVisita(visita.id, { chegada, saida });
                if (r.ok) {
                  toast.success(r.message);
                  onSalvo();
                } else toast.error(r.error);
              })
            }
          >
            {pending ? <Spinner /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
