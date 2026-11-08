import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { MODULOS, ROTULO_ORIGEM, derivadosDaPlanilha, subtotalPorModulo, type DadosExportPlanilha } from "@/lib/planilhaCustos";

// PDF da planilha de custos e formação de preços (ESP-003). Renderizado no
// servidor pela rota /api/planilha-custos/[id]?formato=pdf.

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const pct = (n: number | null) => (n == null ? "" : `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 9, lineHeight: 1.4, color: "#1E293B" },
  brand: { fontSize: 7, color: "#92650A", letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 4 },
  sub: { fontSize: 9, color: "#64748B", marginTop: 2 },
  header: { borderBottom: "1pt solid #D4AF37", paddingBottom: 10, marginBottom: 12 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 10 },
  metaItem: { minWidth: 120 },
  metaLabel: { fontSize: 7, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  thead: { flexDirection: "row", backgroundColor: "#F1F5F9", paddingVertical: 4, paddingHorizontal: 6, borderBottom: "1pt solid #CBD5E1" },
  modulo: { flexDirection: "row", backgroundColor: "#FBF7EA", paddingVertical: 3, paddingHorizontal: 6, marginTop: 4 },
  row: { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 6, borderBottom: "0.5pt solid #E2E8F0" },
  subtotal: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, backgroundColor: "#F8FAFC" },
  total: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, backgroundColor: "#1E293B", marginTop: 6 },
  cMod: { width: 34 },
  cDesc: { flex: 1 },
  cPct: { width: 64, textAlign: "right" },
  cVal: { width: 84, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  white: { color: "#FFFFFF" },
  muted: { color: "#64748B" },
  alerta: { marginTop: 8, padding: 8, backgroundColor: "#FFF7E6", border: "0.5pt solid #F2C94C", borderRadius: 3 },
  secao: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, color: "#92650A", marginTop: 14, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cell: { width: "31%", padding: 6, border: "0.5pt solid #E2E8F0", borderRadius: 3 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: "#94A3B8", textAlign: "center" },
});

export function PlanilhaCustosPdfDoc({ d }: { d: DadosExportPlanilha }) {
  const sub = subtotalPorModulo(d.linhas);
  const der = derivadosDaPlanilha(d.linhas);
  const dif = d.valorMensalItem == null ? null : Math.round((d.totalMensal - d.valorMensalItem) * 100) / 100;
  const n = (v: number | null) => (v == null ? "não identificado" : brl(v));
  return (
    <Document title={`Planilha de custos — ${d.funcao} — v${d.versao}`} author="CP System">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>CP System · Planilha de custos e formação de preços</Text>
          <Text style={s.title}>{d.funcao}</Text>
          <Text style={s.sub}>
            Contrato {d.contratoNumero} · {d.orgao} · {d.empresa}
          </Text>
        </View>

        <View style={s.meta}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Versão</Text>
            <Text style={s.metaValue}>{d.versao}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Efeito a partir de</Text>
            <Text style={s.metaValue}>{d.dataEfeito}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Origem</Text>
            <Text style={s.metaValue}>
              {ROTULO_ORIGEM[d.origem] ?? d.origem}
              {d.origemRef ? ` (${d.origemRef})` : ""}
            </Text>
          </View>
          {d.itemDescricao && (
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Item do contrato</Text>
              <Text style={s.metaValue}>{d.itemDescricao}</Text>
            </View>
          )}
          {d.cct && (
            <View style={{ width: "100%" }}>
              <Text style={s.metaLabel}>Convenção coletiva</Text>
              <Text style={s.metaValue}>{d.cct}</Text>
            </View>
          )}
        </View>

        <View style={s.thead}>
          <Text style={[s.cMod, s.bold]}>Mód.</Text>
          <Text style={[s.cDesc, s.bold]}>Descrição</Text>
          <Text style={[s.cPct, s.bold]}>%</Text>
          <Text style={[s.cVal, s.bold]}>Valor (R$)</Text>
        </View>
        {MODULOS.map((m) => {
          const ls = d.linhas.filter((l) => l.modulo === m.codigo);
          if (ls.length === 0) return null;
          return (
            <View key={m.codigo} wrap={false}>
              <View style={s.modulo}>
                <Text style={[s.cDesc, s.bold]}>{m.titulo}</Text>
              </View>
              {ls.map((l, i) => (
                <View key={i} style={s.row}>
                  <Text style={[s.cMod, s.muted]}>{l.modulo}</Text>
                  <Text style={s.cDesc}>
                    {l.descricao}
                    {l.aRevisar ? "  (a revisar)" : ""}
                  </Text>
                  <Text style={s.cPct}>{pct(l.percentual)}</Text>
                  <Text style={s.cVal}>{brl(l.valor)}</Text>
                </View>
              ))}
              <View style={s.subtotal}>
                <Text style={s.cMod} />
                <Text style={[s.cDesc, s.muted]}>Subtotal</Text>
                <Text style={s.cPct} />
                <Text style={[s.cVal, s.bold]}>{brl(sub[m.codigo] ?? 0)}</Text>
              </View>
            </View>
          );
        })}
        <View style={s.total}>
          <Text style={s.cMod} />
          <Text style={[s.cDesc, s.bold, s.white]}>TOTAL MENSAL POR POSTO</Text>
          <Text style={s.cPct} />
          <Text style={[s.cVal, s.bold, s.white]}>{brl(d.totalMensal)}</Text>
        </View>

        {d.valorMensalItem != null && (
          <View style={{ marginTop: 6 }}>
            <View style={s.row}>
              <Text style={s.cMod} />
              <Text style={s.cDesc}>Valor mensal unitário do item no contrato</Text>
              <Text style={s.cPct} />
              <Text style={s.cVal}>{brl(d.valorMensalItem)}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.cMod} />
              <Text style={s.cDesc}>Diferença (planilha - contrato)</Text>
              <Text style={s.cPct} />
              <Text style={[s.cVal, Math.abs(dif ?? 0) > 0.05 ? { color: "#B45309" } : {}]}>{brl(dif ?? 0)}</Text>
            </View>
          </View>
        )}
        {d.justificativaDivergencia && (
          <View style={s.alerta}>
            <Text style={s.bold}>Justificativa da divergência</Text>
            <Text>{d.justificativaDivergencia}</Text>
          </View>
        )}
        {d.mapeamentoARevisar && (
          <View style={s.alerta}>
            <Text>Há linhas classificadas por aproximação (mapeamento a revisar).</Text>
          </View>
        )}

        <Text style={s.secao}>Dados derivados</Text>
        <View style={s.grid}>
          {[
            ["Salário-base", n(der.salarioBase)],
            ["Remuneração (módulo 1)", brl(der.remuneracao)],
            ["13º salário", pct(der.pct13) || "não identificado"],
            ["Férias e 1/3", pct(der.pctFerias) || "não identificado"],
            ["Multa do FGTS", pct(der.pctMultaFgts) || "não identificado"],
            ["Incidência submódulo 2.2", pct(der.pctIncidencia22) || "não identificado"],
            ["Insumos (módulo 5)", brl(der.insumos)],
            ["Custos indiretos", pct(der.pctCustosIndiretos) || "não identificado"],
            ["Lucro", pct(der.pctLucro) || "não identificado"],
            ["Tributos", pct(der.pctTributos) || "não identificado"],
            ["Mão de obra (módulos 1 a 4)", brl(der.totalMaoDeObra)],
            ["Módulo 6", brl(der.totalModulo6)],
          ].map(([k, v]) => (
            <View key={k} style={s.cell}>
              <Text style={s.metaLabel}>{k}</Text>
              <Text style={s.metaValue}>{v}</Text>
            </View>
          ))}
        </View>

        <Text style={s.footer} fixed>
          Gerado pelo CP System em {d.geradoEm} · cpsystem.app.br · Modelo IN SEGES/MP 5/2017, Anexo VII-D
        </Text>
      </Page>
    </Document>
  );
}
