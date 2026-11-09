import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { DadosDossie } from "@/lib/dossieServer";
import { ROTULO_STATUS_GLOSA, ROTULO_TIPO_GLOSA, type StatusGlosa, type TipoGlosa } from "@/lib/glosas";
import { ROTULO_STATUS_ITEM } from "@/lib/checklistMensal";
import { ETAPAS, dataBrDia } from "@/lib/competencias";

// Dossiê da competência para o fiscal (ESP-010). Helvetica: sem "−" (U+2212).

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const s = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 9, lineHeight: 1.4, color: "#1E293B" },
  brand: { fontSize: 7, color: "#92650A", letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 4, lineHeight: 1.2 },
  sub: { fontSize: 10, color: "#475569", marginTop: 2 },
  capa: { borderBottom: "1pt solid #D4AF37", paddingBottom: 12, marginBottom: 12 },
  incompleto: { marginTop: 10, padding: 8, backgroundColor: "#FEF2F2", border: "1pt solid #FCA5A5", borderRadius: 3 },
  completo: { marginTop: 10, padding: 8, backgroundColor: "#ECFDF5", border: "1pt solid #6EE7B7", borderRadius: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  cell: { width: "31%", padding: 6, border: "0.5pt solid #E2E8F0", borderRadius: 3 },
  lbl: { fontSize: 7, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 },
  val: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, color: "#92650A", marginTop: 14, marginBottom: 6 },
  thead: { flexDirection: "row", backgroundColor: "#F1F5F9", paddingVertical: 3, paddingHorizontal: 4, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 4, borderBottom: "0.5pt solid #E2E8F0" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#64748B" },
  red: { color: "#B91C1C" },
  footer: { position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 7, color: "#94A3B8", textAlign: "center" },
});

function Col({ w, children, style }: { w: number | string; children: React.ReactNode; style?: Style }) {
  return <Text style={[{ width: w, paddingRight: 4 }, style ?? {}]}>{children}</Text>;
}

