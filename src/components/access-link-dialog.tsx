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

export type LinkAcesso = { link: string; nome: string; email: string; telefone?: string | null };

/**
 * Mostra o link de definição de senha para o admin enviar ao usuário
 * (WhatsApp, e-mail ou copiar). O link vale 24 horas e é de uso único.
 */
export function AccessLinkDialog({ dados, onClose }: { dados: LinkAcesso | null; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false);
  if (!dados) return null;

  const primeiroNome = dados.nome.split(" ")[0] || dados.nome;
  const mensagem =
    `Olá, ${primeiroNome}! Seu acesso ao sistema de chamados da Tonytec está pronto. ` +
    `Abra o link abaixo para criar sua senha (válido por 24 horas):\n\n${dados.link}\n\n` +
    `Depois, entre sempre com o e-mail ${dados.email}.`;

  const telefone = somenteDigitos(dados.telefone);
  const whatsapp = `https://wa.me/${telefone ? (telefone.length <= 11 ? `55${telefone}` : telefone) : ""}?text=${encodeURIComponent(mensagem)}`;
  const email = `mailto:${dados.email}?subject=${encodeURIComponent("Seu acesso ao Tonytec OS")}&body=${encodeURIComponent(mensagem)}`;

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
          <DialogTitle>Link de acesso de {dados.nome}</DialogTitle>
          <DialogDescription>
            Envie este link para o usuário criar a senha. Ele vale por <strong>24 horas</strong> e só pode ser
            usado uma vez. Se expirar, gere outro.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={dados.link}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Link de acesso"
          />
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
