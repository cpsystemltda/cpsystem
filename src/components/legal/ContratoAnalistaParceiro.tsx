// Contrato do Analista Parceiro — CP System
// Versão 1.0 — 13/07/2026
//
// Regina 13/07: contrato específico pra ANALISTA (conta tipo ANALISTA).
// Estrutura das partes: CONTRATADA (CP System) x ANALISTA (pessoa física
// que se cadastra pra receber comissão por indicações). Componente independente
// do contrato empresa (ContratoTermosUso.tsx) — signup separa qual mostrar
// pelo tipo escolhido.

export const VERSAO_CONTRATO_ANALISTA = "1.0";
export const VIGENCIA_CONTRATO_ANALISTA = "13/07/2026";

const CONTRATADA = {
  nome: "CP SYSTEM",
  razao: "CONTRATOS PUBLICOS SYSTEM LTDA",
  cnpj: "67.266.466/0001-04",
  endereco: "SRTVS Qd. 701, Bloco B, Sala 616, Asa Sul, Brasília/DF, CEP 70.340-906",
  email: "contato@cpsystem.app.br",
  wa: "+55 11 97061-9434",
};

const FORO = "Brasília — Distrito Federal";
const PLACEHOLDER = "[a ser preenchido no cadastro]";

export type DadosAnalista = {
  nomeCompleto?: string | null;
  cpf?: string | null;
  endereco?: string | null;
  email?: string | null;
  telefone?: string | null;
};

function formatarCpf(cpf: string | null | undefined): string {
  if (!cpf) return PLACEHOLDER;
  const n = cpf.replace(/\D/g, "");
  if (n.length !== 11) return cpf;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
}

