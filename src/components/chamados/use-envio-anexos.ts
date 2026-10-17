"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagem } from "@/lib/imagens";
import { validarArquivo } from "@/lib/anexos";
import { prepararUploadAnexo, registrarAnexo } from "@/actions/chamados";

export type ResultadoEnvio = { enviados: number; erros: string[] };

/**
 * Envia anexos de um chamado: comprime fotos grandes, pede uma URL assinada ao
 * servidor, sobe o arquivo direto para o Storage e registra no banco.
 */
export function useEnvioAnexos() {
  const supabase = useMemo(() => createClient(), []);

  return async function enviar(
    chamadoId: string,
    arquivos: File[],
    aoProgredir?: (atual: number, total: number, nome: string) => void,
  ): Promise<ResultadoEnvio> {
    const erros: string[] = [];
    let enviados = 0;

    for (const [i, original] of arquivos.entries()) {
      const invalido = validarArquivo(original);
      if (invalido) {
        erros.push(invalido);
        continue;
      }
      aoProgredir?.(i + 1, arquivos.length, original.name);
      const arquivo = await comprimirImagem(original);
      const meta = { nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size };

      const preparo = await prepararUploadAnexo(chamadoId, meta);
      if (!preparo.ok) {
        erros.push(`“${original.name}”: ${preparo.error}`);
        continue;
      }
      const { error } = await supabase.storage
        .from("chamado-anexos")
        .uploadToSignedUrl(preparo.data.path, preparo.data.token, arquivo, { contentType: arquivo.type });
      if (error) {
        erros.push(`“${original.name}”: falha no envio. Verifique a conexão e tente de novo.`);
        continue;
      }
      const registro = await registrarAnexo(chamadoId, { ...meta, path: preparo.data.path });
      if (!registro.ok) {
        erros.push(`“${original.name}”: ${registro.error}`);
        continue;
      }
      enviados++;
    }
    return { enviados, erros };
  };
}
