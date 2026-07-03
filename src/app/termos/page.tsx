import Link from "next/link";
import { Logo } from "@/components/Logo";

// Termos de uso do CP System — v1.0 (Regina/Igor 03/07/2026).
// Página pública, sem auth. Link no footer da landing e no fluxo de
// signup/onboarding com checkbox de aceite (a ser implementado depois
// da aprovação do texto).

const VERSAO = "1.0";
const VIGENCIA = "03/07/2026";
const RAZAO_SOCIAL_CP = "REGINA LUIZA DA SILVA FERNANDES (CNPJ 42.736.317/0001-30)";
const FORO = "Brasília — Distrito Federal";
const SUPORTE_EMAIL = "contato@cpsystem.app.br";

export default function TermosPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <header className="border-b py-5" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6">
          <Logo variant="md" />
          <Link href="/" className="text-xs font-semibold" style={{ color: "var(--text-soft)" }}>
            ← Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-extrabold" style={{ color: "var(--text)" }}>
          Termos de uso do CP System
        </h1>
        <p className="mt-2 text-xs" style={{ color: "var(--text-mute)" }}>
          Versão {VERSAO} · Em vigor desde {VIGENCIA}
        </p>

        <section className="prose prose-sm mt-8 max-w-none" style={{ color: "var(--text)" }}>

          <p>
            Este documento estabelece as condições de uso da plataforma <strong>CP System</strong> (o "Serviço"),
            operada por <strong>{RAZAO_SOCIAL_CP}</strong> (a "Contratada"), oferecida ao Contratante
            pessoa jurídica ou pessoa física que representa uma empresa (o "Cliente"). Ao criar uma conta,
            marcar o aceite ou acessar o Serviço, o Cliente <strong>declara ter lido, entendido e concordado
            com todas as cláusulas abaixo</strong>.
          </p>

          <h2 style={{ marginTop: "2rem" }}>1. Objeto</h2>
          <p>
            O CP System é uma plataforma <em>Software as a Service</em> (SaaS) voltada à gestão pós-licitação
            sob a Lei 14.133/2021, oferecendo controle de Atas de Registro de Preços, Contratos Administrativos,
            Empenhos, Aditivos, Apostilamentos, Reajustes, Notificações, Garantias, Comissões,
            análise jurídica por Inteligência Artificial, notificações automáticas por WhatsApp e integrações
            com serviços de terceiros (Google Agenda, gateway de pagamento Asaas).
          </p>

          <h2 style={{ marginTop: "2rem" }}>2. Cadastro e conta</h2>
          <p>
            2.1. Para usar o Serviço, o Cliente deve criar uma conta fornecendo dados verdadeiros, completos e
            atualizados: nome, e-mail, CPF, cargo, telefone WhatsApp, data de nascimento, além dos dados da
            pessoa jurídica (razão social, CNPJ, endereço, telefones).
          </p>
          <p>
            2.2. O Cliente é o único responsável pela guarda das credenciais de acesso. A Contratada não se
            responsabiliza por acessos indevidos decorrentes de negligência do Cliente na proteção da senha.
          </p>
          <p>
            2.3. A conta é intransferível salvo autorização expressa da Contratada. É proibido compartilhar
            uma mesma conta entre pessoas físicas distintas — para operações em equipe, cadastre usuários
            adicionais.
          </p>

          <h2 style={{ marginTop: "2rem" }}>3. Planos, pagamento e faturamento</h2>
          <p>
            3.1. O CP System é oferecido em dois planos principais — <strong>Básico</strong> (R$ 397/mês,
            com 1 CNPJ incluso e R$ 39,90 por CNPJ adicional) e <strong>Premium</strong> (R$ 997/mês, CNPJs
            ilimitados). Preços podem ser atualizados anualmente com aviso prévio de 30 dias.
          </p>
          <p>
            3.2. O pagamento é <strong>mensal e recorrente</strong> via cartão de crédito, PIX ou boleto,
            processado pelo Asaas (parceiro de pagamentos). O cartão é validado no cadastro e a primeira
            cobrança ocorre imediatamente após a ativação — <strong>não há período de trial gratuito
            além do previsto pela Contratada no momento do cadastro</strong>.
          </p>
          <p>
            3.3. Em caso de inadimplência superior a 2 dias, a conta é automaticamente bloqueada até
            regularização. Após 30 dias em atraso, a Contratada pode cancelar a conta e reter dados por
            até 12 meses para eventual restauração.
          </p>
          <p>
            3.4. A <strong>Nota Fiscal de Serviço (NFSe)</strong> é emitida automaticamente pelo Asaas
            no momento da confirmação do pagamento e enviada ao Cliente por e-mail e WhatsApp.
          </p>
          <p>
            3.5. Cancelamento pode ser feito a qualquer momento pelo próprio Cliente em Conta → Assinatura.
            Não há multa contratual. O acesso permanece ativo até o fim do período pago; não há reembolso
            proporcional.
          </p>

          <h2 style={{ marginTop: "2rem" }}>4. Comunicações e notificações</h2>
          <p>
            4.1. Ao aceitar estes termos, o Cliente autoriza expressamente o recebimento de notificações
            automáticas via <strong>WhatsApp</strong> e e-mail sobre: vencimento de empenhos, prazos de
            entrega, entrega de execuções, vencimento de contratos e atas, faturas do CP System, procedimentos
            administrativos, novas atas/contratos/empenhos cadastrados, relatório semanal da conta, mensagens
            de aniversário e outros eventos relevantes.
          </p>
          <p>
            4.2. O Cliente pode desabilitar as notificações WhatsApp a qualquer momento em Conta →
            Notificações WhatsApp, sem prejuízo dos e-mails transacionais críticos (fatura, cancelamento,
            recuperação de senha), que são mantidos por segurança.
          </p>

          <h2 style={{ marginTop: "2rem" }}>5. Uso permitido e proibições</h2>
          <p>
            5.1. O Cliente compromete-se a usar o Serviço exclusivamente para gestão de sua própria operação
            comercial no âmbito da Lei 14.133/2021, sem revenda, redistribuição ou uso para terceiros não
            vinculados juridicamente à empresa cadastrada.
          </p>
          <p>
            5.2. É expressamente proibido: (i) tentar acessar dados de outros clientes; (ii) fazer engenharia
            reversa, decompilar ou copiar o código-fonte; (iii) inserir dados falsos deliberadamente; (iv)
            usar automações não autorizadas (bots, scrapers) que sobrecarreguem a infraestrutura; (v) inserir
            conteúdo ilícito, ofensivo ou que viole direitos de terceiros.
          </p>
          <p>
            5.3. A violação destas regras pode resultar em suspensão ou encerramento imediato da conta, sem
            reembolso, e sem prejuízo das medidas legais cabíveis.
          </p>

          <h2 style={{ marginTop: "2rem" }}>6. Análise jurídica por IA (IAsystem)</h2>
          <p>
            6.1. Os pareceres jurídicos gerados pela funcionalidade IAsystem têm caráter <strong>informativo
            e complementar</strong>, servindo como apoio à decisão. Não substituem análise humana por profissional
            de Direito habilitado.
          </p>
          <p>
            6.2. A Contratada não se responsabiliza por decisões tomadas com base exclusiva em pareceres
            gerados por IA. Recomenda-se validação por advogado do Cliente antes de aplicá-los em situações
            de risco jurídico ou financeiro material.
          </p>

          <h2 style={{ marginTop: "2rem" }}>7. Privacidade e proteção de dados (LGPD)</h2>
          <p>
            7.1. A Contratada trata dados pessoais em conformidade com a Lei Geral de Proteção de Dados
            (Lei 13.709/2018). Os dados coletados no cadastro (nome, CPF, e-mail, telefone, dados da empresa,
            dados fiscais e de contratos) são usados exclusivamente para: prestação do Serviço, cumprimento
            de obrigações legais, envio de notificações operacionais e comunicações contratuais.
          </p>
          <p>
            7.2. O Cliente pode a qualquer momento solicitar acesso, correção, portabilidade ou exclusão de
            seus dados pessoais escrevendo para <strong>{SUPORTE_EMAIL}</strong>. A exclusão de conta é
            executada em até 30 dias, mantendo apenas os registros exigidos por lei (registros fiscais e
            de auditoria por 5 anos).
          </p>
          <p>
            7.3. Compartilhamento de dados com terceiros ocorre apenas com: Asaas (processamento de
            pagamento), Google (integração de agenda quando o Cliente autoriza), Z-API/Meta (envio de mensagens
            WhatsApp), Anthropic (análise jurídica por IA — dados anonimizados). Nenhum dado é vendido a
            terceiros para fins de marketing.
          </p>

          <h2 style={{ marginTop: "2rem" }}>8. Programa de analistas e comissões</h2>
          <p>
            8.1. O Cliente pode vincular um analista de licitações à sua conta, autorizando o compartilhamento
            de dados dos seus contratos e a apuração automática de comissões (percentual variável sobre execuções
            e/ou fixo mensal).
          </p>
          <p>
            8.2. A relação comercial entre Cliente e analista é <strong>direta entre as partes</strong>. A
            Contratada apenas registra, apura e reporta valores no sistema — não é parte da relação nem
            responsável pela quitação da comissão. Pagamentos são feitos diretamente do Cliente ao analista.
          </p>

          <h2 style={{ marginTop: "2rem" }}>9. Disponibilidade e limitações de responsabilidade</h2>
          <p>
            9.1. A Contratada envida melhores esforços para manter o Serviço disponível 24×7, sem garantia
            de <em>uptime</em> específico. Manutenções programadas são comunicadas com antecedência sempre
            que possível.
          </p>
          <p>
            9.2. A Contratada não se responsabiliza por: (i) prejuízos indiretos, lucros cessantes ou danos
            emergentes decorrentes de indisponibilidade temporária; (ii) falhas de terceiros (Asaas, Meta,
            Google, provedores de nuvem); (iii) perda de dados por ação do próprio Cliente.
          </p>
          <p>
            9.3. Backups são realizados diariamente e retidos por 30 dias.
          </p>

          <h2 style={{ marginTop: "2rem" }}>10. Propriedade intelectual</h2>
          <p>
            10.1. Todo o código-fonte, design, marca e conteúdo do CP System é propriedade exclusiva da
            Contratada. O Cliente recebe apenas licença de uso não exclusiva, intransferível e revogável
            durante a vigência do plano contratado.
          </p>
          <p>
            10.2. Os dados inseridos pelo Cliente (atas, contratos, empenhos, anexos) permanecem de sua
            propriedade e podem ser exportados a qualquer momento em formato aberto.
          </p>

          <h2 style={{ marginTop: "2rem" }}>11. Alterações destes termos</h2>
          <p>
            A Contratada pode alterar estes termos, comunicando os Clientes com antecedência mínima de 15
            dias por e-mail ou WhatsApp. O uso continuado do Serviço após a comunicação equivale a aceitação
            das novas condições. Cliente pode cancelar sem custo caso discorde.
          </p>

          <h2 style={{ marginTop: "2rem" }}>12. Foro</h2>
          <p>
            Fica eleito o foro da Comarca de <strong>{FORO}</strong> para dirimir qualquer controvérsia
            oriunda deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
          </p>

          <h2 style={{ marginTop: "2rem" }}>13. Contato</h2>
          <p>
            Dúvidas, reclamações e solicitações: <strong>{SUPORTE_EMAIL}</strong> ou pelo WhatsApp business
            da Contratada.
          </p>

          <p style={{ marginTop: "3rem", fontStyle: "italic", color: "var(--text-mute)" }}>
            Última atualização: {VIGENCIA} · Versão {VERSAO}
          </p>
        </section>
      </main>
    </div>
  );
}
