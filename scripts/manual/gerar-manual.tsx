/* eslint-disable jsx-a11y/alt-text -- <Image> do react-pdf desenha no PDF; não é <img> HTML e não aceita alt. */
/**
 * Gera o manual de uso do Tonytec OS em PDF (docs/manual/Manual-Tonytec-OS.pdf).
 *
 *   npm run manual                                    # manual geral (sem dados de acesso)
 *   npm run manual -- --nome=Rodrigo --email=a@b.com --senha=XXXX --saida=entregas/Manual-Rodrigo.pdf
 *   npm run manual -- --imagens=<pasta com os PNG capturados>   # reotimiza as telas (JPEG) antes
 *
 * As telas ficam em docs/manual/img (JPEG otimizados). Com --email/--senha o manual traz os dados de
 * acesso na capa: não versione esse arquivo (a pasta entregas/ está no .gitignore).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { renderToFile } from "@react-pdf/renderer";
import { Document, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import sharp from "sharp";
import type { ReactNode } from "react";

const arg = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const URL_APP = "https://tonytec-os.vercel.app";
const IMG = resolve("docs/manual/img");
const AZUL = "#1a56b0";
const ESCURO = "#17202e";
const CINZA = "#526071";
const CLARO = "#eef3fb";
const BORDA = "#d5dde8";

// ---------------------------------------------------------------- estilos
const s = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingHorizontal: 40,
    paddingBottom: 52,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: ESCURO,
    lineHeight: 1.4,
  },
  rodapeEsq: { position: "absolute", bottom: 22, left: 40, fontSize: 8, color: CINZA },
  rodapeDir: { position: "absolute", bottom: 22, right: 40, fontSize: 8, color: CINZA },
  topo: { position: "absolute", top: 18, left: 40, right: 40, fontSize: 8, color: CINZA },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: AZUL, marginBottom: 6, lineHeight: 1.2 },
  h1sub: { fontSize: 10.5, color: CINZA, marginBottom: 12 },
  h2: { fontSize: 13.5, fontFamily: "Helvetica-Bold", color: ESCURO, marginTop: 14, marginBottom: 5 },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", color: AZUL, marginTop: 8, marginBottom: 3 },
  p: { marginBottom: 6 },
  passo: { flexDirection: "row", marginBottom: 5 },
  num: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: AZUL,
    marginRight: 8,
    marginTop: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  numTxt: { color: "#fff", fontSize: 9, fontFamily: "Helvetica-Bold", lineHeight: 1 },
  passoTxt: { flex: 1 },
  marcador: { width: 12, color: AZUL, fontFamily: "Helvetica-Bold" },
  item: { flexDirection: "row", marginBottom: 3 },
  caixa: { borderRadius: 5, padding: 9, marginVertical: 7 },
  caixaTitulo: { fontFamily: "Helvetica-Bold", marginBottom: 2, fontSize: 10 },
  figura: { marginVertical: 6, alignItems: "center" },
  legenda: { fontSize: 8.5, color: CINZA, marginTop: 3, textAlign: "center" },
  linhaFiguras: { flexDirection: "row", justifyContent: "center", gap: 10, marginVertical: 6 },
  tabela: { borderWidth: 0.5, borderColor: BORDA, borderRadius: 4, marginVertical: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BORDA },
  th: { backgroundColor: CLARO, fontFamily: "Helvetica-Bold" },
  td: { padding: 5, fontSize: 9.5 },
});

// ---------------------------------------------------------------- blocos
const H1 = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <View>
    <Text style={s.h1}>{children}</Text>
    {sub ? <Text style={s.h1sub}>{sub}</Text> : null}
  </View>
);
const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
const H3 = ({ children }: { children: ReactNode }) => <Text style={s.h3}>{children}</Text>;
const P = ({ children }: { children: ReactNode }) => <Text style={s.p}>{children}</Text>;
const B = ({ children }: { children: ReactNode }) => (
  <Text style={{ fontFamily: "Helvetica-Bold" }}>{children}</Text>
);

function Passos({ itens }: { itens: ReactNode[] }) {
  return (
    <View>
      {itens.map((t, i) => (
        <View key={i} style={s.passo} wrap={false}>
          <View style={s.num}>
            <Text style={s.numTxt}>{i + 1}</Text>
          </View>
          <Text style={s.passoTxt}>{t}</Text>
        </View>
      ))}
    </View>
  );
}
function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <View style={{ marginBottom: 4 }}>
      {itens.map((t, i) => (
        <View key={i} style={s.item} wrap={false}>
          <Text style={s.marcador}>•</Text>
          <Text style={s.passoTxt}>{t}</Text>
        </View>
      ))}
    </View>
  );
}
const TIPOS = {
  dica: { fundo: "#e8f4ec", borda: "#2f9e5b", titulo: "Dica" },
  atencao: { fundo: "#fdf1e3", borda: "#d9822b", titulo: "Atenção" },
  info: { fundo: CLARO, borda: AZUL, titulo: "Importante" },
} as const;
function Caixa({
  tipo,
  titulo,
  children,
}: {
  tipo: keyof typeof TIPOS;
  titulo?: string;
  children: ReactNode;
}) {
  const t = TIPOS[tipo];
  return (
    <View
      style={[s.caixa, { backgroundColor: t.fundo, borderLeftWidth: 3, borderLeftColor: t.borda }]}
      wrap={false}
    >
      <Text style={[s.caixaTitulo, { color: t.borda }]}>{titulo ?? t.titulo}</Text>
      <Text>{children}</Text>
    </View>
  );
}
const imgPath = (nome: string) => ({ data: readFileSync(join(IMG, `${nome}.jpg`)), format: "jpg" as const });
/** Tela de computador (larga) ou de celular (em pé, várias lado a lado). */
function Tela({ nome, legenda, largura = 440 }: { nome: string; legenda: string; largura?: number }) {
  return (
    <View style={s.figura} wrap={false}>
      <Image src={imgPath(nome)} style={{ width: largura, borderWidth: 0.5, borderColor: BORDA }} />
      <Text style={s.legenda}>{legenda}</Text>
    </View>
  );
}
function Celulares({ itens }: { itens: { nome: string; legenda: string }[] }) {
  const w = itens.length === 1 ? 175 : itens.length === 2 ? 175 : 150;
  return (
    <View style={s.linhaFiguras} wrap={false}>
      {itens.map((i) => (
        <View key={i.nome} style={{ alignItems: "center", width: w }}>
          <Image
            src={imgPath(i.nome)}
            style={{ width: w, borderWidth: 0.5, borderColor: BORDA, borderRadius: 6 }}
          />
          <Text style={s.legenda}>{i.legenda}</Text>
        </View>
      ))}
    </View>
  );
}
function Tabela({ colunas, linhas }: { colunas: { t: string; w: number }[]; linhas: ReactNode[][] }) {
  return (
    <View style={s.tabela}>
      <View style={[s.tr, s.th]} wrap={false}>
        {colunas.map((c) => (
          <Text key={c.t} style={[s.td, { width: `${c.w}%`, fontFamily: "Helvetica-Bold" }]}>
            {c.t}
          </Text>
        ))}
      </View>
      {linhas.map((l, i) => (
        <View key={i} style={[s.tr, i === linhas.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
          {l.map((c, j) => (
            <Text key={j} style={[s.td, { width: `${colunas[j].w}%` }]}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Pagina({ children }: { children: ReactNode }) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.topo} fixed>
        Tonytec OS — Manual de uso
      </Text>
      <Text style={s.rodapeEsq} fixed>
        Tonytec Ltda · {URL_APP}
      </Text>
      <Text style={s.rodapeDir} fixed render={({ pageNumber }) => `Página ${pageNumber}`} />
      {children}
    </Page>
  );
}

// ---------------------------------------------------------------- documento
type Acesso = { nome: string; email: string; senha: string } | null;

function Manual({ acesso, data }: { acesso: Acesso; data: string }) {
  return (
    <Document title="Tonytec OS — Manual de uso" author="Tonytec Ltda" language="pt-BR">
      {/* ---------------------------------------------------------- capa */}
      <Page size="A4" style={{ ...s.page, paddingTop: 0, paddingHorizontal: 0 }}>
        <View style={{ backgroundColor: AZUL, height: 300, paddingHorizontal: 50, paddingTop: 90 }}>
          <View
            style={{
              width: 62,
              height: 62,
              borderRadius: 14,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: AZUL, fontSize: 28, fontFamily: "Helvetica-Bold" }}>TT</Text>
          </View>
          <View style={{ height: 48, marginTop: 22 }}>
            <Text style={{ color: "#fff", fontSize: 34, fontFamily: "Helvetica-Bold", lineHeight: 1.2 }}>
              Tonytec OS
            </Text>
          </View>
          <View style={{ height: 26, marginTop: 4 }}>
            <Text style={{ color: "#dbe7fa", fontSize: 17, lineHeight: 1.2 }}>
              Manual de uso — passo a passo
            </Text>
          </View>
          <Text style={{ color: "#dbe7fa", fontSize: 11, marginTop: 10 }}>
            Chamados, ordens de serviço, assinatura digital e cobrança de visitas
          </Text>
        </View>
        <View style={{ paddingHorizontal: 50, paddingTop: 34 }}>
          {acesso ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: AZUL,
                borderRadius: 8,
                padding: 16,
                backgroundColor: CLARO,
              }}
            >
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13, color: AZUL, marginBottom: 8 }}>
                Seus dados de acesso{acesso.nome ? ` — ${acesso.nome}` : ""}
              </Text>
              <Text style={{ marginBottom: 4 }}>
                <B>Endereço: </B>
                <Link src={URL_APP}>{URL_APP}</Link>
              </Text>
              <Text style={{ marginBottom: 4 }}>
                <B>Usuário (e-mail): </B>
                {acesso.email}
              </Text>
              <Text style={{ marginBottom: 8 }}>
                <B>Senha provisória: </B>
                <Text style={{ fontFamily: "Courier-Bold", fontSize: 12 }}>{acesso.senha}</Text>
              </Text>
              <Text style={{ fontSize: 9.5, color: CINZA }}>
                Troque a senha no primeiro acesso (página 3). Não compartilhe este arquivo: ele contém a sua
                senha.
              </Text>
            </View>
          ) : (
            <View style={{ borderWidth: 1, borderColor: BORDA, borderRadius: 8, padding: 16 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13, color: AZUL, marginBottom: 6 }}>
                Endereço do sistema
              </Text>
              <Link src={URL_APP}>{URL_APP}</Link>
            </View>
          )}
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 26, marginBottom: 6 }}>
            Neste manual
          </Text>
          <Lista
            itens={[
              "1. Primeiro acesso, troca de senha e instalação no celular",
              "2. Como o sistema funciona (perfis e caminho de um chamado)",
              "Parte A — Administrador: cadastros, chamados, agenda, OS, cobrança, relatórios e auditoria",
              "Parte B — Técnico (celular): do chamado à assinatura da OS",
              "Parte C — Cliente (portal): abrir e acompanhar chamados — e qual link enviar",
              "Parte D — Problemas comuns e perguntas frequentes",
            ]}
          />
          <Text style={{ marginTop: 30, fontSize: 9, color: CINZA }}>Tonytec Ltda · Versão de {data}</Text>
        </View>
      </Page>

      {/* ---------------------------------------------------------- 1 */}
      <Pagina>
        <Text style={s.h1}>1. Primeiro acesso</Text>
        <Text style={s.h1sub}>Funciona no computador e no celular, em qualquer navegador atual.</Text>

        <H2>Entrar no sistema</H2>
        <Passos
          itens={[
            <>
              Abra o endereço <B>{URL_APP}</B> no navegador (Chrome, Edge, Safari...).
            </>,
            <>
              Digite o seu <B>e-mail</B> e a <B>senha</B> e toque em <B>Entrar</B>. Você será levado direto
              para a sua área (administrador, técnico ou cliente).
            </>,
            <>
              Na primeira vez, <B>troque a senha</B>: toque na sua foto/iniciais (canto superior direito) ›{" "}
              <B>Alterar minha senha</B> › digite a nova senha (mínimo 8 caracteres) duas vezes ›{" "}
              <B>Salvar senha</B>.
            </>,
          ]}
        />
        <Celulares
          itens={[
            { nome: "t-login", legenda: "Tela de entrada no celular" },
            { nome: "t-usuario", legenda: "Menu do usuário › Alterar minha senha" },
          ]}
        />
        <Caixa tipo="dica">
          Prefira copiar e colar a senha provisória. Cuidado com letras parecidas: o “I” (i maiúsculo) e o “l”
          (L minúsculo). Se esquecer a senha, use <B>Esqueci minha senha</B> na tela de entrada ou peça ao
          administrador um novo link de acesso.
        </Caixa>
        <Caixa tipo="atencao">
          Depois de 8 tentativas com senha errada, o sistema bloqueia novas tentativas por alguns minutos. É
          uma proteção: aguarde 10 minutos.
        </Caixa>

        <H2>Instalar como aplicativo no celular</H2>
        <P>Assim o sistema abre em tela cheia, com ícone próprio, sem digitar o endereço.</P>
        <Tabela
          colunas={[
            { t: "Aparelho", w: 22 },
            { t: "Como instalar", w: 78 },
          ]}
          linhas={[
            [
              "Android (Chrome)",
              "Abra o endereço › menu (três pontinhos) › “Instalar aplicativo” ou “Adicionar à tela inicial”.",
            ],
            [
              "iPhone (Safari)",
              "Abra o endereço › botão Compartilhar (quadrado com seta) › “Adicionar à Tela de Início” › Adicionar.",
            ],
          ]}
        />
      </Pagina>
      <Pagina>
        <H1 sub="Quem faz o quê e por onde passa um atendimento.">2. Como o sistema funciona</H1>
        <H2>Os três perfis</H2>
        <Tabela
          colunas={[
            { t: "Perfil", w: 18 },
            { t: "Onde usa", w: 22 },
            { t: "O que faz", w: 60 },
          ]}
          linhas={[
            [
              "Administrador",
              "Computador (e celular)",
              "Cadastra clientes, contratos e técnicos; recebe e distribui chamados; agenda visitas; confere OS; cobra; vê relatórios e auditoria.",
            ],
            [
              "Técnico",
              "Celular",
              "Vê os chamados atribuídos a ele, atende no local, preenche a OS com fotos e horas e colhe as assinaturas.",
            ],
            [
              "Cliente",
              "Celular ou computador",
              "Abre chamados, acompanha o andamento, responde mensagens, baixa o PDF das OS e avalia o atendimento.",
            ],
          ]}
        />
        <H2>O caminho de um chamado</H2>
        <Passos
          itens={[
            <>
              <B>Abertura</B> — o cliente abre pelo portal, ou o administrador registra um pedido recebido por
              telefone/WhatsApp. O sistema gera o protocolo (ex.: CH-2026-000123) e calcula os prazos de SLA
              em horas úteis.
            </>,
            <>
              <B>Triagem</B> — o administrador define prioridade, técnico e (se for o caso) a data da visita.
              Status: Aberto › Em triagem › Agendado.
            </>,
            <>
              <B>Atendimento</B> — o técnico recebe o aviso, vai ao local e toca em <B>Iniciar atendimento</B>
              . Isso abre a Ordem de Serviço (OS) e registra a chegada.
            </>,
            <>
              <B>OS</B> — o técnico registra horas, fotos, diagnóstico, serviço executado e materiais. Tudo é
              salvo automaticamente.
            </>,
            <>
              <B>Assinaturas</B> — técnico e cliente assinam na tela (ou o cliente assina depois por um link).
              Ao assinar, a OS é <B>bloqueada</B>, o chamado vira <B>Resolvido</B> e o PDF é gerado.
            </>,
            <>
              <B>Cobrança</B> — a visita recebe uma sugestão de cobrança pelo contrato; o administrador
              confere, ajusta e marca como faturado.
            </>,
          ]}
        />
        <Caixa tipo="info" titulo="Regras que valem para todos">
          Notas internas nunca aparecem para o cliente. A OS assinada não pode ser alterada (só o
          administrador reabre, com motivo registrado). O sino de notificações (no alto da tela) avisa o que é
          novo para você. Toda alteração sensível fica registrada na Auditoria.
        </Caixa>

        {/* ---------------------------------------------------------- A */}
      </Pagina>
      <Pagina>
        <H1 sub="Para quem gerencia a operação (computador). Também funciona no celular.">
          Parte A — Administrador
        </H1>

        <H2>A1. Dashboard (tela inicial)</H2>
        <P>
          Ao entrar você vê o painel do dia. No alto, <B>Atenção agora</B> mostra o que precisa de ação:
          chamados novos aguardando triagem, chamados em andamento sem técnico, SLA estourado e contratos
          perto do vencimento. Abaixo, os indicadores do período escolhido no filtro (Hoje, 7 dias, 30 dias,
          Este mês ou datas livres): chamados abertos, em atendimento, resolvidos, tempos médios, SLA
          cumprido, satisfação, OS e valores a faturar.
        </P>
        <Tela nome="a-dashboard" legenda="Dashboard com “Atenção agora”, indicadores e gráficos" />

        <H2>A2. Configurar antes de começar</H2>
        <Passos
          itens={[
            <>
              <B>Configurações › Empresa</B>: razão social, CNPJ, telefone, endereço e logotipo (aparecem no
              PDF das OS).
            </>,
            <>
              <B>Configurações › Cobrança</B>: valor padrão de visita e de hora, usados quando o cliente não
              tem contrato.
            </>,
            <>
              <B>Configurações › SLA</B>: horário comercial, feriados e prazos de resposta/solução por
              prioridade.
            </>,
            <>
              <B>Configurações › Assinatura e PDF</B>: texto do termo de aceite e dados que saem no PDF.
            </>,
            <>
              <B>Catálogos</B>: categorias de serviço, tipos de problema e itens/serviços (materiais) usados
              pelos técnicos nas OS.
            </>,
          ]}
        />
        <Tela
          nome="a-config"
          legenda="Configurações: Empresa, Cobrança, SLA, Assinatura e PDF, Administradores"
        />

        <H2>A3. Cadastrar um técnico</H2>
        <Passos
          itens={[
            <>
              Menu <B>Técnicos</B> › botão <B>Novo técnico</B>.
            </>,
            <>
              Preencha nome, e-mail e telefone e salve. O sistema mostra um <B>link de acesso</B> (vale 24
              horas e só pode ser usado uma vez).
            </>,
            <>
              Toque em <B>WhatsApp</B> (ou e-mail) para enviar o link. O técnico abre, toca em{" "}
              <B>Continuar</B> e cria a própria senha.
            </>,
            <>
              Link expirou ou o técnico esqueceu a senha? No menu “três pontinhos” da linha dele:{" "}
              <B>Gerar link de acesso</B>. Para desligar alguém: <B>Desativar</B> (o acesso é cortado na hora
              e o histórico é mantido).
            </>,
          ]}
        />
        <Tela
          nome="a-tecnicos"
          legenda="Lista de técnicos, com Novo técnico e o menu “três pontinhos” de cada linha"
          largura={430}
        />
        <Caixa tipo="dica">
          Para criar outro administrador: Configurações › aba <B>Administradores</B>.
        </Caixa>

        <H2>A4. Cadastrar um cliente</H2>
        <Passos
          itens={[
            <>
              Menu <B>Clientes</B> › <B>Novo cliente</B>. Preencha razão social/nome (obrigatório), nome
              fantasia, CPF/CNPJ, telefone e e-mail. Salve.
            </>,
            <>
              Abra o cliente e use as abas: <B>Unidades</B> (cada local atendido, com endereço —{" "}
              <B>Nova unidade</B>), <B>Usuários do portal</B> (quem do cliente poderá abrir chamados —{" "}
              <B>Novo usuário</B>) e <B>Contratos</B>.
            </>,
            <>
              Ao criar um usuário do portal, o sistema mostra o <B>link de acesso</B>. Envie por WhatsApp ao
              cliente (veja a Parte C).
            </>,
          ]}
        />
        <Tela
          nome="a-cliente"
          legenda="Cliente: abas Dados, Unidades, Usuários do portal, Contratos e Histórico"
        />
        <Caixa tipo="atencao">
          Desativar um cliente também desativa os usuários do portal dele. Clientes e chamados não são
          apagados: ficam arquivados para preservar o histórico.
        </Caixa>

        <H2>A5. Cadastrar um contrato</H2>
        <P>
          Menu <B>Contratos</B> › <B>Novo contrato</B> (ou pela aba Contratos do cliente). Informe cliente,
          tipo, início e fim, valor mensal e a <B>franquia</B>: quantas visitas e horas por mês já estão
          incluídas. O que passar da franquia segue a <B>política de excedente</B> (valor por visita ou por
          hora). O contrato também define os prazos de SLA do cliente. O número é gerado sozinho
          (CT-AAAA-000001).
        </P>
        <Tela
          nome="a-contrato-novo"
          legenda="Novo contrato: identificação, franquia mensal e excedentes"
          largura={430}
        />

        <H2>A6. Chamados</H2>
        <H3>Registrar um chamado recebido por telefone ou WhatsApp</H3>
        <Passos
          itens={[
            <>
              Menu <B>Chamados</B> › <B>Novo chamado</B>.
            </>,
            <>
              Escolha o <B>cliente</B> e a <B>unidade</B>, a categoria, o título e a descrição, a prioridade e
              a origem (telefone, WhatsApp...).
            </>,
            <>
              Em <B>Atribuição (opcional)</B> já pode escolher o técnico e a data da visita. Salve.
            </>,
          ]}
        />
        <Tela nome="a-chamado-novo" legenda="Novo chamado (registro interno)" largura={430} />
        <H3>Acompanhar no Kanban</H3>
        <P>
          A tela <B>Chamados</B> mostra colunas por status (Aberto, Em triagem, Agendado, Em atendimento,
          Aguardando...). <B>Arraste o cartão</B> para mudar o status. Use os filtros (prioridade, técnico,
          categoria, SLA, cliente, período) ou a visão <B>Lista</B>. O selo colorido no cartão mostra quanto
          falta para o SLA.
        </P>
        <Tela nome="a-chamados" legenda="Kanban de chamados com filtros" />
        <H3>Dentro do chamado</H3>
        <Passos
          itens={[
            <>
              No quadro <B>Gestão</B> escolha <B>Status</B>, <B>Prioridade</B>, <B>Técnico responsável</B> e{" "}
              <B>Visita agendada para</B>; toque em <B>Salvar</B>. Agendar um chamado aberto muda o status
              para Agendado e avisa o cliente e o técnico.
            </>,
            <>
              Em <B>Linha do tempo</B> escreva para o cliente (resposta pública). Ligue <B>Nota interna</B>{" "}
              para anotações só da equipe.
            </>,
            <>
              Use <B>Anexar arquivo</B> para fotos, vídeos curtos e PDF (até 20 MB cada).
            </>,
          ]}
        />
        <Tela nome="a-chamado" legenda="Chamado: descrição, anexos, linha do tempo, Gestão e SLA" />

        <H2>A7. Agenda</H2>
        <P>
          Menu <B>Agenda</B>: visão semanal ou mensal das visitas, com filtro por técnico. <B>Arraste</B> um
          chamado para outro dia (a hora é mantida) ou clique nele para escolher o horário. A lista{" "}
          <B>Sem agendamento</B> mostra o que ainda não tem data.
        </P>
        <Tela nome="a-agenda" legenda="Agenda semanal" />

        <H2>A8. Ordens de serviço (OS)</H2>
        <Passos
          itens={[
            <>
              Menu <B>Ordens de Serviço</B>: filtre por situação (Em aberto, Aguardando assinatura,
              Encerradas, Com pendências...), técnico, cliente e período.
            </>,
            <>
              Abra uma OS para ver o que foi feito, as horas, os materiais, as fotos e as assinaturas. Quando
              a OS está <B>encerrada</B> aparece o botão para baixar o <B>PDF</B>.
            </>,
            <>
              Cliente não estava no local? Na OS <B>aguardando assinatura</B>, use{" "}
              <B>Gerar link de assinatura</B> e <B>Enviar link de assinatura</B> (WhatsApp/e-mail). O link
              vale uma vez, tem prazo e não precisa de login.
            </>,
            <>
              Corrigir algo numa OS já assinada? Só o administrador: <B>Reabrir OS</B>, informando o motivo
              (fica na Auditoria). <B>Cancelar OS</B> arquiva uma OS aberta por engano.
            </>,
          ]}
        />
        <Tela nome="a-os-detalhe" legenda="Detalhe da OS no painel do administrador" />

        <H2>A9. Cobrança de visitas</H2>
        <Passos
          itens={[
            <>
              Quando a OS é encerrada, cada visita recebe uma <B>sugestão de cobrança</B> pelo contrato:
              isenta (dentro da franquia), valor único ou por hora (excedente).
            </>,
            <>
              Menu <B>Cobrança de visitas</B>: filtre por cliente, período, “A faturar”/“Faturadas” e tipo.
              Abra uma visita para <B>ajustar</B> (garantia e cortesia exigem justificativa) ou{" "}
              <B>Recalcular sugestão</B>.
            </>,
            <>
              Selecione as visitas e toque em <B>Marcar como faturado</B>. Visita faturada fica travada.
            </>,
            <>
              Em <B>Fechamento mensal</B> escolha cliente e mês: mensalidade + visitas + materiais, com PDF,
              Excel e CSV para o financeiro e <B>Marcar mês como faturado</B>.
            </>,
          ]}
        />
        <Tela nome="a-cobranca" legenda="Cobrança de visitas" />

        <H2>A10. Relatórios</H2>
        <P>
          Menu <B>Relatórios</B>: 11 relatórios (clientes mais atendidos, problemas e reincidência,
          produtividade por técnico, SLA, faturamento, contratos, evolução mensal, satisfação, materiais, mapa
          de calor e OS pendentes). Escolha o período e exporte em <B>CSV</B> (abre no Excel), <B>XLSX</B> ou{" "}
          <B>PDF</B>.
        </P>
        <Tela nome="a-relatorios" legenda="Índice de relatórios" largura={430} />

        <H2>A11. Notificações e auditoria</H2>
        <Lista
          itens={[
            <>
              O <B>sino</B> (no alto, à direita) avisa chamado novo, resposta do cliente, OS aguardando
              assinatura, OS assinada e avaliações. Toque no aviso para abrir o item; “Marcar todas como
              lidas” limpa a lista.
            </>,
            <>
              <B>Auditoria</B> mostra quem alterou usuários, clientes, contratos, configurações, cobrança e a
              situação das OS, e quando. Filtre por área, ação, autor e período. Os registros não podem ser
              apagados.
            </>,
          ]}
        />
        <Tela
          nome="a-auditoria"
          legenda="Auditoria: cada linha mostra autor, ação, registro e os campos alterados"
          largura={430}
        />

        {/* ---------------------------------------------------------- B */}
      </Pagina>
      <Pagina>
        <H1 sub="Tudo pelo celular. As telas foram feitas para o uso em campo, com botões grandes.">
          Parte B — Técnico (celular)
        </H1>

        <H2>B1. Antes de sair de casa (uma vez só)</H2>
        <Passos
          itens={[
            <>
              Abra o link de acesso enviado pela Tonytec, toque em <B>Continuar</B> e crie a sua senha.
            </>,
            <>Instale o sistema na tela inicial do celular (veja a página 3).</>,
            <>
              Menu (três riscos) › <B>Minha assinatura</B>: desenhe a sua assinatura e toque em{" "}
              <B>Salvar assinatura</B>. Ela será usada em todas as suas OS.
            </>,
          ]}
        />
        <Celulares
          itens={[
            { nome: "t-menu", legenda: "Menu: Meu dia, Histórico, Minha assinatura" },
            { nome: "t-minha-assinatura", legenda: "Minha assinatura" },
          ]}
        />

        <H2>B2. Meu dia</H2>
        <P>
          A tela inicial lista os chamados atribuídos a você, os de hoje primeiro. Cada cartão mostra
          protocolo, status, prioridade, endereço, horário e o prazo de SLA. Toque em <B>Abrir rota</B> para
          ir ao Google Maps. O sino avisa quando algo novo é atribuído ou reagendado.
        </P>
        <Celulares itens={[{ nome: "t-dia", legenda: "Meu dia" }]} />

        <H2>B3. Chegou ao cliente</H2>
        <Passos
          itens={[
            <>
              Toque no chamado. Leia a descrição e as mensagens (as <B>notas internas</B> são só da equipe).
              Use <B>Ligar</B> para falar com o contato do local.
            </>,
            <>
              Toque em <B>Iniciar atendimento</B>. O sistema abre a OS e já registra a hora de chegada.
            </>,
            <>
              Precisa de peça ou de uma resposta do cliente? Toque em <B>Aguardando peça</B> ou{" "}
              <B>Aguardando cliente</B> — o administrador é avisado.
            </>,
          ]}
        />
        <Celulares itens={[{ nome: "t-chamado", legenda: "Chamado do técnico: botões grandes de ação" }]} />

        <H2>B4. Preencher a OS</H2>
        <Passos
          itens={[
            <>
              <B>Visitas e horas</B>: a chegada já está registrada. Ao terminar, toque em{" "}
              <B>Registrar saída</B>. Se voltar outro dia, use <B>Nova visita (retorno)</B>.
            </>,
            <>
              <B>Fotos e documentos</B>: toque em <B>Foto antes</B> e <B>Foto depois</B> (abre a câmera) ou{" "}
              <B>Galeria / PDF</B>. As fotos são reduzidas automaticamente.
            </>,
            <>
              <B>Atendimento</B>: tipo de atendimento (corretivo, preventivo, instalação...), problema
              relatado, diagnóstico e <B>serviço executado</B> (obrigatório). Se ficou algo pendente, ligue{" "}
              <B>Ficou alguma pendência?</B> e descreva.
            </>,
            <>
              <B>Materiais e serviços</B>: <B>Do catálogo</B> (busca pelo nome) ou <B>Item avulso</B>{" "}
              (descrição, quantidade e valor).
            </>,
          ]}
        />
        <Caixa tipo="dica">
          O que você digita é <B>salvo sozinho</B> (veja “Salvo” no rodapé). Sem sinal no local? Continue
          normalmente: o texto fica no aparelho e as fotos entram numa fila que sobe quando a internet voltar.
          Antes de sair, confira se não há envio pendente.
        </Caixa>
        <Celulares itens={[{ nome: "t-os-topo", legenda: "OS: visitas e horas, fotos e atendimento" }]} />

        <H2>B5. Concluir e colher as assinaturas</H2>
        <Passos
          itens={[
            <>
              Toque em <B>Concluir e assinar</B> (barra azul fixa no rodapé). O sistema confere os dados
              obrigatórios e mostra o <B>resumo</B> e o <B>termo de aceite</B>.
            </>,
            <>
              <B>1. Sua assinatura (técnico)</B>: assine com o dedo no quadro. Se já tem assinatura salva, ela
              aparece pronta.
            </>,
            <>
              <B>2. Assinatura do cliente</B>: escolha uma opção —
            </>,
          ]}
        />
        <Lista
          itens={[
            <>
              <B>No local</B>: escreva o nome de quem assina (CPF/RG e cargo são opcionais), peça para a
              pessoa assinar na tela, marque “Li e concordo com o termo de aceite” e, se quiser, ative a
              localização.
            </>,
            <>
              <B>Link</B>: o cliente não está no local. Envie o link por WhatsApp/e-mail; ele assina pelo
              próprio celular, sem login.
            </>,
            <>
              <B>Recusou</B>: o cliente não quis assinar. Registre o motivo — a OS é encerrada como “sem
              assinatura”.
            </>,
          ]}
        />
        <Passos
          itens={[
            <>
              Toque em <B>Assinar e encerrar a OS</B>. A OS é bloqueada, o hash de integridade é gravado, o
              chamado vira Resolvido e o PDF é gerado.
            </>,
          ]}
        />
        <Celulares
          itens={[{ nome: "t-assinatura1", legenda: "Resumo, termo de aceite e assinatura do técnico" }]}
        />
        <Caixa tipo="atencao">
          Depois de assinada, a OS não pode mais ser editada. Se errou algo, peça ao administrador para
          reabrir (ele registra o motivo). Antes de assinar, use <B>Voltar para edição</B> para corrigir.
        </Caixa>

        <H2>B6. Depois do atendimento</H2>
        <Lista
          itens={[
            <>
              Menu (três riscos) › <B>Histórico</B>: suas OS encerradas, com situação (Assinada, Sem
              assinatura...) e botão <B>PDF</B>.
            </>,
            <>
              Se o cliente ainda não assinou, a OS aparece em “Meu dia” como <B>aguardando assinatura</B> —
              toque para reenviar o link.
            </>,
          ]}
        />
        <Celulares itens={[{ nome: "t-historico", legenda: "Histórico de OS encerradas" }]} />

        {/* ---------------------------------------------------------- C */}
      </Pagina>
      <Pagina>
        <H1 sub="O que o seu cliente vê. Simples, no celular ou no computador.">
          Parte C — Cliente (portal)
        </H1>

        <Caixa tipo="info" titulo="Qual link enviar aos clientes">
          Cada cliente entra pelo endereço {URL_APP}. Para o primeiro acesso, envie o <B>link individual</B>{" "}
          gerado pelo administrador: Clientes › (o cliente) › aba Usuários do portal › Novo usuário (ou “Gerar
          link de acesso” num usuário existente) › botão WhatsApp. O link vale 24 horas e só pode ser usado
          uma vez; depois o cliente entra sempre por {URL_APP} com e-mail e senha.
        </Caixa>

        <H2>C1. Primeiro acesso</H2>
        <Passos
          itens={[
            <>
              Abrir o link recebido por WhatsApp/e-mail e tocar em <B>Continuar</B>.
            </>,
            <>
              Criar a senha (mínimo 8 caracteres) e <B>Salvar senha</B>. Nas próximas vezes: {URL_APP} ›
              e-mail e senha.
            </>,
          ]}
        />
        <Celulares itens={[{ nome: "c-inicio", legenda: "Início do portal" }]} />

        <H2>C2. Abrir um chamado</H2>
        <Passos
          itens={[
            <>
              Menu (três riscos) › <B>Abrir chamado</B>.
            </>,
            <>
              Escolha a <B>Unidade</B> e a <B>Categoria</B> (e o tipo de problema), escreva um <B>título</B>{" "}
              curto e a <B>descrição</B> (desde quando acontece, o que já foi tentado, horários de acesso).
            </>,
            <>
              Escolha a <B>prioridade</B> (as opções explicam cada nível), anexe fotos ou vídeo curto (até 20
              MB) e toque em <B>Abrir chamado</B>.
            </>,
            <>
              Anote o <B>protocolo</B> (CH-AAAA-000000): é ele que identifica o seu pedido.
            </>,
          ]}
        />
        <Celulares
          itens={[
            { nome: "c-novo", legenda: "Abrir chamado" },
            { nome: "c-chamados", legenda: "Meus chamados" },
          ]}
        />

        <H2>C3. Acompanhar e conversar</H2>
        <Lista
          itens={[
            <>
              <B>Meus chamados</B>: situação de cada pedido (aberto, agendado, em atendimento, aguardando
              você, resolvido).
            </>,
            <>
              Dentro do chamado: histórico, dia e hora da visita agendada e o campo para <B>responder</B> a
              qualquer momento — a equipe é avisada na hora.
            </>,
            <>O sino avisa respostas, visita agendada e OS disponível.</>,
          ]}
        />
        <Celulares itens={[{ nome: "c-chamado", legenda: "Detalhe do chamado no portal" }]} />

        <H2>C4. Ordens de serviço, contrato e avaliação</H2>
        <Lista
          itens={[
            <>
              <B>Ordens de Serviço</B>: consulte e baixe o <B>PDF</B> de cada atendimento (o que foi feito,
              horas, materiais, fotos e assinaturas).
            </>,
            <>
              <B>Contrato</B>: plano, franquia de visitas/horas do mês e saldo restante.
            </>,
            <>
              Quando o chamado for <B>resolvido</B>, dê uma nota de 1 a 5 e, se quiser, um comentário.
            </>,
            <>
              Se a Tonytec enviar um <B>link para assinar</B> uma OS, abra-o no celular, confira o resumo,
              assine na tela e toque em concluir. O link só funciona uma vez.
            </>,
          ]}
        />
        <Celulares
          itens={[
            { nome: "c-os", legenda: "Ordens de serviço" },
            { nome: "c-contrato", legenda: "Contrato e saldo" },
          ]}
        />

        {/* ---------------------------------------------------------- D */}
      </Pagina>
      <Pagina>
        <H1 sub="Se algo não sair como esperado, comece por aqui.">Parte D — Problemas comuns</H1>
        <Tabela
          colunas={[
            { t: "Situação", w: 32 },
            { t: "O que fazer", w: 68 },
          ]}
          linhas={[
            [
              "“E-mail ou senha incorretos”",
              "Confira o e-mail e a senha (cuidado com I maiúsculo e l minúsculo; use copiar e colar). Depois de 8 erros o acesso fica bloqueado por alguns minutos.",
            ],
            ["“Muitas tentativas”", "Aguarde cerca de 10 minutos e tente de novo."],
            [
              "O link de acesso “expirou” ou “já foi usado”",
              "O link vale 24 horas e uma única vez. Peça ao administrador: menu “três pontinhos” do usuário › Gerar link de acesso.",
            ],
            [
              "Esqueci a senha",
              "Na tela de entrada toque em Esqueci minha senha, ou peça um novo link ao administrador.",
            ],
            [
              "Não vejo um chamado",
              "O técnico só vê os chamados atribuídos a ele; o cliente só vê os da própria empresa. Peça ao administrador para conferir a atribuição.",
            ],
            [
              "Estou sem sinal no cliente",
              "Continue preenchendo a OS: ela é salva no aparelho e as fotos ficam numa fila. Quando o sinal voltar, aguarde o “Salvo” e a fila esvaziar antes de fechar o navegador.",
            ],
            [
              "Preciso alterar uma OS já assinada",
              "Só o administrador: abre a OS › Reabrir OS e informa o motivo. A reabertura fica registrada na Auditoria.",
            ],
            [
              "A tela parece desatualizada",
              "Puxe a tela para baixo para recarregar ou feche e abra o aplicativo. O sino de notificações atualiza sozinho a cada 45 segundos.",
            ],
            [
              "O link de assinatura do cliente não abre",
              "Verifique se foi usado, se venceu ou se a OS já foi assinada. O técnico/administrador gera um novo link na própria OS.",
            ],
          ]}
        />
        <Caixa tipo="dica">
          Dúvidas ou sugestões? Fale com a Tonytec e informe o <B>protocolo</B> do chamado ou o{" "}
          <B>número da OS</B> — isso agiliza qualquer suporte.
        </Caixa>
      </Pagina>
    </Document>
  );
}

