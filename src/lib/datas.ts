/**
 * "2026-10-20T14:30" (input datetime-local, horário de Brasília) -> ISO com fuso.
 * O Brasil não tem horário de verão desde 2019: o deslocamento é sempre -03:00.
 */
export function localParaIso(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return `${valor}:00-03:00`;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
