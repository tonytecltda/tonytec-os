"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, Pencil, Phone, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AtivoBadge } from "@/components/status-badge";
import { enderecoCompleto, linkRotaMaps } from "@/lib/endereco";
import { definirAtivoUnidade } from "../actions";
import { UnidadeDialog, type UnidadeEditavel } from "./unidade-dialog";

export type UnidadeLinha = UnidadeEditavel & { ativo: boolean };

export function UnidadesLista({ clienteId, unidades }: { clienteId: string; unidades: UnidadeLinha[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<UnidadeLinha | null>(null);
  const [alternando, setAlternando] = useState<UnidadeLinha | null>(null);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {unidades.map((u) => {
          const maps = linkRotaMaps(u);
          return (
            <Card key={u.id} className={u.ativo ? undefined : "opacity-60"}>
              <CardContent className="grid gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{u.nome}</div>
                  <AtivoBadge ativo={u.ativo} />
                </div>
                <p className="text-muted-foreground flex gap-1.5 text-sm">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  <span>{enderecoCompleto(u) || "Endereço não informado"}</span>
                </p>
                {u.contato_local || u.telefone_local ? (
                  <p className="text-muted-foreground flex gap-1.5 text-sm">
                    <Phone className="mt-0.5 size-3.5 shrink-0" />
                    <span>{[u.contato_local, u.telefone_local].filter(Boolean).join(" · ")}</span>
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" onClick={() => setEditando(u)}>
                    <Pencil /> Editar
                  </Button>
                  {maps ? (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={maps} target="_blank" rel="noopener noreferrer">
                        <Navigation /> Rota
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={u.ativo ? "text-destructive" : undefined}
                    onClick={() => setAlternando(u)}
                  >
                    {u.ativo ? <PowerOff /> : <Power />}
                    {u.ativo ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editando ? (
        <UnidadeDialog
          key={editando.id}
          clienteId={clienteId}
          unidade={editando}
          open
          onOpenChange={(o) => !o && setEditando(null)}
        />
      ) : null}
      {alternando ? (
        <ConfirmDialog
          key={alternando.id}
          open
          onOpenChange={(o) => !o && setAlternando(null)}
          titulo={alternando.ativo ? `Desativar "${alternando.nome}"?` : `Reativar "${alternando.nome}"?`}
          descricao={
            alternando.ativo
              ? "A unidade deixa de aparecer para abrir chamados. O histórico é mantido."
              : "A unidade volta a aparecer para abrir chamados."
          }
          confirmar={alternando.ativo ? "Desativar" : "Reativar"}
          destrutivo={alternando.ativo}
          acao={() => definirAtivoUnidade(alternando.id, !alternando.ativo)}
          onSucesso={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
