-- =====================================================================
-- Tonytec OS — 012: pendência sem texto pode existir no rascunho
-- O salvamento automático grava estados intermediários (o técnico liga
-- "pendências" e ainda vai digitar). A exigência do texto passa a ser
-- validada ao concluir a OS (Server Action concluirOs).
-- =====================================================================

alter table public.ordens_servico drop constraint if exists os_pendencia_exige_texto;
