export type Endereco = {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
};

/** "Rua X, 100 (apto 2) · Centro — São Paulo/SP · 01000-000" */
export function enderecoCompleto(u: Endereco) {
  const linha1 = [u.logradouro, u.numero].filter(Boolean).join(", ");
  const linha2 = [u.bairro, [u.cidade, u.uf].filter(Boolean).join("/")].filter(Boolean).join(" — ");
  return [linha1 + (u.complemento ? ` (${u.complemento})` : ""), linha2, u.cep]
    .filter((p) => p && p.trim())
    .join(" · ");
}

/** Link de rota no Google Maps até o endereço (null se não houver endereço). */
export function linkRotaMaps(u: Endereco) {
  const q = [u.logradouro, u.numero, u.bairro, u.cidade, u.uf, u.cep].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : null;
}
