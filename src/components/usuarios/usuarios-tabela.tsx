"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, MoreHorizontal, Pencil, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccessLinkDialog, type LinkAcesso } from "@/components/access-link-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AtivoBadge } from "@/components/status-badge";
import { definirAtivoUsuario, gerarLinkAcesso } from "@/app/admin/usuarios/actions";
import { formatDataHora } from "@/lib/format";
import type { UserRole } from "@/lib/roles";
import { UsuarioDialog } from "./usuario-dialog";

export type UsuarioLinha = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  ultimoAcesso: string | null;
};

/** Tabela de usuários com ações: editar, gerar link de acesso, desativar/reativar. */
export function UsuariosTabela({
  usuarios,
  role,
  usuarioAtualId,
}: {
  usuarios: UsuarioLinha[];
  role: UserRole;
  usuarioAtualId?: string;
}) {
  const router = useRouter();
  const [link, setLink] = useState<LinkAcesso | null>(null);
  const [editando, setEditando] = useState<UsuarioLinha | null>(null);
  const [alternando, setAlternando] = useState<UsuarioLinha | null>(null);
  const [pending, startTransition] = useTransition();

  const pedirLink = (id: string) =>
    startTransition(async () => {
      const r = await gerarLinkAcesso(id);
      if (r.ok) setLink(r.data);
      else toast.error(r.error);
    });

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead className="hidden md:table-cell">Telefone</TableHead>
              <TableHead className="hidden md:table-cell">Último acesso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id} className={u.ativo ? undefined : "opacity-60"}>
                <TableCell className="font-medium">
                  {u.nome}
                  {u.id === usuarioAtualId ? <span className="text-muted-foreground"> (você)</span> : null}
                </TableCell>
                <TableCell className="max-w-48 truncate">{u.email}</TableCell>
                <TableCell className="hidden md:table-cell">{u.telefone || "—"}</TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {u.ultimoAcesso ? formatDataHora(u.ultimoAcesso) : "Nunca acessou"}
                </TableCell>
                <TableCell>
                  <AtivoBadge ativo={u.ativo} />
                </TableCell>
                <TableCell>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Ações de ${u.nome}`}
                        disabled={pending}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditando(u)}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      {u.ativo ? (
                        <DropdownMenuItem onSelect={() => pedirLink(u.id)}>
                          <KeyRound /> Gerar link de acesso
                        </DropdownMenuItem>
                      ) : null}
                      {u.id !== usuarioAtualId ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant={u.ativo ? "destructive" : "default"}
                            onSelect={() => setAlternando(u)}
                          >
                            {u.ativo ? <PowerOff /> : <Power />}
                            {u.ativo ? "Desativar" : "Reativar"}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editando ? (
        <UsuarioDialog
          key={editando.id}
          role={role}
          usuario={editando}
          open
          onOpenChange={(o) => !o && setEditando(null)}
        />
      ) : null}

      {alternando ? (
        <ConfirmDialog
          key={alternando.id}
          open
          onOpenChange={(o) => !o && setAlternando(null)}
          titulo={alternando.ativo ? `Desativar ${alternando.nome}?` : `Reativar ${alternando.nome}?`}
          descricao={
            alternando.ativo
              ? "O usuário perde o acesso imediatamente. O histórico é mantido."
              : "O usuário volta a poder entrar com a senha atual."
          }
          confirmar={alternando.ativo ? "Desativar" : "Reativar"}
          destrutivo={alternando.ativo}
          pedirMotivo={alternando.ativo}
          acao={(motivo) => definirAtivoUsuario(alternando.id, !alternando.ativo, motivo)}
          onSucesso={() => router.refresh()}
        />
      ) : null}

      <AccessLinkDialog dados={link} onClose={() => setLink(null)} />
    </>
  );
}
