/* eslint-disable jsx-a11y/alt-text -- <Image> do react-pdf desenha no PDF; não é <img> HTML e não aceita alt. */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ImagemPdf } from "./os-documento";

export type PdfRelatorioDados = {
  empresa: { razao: string; fantasia: string; cnpj: string; logo: ImagemPdf | null };
  titulo: string;
  periodo: string;
  geradoEm: string;
  secoes: {
    titulo: string;
    colunas: { titulo: string; peso: number; direita: boolean }[];
    linhas: string[][];
    truncado: number;
    vazio: boolean;
  }[];
};

const AZUL = "#1d4ed8";
const CINZA = "#475569";
const BORDA = "#cbd5e1";

const s = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingHorizontal: 28,
    paddingBottom: 40,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  logo: { width: 70, height: 32, objectFit: "contain", marginRight: 8 },
  titulo: { fontSize: 14, fontFamily: "Helvetica-Bold", color: AZUL },
  muted: { color: CINZA },
  secaoTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    borderBottomWidth: 1,
    borderBottomColor: BORDA,
    paddingBottom: 2,
    marginTop: 8,
    marginBottom: 4,
  },
  tabela: { borderWidth: 1, borderColor: BORDA, borderRadius: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDA },
  th: { fontFamily: "Helvetica-Bold", backgroundColor: "#f1f5f9", fontSize: 7.5 },
  td: { padding: 3, paddingHorizontal: 4 },
  rodape: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: CINZA,
    borderTopWidth: 1,
    borderTopColor: BORDA,
    paddingTop: 4,
  },
});

export function RelatorioDocumento({ d }: { d: PdfRelatorioDados }) {
  return (
    <Document title={`${d.titulo} - ${d.periodo}`} author={d.empresa.razao} language="pt-BR">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <View style={{ flexDirection: "row" }}>
            {d.empresa.logo ? <Image src={d.empresa.logo} style={s.logo} /> : null}
            <View>
              <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold" }}>
                {d.empresa.fantasia || d.empresa.razao}
              </Text>
              {d.empresa.cnpj ? <Text style={s.muted}>CNPJ {d.empresa.cnpj}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.titulo}>{d.titulo}</Text>
            <Text>{d.periodo}</Text>
            <Text style={s.muted}>Gerado em {d.geradoEm}</Text>
          </View>
        </View>

        {d.secoes.map((sec, i) => (
          <View key={i}>
            <Text style={s.secaoTitulo} minPresenceAhead={60}>
              {sec.titulo}
            </Text>
            {sec.vazio ? (
              <Text style={s.muted}>Sem dados no período.</Text>
            ) : (
              <View style={s.tabela}>
                <View style={[s.tr, s.th]} fixed>
                  {sec.colunas.map((c, k) => (
                    <Text key={k} style={[s.td, { flex: c.peso }, c.direita ? { textAlign: "right" } : {}]}>
                      {c.titulo}
                    </Text>
                  ))}
                </View>
                {sec.linhas.map((l, r) => (
                  <View
                    key={r}
                    style={[s.tr, r === sec.linhas.length - 1 ? { borderBottomWidth: 0 } : {}]}
                    wrap={false}
                  >
                    {l.map((v, k) => (
                      <Text
                        key={k}
                        style={[
                          s.td,
                          { flex: sec.colunas[k].peso },
                          sec.colunas[k].direita ? { textAlign: "right" } : {},
                        ]}
                      >
                        {v}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            )}
            {sec.truncado ? (
              <Text style={[s.muted, { marginTop: 3 }]}>
                Exibindo as primeiras {sec.linhas.length} de {sec.truncado} linhas. A planilha traz tudo.
              </Text>
            ) : null}
          </View>
        ))}

        <View style={s.rodape} fixed>
          <Text>{d.empresa.razao}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
