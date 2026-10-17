-- =====================================================================
-- Tonytec OS — 005: buckets do Storage
--
-- Todos os buckets de dados são PRIVADOS e SEM policies para usuários:
-- o servidor (service_role) valida a permissão via RLS das tabelas e emite
-- URLs assinadas de curta duração (download) ou signed upload URLs (envio).
-- Assim o navegador nunca acessa o Storage sem passar pela checagem do servidor.
--
-- Convenção de caminhos:
--   chamado-anexos/{cliente_id}/{chamado_id}/{uuid}-{arquivo}
--   os-anexos/{cliente_id}/{os_id}/{uuid}-{arquivo}
--   assinaturas/os/{os_id}/{tipo}-{uuid}.png  |  assinaturas/perfis/{profile_id}.png
--   os-pdfs/{cliente_id}/{os_id}/{numero}-v{n}.pdf
--   empresa/logo.{ext}  (público: logo usada no login e no PDF)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('chamado-anexos', 'chamado-anexos', false, 20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
          'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf']),
  ('os-anexos', 'os-anexos', false, 20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
          'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf']),
  ('assinaturas', 'assinaturas', false, 2097152, array['image/png']),
  ('os-pdfs', 'os-pdfs', false, 20971520, array['application/pdf']),
  ('empresa', 'empresa', true, 5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
