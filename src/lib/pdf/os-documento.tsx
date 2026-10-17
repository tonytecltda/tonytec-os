/* eslint-disable jsx-a11y/alt-text -- <Image> do react-pdf desenha no PDF; não é <img> HTML e não aceita alt. */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type ImagemPdf = { data: Buffer; format: "png" | "jpg" };

export type PdfOsDados = {
  empresa: {
    razao: string;
    fantasia: string;
    cnpj: string;
    endereco: string;
    contato: string;
    logo: ImagemPdf | null;
  };
  os: {
    numero: string;
    protocolo: string | null;
    tipo: string;
    situacao: string;
    inicio: string;
    fim: string;
    tecnico: string;
    problema: string;
    diagnostico: string;
    servico: string;
    observacoes: string;
    recomendacoes: string;
    pendencias: string | null;
    recusa: string | null;
  };
  cliente: { nome: string; razao: string; documento: string; contato: string };
  unidade: { nome: string; endereco: string; contato: string } | null;
  visitas: { chegada: string; saida: string; horas: string }[];
  totalHoras: string;
  itens: { descricao: string; tipo: string; qtd: string; unit: string; total: string }[];
  totalItens: string | null;
  exibirValores: boolean;
  fotos: { imagem: ImagemPdf; legenda: string }[];
  totalFotos: number;
  termo: string;
  assinaturas: {
    titulo: string;
    nome: string;
    detalhe: string;
    data: string;
    imagem: ImagemPdf | null;
  }[];
  hash: string;
  geradoEm: string;
  rodape: string;
};

