/* eslint-disable jsx-a11y/alt-text -- <Image> do react-pdf desenha no PDF; não é <img> HTML e não aceita alt. */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ImagemPdf } from "./os-documento";

export type PdfFechamentoDados = {
  empresa: { razao: string; fantasia: string; cnpj: string; contato: string; logo: ImagemPdf | null };
  cliente: { nome: string; razao: string; documento: string };
  mes: string;
  contratos: { numero: string; mensal: string; franquia: string; consumo: string }[];
  visitas: {
    data: string;
    os: string;
    protocolo: string;
    horas: string;
    tipo: string;
    cobranca: string;
    valor: string;
    faturado: string;
  }[];
  itens: { os: string; descricao: string; qtd: string; unit: string; valor: string }[];
  resumo: { rotulo: string; valor: string; destaque?: boolean }[];
  tipos: { rotulo: string; qtd: string; valor: string }[];
  geradoEm: string;
};

const AZUL = "#1d4ed8";
const CINZA = "#475569";
const BORDA = "#cbd5e1";

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 30,
    paddingBottom: 44,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  logo: { width: 80, height: 36, objectFit: "contain", marginRight: 8 },
  titulo: { fontSize: 15, fontFamily: "Helvetica-Bold", color: AZUL },
  muted: { color: CINZA },
  secao: { marginBottom: 10 },
  secaoTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: AZUL,
    borderBottomWidth: 1,
    borderBottomColor: BORDA,
    paddingBottom: 2,
    marginBottom: 4,
  },
  tabela: { borderWidth: 1, borderColor: BORDA, borderRadius: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDA },
  th: { fontFamily: "Helvetica-Bold", backgroundColor: "#f1f5f9", fontSize: 7.5 },
  td: { padding: 3.5 },
  resumo: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  rodape: {
    position: "absolute",
    bottom: 18,
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

function Tabela({
  colunas,
  linhas,
}: {
  colunas: { titulo: string; flex: number; direita?: boolean }[];
  linhas: string[][];
}) {
  return (
    <View style={s.tabela}>
      <View style={[s.tr, s.th]} fixed>
        {colunas.map((c, i) => (
          <Text key={i} style={[s.td, { flex: c.flex }, c.direita ? { textAlign: "right" } : {}]}>
            {c.titulo}
          </Text>
        ))}
      </View>
      {linhas.map((l, r) => (
        <View key={r} style={[s.tr, r === linhas.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
          {l.map((v, i) => (
            <Text
              key={i}
              style={[s.td, { flex: colunas[i].flex }, colunas[i].direita ? { textAlign: "right" } : {}]}
            >
              {v}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function FechamentoDocumento({ d }: { d: PdfFechamentoDados }) {
  return (
    <Document title={`Fechamento ${d.mes} - ${d.cliente.nome}`} author={d.empresa.razao} language="pt-BR">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={{ flexDirection: "row", maxWidth: "58%" }}>
            {d.empresa.logo ? <Image src={d.empresa.logo} style={s.logo} /> : null}
            <View>
              <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>
                {d.empresa.fantasia || d.empresa.razao}
              </Text>
              {d.empresa.cnpj ? <Text style={s.muted}>CNPJ {d.empresa.cnpj}</Text> : null}
              {d.empresa.contato ? <Text style={s.muted}>{d.empresa.contato}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.titulo}>Fechamento mensal</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.mes}</Text>
            <Text style={s.muted}>Gerado em {d.geradoEm}</Text>
          </View>
        </View>

        <View style={[s.secao, { borderWidth: 1, borderColor: BORDA, borderRadius: 4, padding: 7 }]}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{d.cliente.nome}</Text>
          {d.cliente.razao !== d.cliente.nome ? <Text>{d.cliente.razao}</Text> : null}
          {d.cliente.documento ? <Text style={s.muted}>CPF/CNPJ {d.cliente.documento}</Text> : null}
        </View>

        {d.contratos.length ? (
          <View style={s.secao}>
            <Text style={s.secaoTitulo}>Contrato(s) vigente(s) no mês</Text>
            <Tabela
              colunas={[
                { titulo: "Contrato", flex: 2 },
                { titulo: "Franquia mensal", flex: 3 },
                { titulo: "Consumo no mês", flex: 4 },
                { titulo: "Mensalidade", flex: 2, direita: true },
              ]}
              linhas={d.contratos.map((c) => [c.numero, c.franquia, c.consumo, c.mensal])}
            />
          </View>
        ) : null}

        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Visitas do mês</Text>
          {d.visitas.length ? (
            <Tabela
              colunas={[
                { titulo: "Data", flex: 2.4 },
                { titulo: "OS / chamado", flex: 3.4 },
                { titulo: "Horas", flex: 1.1, direita: true },
                { titulo: "Cobrança", flex: 3 },
                { titulo: "Valor", flex: 1.8, direita: true },
                { titulo: "Fat.", flex: 1 },
              ]}
              linhas={d.visitas.map((v) => [
                v.data,
                v.protocolo ? `${v.os} · ${v.protocolo}` : v.os,
                v.horas,
                v.cobranca ? `${v.tipo} (${v.cobranca})` : v.tipo,
                v.valor,
                v.faturado,
              ])}
            />
          ) : (
            <Text style={s.muted}>Nenhuma visita neste mês.</Text>
          )}
        </View>

        {d.itens.length ? (
          <View style={s.secao}>
            <Text style={s.secaoTitulo}>Materiais e serviços cobrados</Text>
            <Tabela
              colunas={[
                { titulo: "OS", flex: 2.2 },
                { titulo: "Descrição", flex: 5 },
                { titulo: "Qtd", flex: 1, direita: true },
                { titulo: "Unitário", flex: 1.8, direita: true },
                { titulo: "Total", flex: 1.8, direita: true },
              ]}
              linhas={d.itens.map((i) => [i.os, i.descricao, i.qtd, i.unit, i.valor])}
            />
          </View>
        ) : null}

        <View style={[s.secao, { flexDirection: "row", gap: 14 }]} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={s.secaoTitulo}>Visitas por tipo</Text>
            {d.tipos.map((t, i) => (
              <View key={i} style={s.resumo}>
                <Text>
                  {t.rotulo} ({t.qtd})
                </Text>
                <Text>{t.valor}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.secaoTitulo}>Resumo</Text>
            {d.resumo.map((r, i) => (
              <View
                key={i}
                style={[
                  s.resumo,
                  r.destaque
                    ? { borderTopWidth: 1, borderTopColor: "#0f172a", marginTop: 3, paddingTop: 3 }
                    : {},
                ]}
              >
                <Text style={r.destaque ? { fontFamily: "Helvetica-Bold", fontSize: 10 } : {}}>
                  {r.rotulo}
                </Text>
                <Text style={r.destaque ? { fontFamily: "Helvetica-Bold", fontSize: 10 } : {}}>
                  {r.valor}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.rodape} fixed>
          <Text>{d.empresa.razao}</Text>
          <Text render={({ pageNumber, totalPages }) => `${d.mes} - ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
