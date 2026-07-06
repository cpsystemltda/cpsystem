"use client";

import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { AnaliseJuridica } from "@/lib/iaJuridica";
import type { ComparacaoJuridica } from "@/lib/iaJuridica";

// Templates de PDF pra exportar pareceres e comparações jurídicas.
// Regina 06/07/2026 — pra anexar em resposta ao órgão, arquivar internamente etc.
//
// Uso: passa <PDFDownloadLink document={<ParecerPdfDoc analise={...} />}>
// e o navegador baixa o PDF direto (client-side render via @react-pdf/renderer).

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
    color: "#1E293B",
  },
  header: {
    borderBottom: "1pt solid #6B4FC9",
    paddingBottom: 12,
    marginBottom: 20,
  },
  brand: {
    fontSize: 8,
    color: "#6B4FC9",
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1E293B",
  },
  subtitle: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#4C1D95",
    marginTop: 18,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 10,
    marginBottom: 6,
  },
  card: {
    padding: 10,
    marginBottom: 6,
    borderRadius: 4,
    border: "0.5pt solid #E2E8F0",
    backgroundColor: "#FAFAFA",
  },
  cardTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 3,
  },
  cardBody: {
    fontSize: 9,
    color: "#334155",
  },
  badge: {
    padding: "2 5",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderRadius: 3,
  },
  badgeAlta: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  badgeMedia: { backgroundColor: "#FEF3C7", color: "#92400E" },
  badgeBaixa: { backgroundColor: "#DBEAFE", color: "#1E40AF" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#94A3B8",
    borderTop: "0.5pt solid #E2E8F0",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  checklistItem: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 3,
    fontSize: 10,
  },
  bullet: { fontFamily: "Helvetica-Bold", color: "#059669" },
});

function severidadeStyle(s: "alta" | "media" | "baixa") {
  if (s === "alta") return styles.badgeAlta;
  if (s === "media") return styles.badgeMedia;
  return styles.badgeBaixa;
}

function formatarData(): string {
  // Usa fallback quando Date.now falha (nao deveria em client)
  try {
    return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

export function ParecerPdfDoc({
  analise,
  documentoNome,
}: {
  analise: AnaliseJuridica;
  documentoNome: string;
}) {
  const emissao = formatarData();
  return (
    <Document title={`Parecer jurídico — ${documentoNome}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>CP System · Consultoria Jurídica IA</Text>
          <Text style={styles.title}>Parecer jurídico</Text>
          <Text style={styles.subtitle}>{documentoNome}</Text>
        </View>

        <Text style={styles.sectionTitle}>Resumo executivo</Text>
        <Text style={styles.paragraph}>{analise.resumoExecutivo}</Text>

        <Text style={styles.sectionTitle}>Pontos críticos ({analise.pontosCriticos.length})</Text>
        {analise.pontosCriticos.length === 0 && (
          <Text style={styles.paragraph}>Nenhum ponto crítico identificado.</Text>
        )}
        {analise.pontosCriticos.map((p, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{p.titulo}</Text>
              <Text style={[styles.badge, severidadeStyle(p.severidade)]}>{p.severidade.toUpperCase()}</Text>
            </View>
            <Text style={styles.cardBody}>{p.descricao}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Checklist de gestão ({analise.checklistGestao.length})</Text>
        {analise.checklistGestao.map((c, i) => (
          <View key={i} style={styles.checklistItem}>
            <Text style={styles.bullet}>{c.concluido ? "☑" : "☐"}</Text>
            <Text>{c.item}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Janelas críticas de prazo ({analise.janelasCriticas.length})</Text>
        {analise.janelasCriticas.length === 0 && (
          <Text style={styles.paragraph}>Nenhuma janela de prazo destacada.</Text>
        )}
        {analise.janelasCriticas.map((j, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{j.evento}</Text>
              <Text style={styles.cardBody}>{j.prazo}</Text>
            </View>
            <Text style={styles.cardBody}>{j.recomendacao}</Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Gerado por Claude AI · CP System · Não substitui parecer humano</Text>
          <Text>{emissao}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function ComparacaoPdfDoc({
  comparacao,
  nomeOriginal,
  nomeAlterado,
}: {
  comparacao: ComparacaoJuridica;
  nomeOriginal: string;
  nomeAlterado: string;
}) {
  const emissao = formatarData();
  return (
    <Document title={`Comparação — ${nomeOriginal} vs ${nomeAlterado}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>CP System · Comparação Jurídica IA</Text>
          <Text style={styles.title}>Comparação de documentos</Text>
          <Text style={styles.subtitle}>Original: {nomeOriginal}</Text>
          <Text style={styles.subtitle}>Alterado: {nomeAlterado}</Text>
        </View>

        <Text style={styles.sectionTitle}>Resumo das diferenças</Text>
        <Text style={styles.paragraph}>{comparacao.resumoDiferencas}</Text>

        <Text style={styles.sectionTitle}>Diferenças críticas ({comparacao.diferencasCriticas.length})</Text>
        {comparacao.diferencasCriticas.map((d, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{d.titulo}</Text>
              <Text style={[styles.badge, severidadeStyle(d.severidade)]}>{d.severidade.toUpperCase()}</Text>
            </View>
            <Text style={[styles.cardBody, { marginTop: 3, fontFamily: "Helvetica-Bold" }]}>Original:</Text>
            <Text style={styles.cardBody}>{d.original}</Text>
            <Text style={[styles.cardBody, { marginTop: 3, fontFamily: "Helvetica-Bold" }]}>Alterado:</Text>
            <Text style={styles.cardBody}>{d.alterado}</Text>
            <Text style={[styles.cardBody, { marginTop: 3, fontFamily: "Helvetica-Bold" }]}>Impacto:</Text>
            <Text style={styles.cardBody}>{d.impacto}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Cláusulas novas ({comparacao.clausulasNovas.length})</Text>
        {comparacao.clausulasNovas.map((c, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardTitle}>{c.clausula}</Text>
            <Text style={styles.cardBody}>Risco: {c.risco}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Cláusulas removidas ({comparacao.clausulasRemovidas.length})</Text>
        {comparacao.clausulasRemovidas.map((c, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardTitle}>{c.clausula}</Text>
            <Text style={styles.cardBody}>Consequência: {c.consequencia}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Recomendação</Text>
        <Text style={styles.paragraph}>{comparacao.recomendacao}</Text>

        <View style={styles.footer} fixed>
          <Text>Gerado por Claude AI · CP System · Não substitui parecer humano</Text>
          <Text>{emissao}</Text>
        </View>
      </Page>
    </Document>
  );
}