export function DossiePdfDoc({ d }: { d: DadosDossie }) {
  const c = d.competencia;
  return (
    <Document title={`Dossiê ${d.rotulo} — Contrato ${d.contrato.numero}`} author="CP System">
      <Page size="A4" style={s.page}>
        <View style={s.capa}>
          <Text style={s.brand}>CP System · Dossiê da competência para o fiscal do contrato</Text>
          <Text style={s.h1}>Competência {d.rotulo}</Text>
          <Text style={s.sub}>
            Contrato {d.contrato.numero} · {d.contrato.orgao}
          </Text>
          <Text style={s.sub}>{d.contrato.objeto}</Text>
          <View style={s.grid}>
            {[
              ["Empresa", d.empresa.razaoSocial],
              ["CNPJ", d.empresa.cnpj.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\d{2})$/, "$1.$2.$3/$4-$5")],
              ["Regime legal", d.contrato.regime],
              ["Período", `${dataBrDia(c.periodoInicio)} a ${dataBrDia(c.periodoFim)}`],
              ["Valor faturado", brl(c.valorFaturado)],
              ["Nota fiscal", c.numeroNf ?? "—"],
              ["Glosas", c.valorGlosas ? brl(c.valorGlosas) : "nenhuma"],
              ["Colaboradores no mês", String(d.colaboradoresDistintos)],
              ["Versão do dossiê", `${d.versao} · ${d.geradoEm}`],
            ].map(([k, v]) => (
              <View key={k} style={s.cell}>
                <Text style={s.lbl}>{k}</Text>
                <Text style={s.val}>{v}</Text>
              </View>
            ))}
          </View>
          {d.incompleto ? (
            <View style={s.incompleto}>
              <Text style={[s.bold, s.red]}>INCOMPLETO — itens obrigatórios pendentes:</Text>
              {d.pendencias.map((p, i) => (
                <Text key={i} style={s.red}>
                  • {p}
                </Text>
              ))}
            </View>
          ) : (
            <View style={s.completo}>
              <Text style={s.bold}>Documentação obrigatória completa.</Text>
            </View>
          )}
        </View>

        <Text style={s.h2}>Etapas da competência</Text>
        {ETAPAS.map((e) => (
          <View key={e.key} style={s.row}>
            <Col w="45%">{e.rotulo}</Col>
            <Col w="20%">{c.datas[e.key] ? dataBrDia(c.datas[e.key] as string) : "pendente"}</Col>
            <Col w="35%" style={s.muted}>{c.responsaveis[e.key] ?? ""}</Col>
          </View>
        ))}

        <Text style={s.h2}>Quadro de postos</Text>
        <View style={s.thead}>
          <Col w="52%">Posto / função</Col>
          <Col w="16%">Necessários</Col>
          <Col w="16%">Ocupantes</Col>
          <Col w="16%">Descobertos</Col>
        </View>
        {d.postos.map((p, i) => (
          <View key={i} style={s.row}>
            <Col w="52%">{p.descricao}</Col>
            <Col w="16%">{p.necessarios}</Col>
            <Col w="16%">{p.ocupantes}</Col>
            <Col w="16%" style={p.descobertos ? s.red : {}}>{p.descobertos}</Col>
          </View>
        ))}

        <Text style={s.h2}>Alocação no mês ({d.alocacoes.length})</Text>
        {d.nomesOcultos && <Text style={s.muted}>Nomes ocultos: quem gerou não tem a permissão “Dados de colaboradores”.</Text>}
        <View style={s.thead}>
          <Col w="30%">Colaborador</Col>
          <Col w="16%">CPF</Col>
          <Col w="26%">Posto</Col>
          <Col w="10%">Tipo</Col>
          <Col w="9%">De</Col>
          <Col w="9%">Até</Col>
        </View>
        {d.alocacoes.map((a, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Col w="30%">{a.nome}</Col>
            <Col w="16%">{a.cpfMascarado}</Col>
            <Col w="26%">{a.posto}</Col>
            <Col w="10%">{a.tipo}</Col>
            <Col w="9%">{a.inicio}</Col>
            <Col w="9%">{a.fim ?? "—"}</Col>
          </View>
        ))}
        {d.alocacoes.length === 0 && <Text style={s.muted}>Nenhuma alocação registrada no período.</Text>}

        <Text style={s.h2}>Glosas</Text>
        {c.glosas.length === 0 ? (
          <Text style={s.muted}>Nenhuma glosa registrada.</Text>
        ) : (
          c.glosas.map((g) => (
            <View key={g.id} style={s.row} wrap={false}>
              <Col w="14%">{dataBrDia(g.data)}</Col>
              <Col w="22%">{ROTULO_TIPO_GLOSA[g.tipo as TipoGlosa]}</Col>
              <Col w="36%">{g.motivo}</Col>
              <Col w="14%">{ROTULO_STATUS_GLOSA[g.status as StatusGlosa]}</Col>
              <Col w="14%">{brl(g.valor)}</Col>
            </View>
          ))
        )}

        <Text style={s.h2}>Comprovação mensal (checklist)</Text>
        {d.checklist.map((i) => (
          <View key={i.id} style={s.row} wrap={false}>
            <Col w="58%">
              {i.nome}
              {i.obrigatorio ? "" : " (opcional)"}
            </Col>
            <Col w="18%" style={["ENVIADO", "ACEITO"].includes(i.status) ? {} : s.red}>{ROTULO_STATUS_ITEM[i.status]}</Col>
            <Col w="24%" style={s.muted}>
              {i.dataEnvio ? `enviado ${dataBrDia(i.dataEnvio)}` : ""}
              {i.validade ? ` válida até ${dataBrDia(i.validade)}` : ""}
            </Col>
          </View>
        ))}

        <Text style={s.h2}>Índice dos anexos ({d.anexos.length})</Text>
        {d.anexos.map((a, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Col w="6%">{i + 1}</Col>
            <Col w="50%">{a.nomeZip}</Col>
            <Col w="44%" style={s.muted}>{a.origem}</Col>
          </View>
        ))}
        {d.anexos.length === 0 && <Text style={s.muted}>Nenhum anexo.</Text>}

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `Dossiê ${d.rotulo} · Contrato ${d.contrato.numero} · gerado pelo CP System em ${d.geradoEm} · página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
}