// ---------------------------------------------------------------- execução
async function otimizarImagens(origem: string) {
  mkdirSync(IMG, { recursive: true });
  let n = 0;
  for (const f of readdirSync(origem).filter((x) => x.endsWith(".png"))) {
    const alvo = join(IMG, f.replace(/\.png$/, ".jpg"));
    const largura = /^(t|c)-/.test(f) ? 560 : 1180;
    await sharp(join(origem, f))
      .resize({ width: largura, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(alvo);
    n++;
  }
  console.log(`✓ ${n} telas otimizadas em docs/manual/img`);
}

async function main() {
  const origem = arg("imagens");
  if (origem) await otimizarImagens(resolve(origem));
  if (!existsSync(IMG)) throw new Error("Sem telas em docs/manual/img. Use --imagens=<pasta com PNG>.");

  const email = arg("email");
  const senha = arg("senha");
  const acesso: Acesso = email && senha ? { nome: arg("nome") ?? "", email, senha } : null;
  const saida = resolve(arg("saida") ?? "docs/manual/Manual-Tonytec-OS.pdf");
  mkdirSync(dirname(saida), { recursive: true });
  const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );

  await renderToFile(<Manual acesso={acesso} data={data} />, saida);
  console.log(`✓ Manual gerado: ${saida}${acesso ? " (com dados de acesso — não versionar)" : ""}`);
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
