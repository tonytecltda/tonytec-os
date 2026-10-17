"use client";

import { useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MaskedInput } from "@/components/forms/masked-input";
import { QuadroAssinatura, type QuadroAssinaturaHandle } from "./quadro-assinatura";

export type DadosAssinaturaCliente = {
  nome: string;
  documento: string;
  cargo: string;
  imagem: string;
  aceite: true;
  geo: { lat: number; lng: number } | null;
};

/** Pede a posição só com consentimento explícito (LGPD). */
function obterPosicao(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

/**
 * Campos da assinatura do cliente: nome, documento, cargo, quadro, aceite do termo
 * e localização opcional. `coletar()` valida e devolve os dados (ou uma mensagem de erro).
 */
export function useCamposAssinaturaCliente(nomeSugerido = "") {
  const quadro = useRef<QuadroAssinaturaHandle>(null);
  const [nome, setNome] = useState(nomeSugerido);
  const [documento, setDocumento] = useState("");
  const [cargo, setCargo] = useState("");
  const [aceite, setAceite] = useState(false);
  const [geoAtivo, setGeoAtivo] = useState(false);

  const coletar = async (): Promise<DadosAssinaturaCliente | string> => {
    if (nome.trim().length < 3) return "Informe o nome de quem assina.";
    const imagem = quadro.current?.imagem();
    if (!imagem) return "Faça a assinatura no quadro.";
    if (!aceite) return "É preciso concordar com o termo de aceite.";
    const geo = geoAtivo ? await obterPosicao() : null;
    return { nome: nome.trim(), documento: documento.trim(), cargo: cargo.trim(), imagem, aceite: true, geo };
  };

  const campos = (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5 sm:col-span-3">
          <Label htmlFor="as-nome">Nome de quem assina</Label>
          <Input id="as-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="as-doc">CPF ou RG (opcional)</Label>
          <MaskedInput id="as-doc" mascara="documento" value={documento} onChange={setDocumento} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="as-cargo">Cargo (opcional)</Label>
          <Input
            id="as-cargo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Ex.: Síndico"
          />
        </div>
      </div>
      <QuadroAssinatura ref={quadro} rotulo="Assinatura do cliente" />
      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={aceite} onCheckedChange={(v) => setAceite(v === true)} className="mt-0.5" />
        <span>Li e concordo com o termo de aceite acima.</span>
      </label>
      <label className="text-muted-foreground flex items-center gap-2 text-xs">
        <Switch checked={geoAtivo} onCheckedChange={setGeoAtivo} aria-label="Registrar localização" />
        <MapPin className="size-3.5" />
        Registrar a localização desta assinatura (opcional)
      </label>
    </div>
  );

  return { campos, coletar };
}

export type DadosAssinaturaTecnico = { usarSalva: boolean; imagem: string | null; salvarComoPadrao: boolean };

/** Assinatura do técnico: usa a salva no perfil ou desenha na hora. */
export function useCamposAssinaturaTecnico(urlSalva: string | null) {
  const quadro = useRef<QuadroAssinaturaHandle>(null);
  const [usarSalva, setUsarSalva] = useState(!!urlSalva);
  const [salvarComoPadrao, setSalvarComoPadrao] = useState(!urlSalva);

  const coletar = (): DadosAssinaturaTecnico | string => {
    if (usarSalva && urlSalva) return { usarSalva: true, imagem: null, salvarComoPadrao: false };
    const imagem = quadro.current?.imagem();
    if (!imagem) return "Faça a assinatura do técnico.";
    return { usarSalva: false, imagem, salvarComoPadrao };
  };

  const campos = (
    <div className="grid gap-3">
      {urlSalva ? (
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={usarSalva} onCheckedChange={setUsarSalva} />
          Usar minha assinatura salva
        </label>
      ) : null}
      {usarSalva && urlSalva ? (
        <div className="grid h-24 place-items-center rounded-lg border bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlSalva} alt="Sua assinatura salva" className="max-h-20 object-contain" />
        </div>
      ) : (
        <>
          <QuadroAssinatura ref={quadro} rotulo="Assinatura do técnico" />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={salvarComoPadrao} onCheckedChange={(v) => setSalvarComoPadrao(v === true)} />
            Salvar como minha assinatura padrão
          </label>
        </>
      )}
    </div>
  );

  return { campos, coletar };
}
