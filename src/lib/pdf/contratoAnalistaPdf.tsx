import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  VERSAO_CONTRATO_ANALISTA,
  VIGENCIA_CONTRATO_ANALISTA,
} from "@/components/legal/ContratoAnalistaParceiro";

// PDF do Contrato de Analista Parceiro pra envio via WhatsApp (Regina 13/07).
// Fonte de verdade do TEXTO é ContratoAnalistaParceiro.tsx — este arquivo
// mantém o mesmo conteudo em layout de impressao (@react-pdf/renderer).
// Se atualizar clausula la, atualizar aqui tambem.

const CONTRATADA = {
  nome: "CP SYSTEM",
  razao: "CONTRATOS PUBLICOS SYSTEM LTDA",
  cnpj: "67.266.466/0001-04",
  endereco: "SRTVS Qd. 701, Bloco B, Sala 616, Asa Sul, Brasília/DF, CEP 70.340-906",
  email: "contato@cpsystem.app.br",
  wa: "+55 11 97061-9434",
};

const FORO = "Brasília — Distrito Federal";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.55,
    color: "#1E293B",
  },
  headerBrand: {
    fontSize: 8,
    color: "#6B4FC9",
    letterSpacing: 2,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1E293B",
  },
  subtitle: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 3,
    marginBottom: 16,
  },
  partesBox: {
    padding: 10,
    marginBottom: 14,
    border: "0.5pt solid #CBD5E1",
    backgroundColor: "#F8FAFC",
    fontSize: 9.5,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  paragraph: { marginBottom: 5, fontSize: 10 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#4C1D95",
    marginTop: 12,
    marginBottom: 6,
  },
  listItem: {
    marginBottom: 3,
    fontSize: 9.5,
    paddingLeft: 10,
  },
  qualifBox: {
    marginTop: 14,
    padding: 10,
    border: "0.5pt solid #CBD5E1",
    backgroundColor: "#F8FAFC",
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#94A3B8",
    borderTop: "0.5pt solid #E2E8F0",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const PLACEHOLDER = "[a ser preenchido no cadastro]";

function formatarCpf(cpf: string | null | undefined): string {
  if (!cpf) return PLACEHOLDER;
  const n = cpf.replace(/\D/g, "");
  if (n.length !== 11) return cpf;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
}

export type DadosAnalistaPdf = {
  nomeCompleto?: string | null;
  cpf?: string | null;
  endereco?: string | null;
  email?: string | null;
  telefone?: string | null;
};

export function ContratoAnalistaPdfDoc({ analista }: { analista?: DadosAnalistaPdf }) {
  const nome = analista?.nomeCompleto || PLACEHOLDER;
  const cpf = formatarCpf(analista?.cpf);
  const endereco = analista?.endereco || PLACEHOLDER;
  const email = analista?.email || PLACEHOLDER;
  const telefone = analista?.telefone || PLACEHOLDER;

  return (
    <Document
      title={`Contrato Analista Parceiro CP System v${VERSAO_CONTRATO_ANALISTA}`}
      author="CP System — Contratos Publicos System LTDA"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.headerBrand}>CP SYSTEM</Text>
        <Text style={styles.title}>
          Contrato de Adesão ao Programa de Analista Parceiro
        </Text>
        <Text style={styles.subtitle}>
          Versão {VERSAO_CONTRATO_ANALISTA} · Em vigor desde {VIGENCIA_CONTRATO_ANALISTA}
        </Text>

        <View style={styles.partesBox}>
          <Text style={{ ...styles.bold, marginBottom: 4 }}>
            Pelo presente instrumento particular, celebram entre si:
          </Text>
          <Text style={{ marginBottom: 4 }}>
            <Text style={styles.bold}>CONTRATADA</Text>: {CONTRATADA.nome}, pessoa jurídica de direito privado inscrita
            no CNPJ/MF sob nº {CONTRATADA.cnpj}, com sede em {CONTRATADA.endereco}, e-mail de contato{" "}
            {CONTRATADA.email}, doravante denominada apenas "CONTRATADA" ou "CP System"; e
          </Text>
          <Text>
            <Text style={styles.bold}>ANALISTA PARCEIRO</Text>: {nome}, pessoa física inscrita no CPF/MF sob nº {cpf},
            residente e domiciliado em {endereco}, e-mail {email}, telefone {telefone}, doravante denominado apenas
            "ANALISTA" ou "PARCEIRO".
          </Text>
        </View>

        <Text style={styles.paragraph}>
          As Partes celebram o presente <Text style={styles.bold}>Contrato de Adesão ao Programa de Analista Parceiro</Text>,
          que se regerá pelas cláusulas a seguir, cuja aceitação eletrônica pelo ANALISTA (marcação de checkbox ou uso da
          Plataforma) equivale à assinatura física para todos os efeitos legais, nos termos do art. 10, §2º da MP
          2.200-2/2001, registrando-se endereço IP, horário e versão do documento aceitos.
        </Text>

        <Text style={styles.sectionTitle}>1. Objeto</Text>
        <Text style={styles.paragraph}>
          1.1. O objeto deste Contrato é regular a adesão do ANALISTA ao Programa de Analista Parceiro do CP System,
          mediante o qual o ANALISTA poderá indicar empresas para adesão à Plataforma e receber, em contrapartida,
          comissão fixa recorrente nos termos da Cláusula 3.
        </Text>
        <Text style={styles.paragraph}>
          1.2. A adesão é gratuita — o ANALISTA não paga mensalidade nem taxa de cadastro.
        </Text>
        <Text style={styles.paragraph}>
          1.3. A relação entre as Partes é estritamente comercial e autônoma. Este Contrato não gera vínculo empregatício,
          societário, de representação exclusiva ou mandato entre CONTRATADA e ANALISTA. O ANALISTA atua como pessoa física
          ou pessoa jurídica autônoma, cumprindo suas próprias obrigações tributárias, previdenciárias e trabalhistas.
        </Text>

        <Text style={styles.sectionTitle}>2. Cadastro e Elegibilidade</Text>
        <Text style={styles.paragraph}>
          2.1. Para participar do Programa, o ANALISTA deve realizar cadastro fornecendo dados verdadeiros e atualizados,
          incluindo: nome completo, CPF, endereço, e-mail, telefone com DDD (WhatsApp) e chave PIX válida (CPF, e-mail,
          celular ou aleatória) para recebimento das comissões — a chave PIX é obrigatória, uma vez que o pagamento das
          comissões é exclusivamente por PIX automático.
        </Text>
        <Text style={styles.paragraph}>
          2.2. O ANALISTA declara, sob as penas dos arts. 297, 298 e 299 do Código Penal, a veracidade das informações
          prestadas e assume responsabilidade civil e criminal por eventual falsidade.
        </Text>
        <Text style={styles.paragraph}>
          2.3. Requisitos mínimos: ser maior de 18 anos, ter CPF ativo e regular perante a Receita Federal, e possuir
          chave PIX ativa em instituição financeira brasileira.
        </Text>

        <Text style={styles.sectionTitle}>3. Comissão</Text>
        <Text style={styles.paragraph}>
          3.1. Por cada empresa que o ANALISTA indicar e que se converter em cliente pagante (assinatura ativa com ao
          menos uma fatura paga), o ANALISTA fará jus à comissão de R$ 29,90 (vinte e nove reais e noventa centavos)
          por mês, por cliente ativo, recorrente e enquanto o cliente indicado permanecer com assinatura ativa da
          Plataforma.
        </Text>
        <Text style={styles.paragraph}>
          3.2. A vinculação analista↔cliente ocorre por: (i) link pessoal de indicação contendo identificador único do
          ANALISTA (cpsystem.app.br/signup?ref=&lt;analistaId&gt;); (ii) cupom promocional gerado com analista vinculado;
          ou (iii) seleção manual do ANALISTA pelo cliente durante o cadastro. A vinculação registrada não pode ser
          transferida a outro analista.
        </Text>
        <Text style={styles.paragraph}>
          3.3. Gatilho de elegibilidade: a comissão passa a ser devida somente após a primeira fatura paga pelo cliente
          indicado. Contas que permaneçam apenas em trial, sem pagamento efetivo, não geram comissão.
        </Text>
        <Text style={styles.paragraph}>
          3.4. Cronograma de pagamento: o pagamento das comissões é feito automaticamente por PIX, no dia 20 de cada
          mês, referente às comissões apuradas sobre as assinaturas ativas no fechamento do mês imediatamente anterior.
          O PIX é transferido para a chave cadastrada pelo ANALISTA nos termos da Cláusula 2.1.
        </Text>
        <Text style={styles.paragraph}>
          3.5. Eventuais falhas na transferência (chave PIX inválida, alterada sem prévio aviso à CONTRATADA, ou
          instituição financeira indisponível) são de responsabilidade do ANALISTA. A CONTRATADA envidará melhores
          esforços em nova tentativa no dia útil seguinte, mas não responde por perdas decorrentes de dados
          desatualizados fornecidos pelo ANALISTA.
        </Text>
        <Text style={styles.paragraph}>
          3.6. Programas promocionais eventuais (bônus, campanhas de aceleração) terão regras próprias divulgadas
          separadamente e não criam direito adquirido para períodos subsequentes.
        </Text>

        <Text style={styles.sectionTitle}>4. Obrigações do Analista</Text>
        <Text style={styles.paragraph}>4.1. O ANALISTA compromete-se a:</Text>
        <Text style={styles.listItem}>
          • Atuar com ética, boa-fé e transparência junto aos clientes indicados, representando o CP System de forma
          fidedigna e respeitando os limites deste Contrato;
        </Text>
        <Text style={styles.listItem}>
          • Não fazer promessas comerciais não autorizadas pela CONTRATADA (descontos fora dos cupons oficiais,
          promessas de features futuras, garantias de resultado, SLA distinto do publicado etc.);
        </Text>
        <Text style={styles.listItem}>
          • Não utilizar propaganda enganosa, spam, phishing ou práticas abusivas na promoção da Plataforma;
        </Text>
        <Text style={styles.listItem}>
          • Não veicular a marca, logotipo ou material do CP System em contextos difamatórios, ilícitos ou incompatíveis
          com a imagem institucional da CONTRATADA;
        </Text>
        <Text style={styles.listItem}>
          • Manter sigilo sobre dados dos clientes indicados a que porventura tenha acesso e sobre informações
          confidenciais da CONTRATADA;
        </Text>
        <Text style={styles.listItem}>
          • Cumprir integralmente suas próprias obrigações fiscais, especialmente na emissão de recibo ou nota fiscal
          referente às comissões recebidas, quando aplicável, e no recolhimento de tributos incidentes sobre a renda
          auferida.
        </Text>
        <Text style={styles.paragraph}>
          4.2. O descumprimento das obrigações da Cláusula 4.1 autoriza a CONTRATADA a suspender ou encerrar a adesão do
          ANALISTA ao Programa, sem prejuízo das medidas civis e criminais cabíveis.
        </Text>

        <Text style={styles.sectionTitle}>5. Vedações</Text>
        <Text style={styles.paragraph}>São expressamente vedadas ao ANALISTA:</Text>
        <Text style={styles.listItem}>
          • Autoindicação ou fraude: cadastrar-se como cliente sob o próprio CPF/CNPJ usando link ou cupom próprio,
          tentativa de cadastrar múltiplas contas fictícias para gerar comissão artificial, ou qualquer prática de
          gaming do Programa;
        </Text>
        <Text style={styles.listItem}>
          • Compartilhamento indevido do link pessoal para geração de tráfego pago comprado (compra de leads,
          redirecionamento massivo, tráfego incentivado por recompensa) sem autorização prévia e expressa da CONTRATADA;
        </Text>
        <Text style={styles.listItem}>
          • Uso não autorizado da marca CP System (nome, logotipo, layout, materiais institucionais) fora das peças
          oficiais disponibilizadas pela CONTRATADA;
        </Text>
        <Text style={styles.listItem}>
          • Concorrência desleal: durante a vigência do Contrato e por 12 (doze) meses após seu término, oferecer aos
          clientes indicados por meio do Programa produto substituto ao CP System.
        </Text>

        <Text style={styles.sectionTitle}>6. Confidencialidade e Proteção de Dados</Text>
        <Text style={styles.paragraph}>
          6.1. O ANALISTA obriga-se a manter sigilo sobre todas as informações confidenciais da CONTRATADA e de seus
          clientes indicados a que tiver acesso em razão deste Contrato, obrigação que sobrevive por 5 (cinco) anos após
          o término.
        </Text>
        <Text style={styles.paragraph}>
          6.2. Os dados pessoais do ANALISTA são tratados pela CONTRATADA na condição de Controladora, nos termos da
          Lei 13.709/2018 (LGPD), com bases legais em execução do contrato (art. 7º, V) e cumprimento de obrigações
          legais (art. 7º, II). O ANALISTA pode exercer os direitos previstos no art. 18 da LGPD junto ao Encarregado
          de Dados: {CONTRATADA.email}.
        </Text>
        <Text style={styles.paragraph}>
          6.3. Registros fiscais (comissões pagas, PIX efetuados) são mantidos por 5 (cinco) anos após o encerramento,
          conforme legislação tributária.
        </Text>

        <Text style={styles.sectionTitle}>7. Vigência, Rescisão e Encerramento</Text>
        <Text style={styles.paragraph}>
          7.1. Este Contrato entra em vigor na data de aceitação eletrônica pelo ANALISTA e permanece vigente por prazo
          indeterminado.
        </Text>
        <Text style={styles.paragraph}>
          7.2. Qualquer das Partes pode rescindir este Contrato a qualquer tempo, sem multa, mediante comunicação prévia
          de 30 (trinta) dias por e-mail à outra Parte.
        </Text>
        <Text style={styles.paragraph}>
          7.3. A CONTRATADA pode rescindir imediatamente, sem aviso prévio, em caso de descumprimento das Cláusulas 4 e
          5 (obrigações e vedações), fraude, uso indevido de marca ou prática lesiva à imagem do CP System.
        </Text>
        <Text style={styles.paragraph}>
          7.4. Encerrado o Contrato: (i) o link pessoal é desativado; (ii) novas indicações não são mais aceitas;
          (iii) comissões já apuradas e ainda não pagas são liquidadas no próximo ciclo (dia 20 do mês seguinte ao
          encerramento); (iv) comissões referentes a clientes que permaneçam ativos deixam de ser devidas, salvo
          pactuação diversa por escrito.
        </Text>

        <Text style={styles.sectionTitle}>8. Alteração e Suspensão do Programa</Text>
        <Text style={styles.paragraph}>
          8.1. A CONTRATADA poderá alterar as regras do Programa (valor da comissão, gatilhos, cronograma,
          elegibilidade) mediante comunicação prévia de 30 (trinta) dias por e-mail e/ou WhatsApp ao ANALISTA.
          Discordando, o ANALISTA pode rescindir sem custo dentro do mesmo prazo.
        </Text>
        <Text style={styles.paragraph}>
          8.2. As comissões devidas antes da alteração serão liquidadas nas condições vigentes à época do fato gerador
          (adesão do cliente indicado e pagamento pelo cliente).
        </Text>
        <Text style={styles.paragraph}>
          8.3. A CONTRATADA poderá encerrar o Programa a qualquer tempo, mediante notificação prévia de 60 (sessenta)
          dias, garantido o pagamento das comissões apuradas até o encerramento.
        </Text>

        <Text style={styles.sectionTitle}>9. Limitação de Responsabilidade</Text>
        <Text style={styles.paragraph}>
          9.1. A responsabilidade da CONTRATADA perante o ANALISTA por qualquer causa fica limitada, em conjunto e por
          qualquer título, ao valor total das comissões devidas e não pagas ao ANALISTA nos 12 (doze) meses anteriores
          ao evento gerador.
        </Text>
        <Text style={styles.paragraph}>
          9.2. A CONTRATADA não responde por lucros cessantes, expectativa de ganho futuro, danos indiretos ou reflexos,
          tampouco por decisões comerciais tomadas pelo ANALISTA com base em projeções próprias.
        </Text>

        <Text style={styles.sectionTitle}>10. Confidencialidade da Estrutura de Comissão</Text>
        <Text style={styles.paragraph}>
          10.1. O ANALISTA compromete-se a não divulgar publicamente, salvo autorização expressa da CONTRATADA,
          informações sensíveis da estrutura interna do Programa que não estejam já publicadas em página oficial
          (cpsystem.app.br/seja-embaixador), tais como: percentuais promocionais restritos, campanhas fechadas e cupons
          diferenciados.
        </Text>

        <Text style={styles.sectionTitle}>11. Comunicações e Notificações</Text>
        <Text style={styles.paragraph}>
          11.1. Comunicações formais serão válidas quando enviadas para: (i) o e-mail cadastrado do ANALISTA; ou (ii){" "}
          {CONTRATADA.email} em nome da CONTRATADA.
        </Text>

        <Text style={styles.sectionTitle}>12. Foro, Legislação e Resolução de Conflitos</Text>
        <Text style={styles.paragraph}>
          12.1. Este Contrato rege-se pelas leis da República Federativa do Brasil.
        </Text>
        <Text style={styles.paragraph}>
          12.2. As Partes elegem o foro da Comarca de {FORO}, renunciando a qualquer outro, por mais privilegiado que
          seja.
        </Text>
        <Text style={styles.paragraph}>
          12.3. Antes da via judicial, as Partes obrigam-se a tentar solução amigável por 30 (trinta) dias, podendo
          recorrer à mediação e conciliação nos termos da Lei 13.140/2015.
        </Text>

        <Text style={styles.sectionTitle}>13. Disposições Gerais</Text>
        <Text style={styles.paragraph}>13.1. Eventual nulidade parcial não invalida as demais cláusulas.</Text>
        <Text style={styles.paragraph}>
          13.2. A não exigência, por qualquer das Partes, de cumprimento de qualquer disposição não constitui renúncia
          ou novação.
        </Text>
        <Text style={styles.paragraph}>
          13.3. Este Contrato, em conjunto com a Política de Privacidade e a página oficial cpsystem.app.br/seja-embaixador,
          constitui o acordo integral entre as Partes, substituindo comunicações verbais anteriores sobre o mesmo objeto.
        </Text>
        <Text style={styles.paragraph}>
          13.4. A marcação do checkbox "Li e aceito" ou o uso da Plataforma após o cadastro registra, com endereço IP,
          horário e versão vigente, o aceite eletrônico com força de assinatura, nos termos do art. 10, §2º da MP
          2.200-2/2001.
        </Text>

        <View style={styles.qualifBox}>
          <Text style={{ ...styles.bold, marginBottom: 4 }}>Qualificação Institucional das Partes</Text>
          <Text style={styles.bold}>CONTRATADA — {CONTRATADA.nome}</Text>
          <Text>Razão social: {CONTRATADA.razao}</Text>
          <Text>CNPJ: {CONTRATADA.cnpj}</Text>
          <Text>Sede: {CONTRATADA.endereco}</Text>
          <Text>E-mail / DPO: {CONTRATADA.email}</Text>
          <Text style={{ marginBottom: 6 }}>WhatsApp business: {CONTRATADA.wa}</Text>
          <Text style={styles.bold}>ANALISTA</Text>
          <Text>Nome: {nome}</Text>
          <Text>CPF: {cpf}</Text>
          <Text>Endereço: {endereco}</Text>
          <Text>E-mail: {email}</Text>
          <Text>Telefone: {telefone}</Text>
        </View>

        <Text style={{ marginTop: 12, fontSize: 8, color: "#94A3B8" }}>
          Documento em vigor desde {VIGENCIA_CONTRATO_ANALISTA} · Versão {VERSAO_CONTRATO_ANALISTA} · Aceite eletrônico
          com valor de assinatura conforme MP 2.200-2/2001. O sistema registra IP e horário no momento do aceite pelo
          ANALISTA.
        </Text>

        <View style={styles.footer} fixed>
          <Text>
            CP System · CNPJ {CONTRATADA.cnpj} · v{VERSAO_CONTRATO_ANALISTA}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
