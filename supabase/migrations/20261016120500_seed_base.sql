-- =====================================================================
-- Tonytec OS — 006: dados base (categorias, tipos de problema, configurações)
-- Idempotente: pode rodar mais de uma vez.
-- =====================================================================

insert into public.categorias_servico (nome, ordem) values
  ('Câmeras/CFTV', 1),
  ('Central Telefônica', 2),
  ('Portão Eletrônico', 3),
  ('Controle de Acesso', 4),
  ('Outros', 99)
on conflict (nome) do nothing;

insert into public.tipos_problema (categoria_id, nome)
select c.id, t.nome
from (values
  ('Câmeras/CFTV', 'Câmera sem imagem'),
  ('Câmeras/CFTV', 'Imagem com chuvisco/interferência'),
  ('Câmeras/CFTV', 'HD cheio/defeito'),
  ('Câmeras/CFTV', 'DVR/NVR não grava'),
  ('Câmeras/CFTV', 'Sem acesso remoto (app/celular)'),
  ('Câmeras/CFTV', 'Visão noturna (infravermelho) com falha'),
  ('Central Telefônica', 'Ramal sem registrar'),
  ('Central Telefônica', 'Ramal mudo/sem linha'),
  ('Central Telefônica', 'Linha externa sem sinal'),
  ('Central Telefônica', 'Configuração de URA/atendimento'),
  ('Central Telefônica', 'Inclusão/alteração de ramal'),
  ('Portão Eletrônico', 'Portão não abre'),
  ('Portão Eletrônico', 'Motor travado'),
  ('Portão Eletrônico', 'Controle remoto não funciona'),
  ('Portão Eletrônico', 'Portão abre/fecha sozinho'),
  ('Portão Eletrônico', 'Cremalheira/engrenagem danificada'),
  ('Controle de Acesso', 'Biometria não lê'),
  ('Controle de Acesso', 'Fechadura eletroímã não trava'),
  ('Controle de Acesso', 'Cadastro de usuários/cartões'),
  ('Controle de Acesso', 'Interfone/vídeo porteiro sem áudio'),
  ('Controle de Acesso', 'Catraca travada'),
  ('Outros', 'Instalação nova'),
  ('Outros', 'Manutenção preventiva'),
  ('Outros', 'Orçamento/vistoria técnica')
) as t(categoria, nome)
join public.categorias_servico c on c.nome = t.categoria
on conflict (categoria_id, nome) do nothing;

insert into public.configuracoes (chave, valor, descricao) values
  ('empresa', jsonb_build_object(
      'razao_social', 'Tonytec Ltda',
      'nome_fantasia', 'Tonytec',
      'cnpj', '',
      'endereco', '',
      'telefone', '',
      'email', '',
      'site', '',
      'logo_path', null
   ), 'Dados da empresa exibidos no sistema e no PDF da OS'),
  ('cobranca', jsonb_build_object(
      'valor_hora_padrao', 150.00,
      'valor_visita_padrao', 180.00,
      'minimo_horas_cobraveis', 1,
      'fracao_minutos', 15
   ), 'Valores padrão de cobrança de visitas (ajustar em Configurações)'),
  ('sla_padrao', jsonb_build_object(
      'urgente', jsonb_build_object('resposta', 1,  'solucao', 4),
      'alta',    jsonb_build_object('resposta', 4,  'solucao', 8),
      'media',   jsonb_build_object('resposta', 8,  'solucao', 24),
      'baixa',   jsonb_build_object('resposta', 24, 'solucao', 72)
   ), 'Prazos de SLA (horas úteis) por prioridade, quando o contrato não define'),
  ('sla_horario_comercial', jsonb_build_object(
      'ativo', true,
      'dias', jsonb_build_array(1, 2, 3, 4, 5),
      'inicio', '08:00',
      'fim', '18:00'
   ), 'Horário comercial para contagem do SLA (1=segunda ... 7=domingo)'),
  ('assinatura', jsonb_build_object(
      'termo_aceite',
      'Declaro que os serviços descritos nesta Ordem de Serviço foram executados e conferidos, '
      || 'e que os equipamentos foram entregues em funcionamento, salvo as pendências registradas. '
      || 'Autorizo o registro desta assinatura eletrônica, com data, hora e identificação do dispositivo, '
      || 'para fins de comprovação do atendimento, nos termos da LGPD.',
      'validade_link_horas', 72
   ), 'Termo de aceite exibido na assinatura da OS'),
  ('pdf', jsonb_build_object(
      'rodape', 'Tonytec Ltda — CFTV • Centrais Telefônicas • Portões Eletrônicos • Controle de Acesso',
      'exibir_valores', true
   ), 'Configurações do PDF da OS')
on conflict (chave) do nothing;
