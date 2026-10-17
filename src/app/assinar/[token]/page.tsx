import { LinkIcon } from "lucide-react";
import { assinarPorLink } from "@/actions/os";
import { dadosCompletosOs, resumoDeDadosCompletos } from "@/lib/os";
import { LIMITES, MSG_MUITAS_TENTATIVAS, dentroDoLimite, ipDoCliente } from "@/lib/rate-limit";
import { validarTokenAssinatura } from "@/lib/os-tokens";
import { formatDataHora } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { ResumoOsCard } from "@/components/os/resumo-os";
import { AssinaturaClienteForm } from "@/components/os/assinatura-cliente-form";

// Encerrar a OS gera o PDF no servidor.
export const maxDuration = 60;

export default async function AssinarPorLinkPage({ params }: PageProps<"/assinar/[token]">) {
  const { token } = await params;
  if (!(await dentroDoLimite("assinar-ver", await ipDoCliente(), LIMITES.linkAssinaturaVer))) {
    return (
      <div className="pt-8">
        <EmptyState icon={LinkIcon} titulo="Muitas tentativas" descricao={MSG_MUITAS_TENTATIVAS} />
      </div>
    );
  }
  const v = await validarTokenAssinatura(token);
  if (!v.ok) {
    return (
      <div className="pt-8">
        <EmptyState icon={LinkIcon} titulo="Não foi possível abrir a assinatura" descricao={v.erro} />
      </div>
    );
  }

  const dados = await dadosCompletosOs(v.token.osId);
  if (!dados) {
    return (
      <div className="pt-8">
        <EmptyState icon={LinkIcon} titulo="Ordem de serviço não encontrada" />
      </div>
    );
  }
  const resumo = await resumoDeDadosCompletos(dados);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ordem de serviço {dados.os.numero}</h1>
        <p className="text-muted-foreground text-sm">
          Confira os dados do atendimento e assine no final. Link válido até{" "}
          {formatDataHora(v.token.expiraEm)}.
        </p>
      </div>
      <ResumoOsCard r={resumo} />
      <AssinaturaClienteForm acao={assinarPorLink.bind(null, token)} termo={dados.assinatura.termo_aceite} />
    </div>
  );
}
