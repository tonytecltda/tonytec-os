/** Regras de anexos compartilhadas entre navegador e servidor. */

export const ANEXO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
export const ANEXOS_POR_ENVIO = 5;

export const ANEXO_TIPOS: Record<string, string> = {
  "image/jpeg": "Foto",
  "image/png": "Imagem",
  "image/webp": "Imagem",
  "image/heic": "Foto",
  "image/heif": "Foto",
  "video/mp4": "Vídeo",
  "video/quicktime": "Vídeo",
  "video/webm": "Vídeo",
  "application/pdf": "PDF",
};

export const ANEXO_ACCEPT = Object.keys(ANEXO_TIPOS).join(",");

export function validarArquivo(arquivo: { name: string; type: string; size: number }): string | null {
  if (!ANEXO_TIPOS[arquivo.type]) return `“${arquivo.name}”: use foto, vídeo (MP4/MOV) ou PDF.`;
  if (arquivo.size > ANEXO_MAX_BYTES) return `“${arquivo.name}” tem mais de 20 MB.`;
  if (arquivo.size === 0) return `“${arquivo.name}” está vazio.`;
  return null;
}

/** Nome seguro para o caminho no Storage (sem acentos/espaços). */
export function nomeSeguro(nome: string) {
  const semAcento = nome.normalize("NFD").replace(/\p{M}/gu, "");
  const limpo = semAcento.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return limpo.slice(-80) || "arquivo";
}

export function tamanhoLegivel(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export const ehImagem = (mime: string | null | undefined) => !!mime && mime.startsWith("image/");
export const ehVideo = (mime: string | null | undefined) => !!mime && mime.startsWith("video/");
