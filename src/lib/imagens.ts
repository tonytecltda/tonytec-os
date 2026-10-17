/**
 * Reduz fotos grandes no navegador antes do envio (economiza dados móveis e
 * armazenamento). Mantém o arquivo original se não for vantajoso ou se o
 * navegador não conseguir decodificar o formato (ex.: HEIC no Chrome).
 */
export async function comprimirImagem(arquivo: File, ladoMaximo = 2048, qualidade = 0.82): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size < 1_500_000) return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.fillStyle = "#ffffff"; // PNG transparente vira fundo branco no JPEG
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
    if (!blob || blob.size >= arquivo.size) return arquivo;
    const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg", lastModified: arquivo.lastModified });
  } catch {
    return arquivo;
  }
}
