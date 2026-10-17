"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, FileSignature, Link2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CompartilharLinkDialog, type DadosCompartilhar } from "@/components/compartilhar-link-dialog";
import { assinarNoLocal, gerarLinkAssinatura } from "@/actions/os";
import { formatDataHora } from "@/lib/format";
import { useCamposAssinaturaCliente, useCamposAssinaturaTecnico } from "./campos-assinatura";

const SEM_DESENHO = { usarSalva: false, imagem: null, salvarComoPadrao: false };

export function ColetaAssinaturas({
  osId,
  numero,
  termo,
  urlAssinaturaSalva,
  tecnicoJaAssinou,
}: {
  osId: string;
  numero: string;
  termo: string;
  urlAssinaturaSalva: string | null;
  tecnicoJaAssinou: boolean;
}) {
  const router = useRouter();
  const tecnico = useCamposAssinaturaTecnico(urlAssinaturaSalva);
  const cliente = useCamposAssinaturaCliente();
  const [motivo, setMotivo] = useState("");
  const [link, setLink] = useState<DadosCompartilhar | null>(null);
  const [pending, startTransition] = useTransition();

  /** Assinatura do técnico (ou nada, se ele já assinou este conteúdo). */
  const dadosTecnico = () => (tecnicoJaAssinou ? SEM_DESENHO : tecnico.coletar());

  const encerrar = (comCliente: boolean) =>
    startTransition(async () => {
      const t = dadosTecnico();
      if (typeof t === "string") return void toast.error(t);
      let dadosCliente = null;
      if (comCliente) {
        const c = await cliente.coletar();
        if (typeof c === "string") return void toast.error(c);
        dadosCliente = c;
      } else if (motivo.trim().length < 5) {
        return void toast.error("Descreva o motivo (mínimo 5 caracteres).");
      }
      const r = await assinarNoLocal(osId, {
        tecnico: t,
        cliente: dadosCliente,
        recusa: comCliente ? null : motivo.trim(),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message);
      if (!r.data.pdf)
        toast.warning("A OS foi encerrada, mas o PDF não foi gerado. A Tonytec pode gerá-lo novamente.");
      router.refresh();
    });

  const enviarLink = () =>
    startTransition(async () => {
      const t = tecnicoJaAssinou ? null : dadosTecnico();
      if (typeof t === "string") return void toast.error(t);
      const r = await gerarLinkAssinatura(osId, t);
      if (!r.ok) return void toast.error(r.error);
      const validade = formatDataHora(r.data.expiraEm);
      setLink({
        titulo: "Link para o cliente assinar",
        descricao: (
          <>
            O cliente confere a OS e assina pelo celular. O link vale até <strong>{validade}</strong>.
          </>
        ),
        link: r.data.link,
        assunto: `Assinatura da Ordem de Serviço ${numero}`,
        mensagem: `Olá! Segue o link para conferir e assinar a Ordem de Serviço ${numero} (válido até ${validade}):\n\n${r.data.link}`,
        telefone: r.data.telefone,
        email: r.data.email,
      });
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Termo de aceite</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">{termo}</p>
        </CardContent>
      </Card>

      {!tecnicoJaAssinou ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Sua assinatura (técnico)</CardTitle>
          </CardHeader>
          <CardContent>{tecnico.campos}</CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">✓ Assinatura do técnico já registrada.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {tecnicoJaAssinou ? "Assinatura do cliente" : "2. Assinatura do cliente"}
          </CardTitle>
          <CardDescription>Escolha como o cliente vai assinar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="aqui">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="aqui">
                <PenLine /> No local
              </TabsTrigger>
              <TabsTrigger value="link">
                <Link2 /> Link
              </TabsTrigger>
              <TabsTrigger value="recusa">
                <Ban /> Recusou
              </TabsTrigger>
            </TabsList>
            <TabsContent value="aqui" className="grid gap-4 pt-4">
              {cliente.campos}
              <Button size="lg" onClick={() => encerrar(true)} disabled={pending}>
                {pending ? <Spinner /> : <FileSignature />} Assinar e encerrar a OS
              </Button>
            </TabsContent>
            <TabsContent value="link" className="grid gap-3 pt-4">
              <p className="text-muted-foreground text-sm">
                Gere um link seguro e envie por WhatsApp ou e-mail. A OS é encerrada automaticamente quando o
                cliente assinar.
              </p>
              <Button size="lg" variant="outline" onClick={enviarLink} disabled={pending}>
                {pending ? <Spinner /> : <Link2 />} Gerar link de assinatura
              </Button>
            </TabsContent>
            <TabsContent value="recusa" className="grid gap-3 pt-4">
              <div className="grid gap-1.5">
                <Label htmlFor="motivo-recusa">Motivo (fica registrado no PDF)</Label>
                <Textarea
                  id="motivo-recusa"
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: responsável ausente; cliente não quis assinar"
                />
              </div>
              <Button size="lg" variant="destructive" onClick={() => encerrar(false)} disabled={pending}>
                {pending ? <Spinner /> : <Ban />} Encerrar sem assinatura do cliente
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CompartilharLinkDialog dados={link} onClose={() => setLink(null)} />
    </div>
  );
}
