// Contrato de Prestação de Serviços & Termos de Uso do CP System
// Versão 2.1 — 03/07/2026
//
// Componente único (fonte da verdade do texto). Aceita props opcionais
// com dados do CONTRATANTE — quando presentes, o contrato fica
// PERSONALIZADO em nome do cliente (razão social, CNPJ, nome do
// representante, CPF). Sem dados: mostra placeholder pra visitantes
// anônimos.

export const VERSAO_TERMOS = "2.1";
export const VIGENCIA_TERMOS = "03/07/2026";

const CONTRATADA = {
  razao: "REGINA LUIZA DA SILVA FERNANDES",
  cnpj: "42.736.317/0001-30",
  endereco: "Rio de Janeiro/RJ",
  email: "contato@cpsystem.app.br",
  wa: "+55 11 97061-9434",
};

const FORO = "Brasília — Distrito Federal";

const PLACEHOLDER = "[a ser preenchido no cadastro]";

export type DadosContratante = {
  razaoSocial?: string | null;
  cnpj?: string | null;
  enderecoEmpresa?: string | null;
  nomeRepresentante?: string | null;
  cpfRepresentante?: string | null;
  emailRepresentante?: string | null;
};

function formatarCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return PLACEHOLDER;
  const n = cnpj.replace(/\D/g, "");
  if (n.length !== 14) return cnpj;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12, 14)}`;
}

function formatarCpf(cpf: string | null | undefined): string {
  if (!cpf) return PLACEHOLDER;
  const n = cpf.replace(/\D/g, "");
  if (n.length !== 11) return cpf;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
}

export function ContratoTermosUso({ contratante }: { contratante?: DadosContratante }) {
  const razao = contratante?.razaoSocial || PLACEHOLDER;
  const cnpj = formatarCnpj(contratante?.cnpj);
  const endereco = contratante?.enderecoEmpresa || PLACEHOLDER;
  const representante = contratante?.nomeRepresentante || PLACEHOLDER;
  const cpfRep = formatarCpf(contratante?.cpfRepresentante);
  const emailRep = contratante?.emailRepresentante || PLACEHOLDER;
  return (
    <article className="text-[13px] leading-[1.75]" style={{ color: "var(--text)" }}>
      <p className="mb-6 text-xs" style={{ color: "var(--text-mute)" }}>
        Versão <strong>{VERSAO_TERMOS}</strong> · Em vigor desde <strong>{VIGENCIA_TERMOS}</strong>
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
          <strong>CONTRATADA</strong>: <strong>{CONTRATADA.razao}</strong>, pessoa jurídica
          de direito privado inscrita no CNPJ/MF sob nº <strong>{CONTRATADA.cnpj}</strong>,
          com sede em {CONTRATADA.endereco}, e-mail de contato{" "}
          <code>{CONTRATADA.email}</code>, doravante denominada apenas{" "}
          <strong>&ldquo;CONTRATADA&rdquo;</strong> ou <strong>&ldquo;CP System&rdquo;</strong>; e
        </p>
        <p>
          <strong>CONTRATANTE</strong>: <strong>{razao}</strong>, pessoa jurídica de direito
          privado inscrita no CNPJ/MF sob nº <strong>{cnpj}</strong>, com sede em{" "}
          <strong>{endereco}</strong>, neste ato representada por{" "}
          <strong>{representante}</strong>, portador do CPF nº <strong>{cpfRep}</strong>,
          e-mail <code>{emailRep}</code>, doravante denominada apenas{" "}
          <strong>&ldquo;CONTRATANTE&rdquo;</strong> ou <strong>&ldquo;Cliente&rdquo;</strong>.
        </p>
      </div>

      <p className="mb-8">
        As Partes acima qualificadas celebram o presente{" "}
        <strong>Contrato de Prestação de Serviços por Adesão &amp; Termos de Uso</strong>, que
        se regerá pelas cláusulas e condições a seguir, cuja aceitação eletrônica pelo
        CONTRATANTE (marcação de <em>checkbox</em>, uso da plataforma ou pagamento) equivale
        à assinatura física para todos os efeitos legais, nos termos do art. 10, §2º da MP
        2.200-2/2001 e do art. 442 do Código Civil, registrando-se o endereço IP, o horário
        (<em>timestamp</em>) e a versão do documento aceitos.
      </p>

      <Section num="1" title="Definições">
        <p>Para os fins deste Contrato, entende-se por:</p>
        <List>
          <li><strong>Plataforma</strong> ou <strong>Serviço</strong>: o software CP System, oferecido em modelo <em>Software as a Service</em> (SaaS), acessível via internet no domínio <code>cpsystem.app.br</code>.</li>
          <li><strong>Conta</strong>: registro do Cliente na Plataforma, vinculado a um ou mais CNPJs e um ou mais Usuários autorizados.</li>
          <li><strong>Usuário</strong>: pessoa física com credenciais de acesso à Conta do Cliente (administrador, sócio, funcionário ou terceiro autorizado).</li>
          <li><strong>Dados do Cliente</strong>: informações inseridas pelo Cliente na Plataforma (atas, contratos, empenhos, anexos, dados fiscais, comunicações, comissões, pareceres jurídicos e demais registros).</li>
          <li><strong>Dados Pessoais</strong>: quaisquer informações relacionadas à pessoa natural identificada ou identificável, conforme art. 5º, I da Lei 13.709/2018 (LGPD).</li>
          <li><strong>Terceiros Autorizados</strong>: provedores contratados pela CONTRATADA para viabilizar o Serviço, notadamente: Asaas (gateway de pagamento e emissão de NFSe), Meta/Z-API (mensageria WhatsApp), Google LLC (integração com Google Calendar), Anthropic PBC (análise por Inteligência Artificial), Vercel Inc. e Neon Inc. (hospedagem e banco de dados).</li>
          <li><strong>IAsystem</strong>: funcionalidade da Plataforma baseada em Modelos de Linguagem de Larga Escala (LLMs) que gera análises e pareceres a partir dos Dados do Cliente.</li>
          <li><strong>Lei 14.133/2021</strong>: Lei de Licitações e Contratos Administrativos, arcabouço regulatório central da atividade-fim da Plataforma.</li>
        </List>
      </Section>

      <Section num="2" title="Objeto do Contrato">
        <p>
          2.1. O objeto deste Contrato é a concessão, pela CONTRATADA ao CONTRATANTE, de
          <strong> licença de uso não exclusiva, intransferível, revogável e limitada no tempo</strong> da
          Plataforma CP System, para gestão pós-licitação de atas, contratos e empenhos derivados
          da Lei 14.133/2021, incluindo:
        </p>
        <List>
          <li>Cadastro e controle de Atas de Registro de Preços, Contratos Administrativos, Notas de Empenho, Ordens de Serviço, Autorizações de Compra e Entrega, Aditivos, Apostilamentos e Reajustes;</li>
          <li>Timeline de execução com marcos (pedido recebido, entrega, emissão de NF, encaminhamento, pagamento);</li>
          <li>Alertas automáticos de prazos, vencimentos, entregas e pontos de atenção jurídica;</li>
          <li>Cálculo de saldos por vigência, comissões variáveis e fixas com analistas parceiros;</li>
          <li>Análise jurídica por Inteligência Artificial (IAsystem) sobre documentos anexados;</li>
          <li>Integrações com Google Calendar, e-mail e WhatsApp para notificações operacionais;</li>
          <li>Painel financeiro consolidado por empresa e multi-empresa;</li>
          <li>Emissão de relatórios auditáveis e trilha de auditoria (log imutável).</li>
        </List>
        <p>
          2.2. A licença tem <strong>vigência coincidente com a assinatura ativa</strong> do plano contratado
          e extingue-se automaticamente com o cancelamento, rescisão ou inadimplência definitiva
          da Conta.
        </p>
        <p>
          2.3. A CONTRATADA <strong>reserva-se o direito de evoluir, adicionar, remover ou modificar
          funcionalidades</strong> a qualquer momento, sem prévio aviso, desde que preserve as
          funcionalidades essenciais anunciadas ao Cliente no momento da contratação.
        </p>
      </Section>

      <Section num="3" title="Cadastro, Autenticação e Segurança das Credenciais">
        <p>
          3.1. Para acessar o Serviço, o CONTRATANTE deve realizar cadastro fornecendo dados
          verdadeiros, completos, atualizados e integralmente responsáveis, incluindo:
          nome completo, CPF, cargo, e-mail, telefone com DDD (WhatsApp), data de nascimento
          e informações da pessoa jurídica (razão social, CNPJ, porte, endereço, telefone,
          responsável legal).
        </p>
        <p>
          3.2. O CONTRATANTE declara, sob as penas dos arts. 297, 298 e 299 do Código Penal, a
          veracidade das informações prestadas e assume responsabilidade civil e criminal por
          eventual falsidade.
        </p>
        <p>
          3.3. O CONTRATANTE é o <strong>único e integral responsável</strong> pela guarda de suas
          credenciais (login e senha). Todas as ações praticadas com uso das credenciais
          presumem-se realizadas pelo CONTRATANTE, inclusive para efeitos financeiros e
          jurídicos, dispensada a CONTRATADA de verificação adicional de autoria.
        </p>
        <p>
          3.4. Em caso de comprometimento das credenciais (perda, roubo, uso indevido), o
          CONTRATANTE deve notificar a CONTRATADA imediatamente pelo canal <code>{CONTRATADA.email}</code>,
          sob pena de responder por eventuais prejuízos decorrentes da omissão.
        </p>
        <p>
          3.5. É <strong>expressamente vedado</strong> o compartilhamento da mesma credencial entre pessoas
          físicas distintas. Para operações em equipe, o CONTRATANTE deve cadastrar
          Usuários adicionais no menu Equipe.
        </p>
        <p>
          3.6. A Conta e a licença de uso são <strong>intransferíveis</strong>, salvo autorização prévia,
          expressa e formal da CONTRATADA, mediante análise de risco compliance e assinatura
          de termo de cessão.
        </p>
      </Section>

      <Section num="4" title="Planos, Preços e Reajuste">
        <p>
          4.1. Os planos oficiais vigentes e seus valores estão publicados na Plataforma, sem
          prejuízo dos termos individualizados eventualmente formalizados por escrito:
        </p>
        <List>
          <li><strong>Plano Básico</strong>: R$ 397,00/mês, com 1 (um) CNPJ incluso; cada CNPJ adicional custa R$ 39,90/mês.</li>
          <li><strong>Plano Premium</strong>: R$ 997,00/mês, com CNPJs ilimitados e funcionalidades avançadas de IA e multi-empresa.</li>
        </List>
        <p>
          4.2. Os preços poderão ser <strong>reajustados anualmente</strong> pela variação positiva do
          IPCA/IBGE dos 12 meses anteriores, mediante aviso prévio de 30 dias, mantida ao
          CONTRATANTE a faculdade de rescindir sem custo caso não concorde com o novo valor.
        </p>
        <p>
          4.3. A troca de plano (upgrade ou downgrade) pode ser feita a qualquer tempo pelo próprio
          CONTRATANTE. <strong>Upgrade</strong> gera cobrança proporcional imediata. <strong>Downgrade</strong> entra em
          vigor no próximo ciclo, sem reembolso proporcional do valor já pago.
        </p>
        <p>
          4.4. Descontos promocionais eventualmente concedidos (cupons, indicações,
          embaixadores) têm validade e regras próprias descritas na promoção específica e não
          criam direito adquirido para períodos subsequentes.
        </p>
      </Section>

      <Section num="5" title="Pagamento, Faturamento e Nota Fiscal">
        <p>
          5.1. O pagamento é <strong>mensal, recorrente e antecipado</strong>, cobrado no dia da adesão e
          nas mesmas datas dos meses subsequentes, via:
        </p>
        <List>
          <li>Cartão de crédito (débito recorrente automático, tokenizado pelo Asaas em conformidade PCI-DSS);</li>
          <li>PIX (link gerado a cada vencimento, com validade de 3 dias); ou</li>
          <li>Boleto bancário (com prazo padrão de 3 dias úteis para compensação).</li>
        </List>
        <p>
          5.2. O <strong>cartão de crédito é validado no cadastro</strong> mediante pré-autorização; a
          cobrança do primeiro ciclo é efetivada imediatamente após a ativação do plano, salvo
          se houver promoção específica de trial gratuito anunciada no momento da contratação.
        </p>
        <p>
          5.3. A <strong>Nota Fiscal de Serviço (NFSe)</strong> é emitida automaticamente pelo Asaas no
          momento da confirmação de cada pagamento, com envio da via em PDF ao e-mail
          cadastrado e via WhatsApp do Usuário administrador. Cabe ao CONTRATANTE conferir os
          dados fiscais e comunicar divergências em até 5 (cinco) dias úteis, sob pena de
          preclusão do direito de correção.
        </p>
        <p>
          5.4. Cartões de crédito próximos do vencimento (validade nos próximos 30 dias) recebem
          notificação preventiva por WhatsApp. Compete ao CONTRATANTE substituí-lo antes da
          expiração para evitar interrupção do Serviço.
        </p>
        <p>
          5.5. Falhas de compensação (recusa do banco emissor, saldo insuficiente,
          antifraude) geram nova tentativa automática em 48h. Persistindo a falha, aplica-se
          a Cláusula 6.
        </p>
      </Section>

      <Section num="6" title="Inadimplência, Suspensão e Cancelamento por Iniciativa da CONTRATADA">
        <p>
          6.1. Configurada a inadimplência (pagamento não confirmado até o vencimento), o
          CONTRATANTE receberá comunicação automática por e-mail e WhatsApp e terá <strong>prazo
          de 2 (dois) dias corridos</strong> para regularização.
        </p>
        <p>
          6.2. Persistindo o inadimplemento após esse prazo, o Serviço será <strong>suspenso
          automaticamente</strong>, mantendo o CONTRATANTE apenas as áreas necessárias à
          regularização (Assinatura, Método de Pagamento e Suporte).
        </p>
        <p>
          6.3. Após <strong>30 (trinta) dias</strong> de inadimplência não regularizada, a CONTRATADA
          poderá <strong>rescindir unilateralmente</strong> o Contrato e cancelar a Conta, sem prejuízo
          da cobrança dos valores em aberto acrescidos de juros de 1% a.m., multa moratória de
          2% e correção pelo IGP-M, além de eventual protesto e inscrição em cadastros de
          proteção ao crédito.
        </p>
        <p>
          6.4. Cancelada a Conta, os Dados do Cliente ficam retidos em <strong>arquivo morto por 12
          (doze) meses</strong>, restaurados mediante reativação da Conta e quitação do débito.
          Passado esse prazo, os dados são <strong>anonimizados ou excluídos</strong>, resguardadas
          exigências legais de retenção fiscal e de auditoria.
        </p>
      </Section>

      <Section num="7" title="Cancelamento por Iniciativa do CONTRATANTE e Direito de Arrependimento">
        <p>
          7.1. O CONTRATANTE poderá cancelar a Conta <strong>a qualquer momento</strong>, sem multa
          contratual ou fidelidade, pelo próprio painel (Conta &rarr; Assinatura &rarr; Cancelar).
        </p>
        <p>
          7.2. O acesso permanece ativo até o final do período mensal já pago. <strong>Não há
          reembolso proporcional</strong>, salvo nos casos previstos na cláusula 7.3.
        </p>
        <p>
          7.3. <strong>Direito de arrependimento</strong>: sendo o CONTRATANTE consumidor pessoa física ou
          equiparado, aplica-se o art. 49 do Código de Defesa do Consumidor — <strong>reembolso
          integral</strong> do primeiro pagamento se o cancelamento ocorrer em até 7 (sete) dias
          corridos contados da assinatura, mediante solicitação por e-mail em
          <code>{CONTRATADA.email}</code>.
        </p>
        <p>
          7.4. O CONTRATANTE poderá <strong>exportar seus dados</strong> em formato aberto (CSV, PDF) a
          qualquer momento antes do cancelamento. A CONTRATADA compromete-se a manter recurso
          de exportação funcional durante toda a vigência do Contrato.
        </p>
      </Section>

      <Section num="8" title="Nível de Serviço (SLA) e Disponibilidade">
        <p>
          8.1. A CONTRATADA envida melhores esforços para manter disponibilidade de{" "}
          <strong>99,5% mensal</strong> do Serviço, excluídos os períodos de manutenção programada
          previamente comunicados com antecedência mínima de 48h.
        </p>
        <p>
          8.2. Interrupções decorrentes de <strong>caso fortuito, força maior ou falhas de Terceiros
          Autorizados</strong> (Vercel, Neon, Asaas, Meta, Google, Anthropic) não configuram
          descumprimento contratual pela CONTRATADA.
        </p>
        <p>
          8.3. Registrando-se indisponibilidade total do Serviço superior a 24 (vinte e quatro)
          horas contínuas em um mesmo mês, o CONTRATANTE terá direito a bônus proporcional em
          crédito no mês subsequente, calculado sobre o valor mensal pago dividido por 30
          multiplicado pelos dias de indisponibilidade.
        </p>
        <p>
          8.4. Suporte técnico é prestado por e-mail e chat em dias úteis, com SLA de resposta
          de até <strong>4 (quatro) horas úteis</strong> para o plano Básico e <strong>2 (duas) horas úteis</strong>{" "}
          para o plano Premium.
        </p>
      </Section>

      <Section num="9" title="Backup, Retenção e Portabilidade de Dados">
        <p>
          9.1. A CONTRATADA realiza <strong>backup diário automatizado</strong> dos Dados do Cliente,
          armazenados em infraestrutura criptografada em nuvem, com retenção mínima de 30 dias.
        </p>
        <p>
          9.2. Restaurações a pedido do CONTRATANTE (recuperação após exclusão acidental) são
          atendidas em regime de melhores esforços, sujeitas à existência do backup no período
          solicitado e à cobrança de taxa administrativa quando a operação envolver esforço
          técnico atípico.
        </p>
        <p>
          9.3. O CONTRATANTE tem direito à <strong>portabilidade integral</strong> de seus dados a qualquer
          momento, em formato estruturado, legível por máquina e interoperável, nos termos do
          art. 18, V da LGPD.
        </p>
      </Section>

      <Section num="10" title="Proteção de Dados Pessoais (LGPD)">
        <p>
          10.1. A CONTRATADA atua como <strong>Operadora de Dados Pessoais</strong> em relação aos dados
          dos clientes finais do CONTRATANTE (parceiros, órgãos públicos, fornecedores) e como
          <strong> Controladora</strong> em relação aos dados dos Usuários da Conta (nome, e-mail, CPF,
          telefone, data de nascimento), tudo em conformidade com a Lei 13.709/2018.
        </p>
        <p>
          10.2. <strong>Bases legais de tratamento</strong>: execução do contrato (art. 7º, V), cumprimento
          de obrigação legal (art. 7º, II), legítimo interesse (art. 7º, IX) e consentimento
          expresso do titular (art. 7º, I) para comunicações de marketing eventuais.
        </p>
        <p>
          10.3. <strong>Compartilhamento</strong>: os Dados Pessoais podem ser compartilhados exclusivamente
          com os Terceiros Autorizados (Cláusula 1.6), sob contrato de confidencialidade e
          exclusivamente para viabilizar o Serviço. Nenhum dado é vendido, cedido ou
          compartilhado para fins de marketing de terceiros.
        </p>
        <p>
          10.4. <strong>Direitos do titular</strong> (art. 18 LGPD): confirmação da existência de tratamento,
          acesso, correção, anonimização, portabilidade, eliminação, informação sobre
          compartilhamento e revogação de consentimento. Requisições devem ser encaminhadas
          para <code>{CONTRATADA.email}</code>, com atendimento em até 15 (quinze) dias.
        </p>
        <p>
          10.5. <strong>Retenção legal</strong>: registros fiscais são mantidos por 5 (cinco) anos após o
          fim do relacionamento contratual, em cumprimento à legislação tributária. Registros
          de auditoria (log) e trilha de aceite são mantidos pelo mesmo prazo.
        </p>
        <p>
          10.6. <strong>Encarregado de Dados (DPO)</strong>: {CONTRATADA.razao}, e-mail <code>{CONTRATADA.email}</code>.
        </p>
        <p>
          10.7. <strong>Incidentes de segurança</strong>: em caso de vazamento com risco relevante aos
          titulares, a CONTRATADA notificará a ANPD e os titulares em prazo razoável, nos
          termos do art. 48 da LGPD.
        </p>
      </Section>

      <Section num="11" title="Comunicações Eletrônicas e Consentimento WhatsApp">
        <p>
          11.1. Ao aceitar este Contrato, o CONTRATANTE <strong>consente expressamente</strong> com o
          recebimento de comunicações automáticas por <strong>e-mail e WhatsApp</strong> no número
          cadastrado, incluindo notificações operacionais, fiscais e comerciais relacionadas ao
          Serviço, tais como:
        </p>
        <List>
          <li>Alertas de vencimento de empenhos, atas, contratos e prazos de entrega;</li>
          <li>Confirmações de novos cadastros (atas, contratos, empenhos);</li>
          <li>Mudanças de status de execução (entregue, NF emitida, pago);</li>
          <li>Vencimento de faturas do CP System e cartão prestes a expirar;</li>
          <li>Emissão de Nota Fiscal com link para PDF;</li>
          <li>Relatório semanal consolidado da Conta;</li>
          <li>Mensagem de aniversário;</li>
          <li>Recados operacionais e institucionais relevantes.</li>
        </List>
        <p>
          11.2. O CONTRATANTE pode revogar o consentimento para notificações WhatsApp a qualquer
          tempo em Conta &rarr; Notificações WhatsApp, mantidos apenas os e-mails <strong>transacionais
          críticos</strong> (fatura, cancelamento, alerta de segurança), essenciais à execução do
          contrato e insuscetíveis de opt-out.
        </p>
      </Section>

      <Section num="12" title="Inteligência Artificial (IAsystem) — Limitações e Isenção">
        <p>
          12.1. A funcionalidade IAsystem utiliza Modelos de Linguagem de Larga Escala (LLMs)
          fornecidos pela Anthropic PBC (Claude) para gerar análises jurídicas e operacionais
          sobre documentos anexados pelo CONTRATANTE.
        </p>
        <p>
          12.2. <strong>As análises geradas têm caráter meramente informativo e complementar</strong>, não
          constituem parecer jurídico formal, não substituem análise humana por profissional
          habilitado (advogado, contador ou auditor) e <strong>não devem ser adotadas como única
          fonte de decisão em matérias de risco jurídico ou financeiro material</strong>.
        </p>
        <p>
          12.3. LLMs podem apresentar <em>alucinações</em> (afirmações incorretas com aparência de
          precisão). O CONTRATANTE compromete-se a validar criticamente cada análise antes de
          adotá-la e a comunicar eventuais imprecisões pelo canal de suporte para melhoria contínua.
        </p>
        <p>
          12.4. A CONTRATADA <strong>não se responsabiliza</strong> por decisões tomadas com base exclusiva
          em pareceres da IAsystem, tampouco por eventuais consequências jurídicas,
          administrativas ou financeiras delas decorrentes.
        </p>
        <p>
          12.5. Os documentos submetidos à IAsystem são <strong>não retidos para treinamento</strong> pela
          Anthropic (política contratual da provedora) e são processados sob termos de
          confidencialidade compatíveis com a LGPD.
        </p>
      </Section>

      <Section num="13" title="Programa de Analistas Parceiros e Comissões">
        <p>
          13.1. A Plataforma oferece o Programa de Analistas Parceiros, no qual o CONTRATANTE
          pode vincular à Conta um analista de licitações, autorizando o compartilhamento dos
          dados dos contratos e a apuração automática de comissões (variável sobre execução e/ou
          fixa mensal), conforme percentuais e valores livremente pactuados entre as partes.
        </p>
        <p>
          13.2. A relação comercial entre CONTRATANTE e analista é <strong>direta e autônoma</strong>: a
          CONTRATADA apenas registra, apura e reporta valores na Plataforma. <strong>A CONTRATADA
          não é parte, mandatária, garantidora ou fiadora dessa relação</strong>, tampouco responde
          por eventual descumprimento de qualquer das partes.
        </p>
        <p>
          13.3. Os pagamentos da comissão são feitos <strong>diretamente do CONTRATANTE ao analista</strong>,
          fora da Plataforma, cabendo às partes emitirem os documentos fiscais próprios (RPA,
          NFSe do analista, etc.).
        </p>
        <p>
          13.4. Programas de <em>embaixadores</em> (Cliente indica novo cliente) e comissões vitalícias
          têm regras próprias divulgadas em página específica e não integram este Contrato.
        </p>
      </Section>

      <Section num="14" title="Uso Permitido, Proibições e Cláusula Antifraude">
        <p>
          14.1. O CONTRATANTE compromete-se a usar o Serviço exclusivamente para gestão de sua
          própria operação comercial no âmbito da Lei 14.133/2021, dentro dos limites da
          legalidade, boa-fé e função social do contrato.
        </p>
        <p>
          14.2. São <strong>expressamente vedadas</strong>, sob pena de suspensão imediata e sem prejuízo
          das medidas cíveis e criminais cabíveis:
        </p>
        <List>
          <li>Tentativa de acesso não autorizado a dados de outros clientes;</li>
          <li>Engenharia reversa, decompilação, cópia ou distribuição do código-fonte;</li>
          <li>Uso de bots, scrapers, automações não autorizadas ou meios que sobrecarreguem a infraestrutura;</li>
          <li>Inserção deliberada de dados falsos, ideológicos ou fraudulentos;</li>
          <li>Uso da Plataforma para lavagem de dinheiro, evasão fiscal, corrupção, atividades ilícitas ou fins que violem a Lei 14.133/2021, o Código Penal, a Lei Anticorrupção (12.846/2013) ou a legislação tributária;</li>
          <li>Revenda, sublocação, cessão ou redistribuição da licença de uso;</li>
          <li>Publicação de conteúdo ofensivo, discriminatório, protegido por direito autoral de terceiro sem autorização, ou que viole direitos de imagem, honra ou intimidade.</li>
        </List>
        <p>
          14.3. A CONTRATADA reserva-se o direito de <strong>auditar o uso da Plataforma</strong> quando
          houver indícios razoáveis de violação, mediante notificação prévia, salvo em casos de
          urgência ou risco iminente à infraestrutura.
        </p>
      </Section>

      <Section num="15" title="Propriedade Intelectual">
        <p>
          15.1. Todo o <strong>código-fonte, design, marca, logotipos, layouts, textos institucionais,
          documentação técnica e conteúdo</strong> do CP System é de propriedade exclusiva da
          CONTRATADA, protegido pela Lei 9.279/1996 (Propriedade Industrial), Lei 9.609/1998
          (Software) e Lei 9.610/1998 (Direitos Autorais).
        </p>
        <p>
          15.2. Este Contrato concede ao CONTRATANTE <strong>tão somente licença de uso não exclusiva</strong>
          — nenhuma cessão, transferência ou licença ampla é concedida ou presumida.
        </p>
        <p>
          15.3. Os <strong>Dados do Cliente</strong> permanecem de sua exclusiva propriedade. A CONTRATADA
          adquire, contudo, licença limitada e revogável para usar tais dados exclusivamente
          para viabilizar o Serviço, cumprir obrigações legais, gerar estatísticas anonimizadas
          e treinar modelos internos <strong>não-generativos</strong> de melhoria de produto (sem
          exposição individualizada a terceiros).
        </p>
      </Section>

      <Section num="16" title="Confidencialidade">
        <p>
          16.1. As Partes obrigam-se a manter <strong>sigilo</strong> sobre todas as informações confidenciais
          de que tomarem conhecimento em razão deste Contrato, incluindo, sem limitação:
          dados financeiros, estratégias comerciais, dados pessoais dos Usuários, informações
          técnicas da Plataforma, e conteúdo de atas, contratos e empenhos.
        </p>
        <p>
          16.2. A obrigação de confidencialidade permanece vigente <strong>por 5 (cinco) anos após o
          término do Contrato</strong>.
        </p>
        <p>
          16.3. Não se enquadram como confidenciais: informações de domínio público, informações
          já legalmente conhecidas pela Parte receptora antes da revelação, ou informações
          exigidas por ordem judicial ou autoridade competente (com notificação prévia à outra
          Parte quando legalmente possível).
        </p>
      </Section>

      <Section num="17" title="Limitação de Responsabilidade">
        <p>
          17.1. Ressalvadas as hipóteses de dolo ou culpa grave, a responsabilidade civil da
          CONTRATADA perante o CONTRATANTE, por qualquer causa, fica <strong>limitada, em conjunto e
          por qualquer título</strong>, ao valor equivalente às <strong>últimas 6 (seis) mensalidades
          efetivamente pagas</strong> pelo CONTRATANTE nos 12 meses anteriores ao evento gerador.
        </p>
        <p>
          17.2. A CONTRATADA <strong>não responde</strong> por:
        </p>
        <List>
          <li>Lucros cessantes, danos indiretos, imateriais ou reflexos;</li>
          <li>Prejuízos decorrentes de falha ou indisponibilidade de Terceiros Autorizados;</li>
          <li>Perdas causadas por atos ou omissões do próprio CONTRATANTE, de seus Usuários ou de terceiros por ele autorizados;</li>
          <li>Decisões jurídicas, administrativas ou financeiras tomadas com base exclusiva em pareceres da IAsystem;</li>
          <li>Danos decorrentes de força maior, caso fortuito, greves, ataques cibernéticos, sanções internacionais ou eventos análogos.</li>
        </List>
      </Section>

      <Section num="18" title="Indenização e Regresso">
        <p>
          O CONTRATANTE compromete-se a indenizar e manter a CONTRATADA a salvo (<em>indemnity
          and hold harmless</em>) de quaisquer perdas, danos, multas, custas e honorários advocatícios
          decorrentes de: (i) violação deste Contrato pelo CONTRATANTE ou seus Usuários;
          (ii) uso indevido, ilícito ou fraudulento da Plataforma; (iii) reclamações de
          terceiros relativas a Dados do Cliente inseridos na Plataforma; ou (iv) descumprimento
          de obrigações fiscais e trabalhistas próprias do CONTRATANTE.
        </p>
      </Section>

      <Section num="19" title="Vigência, Rescisão e Sobrevivência de Cláusulas">
        <p>
          19.1. Este Contrato entra em vigor na data de sua aceitação eletrônica pelo CONTRATANTE
          e permanece vigente <strong>por prazo indeterminado</strong>, extinguindo-se conforme as
          hipóteses das Cláusulas 6 e 7.
        </p>
        <p>
          19.2. As obrigações de <strong>confidencialidade (Cláusula 16), limitação de responsabilidade
          (17), indenização (18), proteção de dados (10), foro (23)</strong> e todas as demais
          incompatíveis com a extinção do Contrato <strong>sobrevivem</strong> ao término.
        </p>
      </Section>

      <Section num="20" title="Alterações Contratuais">
        <p>
          20.1. A CONTRATADA pode <strong>alterar unilateralmente</strong> estes Termos, comunicando o
          CONTRATANTE com antecedência mínima de 15 (quinze) dias por e-mail e/ou WhatsApp.
        </p>
        <p>
          20.2. O uso continuado do Serviço após o prazo de comunicação equivale à
          <strong> aceitação tácita</strong> das novas condições. Discordando, o CONTRATANTE pode rescindir
          sem custo dentro do mesmo prazo.
        </p>
        <p>
          20.3. Alterações que representem <strong>majoração significativa de preço</strong> ou
          <strong> restrição material de funcionalidade</strong> exigem consentimento expresso do
          CONTRATANTE.
        </p>
      </Section>

      <Section num="21" title="Cessão do Contrato">
        <p>
          21.1. Este Contrato é <strong>intransferível pelo CONTRATANTE</strong>, salvo autorização prévia
          e expressa da CONTRATADA.
        </p>
        <p>
          21.2. A CONTRATADA pode <strong>ceder este Contrato</strong> total ou parcialmente, mediante
          notificação ao CONTRATANTE, nos casos de reorganização societária, fusão, aquisição,
          cisão, incorporação ou venda de ativos, preservados todos os direitos do CONTRATANTE.
        </p>
      </Section>

      <Section num="22" title="Comunicações Formais e Notificações">
        <p>
          22.1. Comunicações formais entre as Partes serão consideradas <strong>válidas e recebidas</strong>{" "}
          quando enviadas para: (i) o e-mail cadastrado do CONTRATANTE; ou (ii) o endereço de
          e-mail <code>{CONTRATADA.email}</code> da CONTRATADA.
        </p>
        <p>
          22.2. Notificações extrajudiciais podem ser encaminhadas por carta registrada,
          e-mail com confirmação de leitura ou plataforma de assinatura eletrônica com validade
          jurídica reconhecida (ICP-Brasil ou equivalente).
        </p>
      </Section>

      <Section num="23" title="Foro, Legislação Aplicável e Resolução de Conflitos">
        <p>
          23.1. Este Contrato rege-se exclusivamente pelas leis da <strong>República Federativa do
          Brasil</strong>.
        </p>
        <p>
          23.2. As Partes elegem o <strong>foro da Comarca de {FORO}</strong> como competente para
          dirimir quaisquer controvérsias oriundas deste Contrato, renunciando a qualquer outro,
          por mais privilegiado que seja.
        </p>
        <p>
          23.3. Antes da judicialização, as Partes obrigam-se a tentar solução amigável por 30
          (trinta) dias corridos contados da notificação formal da controvérsia. Optando pela
          via extrajudicial, poderão recorrer à <strong>mediação e conciliação</strong>, nos termos da
          Lei 13.140/2015.
        </p>
      </Section>

      <Section num="24" title="Disposições Gerais">
        <p>
          24.1. <strong>Nulidade parcial</strong>: eventual nulidade ou ineficácia de uma cláusula não
          afeta a validade das demais, que permanecerão em vigor.
        </p>
        <p>
          24.2. <strong>Tolerância</strong>: a não exigência, por qualquer das Partes, de cumprimento
          de qualquer disposição não constitui novação, renúncia ou modificação contratual.
        </p>
        <p>
          24.3. <strong>Contrato integral</strong>: este documento, em conjunto com a Política de
          Privacidade e demais anexos publicados na Plataforma, constitui o <em>acordo integral</em>{" "}
          entre as Partes, substituindo comunicações verbais ou escritas anteriores sobre o
          mesmo objeto.
        </p>
        <p>
          24.4. <strong>Aceitação eletrônica</strong>: a marcação do <em>checkbox</em> &ldquo;Li e aceito os
          Termos&rdquo; ou o simples uso da Plataforma após o cadastro registra, com endereço IP,
          horário (<em>timestamp</em>) e versão do documento vigente, o aceite eletrônico com força de
          <strong> assinatura</strong>, nos termos do art. 10, §2º da MP 2.200-2/2001.
        </p>
      </Section>

      <div
        className="mt-10 grid gap-4 rounded-xl px-5 py-4 text-xs md:grid-cols-2"
        style={{ background: "rgba(15,14,12,0.04)", border: "0.5px solid var(--hairline)", color: "var(--text-soft)" }}
      >
        <div>
          <p className="mb-1 font-bold uppercase" style={{ letterSpacing: "0.12em", color: "var(--text)" }}>
            CONTRATADA
          </p>
          <p><strong>{CONTRATADA.razao}</strong></p>
          <p>CNPJ: {CONTRATADA.cnpj}</p>
          <p>Sede: {CONTRATADA.endereco}</p>
          <p>DPO / e-mail: {CONTRATADA.email}</p>
          <p>WhatsApp business: {CONTRATADA.wa}</p>
        </div>
        <div>
          <p className="mb-1 font-bold uppercase" style={{ letterSpacing: "0.12em", color: "var(--text)" }}>
            CONTRATANTE
          </p>
          <p><strong>{razao}</strong></p>
          <p>CNPJ: {cnpj}</p>
          <p>Sede: {endereco}</p>
          <p>Representante: {representante}</p>
          <p>CPF do representante: {cpfRep}</p>
          <p>E-mail: {emailRep}</p>
        </div>
        <p className="md:col-span-2 pt-2" style={{ borderTop: "0.5px solid var(--hairline)" }}>
          <em>
            Documento em vigor desde {VIGENCIA_TERMOS} · Versão {VERSAO_TERMOS} · Aceite
            eletrônico com valor de assinatura conforme MP 2.200-2/2001. O sistema registra
            IP e horário no momento do aceite pelo CONTRATANTE.
          </em>
        </p>
      </div>
    </article>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
        {num}. {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="ml-5 list-disc space-y-1.5">{children}</ul>;
}
