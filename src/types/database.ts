export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          acao: string
          autor_id: string | null
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          id: number
          motivo: string | null
          registro_id: string | null
          tabela: string
        }
        Insert: {
          acao: string
          autor_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: never
          motivo?: string | null
          registro_id?: string | null
          tabela: string
        }
        Update: {
          acao?: string
          autor_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: never
          motivo?: string | null
          registro_id?: string | null
          tabela?: string
        }
        Relationships: []
      }
      categorias_servico: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      chamado_anexos: {
        Row: {
          chamado_id: string
          created_at: string
          enviado_por: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
        }
        Insert: {
          chamado_id: string
          created_at?: string
          enviado_por?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
        }
        Update: {
          chamado_id?: string
          created_at?: string
          enviado_por?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chamado_anexos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_anexos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chamado_comentarios: {
        Row: {
          autor_id: string
          chamado_id: string
          created_at: string
          id: string
          interno: boolean
          mensagem: string
        }
        Insert: {
          autor_id?: string
          chamado_id: string
          created_at?: string
          id?: string
          interno?: boolean
          mensagem: string
        }
        Update: {
          autor_id?: string
          chamado_id?: string
          created_at?: string
          id?: string
          interno?: boolean
          mensagem?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamado_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_comentarios_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      chamado_historico: {
        Row: {
          autor_id: string | null
          campo: string
          chamado_id: string
          created_at: string
          id: number
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          autor_id?: string | null
          campo: string
          chamado_id: string
          created_at?: string
          id?: never
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          autor_id?: string | null
          campo?: string
          chamado_id?: string
          created_at?: string
          id?: never
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamado_historico_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_historico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          aberto_por: string | null
          ativo: boolean
          avaliacao_comentario: string | null
          avaliacao_nota: number | null
          avaliado_em: string | null
          categoria_id: string | null
          cliente_id: string
          contrato_id: string | null
          created_at: string
          data_agendada: string | null
          descricao: string | null
          id: string
          origem: Database["public"]["Enums"]["chamado_origem"]
          primeira_resposta_em: string | null
          prioridade: Database["public"]["Enums"]["chamado_prioridade"]
          protocolo: string
          resolvido_em: string | null
          sla_resposta_ate: string | null
          sla_solucao_ate: string | null
          status: Database["public"]["Enums"]["chamado_status"]
          tecnico_id: string | null
          telefone_contato: string | null
          tipo_problema_id: string | null
          titulo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          aberto_por?: string | null
          ativo?: boolean
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          avaliado_em?: string | null
          categoria_id?: string | null
          cliente_id: string
          contrato_id?: string | null
          created_at?: string
          data_agendada?: string | null
          descricao?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["chamado_origem"]
          primeira_resposta_em?: string | null
          prioridade?: Database["public"]["Enums"]["chamado_prioridade"]
          protocolo?: string
          resolvido_em?: string | null
          sla_resposta_ate?: string | null
          sla_solucao_ate?: string | null
          status?: Database["public"]["Enums"]["chamado_status"]
          tecnico_id?: string | null
          telefone_contato?: string | null
          tipo_problema_id?: string | null
          titulo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          aberto_por?: string | null
          ativo?: boolean
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          avaliado_em?: string | null
          categoria_id?: string | null
          cliente_id?: string
          contrato_id?: string | null
          created_at?: string
          data_agendada?: string | null
          descricao?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["chamado_origem"]
          primeira_resposta_em?: string | null
          prioridade?: Database["public"]["Enums"]["chamado_prioridade"]
          protocolo?: string
          resolvido_em?: string | null
          sla_resposta_ate?: string | null
          sla_solucao_ate?: string | null
          status?: Database["public"]["Enums"]["chamado_status"]
          tecnico_id?: string | null
          telefone_contato?: string | null
          tipo_problema_id?: string | null
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_aberto_por_fkey"
            columns: ["aberto_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_tipo_problema_id_fkey"
            columns: ["tipo_problema_id"]
            isOneToOne: false
            referencedRelation: "tipos_problema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          cnpj_cpf: string | null
          created_at: string
          email: string | null
          id: string
          inscricao_estadual: string | null
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj_cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj_cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          descricao: string | null
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          descricao?: string | null
          updated_at?: string
          valor: Json
        }
        Update: {
          chave?: string
          descricao?: string | null
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      contratos: {
        Row: {
          cliente_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          horas_inclusas_mes: number
          id: string
          numero: string
          observacoes: string | null
          politica_visita_excedente: Database["public"]["Enums"]["politica_excedente"]
          sla_resposta_horas: number | null
          sla_solucao_horas: number | null
          status: Database["public"]["Enums"]["contrato_status"]
          tipo: Database["public"]["Enums"]["contrato_tipo"]
          updated_at: string
          valor_hora_excedente: number | null
          valor_mensal: number
          valor_visita_excedente: number | null
          visitas_inclusas_mes: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          horas_inclusas_mes?: number
          id?: string
          numero: string
          observacoes?: string | null
          politica_visita_excedente?: Database["public"]["Enums"]["politica_excedente"]
          sla_resposta_horas?: number | null
          sla_solucao_horas?: number | null
          status?: Database["public"]["Enums"]["contrato_status"]
          tipo?: Database["public"]["Enums"]["contrato_tipo"]
          updated_at?: string
          valor_hora_excedente?: number | null
          valor_mensal?: number
          valor_visita_excedente?: number | null
          visitas_inclusas_mes?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          horas_inclusas_mes?: number
          id?: string
          numero?: string
          observacoes?: string | null
          politica_visita_excedente?: Database["public"]["Enums"]["politica_excedente"]
          sla_resposta_horas?: number | null
          sla_solucao_horas?: number | null
          status?: Database["public"]["Enums"]["contrato_status"]
          tipo?: Database["public"]["Enums"]["contrato_tipo"]
          updated_at?: string
          valor_hora_excedente?: number | null
          valor_mensal?: number
          valor_visita_excedente?: number | null
          visitas_inclusas_mes?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_catalogo: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          descricao: string
          id: string
          tipo: Database["public"]["Enums"]["os_item_tipo"]
          unidade: string
          updated_at: string
          valor_unitario: number
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          tipo?: Database["public"]["Enums"]["os_item_tipo"]
          unidade?: string
          updated_at?: string
          valor_unitario?: number
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          tipo?: Database["public"]["Enums"]["os_item_tipo"]
          unidade?: string
          updated_at?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_catalogo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          profile_id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          profile_id: string
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          profile_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          assinada_em: string | null
          assinatura_recusada: boolean
          ativo: boolean
          chamado_id: string | null
          cliente_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          diagnostico: string | null
          hash_conteudo: string | null
          id: string
          motivo_recusa: string | null
          numero: string
          observacoes_tecnicas: string | null
          pdf_path: string | null
          pendencias: boolean
          pendencias_texto: string | null
          problema_relatado: string | null
          recomendacoes: string | null
          servico_executado: string | null
          status: Database["public"]["Enums"]["os_status"]
          tecnico_id: string | null
          tecnico_nome_snapshot: string | null
          tipo_atendimento: Database["public"]["Enums"]["os_tipo_atendimento"]
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          assinada_em?: string | null
          assinatura_recusada?: boolean
          ativo?: boolean
          chamado_id?: string | null
          cliente_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          diagnostico?: string | null
          hash_conteudo?: string | null
          id?: string
          motivo_recusa?: string | null
          numero?: string
          observacoes_tecnicas?: string | null
          pdf_path?: string | null
          pendencias?: boolean
          pendencias_texto?: string | null
          problema_relatado?: string | null
          recomendacoes?: string | null
          servico_executado?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          tecnico_id?: string | null
          tecnico_nome_snapshot?: string | null
          tipo_atendimento?: Database["public"]["Enums"]["os_tipo_atendimento"]
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          assinada_em?: string | null
          assinatura_recusada?: boolean
          ativo?: boolean
          chamado_id?: string | null
          cliente_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          diagnostico?: string | null
          hash_conteudo?: string | null
          id?: string
          motivo_recusa?: string | null
          numero?: string
          observacoes_tecnicas?: string | null
          pdf_path?: string | null
          pendencias?: boolean
          pendencias_texto?: string | null
          problema_relatado?: string | null
          recomendacoes?: string | null
          servico_executado?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          tecnico_id?: string | null
          tecnico_nome_snapshot?: string | null
          tipo_atendimento?: Database["public"]["Enums"]["os_tipo_atendimento"]
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      os_anexos: {
        Row: {
          created_at: string
          enviado_por: string | null
          id: string
          legenda: string | null
          mime_type: string | null
          os_id: string
          storage_path: string
          tamanho_bytes: number | null
          tipo: Database["public"]["Enums"]["os_anexo_tipo"]
        }
        Insert: {
          created_at?: string
          enviado_por?: string | null
          id?: string
          legenda?: string | null
          mime_type?: string | null
          os_id: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo?: Database["public"]["Enums"]["os_anexo_tipo"]
        }
        Update: {
          created_at?: string
          enviado_por?: string | null
          id?: string
          legenda?: string | null
          mime_type?: string | null
          os_id?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: Database["public"]["Enums"]["os_anexo_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "os_anexos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_anexos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_assinatura_tokens: {
        Row: {
          created_at: string
          criado_por: string | null
          enviado_para: string | null
          expira_em: string
          id: string
          os_id: string
          token_hash: string
          usado_em: string | null
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          enviado_para?: string | null
          expira_em: string
          id?: string
          os_id: string
          token_hash: string
          usado_em?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          enviado_para?: string | null
          expira_em?: string
          id?: string
          os_id?: string
          token_hash?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_assinatura_tokens_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_assinatura_tokens_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_assinaturas: {
        Row: {
          assinado_em: string
          cargo: string | null
          created_at: string
          documento_signatario: string | null
          geo_consentimento: boolean
          hash_documento: string
          id: string
          imagem_path: string
          invalidada_em: string | null
          invalidada_motivo: string | null
          ip: string | null
          latitude: number | null
          longitude: number | null
          nome_signatario: string
          os_id: string
          remota: boolean
          tipo: Database["public"]["Enums"]["assinatura_tipo"]
          user_agent: string | null
        }
        Insert: {
          assinado_em?: string
          cargo?: string | null
          created_at?: string
          documento_signatario?: string | null
          geo_consentimento?: boolean
          hash_documento: string
          id?: string
          imagem_path: string
          invalidada_em?: string | null
          invalidada_motivo?: string | null
          ip?: string | null
          latitude?: number | null
          longitude?: number | null
          nome_signatario: string
          os_id: string
          remota?: boolean
          tipo: Database["public"]["Enums"]["assinatura_tipo"]
          user_agent?: string | null
        }
        Update: {
          assinado_em?: string
          cargo?: string | null
          created_at?: string
          documento_signatario?: string | null
          geo_consentimento?: boolean
          hash_documento?: string
          id?: string
          imagem_path?: string
          invalidada_em?: string | null
          invalidada_motivo?: string | null
          ip?: string | null
          latitude?: number | null
          longitude?: number | null
          nome_signatario?: string
          os_id?: string
          remota?: boolean
          tipo?: Database["public"]["Enums"]["assinatura_tipo"]
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_assinaturas_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_itens: {
        Row: {
          catalogo_id: string | null
          cobrado: boolean
          created_at: string
          descricao: string
          id: string
          os_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["os_item_tipo"]
          updated_at: string
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          catalogo_id?: string | null
          cobrado?: boolean
          created_at?: string
          descricao: string
          id?: string
          os_id: string
          quantidade?: number
          tipo?: Database["public"]["Enums"]["os_item_tipo"]
          updated_at?: string
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          catalogo_id?: string | null
          cobrado?: boolean
          created_at?: string
          descricao?: string
          id?: string
          os_id?: string
          quantidade?: number
          tipo?: Database["public"]["Enums"]["os_item_tipo"]
          updated_at?: string
          valor_total?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_itens_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "itens_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_itens_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_visitas: {
        Row: {
          cobranca_tipo: Database["public"]["Enums"]["cobranca_tipo"] | null
          created_at: string
          data_hora_chegada: string
          data_hora_saida: string | null
          deslocamento_km: number | null
          faturado: boolean
          faturado_em: string | null
          horas_trabalhadas: number | null
          id: string
          justificativa_isencao: string | null
          observacoes: string | null
          observacoes_financeiras: string | null
          os_id: string
          quantidade_horas: number | null
          updated_at: string
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          cobranca_tipo?: Database["public"]["Enums"]["cobranca_tipo"] | null
          created_at?: string
          data_hora_chegada?: string
          data_hora_saida?: string | null
          deslocamento_km?: number | null
          faturado?: boolean
          faturado_em?: string | null
          horas_trabalhadas?: number | null
          id?: string
          justificativa_isencao?: string | null
          observacoes?: string | null
          observacoes_financeiras?: string | null
          os_id: string
          quantidade_horas?: number | null
          updated_at?: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          cobranca_tipo?: Database["public"]["Enums"]["cobranca_tipo"] | null
          created_at?: string
          data_hora_chegada?: string
          data_hora_saida?: string | null
          deslocamento_km?: number | null
          faturado?: boolean
          faturado_em?: string | null
          horas_trabalhadas?: number | null
          id?: string
          justificativa_isencao?: string | null
          observacoes?: string | null
          observacoes_financeiras?: string | null
          os_id?: string
          quantidade_horas?: number | null
          updated_at?: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_visitas_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assinatura_path: string | null
          ativo: boolean
          cliente_id: string | null
          created_at: string
          email: string
          id: string
          nome: string
          role: Database["public"]["Enums"]["user_role"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          assinatura_path?: string | null
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          email: string
          id: string
          nome?: string
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          assinatura_path?: string | null
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_problema: {
        Row: {
          ativo: boolean
          categoria_id: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_problema_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          contato_local: string | null
          created_at: string
          id: string
          logradouro: string | null
          nome: string
          numero: string | null
          referencia: string | null
          telefone_local: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          contato_local?: string | null
          created_at?: string
          id?: string
          logradouro?: string | null
          nome: string
          numero?: string | null
          referencia?: string | null
          telefone_local?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          contato_local?: string | null
          created_at?: string
          id?: string
          logradouro?: string | null
          nome?: string
          numero?: string | null
          referencia?: string | null
          telefone_local?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reabrir_os: {
        Args: { p_motivo: string; p_os_id: string }
        Returns: undefined
      }
    }
    Enums: {
      assinatura_tipo: "cliente" | "tecnico"
      chamado_origem: "portal" | "admin" | "telefone" | "whatsapp"
      chamado_prioridade: "baixa" | "media" | "alta" | "urgente"
      chamado_status:
        | "aberto"
        | "triagem"
        | "agendado"
        | "em_atendimento"
        | "aguardando_cliente"
        | "aguardando_peca"
        | "resolvido"
        | "cancelado"
      cobranca_tipo:
        | "isento_contrato"
        | "valor_unico"
        | "valor_por_hora"
        | "garantia"
        | "cortesia"
      contrato_status: "ativo" | "suspenso" | "encerrado"
      contrato_tipo: "avulso" | "manutencao_mensal" | "sla_visitas"
      os_anexo_tipo: "foto_antes" | "foto_depois" | "documento" | "outro"
      os_item_tipo: "material" | "equipamento" | "mao_de_obra" | "servico"
      os_status:
        | "rascunho"
        | "em_execucao"
        | "concluida"
        | "aguardando_assinatura"
        | "assinada"
        | "cancelada"
      os_tipo_atendimento:
        | "corretivo"
        | "preventivo"
        | "instalacao"
        | "vistoria"
        | "outro"
      politica_excedente: "valor_unico" | "valor_hora" | "isento"
      user_role: "admin" | "tecnico" | "cliente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      assinatura_tipo: ["cliente", "tecnico"],
      chamado_origem: ["portal", "admin", "telefone", "whatsapp"],
      chamado_prioridade: ["baixa", "media", "alta", "urgente"],
      chamado_status: [
        "aberto",
        "triagem",
        "agendado",
        "em_atendimento",
        "aguardando_cliente",
        "aguardando_peca",
        "resolvido",
        "cancelado",
      ],
      cobranca_tipo: [
        "isento_contrato",
        "valor_unico",
        "valor_por_hora",
        "garantia",
        "cortesia",
      ],
      contrato_status: ["ativo", "suspenso", "encerrado"],
      contrato_tipo: ["avulso", "manutencao_mensal", "sla_visitas"],
      os_anexo_tipo: ["foto_antes", "foto_depois", "documento", "outro"],
      os_item_tipo: ["material", "equipamento", "mao_de_obra", "servico"],
      os_status: [
        "rascunho",
        "em_execucao",
        "concluida",
        "aguardando_assinatura",
        "assinada",
        "cancelada",
      ],
      os_tipo_atendimento: [
        "corretivo",
        "preventivo",
        "instalacao",
        "vistoria",
        "outro",
      ],
      politica_excedente: ["valor_unico", "valor_hora", "isento"],
      user_role: ["admin", "tecnico", "cliente"],
    },
  },
} as const