const AZUL = "#1d4ed8";
const CINZA = "#475569";
const BORDA = "#cbd5e1";

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 30,
    paddingBottom: 48,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  empresa: { flexDirection: "row", gap: 10, maxWidth: "62%" },
  logo: { width: 90, height: 40, objectFit: "contain" },
  empresaNome: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  muted: { color: CINZA },
  caixaOs: { borderWidth: 1, borderColor: AZUL, borderRadius: 4, padding: 8, minWidth: 170 },
  osTitulo: { fontSize: 8, color: AZUL, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  osNumero: { fontSize: 14, fontFamily: "Helvetica-Bold", marginVertical: 2 },
  linha2: { flexDirection: "row", gap: 10, marginBottom: 8 },
  bloco: { flex: 1, borderWidth: 1, borderColor: BORDA, borderRadius: 4, padding: 7 },
  rotulo: {
    fontSize: 7,
    color: CINZA,
    textTransform: "uppercase",
    marginBottom: 2,
    fontFamily: "Helvetica-Bold",
  },
  secao: { marginBottom: 8 },
  secaoTitulo: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    borderBottomWidth: 1,
    borderBottomColor: BORDA,
    paddingBottom: 2,
    marginBottom: 4,
  },
  texto: { lineHeight: 1.35 },
  tabela: { borderWidth: 1, borderColor: BORDA, borderRadius: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDA },
  th: { fontFamily: "Helvetica-Bold", backgroundColor: "#f1f5f9", fontSize: 8 },
  td: { padding: 4 },
  alerta: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    borderRadius: 4,
    padding: 7,
    marginBottom: 8,
  },
  fotos: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  foto: { width: 124, height: 93, objectFit: "cover", borderRadius: 3 },
  assinaturas: { flexDirection: "row", gap: 12, marginTop: 4 },
  assinatura: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: 4,
    padding: 7,
    alignItems: "center",
  },
  assinaturaImg: { width: 180, height: 70, objectFit: "contain" },
  linhaAss: { borderTopWidth: 1, borderTopColor: "#0f172a", width: "90%", marginTop: 2, marginBottom: 3 },
  hash: { marginTop: 8, fontSize: 7, color: CINZA },
  rodape: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: CINZA,
    borderTopWidth: 1,
    borderTopColor: BORDA,
    paddingTop: 4,
  },
});

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={s.secao} wrap={false}>
      <Text style={s.secaoTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

function TextoLivre({ titulo, valor }: { titulo: string; valor: string }) {
  if (!valor.trim()) return null;
  return (
    <View style={s.secao}>
      <Text style={s.secaoTitulo}>{titulo}</Text>
      <Text style={s.texto}>{valor}</Text>
    </View>
  );
}

export function OsDocumento({ d }: { d: PdfOsDados }) {
  return (
    <Document
      title={`OS ${d.os.numero}`}
      author={d.empresa.razao}
      subject="Ordem de Serviço"
      language="pt-BR"
    >
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={s.header}>
          <View style={s.empresa}>
            {d.empresa.logo ? <Image src={d.empresa.logo} style={s.logo} /> : null}
            <View>
              <Text style={s.empresaNome}>{d.empresa.fantasia || d.empresa.razao}</Text>
              {d.empresa.fantasia ? <Text style={s.muted}>{d.empresa.razao}</Text> : null}
              {d.empresa.cnpj ? <Text style={s.muted}>CNPJ {d.empresa.cnpj}</Text> : null}
              {d.empresa.endereco ? <Text style={s.muted}>{d.empresa.endereco}</Text> : null}
              {d.empresa.contato ? <Text style={s.muted}>{d.empresa.contato}</Text> : null}
            </View>
          </View>
          <View style={s.caixaOs}>
            <Text style={s.osTitulo}>ORDEM DE SERVIÇO</Text>
            <Text style={s.osNumero}>{d.os.numero}</Text>
            {d.os.protocolo ? <Text>Chamado {d.os.protocolo}</Text> : null}
            <Text>{d.os.tipo}</Text>
            <Text style={s.muted}>{d.os.situacao}</Text>
          </View>
        </View>

        {/* Cliente e local */}
        <View style={s.linha2}>
          <View style={s.bloco}>
            <Text style={s.rotulo}>Cliente</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.cliente.nome}</Text>
            {d.cliente.razao !== d.cliente.nome ? <Text>{d.cliente.razao}</Text> : null}
            {d.cliente.documento ? <Text style={s.muted}>CPF/CNPJ {d.cliente.documento}</Text> : null}
            {d.cliente.contato ? <Text style={s.muted}>{d.cliente.contato}</Text> : null}
          </View>
          <View style={s.bloco}>
            <Text style={s.rotulo}>Local do atendimento</Text>
            {d.unidade ? (
              <>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.unidade.nome}</Text>
                <Text>{d.unidade.endereco || "-"}</Text>
                {d.unidade.contato ? <Text style={s.muted}>{d.unidade.contato}</Text> : null}
              </>
            ) : (
              <Text>-</Text>
            )}
          </View>
        </View>

        {/* Atendimento */}
        <Secao titulo="Atendimento">
          <View style={[s.linha2, { marginBottom: 4 }]}>
            <Text style={{ flex: 1 }}>Técnico: {d.os.tecnico}</Text>
            <Text style={{ flex: 1 }}>Início: {d.os.inicio}</Text>
            <Text style={{ flex: 1 }}>Fim: {d.os.fim}</Text>
          </View>
          {d.visitas.length ? (
            <View style={s.tabela}>
              <View style={[s.tr, s.th]}>
                <Text style={[s.td, { flex: 2 }]}>Chegada</Text>
                <Text style={[s.td, { flex: 2 }]}>Saída</Text>
                <Text style={[s.td, { flex: 1, textAlign: "right" }]}>Horas</Text>
              </View>
              {d.visitas.map((v, i) => (
                <View key={i} style={[s.tr, i === d.visitas.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                  <Text style={[s.td, { flex: 2 }]}>{v.chegada}</Text>
                  <Text style={[s.td, { flex: 2 }]}>{v.saida}</Text>
                  <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{v.horas}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={[s.muted, { marginTop: 3 }]}>Total de horas trabalhadas: {d.totalHoras}</Text>
        </Secao>

        <TextoLivre titulo="Problema relatado" valor={d.os.problema} />
        <TextoLivre titulo="Diagnóstico" valor={d.os.diagnostico} />
        <TextoLivre titulo="Serviço executado" valor={d.os.servico} />
        <TextoLivre titulo="Observações técnicas" valor={d.os.observacoes} />
        <TextoLivre titulo="Recomendações" valor={d.os.recomendacoes} />

        {/* Itens */}
        {d.itens.length ? (
          <Secao titulo="Materiais, equipamentos e serviços">
            <View style={s.tabela}>
              <View style={[s.tr, s.th]}>
                <Text style={[s.td, { flex: 5 }]}>Descrição</Text>
                <Text style={[s.td, { flex: 2 }]}>Tipo</Text>
                <Text style={[s.td, { flex: 1, textAlign: "right" }]}>Qtd</Text>
                {d.exibirValores ? (
                  <Text style={[s.td, { flex: 2, textAlign: "right" }]}>Unitário</Text>
                ) : null}
                {d.exibirValores ? <Text style={[s.td, { flex: 2, textAlign: "right" }]}>Total</Text> : null}
              </View>
              {d.itens.map((it, i) => (
                <View key={i} style={[s.tr, i === d.itens.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                  <Text style={[s.td, { flex: 5 }]}>{it.descricao}</Text>
                  <Text style={[s.td, { flex: 2 }]}>{it.tipo}</Text>
                  <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{it.qtd}</Text>
                  {d.exibirValores ? (
                    <Text style={[s.td, { flex: 2, textAlign: "right" }]}>{it.unit}</Text>
                  ) : null}
                  {d.exibirValores ? (
                    <Text style={[s.td, { flex: 2, textAlign: "right" }]}>{it.total}</Text>
                  ) : null}
                </View>
              ))}
            </View>
            {d.exibirValores && d.totalItens ? (
              <Text style={{ textAlign: "right", marginTop: 3, fontFamily: "Helvetica-Bold" }}>
                Total de itens cobrados: {d.totalItens}
              </Text>
            ) : null}
          </Secao>
        ) : null}

        {/* Pendências */}
        {d.os.pendencias ? (
          <View style={s.alerta} wrap={false}>
            <Text style={[s.rotulo, { color: "#b45309" }]}>Pendências</Text>
            <Text style={s.texto}>{d.os.pendencias}</Text>
          </View>
        ) : null}

        {/* Fotos */}
        {d.fotos.length ? (
          <Secao
            titulo={`Fotos${d.totalFotos > d.fotos.length ? ` (${d.fotos.length} de ${d.totalFotos})` : ""}`}
          >
            <View style={s.fotos}>
              {d.fotos.map((f, i) => (
                <View key={i}>
                  <Image src={f.imagem} style={s.foto} />
                  <Text style={[s.muted, { fontSize: 7, marginTop: 1 }]}>{f.legenda}</Text>
                </View>
              ))}
            </View>
          </Secao>
        ) : null}

        {/* Termo e assinaturas */}
        <View wrap={false}>
          <Secao titulo="Termo de aceite">
            <Text style={[s.texto, { fontSize: 8 }]}>{d.termo}</Text>
          </Secao>
          {d.os.recusa ? (
            <View style={s.alerta}>
              <Text style={[s.rotulo, { color: "#b45309" }]}>Cliente não assinou</Text>
              <Text>{d.os.recusa}</Text>
            </View>
          ) : null}
          <View style={s.assinaturas}>
            {d.assinaturas.map((a, i) => (
              <View key={i} style={s.assinatura}>
                {a.imagem ? (
                  <Image src={a.imagem} style={s.assinaturaImg} />
                ) : (
                  <View style={{ height: 70 }} />
                )}
                <View style={s.linhaAss} />
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{a.nome}</Text>
                <Text style={s.muted}>{a.titulo}</Text>
                {a.detalhe ? <Text style={s.muted}>{a.detalhe}</Text> : null}
                <Text style={s.muted}>{a.data}</Text>
              </View>
            ))}
          </View>
          <Text style={s.hash}>
            Hash SHA-256 do conteúdo assinado: {d.hash}
            {"\n"}Documento gerado eletronicamente em {d.geradoEm}. Qualquer alteração no conteúdo invalida
            este hash.
          </Text>
        </View>

        <View style={s.rodape} fixed>
          <Text style={{ maxWidth: "85%" }}>{d.rodape || d.empresa.razao}</Text>
          <Text render={({ pageNumber, totalPages }) => `${d.os.numero} - ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