export function ContratoAnalistaParceiro({ analista }: { analista?: DadosAnalista }) {
  const nome = analista?.nomeCompleto || PLACEHOLDER;
  const cpf = formatarCpf(analista?.cpf);
  const endereco = analista?.endereco || PLACEHOLDER;
  const email = analista?.email || PLACEHOLDER;
  const telefone = analista?.telefone || PLACEHOLDER;

  return (
    <article className="text-[13px] leading-[1.75]" style={{ color: "var(--text)" }}>
      <p className="mb-6 text-xs" style={{ color: "var(--text-mute)" }}>
        Versão <strong>{VERSAO_CONTRATO_ANALISTA}</strong> · Em vigor desde <strong>{VIGENCIA_CONTRATO_ANALISTA}</strong>
      </p>

      {/* Qualificação das Partes */}
      <div
        className="mb-8 rounded-xl px-5 py-4 text-[12px]"
        style={{ background: "rgba(15,14,12,0.03)", border: "0.5px solid var(--hairline)" }}
      >
        <p className="mb-3">
          <strong>Pelo presente instrumento particular, celebram entre si:</strong>
        </p>
        <p className="mb-3">
          <strong>CONTRATADA</strong>: <strong>{CONTRATADA.nome}</strong>, pessoa jurídica de direito
          privado inscrita no CNPJ/MF sob nº <strong>{CONTRATADA.cnpj}</strong>, com sede em{" "}
          {CONTRATADA.endereco}, e-mail de contato <code>{CONTRATADA.email}</code>, doravante
          denominada apenas <strong>&ldquo;CONTRATADA&rdquo;</strong> ou{" "}
          <strong>&ldquo;CP System&rdquo;</strong>; e
        </p>
        <p>
          <strong>ANALISTA PARCEIRO</strong>: <strong>{nome}</strong>, pessoa física inscrita no CPF/MF
          sob nº <strong>{cpf}</strong>, residente e domiciliado em <strong>{endereco}</strong>,
          e-mail <code>{email}</code>, telefone <code>{telefone}</code>, doravante denominado
          apenas <strong>&ldquo;ANALISTA&rdquo;</strong> ou <strong>&ldquo;PARCEIRO&rdquo;</strong>.
        </p>
      </div>

      <p className="mb-8">
        As Partes celebram o presente <strong>Contrato de Adesão ao Programa de Analista Parceiro</strong>,
        que se regerá pelas cláusulas a seguir, cuja aceitação eletrônica pelo ANALISTA
        (marcação de <em>checkbox</em> ou uso da Plataforma) equivale à assinatura física para
        todos os efeitos legais, nos termos do art. 10, §2º da MP 2.200-2/2001, registrando-se
        endereço IP, horário e versão do documento aceitos.
      </p>

      <Section num="1" title="Objeto">
        <p>
          1.1. O objeto deste Contrato é regular a adesão do ANALISTA ao{" "}
          <strong>Programa de Analista Parceiro do CP System</strong>, mediante o qual o ANALISTA
          poderá indicar empresas para adesão à Plataforma e receber, em contrapartida,
          <strong> comissão fixa recorrente</strong> nos termos da Cláusula 3.
        </p>
        <p>
          1.2. A adesão é <strong>gratuita</strong> — o ANALISTA não paga mensalidade nem taxa de cadastro.
        </p>
        <p>
          1.3. A relação entre as Partes é <strong>estritamente comercial e autônoma</strong>. Este
          Contrato não gera vínculo empregatício, societário, de representação exclusiva ou
          mandato entre CONTRATADA e ANALISTA. O ANALISTA atua como pessoa física ou pessoa
          jurídica autônoma, cumprindo suas próprias obrigações tributárias, previdenciárias
          e trabalhistas.
        </p>
      </Section>

      <Section num="2" title="Cadastro e Elegibilidade">
        <p>
          2.1. Para participar do Programa, o ANALISTA deve realizar cadastro fornecendo dados
          verdadeiros e atualizados, incluindo: nome completo, CPF, endereço, e-mail, telefone
          com DDD (WhatsApp) e <strong>chave PIX válida</strong> (CPF, e-mail, celular ou aleatória)
          para recebimento das comissões — a chave PIX é <strong>obrigatória</strong>, uma vez que o
          pagamento das comissões é exclusivamente por PIX automático.
        </p>
        <p>
          2.2. O ANALISTA declara, sob as penas dos arts. 297, 298 e 299 do Código Penal, a
          veracidade das informações prestadas e assume responsabilidade civil e criminal por
          eventual falsidade.
        </p>
        <p>
          2.3. Requisitos mínimos: ser maior de 18 anos, ter CPF ativo e regular perante a
          Receita Federal, e possuir chave PIX ativa em instituição financeira brasileira.
        </p>
      </Section>

      <Section num="3" title="Comissão">
        <p>
          3.1. Por cada empresa que o ANALISTA indicar e que se converter em <strong>cliente pagante</strong>
          (assinatura ativa com ao menos uma fatura paga), o ANALISTA fará jus à comissão de
          <strong> R$ 29,90 (vinte e nove reais e noventa centavos) por mês</strong>, por cliente ativo,
          recorrente e enquanto o cliente indicado permanecer com assinatura ativa da Plataforma.
        </p>
        <p>
          3.2. A vinculação analista&harr;cliente ocorre por: (i) link pessoal de indicação
          contendo identificador único do ANALISTA (
          <code>cpsystem.app.br/signup?ref=&lt;analistaId&gt;</code>); (ii) cupom promocional
          gerado com analista vinculado; ou (iii) seleção manual do ANALISTA pelo cliente
          durante o cadastro. A vinculação registrada não pode ser transferida a outro analista.
        </p>
        <p>
          3.3. <strong>Gatilho de elegibilidade</strong>: a comissão passa a ser devida somente após a{" "}
          <strong>primeira fatura paga</strong> pelo cliente indicado. Contas que permaneçam apenas em trial,
          sem pagamento efetivo, não geram comissão.
        </p>
        <p>
          3.4. <strong>Cronograma de pagamento</strong>: o pagamento das comissões é feito automaticamente
          por PIX, no <strong>dia 20 de cada mês</strong>, referente às comissões apuradas sobre as
          assinaturas ativas no fechamento do mês imediatamente anterior. O PIX é transferido
          para a chave cadastrada pelo ANALISTA nos termos da Cláusula 2.1.
        </p>
        <p>
          3.5. Eventuais falhas na transferência (chave PIX inválida, alterada sem prévio aviso
          à CONTRATADA, ou instituição financeira indisponível) são de responsabilidade do
          ANALISTA. A CONTRATADA envidará melhores esforços em nova tentativa no dia útil
          seguinte, mas não responde por perdas decorrentes de dados desatualizados fornecidos
          pelo ANALISTA.
        </p>
        <p>
          3.6. Programas promocionais eventuais (bônus, campanhas de aceleração) terão regras
          próprias divulgadas separadamente e não criam direito adquirido para períodos
          subsequentes.
        </p>
      </Section>

      <Section num="4" title="Obrigações do Analista">
        <p>4.1. O ANALISTA compromete-se a:</p>
        <List>
          <li>
            Atuar com <strong>ética, boa-fé e transparência</strong> junto aos clientes indicados,
            representando o CP System de forma fidedigna e respeitando os limites deste
            Contrato;
          </li>
          <li>
            Não fazer <strong>promessas comerciais</strong> não autorizadas pela CONTRATADA (descontos
            fora dos cupons oficiais, promessas de features futuras, garantias de resultado,
            SLA distinto do publicado etc.);
          </li>
          <li>
            Não utilizar <strong>propaganda enganosa, spam, phishing ou práticas abusivas</strong> na
            promoção da Plataforma;
          </li>
          <li>
            Não veicular a marca, logotipo ou material do CP System em contextos difamatórios,
            ilícitos ou incompatíveis com a imagem institucional da CONTRATADA;
          </li>
          <li>
            Manter <strong>sigilo</strong> sobre dados dos clientes indicados a que porventura tenha
            acesso e sobre informações confidenciais da CONTRATADA;
          </li>
          <li>
            Cumprir integralmente suas próprias <strong>obrigações fiscais</strong>, especialmente na
            emissão de recibo ou nota fiscal referente às comissões recebidas, quando aplicável,
            e no recolhimento de tributos incidentes sobre a renda auferida.
          </li>
        </List>
        <p>
          4.2. O <strong>descumprimento</strong> das obrigações da Cláusula 4.1 autoriza a CONTRATADA a
          suspender ou encerrar a adesão do ANALISTA ao Programa, sem prejuízo das medidas
          civis e criminais cabíveis.
        </p>
      </Section>

      <Section num="5" title="Vedações">
        <p>São expressamente vedadas ao ANALISTA:</p>
        <List>
          <li>
            <strong>Autoindicação ou fraude</strong>: cadastrar-se como cliente sob o próprio CPF/CNPJ
            usando link ou cupom próprio, tentativa de cadastrar múltiplas contas fictícias
            para gerar comissão artificial, ou qualquer prática de <em>gaming</em> do Programa;
          </li>
          <li>
            <strong>Compartilhamento indevido</strong> do link pessoal para geração de tráfego pago
            comprado (compra de leads, redirecionamento massivo, tráfego incentivado por
            recompensa) sem autorização prévia e expressa da CONTRATADA;
          </li>
          <li>
            <strong>Uso não autorizado da marca</strong> CP System (nome, logotipo, layout, materiais
            institucionais) fora das peças oficiais disponibilizadas pela CONTRATADA;
          </li>
          <li>
            <strong>Concorrência desleal</strong>: durante a vigência do Contrato e por 12 (doze) meses
            após seu término, oferecer aos clientes indicados por meio do Programa produto
            substituto ao CP System.
          </li>
        </List>
      </Section>

      <Section num="6" title="Confidencialidade e Proteção de Dados">
        <p>
          6.1. O ANALISTA obriga-se a manter <strong>sigilo</strong> sobre todas as informações
          confidenciais da CONTRATADA e de seus clientes indicados a que tiver acesso em razão
          deste Contrato, obrigação que sobrevive por 5 (cinco) anos após o término.
        </p>
        <p>
          6.2. Os dados pessoais do ANALISTA são tratados pela CONTRATADA na condição de{" "}
          <strong>Controladora</strong>, nos termos da Lei 13.709/2018 (LGPD), com bases legais em
          execução do contrato (art. 7º, V) e cumprimento de obrigações legais (art. 7º, II).
          O ANALISTA pode exercer os direitos previstos no art. 18 da LGPD junto ao Encarregado
          de Dados: <code>{CONTRATADA.email}</code>.
        </p>
        <p>
          6.3. Registros fiscais (comissões pagas, PIX efetuados) são mantidos por 5 (cinco)
          anos após o encerramento, conforme legislação tributária.
        </p>
      </Section>

      <Section num="7" title="Vigência, Rescisão e Encerramento">
        <p>
          7.1. Este Contrato entra em vigor na data de aceitação eletrônica pelo ANALISTA e
          permanece vigente por <strong>prazo indeterminado</strong>.
        </p>
        <p>
          7.2. Qualquer das Partes pode rescindir este Contrato a qualquer tempo, sem multa,
          mediante comunicação prévia de 30 (trinta) dias por e-mail à outra Parte.
        </p>
        <p>
          7.3. A CONTRATADA pode rescindir <strong>imediatamente</strong>, sem aviso prévio, em caso de
          descumprimento das Cláusulas 4 e 5 (obrigações e vedações), fraude, uso indevido de
          marca ou prática lesiva à imagem do CP System.
        </p>
        <p>
          7.4. Encerrado o Contrato: (i) o link pessoal é desativado; (ii) novas indicações não
          são mais aceitas; (iii) comissões já apuradas e ainda não pagas são liquidadas no
          próximo ciclo (dia 20 do mês seguinte ao encerramento); (iv) comissões referentes
          a clientes que permaneçam ativos <strong>deixam de ser devidas</strong>, salvo pactuação
          diversa por escrito.
        </p>
      </Section>

      <Section num="8" title="Alteração e Suspensão do Programa">
        <p>
          8.1. A CONTRATADA poderá alterar as regras do Programa (valor da comissão, gatilhos,
          cronograma, elegibilidade) mediante <strong>comunicação prévia de 30 (trinta) dias</strong> por
          e-mail e/ou WhatsApp ao ANALISTA. Discordando, o ANALISTA pode rescindir sem custo
          dentro do mesmo prazo.
        </p>
        <p>
          8.2. As comissões devidas antes da alteração serão liquidadas nas condições vigentes
          à época do fato gerador (adesão do cliente indicado e pagamento pelo cliente).
        </p>
        <p>
          8.3. A CONTRATADA poderá <strong>encerrar o Programa</strong> a qualquer tempo, mediante
          notificação prévia de 60 (sessenta) dias, garantido o pagamento das comissões
          apuradas até o encerramento.
        </p>
      </Section>

      <Section num="9" title="Limitação de Responsabilidade">
        <p>
          9.1. A responsabilidade da CONTRATADA perante o ANALISTA por qualquer causa fica
          limitada, em conjunto e por qualquer título, ao <strong>valor total das comissões devidas
          e não pagas</strong> ao ANALISTA nos 12 (doze) meses anteriores ao evento gerador.
        </p>
        <p>
          9.2. A CONTRATADA <strong>não responde por lucros cessantes</strong>, expectativa de ganho futuro,
          danos indiretos ou reflexos, tampouco por decisões comerciais tomadas pelo ANALISTA
          com base em projeções próprias.
        </p>
      </Section>

      <Section num="10" title="Confidencialidade da Estrutura de Comissão">
        <p>
          10.1. O ANALISTA compromete-se a <strong>não divulgar publicamente</strong>, salvo autorização
          expressa da CONTRATADA, informações sensíveis da estrutura interna do Programa que
          não estejam já publicadas em página oficial (
          <code>cpsystem.app.br/seja-embaixador</code>), tais como: percentuais promocionais
          restritos, campanhas fechadas e cupons diferenciados.
        </p>
      </Section>

      <Section num="11" title="Comunicações e Notificações">
        <p>
          11.1. Comunicações formais serão válidas quando enviadas para: (i) o e-mail cadastrado
          do ANALISTA; ou (ii) <code>{CONTRATADA.email}</code> em nome da CONTRATADA.
        </p>
      </Section>

      <Section num="12" title="Foro, Legislação e Resolução de Conflitos">
        <p>
          12.1. Este Contrato rege-se pelas leis da República Federativa do Brasil.
        </p>
        <p>
          12.2. As Partes elegem o foro da <strong>Comarca de {FORO}</strong>, renunciando a qualquer
          outro, por mais privilegiado que seja.
        </p>
        <p>
          12.3. Antes da via judicial, as Partes obrigam-se a tentar solução amigável por 30
          (trinta) dias, podendo recorrer à mediação e conciliação nos termos da Lei 13.140/2015.
        </p>
      </Section>

      <Section num="13" title="Disposições Gerais">
        <p>
          13.1. Eventual nulidade parcial não invalida as demais cláusulas.
        </p>
        <p>
          13.2. A não exigência, por qualquer das Partes, de cumprimento de qualquer disposição
          não constitui renúncia ou novação.
        </p>
        <p>
          13.3. Este Contrato, em conjunto com a Política de Privacidade e a página oficial
          <code> cpsystem.app.br/seja-embaixador</code>, constitui o acordo integral entre as
          Partes, substituindo comunicações verbais anteriores sobre o mesmo objeto.
        </p>
        <p>
          13.4. A marcação do checkbox &ldquo;Li e aceito&rdquo; ou o uso da Plataforma após o
          cadastro registra, com endereço IP, horário e versão vigente, o aceite eletrônico com
          força de assinatura, nos termos do art. 10, §2º da MP 2.200-2/2001.
        </p>
      </Section>

      {/* Qualificação Institucional das Partes */}
      <div
        className="mt-10 rounded-xl px-5 py-4 text-[12px]"
        style={{ background: "rgba(15,14,12,0.03)", border: "0.5px solid var(--hairline)" }}
      >
        <p className="mb-3 font-bold">Qualificação Institucional das Partes</p>
        <div className="mb-4">
          <p className="font-bold">CONTRATADA — {CONTRATADA.nome}</p>
          <p>Razão social: {CONTRATADA.razao}</p>
          <p>CNPJ: {CONTRATADA.cnpj}</p>
          <p>Sede: {CONTRATADA.endereco}</p>
          <p>E-mail / DPO: {CONTRATADA.email}</p>
          <p>WhatsApp business: {CONTRATADA.wa}</p>
        </div>
        <div>
          <p className="font-bold">ANALISTA</p>
          <p>Nome: {nome}</p>
          <p>CPF: {cpf}</p>
          <p>Endereço: {endereco}</p>
          <p>E-mail: {email}</p>
          <p>Telefone: {telefone}</p>
        </div>
      </div>

      <p className="mt-6 text-xs" style={{ color: "var(--text-mute)" }}>
        Documento em vigor desde {VIGENCIA_CONTRATO_ANALISTA} · Versão {VERSAO_CONTRATO_ANALISTA} · Aceite
        eletrônico com valor de assinatura conforme MP 2.200-2/2001. O sistema registra IP e
        horário no momento do aceite pelo ANALISTA.
      </p>
    </article>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-bold">
        {num}. {title}
      </h3>
      <div className="space-y-2 text-[13px]">{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="my-2 ml-6 list-disc space-y-1.5 text-[13px]">{children}</ul>;
}
