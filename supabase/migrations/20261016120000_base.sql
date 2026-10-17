-- =====================================================================
-- Tonytec OS — 001: extensões, schema privado e tipos enum
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Schema "private": funções auxiliares de segurança e contadores.
-- NÃO é exposto pela API (PostgREST), só é usado por policies e triggers.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create type public.user_role as enum ('admin', 'tecnico', 'cliente');

create type public.contrato_tipo as enum ('avulso', 'manutencao_mensal', 'sla_visitas');
create type public.politica_excedente as enum ('valor_unico', 'valor_hora', 'isento');
create type public.contrato_status as enum ('ativo', 'suspenso', 'encerrado');

create type public.chamado_prioridade as enum ('baixa', 'media', 'alta', 'urgente');
create type public.chamado_status as enum (
  'aberto', 'triagem', 'agendado', 'em_atendimento',
  'aguardando_cliente', 'aguardando_peca', 'resolvido', 'cancelado'
);
create type public.chamado_origem as enum ('portal', 'admin', 'telefone', 'whatsapp');

create type public.os_tipo_atendimento as enum ('corretivo', 'preventivo', 'instalacao', 'vistoria', 'outro');
create type public.os_status as enum (
  'rascunho', 'em_execucao', 'concluida', 'aguardando_assinatura', 'assinada', 'cancelada'
);
create type public.cobranca_tipo as enum (
  'isento_contrato', 'valor_unico', 'valor_por_hora', 'garantia', 'cortesia'
);
create type public.os_item_tipo as enum ('material', 'equipamento', 'mao_de_obra', 'servico');
create type public.os_anexo_tipo as enum ('foto_antes', 'foto_depois', 'documento', 'outro');
create type public.assinatura_tipo as enum ('cliente', 'tecnico');
