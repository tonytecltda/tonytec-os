import { MapPin, Navigation, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enderecoCompleto, linkRotaMaps, type Endereco } from "@/lib/endereco";
import { formatDataHora } from "@/lib/format";
import { somenteDigitos } from "@/lib/masks";
import { slaDoChamado } from "@/lib/sla";
import { SlaBadge } from "./badges";

/** Endereço e contato da unidade, com rota no Google Maps e ligação. */
export function UnidadeInfo({
  unidade,
  telefoneContato,
}: {
  unidade:
    | (Endereco & {
        nome: string;
        contato_local?: string | null;
        telefone_local?: string | null;
        referencia?: string | null;
      })
    | null;
  telefoneContato?: string | null;
}) {
  if (!unidade) return <p className="text-muted-foreground text-sm">Unidade não informada.</p>;
  const rota = linkRotaMaps(unidade);
  const telefone = telefoneContato || unidade.telefone_local;
  return (
    <div className="grid gap-2 text-sm">
      <div className="font-medium">{unidade.nome}</div>
      <p className="text-muted-foreground flex gap-1.5">
        <MapPin className="mt-0.5 size-3.5 shrink-0" />
        <span>{enderecoCompleto(unidade) || "Endereço não informado"}</span>
      </p>
      {unidade.referencia ? (
        <p className="text-muted-foreground text-xs">Referência: {unidade.referencia}</p>
      ) : null}
      {unidade.contato_local ? (
        <p className="text-muted-foreground flex gap-1.5">
          <UserRound className="mt-0.5 size-3.5 shrink-0" />
          {unidade.contato_local}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-2">
        {rota ? (
          <Button size="sm" asChild>
            <a href={rota} target="_blank" rel="noopener noreferrer">
              <Navigation /> Rota
            </a>
          </Button>
        ) : null}
        {telefone ? (
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${somenteDigitos(telefone)}`}>
              <Phone /> {telefone}
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type ChamadoSlaInfo = Parameters<typeof slaDoChamado>[0];

/** Prazos de resposta e solução com a situação atual. */
export function SlaPainel({ chamado }: { chamado: ChamadoSlaInfo }) {
  const { resposta, solucao } = slaDoChamado(chamado);
  return (
    <dl className="grid gap-3 text-sm">
      <div className="grid gap-1">
        <dt className="text-muted-foreground text-xs">Primeira resposta até</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <span>{formatDataHora(chamado.sla_resposta_ate)}</span>
          <SlaBadge sla={resposta} />
        </dd>
        {chamado.primeira_resposta_em ? (
          <dd className="text-muted-foreground text-xs">
            Respondido em {formatDataHora(chamado.primeira_resposta_em)}
          </dd>
        ) : null}
      </div>
      <div className="grid gap-1">
        <dt className="text-muted-foreground text-xs">Solução até</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <span>{formatDataHora(chamado.sla_solucao_ate)}</span>
          <SlaBadge sla={solucao} />
        </dd>
        {chamado.resolvido_em ? (
          <dd className="text-muted-foreground text-xs">
            Resolvido em {formatDataHora(chamado.resolvido_em)}
          </dd>
        ) : null}
      </div>
    </dl>
  );
}
