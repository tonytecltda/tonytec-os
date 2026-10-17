"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { somenteDigitos } from "@/lib/masks";

export type DadosCompartilhar = {
  titulo: string;
  descricao: React.ReactNode;
  link: string;
  mensagem: string;
  assunto: string;
  telefone?: string | null;
  email?: string | null;
};

/** Mostra um link para enviar por WhatsApp, e-mail ou copiar. */
export function CompartilharLinkDialog({
  dados,
  onClose,
}: {
  dados: DadosCompartilhar | null;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  if (!dados) return null;

  const telefone = somenteDigitos(dados.telefone);
  const whatsapp = `https://wa.me/${telefone ? (telefone.length <= 11 ? `55${telefone}` : telefone) : ""}?text=${encodeURIComponent(dados.mensagem)}`;
  const email = `mailto:${dados.email ?? ""}?subject=${encodeURIComponent(dados.assunto)}&body=${encodeURIComponent(dados.mensagem)}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(dados.link);
      setCopiado(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dados.titulo}</DialogTitle>
          <DialogDescription>{dados.descricao}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={dados.link} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Link" />
          <Button type="button" variant="outline" size="icon" onClick={copiar} aria-label="Copiar link">
            {copiado ? <Check /> : <Copy />}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" asChild>
            <a href={email}>
              <Mail /> E-mail
            </a>
          </Button>
          <Button asChild>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Enviar por WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
