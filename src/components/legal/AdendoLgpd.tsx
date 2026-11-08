import { VERSAO_ADENDO_LGPD, VIGENCIA_ADENDO_LGPD } from "@/lib/lgpd";

/**
 * Adendo de Tratamento de Dados Pessoais ao Contrato de Adesão (ESP-007
 * RN08). Texto do Anexo A da especificação do Módulo Terceirização (Igor,
 * aprovado em 07/11/2026). A CP System é a OPERADORA; a empresa cliente, a
 * CONTROLADORA. Aceite eletrônico no primeiro acesso ao módulo.
 */

export const OPERADORA = {
  razaoSocial: "CONTRATOS PUBLICOS SYSTEM LTDA",
  cnpj: "67.266.466/0001-04",
  cidade: "Brasília — DF",
  canalEncarregado: "contato@cpsystem.app.br",
};

export const SUBOPERADORES = [
  { nome: "Vercel Inc.", papel: "Hospedagem da aplicação e armazenamento de arquivos (Blob)", local: "Estados Unidos" },
  { nome: "Neon Inc.", papel: "Banco de dados (PostgreSQL gerenciado)", local: "Estados Unidos" },
  { nome: "Anthropic PBC", papel: "Leitura de documentos e geração de textos por inteligência artificial; os dados não são usados para treinamento de modelos", local: "Estados Unidos" },
  { nome: "Meta Platforms (WhatsApp)", papel: "Envio de avisos e mensagens à empresa, pelo WhatsApp Business da CP System", local: "Estados Unidos / Irlanda" },
  { nome: "Resend / provedor SMTP", papel: "Envio de e-mails transacionais", local: "Estados Unidos" },
  { nome: "Asaas Gestão Financeira S.A.", papel: "Cobrança da assinatura (dados da conta, não de colaboradores)", local: "Brasil" },
  { nome: "Google LLC", papel: "Agenda (Google Calendar), somente quando a empresa conecta a própria conta", local: "Estados Unidos" },
];

export function AdendoLgpd({ contratante }: { contratante?: { razaoSocial?: string | null; cnpj?: string | null } | null }) {
  const nomeControladora = contratante?.razaoSocial || "a pessoa jurídica titular da conta, identificada no cadastro da plataforma";
  const cnpjControladora = contratante?.cnpj ? `, inscrita no CNPJ sob o nº ${contratante.cnpj}` : "";
  return (
    <article className="prose prose-sm max-w-none text-slate-800 prose-headings:text-slate-900">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        Versão {VERSAO_ADENDO_LGPD} · vigente desde {VIGENCIA_ADENDO_LGPD}
      </p>
      <h2 className="text-lg font-bold">Adendo de Tratamento de Dados Pessoais ao Contrato de Adesão da CP System</h2>
      <p>
        <strong>Partes:</strong> de um lado, {nomeControladora}
        {cnpjControladora}, doravante <strong>CONTROLADORA</strong>; de outro, {OPERADORA.razaoSocial}, inscrita no CNPJ sob o nº {OPERADORA.cnpj}, titular da plataforma CP System, doravante <strong>OPERADORA</strong>.
      </p>
      <p>
        <strong>Cláusula 1ª — Objeto.</strong> Este adendo integra o Contrato de Adesão (Termos de Uso) e regula o tratamento, pela OPERADORA, de dados pessoais de empregados e prepostos da CONTROLADORA inseridos no Módulo Terceirização da plataforma, nos termos da Lei nº 13.709/2018 (LGPD).
      </p>
      <p>
        <strong>Cláusula 2ª — Papéis.</strong> A CONTROLADORA é a controladora dos dados pessoais (LGPD, art. 5º, VI) e a ela competem as decisões sobre o tratamento. A OPERADORA atua como operadora (art. 5º, VII) e trata os dados exclusivamente conforme as instruções da CONTROLADORA, expressas neste adendo e nas funcionalidades da plataforma (art. 39).
      </p>
      <p>
        <strong>Cláusula 3ª — Finalidade.</strong> Os dados serão tratados exclusivamente para a gestão da execução de contratos administrativos de prestação de serviços com mão de obra: controle de postos e alocação, comprovação de obrigações trabalhistas e previdenciárias perante o órgão contratante, conta vinculada, repactuação, férias, afastamentos, documentos e relatórios. É vedado à OPERADORA utilizar os dados para qualquer outra finalidade, inclusive comercial ou de treinamento de modelos de inteligência artificial.
      </p>
      <p>
        <strong>Cláusula 4ª — Dados tratados.</strong> 4.1. Podem ser inseridos: dados de identificação (nome, CPF e telefone); dados funcionais (função, CBO, jornada, admissão, desligamento e alocação); datas de férias e afastamentos; datas de validade de documentos; e documentos trabalhistas e previdenciários exigidos pelo órgão contratante. 4.2. A CONTROLADORA obriga-se a não inserir dados pessoais sensíveis (LGPD, art. 5º, II), em especial atestados médicos, diagnósticos, CID ou laudos, e a não identificar individualmente empregados beneficiários de cotas cuja condição seja sensível (como mulheres vítimas de violência doméstica e egressos do sistema prisional), que devem ser informados apenas em números agregados.
      </p>
      <p>
        <strong>Cláusula 5ª — Base legal e transparência.</strong> Cabe à CONTROLADORA definir a base legal do tratamento (LGPD, art. 7º, em especial o cumprimento de obrigação legal ou regulatória e a execução de contrato) e informar os titulares sobre o tratamento, inclusive sobre o uso de plataforma de terceiro.
      </p>
      <p>
        <strong>Cláusula 6ª — Obrigações da OPERADORA.</strong> A OPERADORA obriga-se a: (a) tratar os dados apenas conforme este adendo; (b) adotar medidas técnicas e administrativas de segurança aptas a proteger os dados (art. 46), incluindo criptografia dos dados de identificação, controle de acesso por perfil e registro das operações de tratamento (art. 37); (c) garantir a confidencialidade dos dados por seus sócios, empregados e prestadores; (d) apoiar a CONTROLADORA no atendimento aos direitos dos titulares (art. 18), disponibilizando na plataforma meios de consulta, correção, exportação e eliminação; (e) não acessar os dados, salvo para suporte técnico solicitado ou necessário, em modo somente leitura, com registro em auditoria e sem exibição de CPF.
      </p>
      <p>
        <strong>Cláusula 7ª — Suboperadores e transferência internacional.</strong> A CONTROLADORA autoriza a OPERADORA a contratar os suboperadores necessários à prestação do serviço (hospedagem em nuvem, envio de mensagens, processamento por inteligência artificial e meios de pagamento), relacionados no Anexo I deste adendo, vinculados a obrigações de proteção de dados equivalentes às deste adendo. A inclusão de novo suboperador será comunicada com antecedência mínima de 30 (trinta) dias. Havendo transferência internacional de dados, a OPERADORA observará o art. 33 da LGPD e a regulamentação da ANPD (Resolução CD/ANPD nº 19/2024, cláusulas-padrão contratuais).
      </p>
      <p>
        <strong>Cláusula 8ª — Incidentes de segurança.</strong> A OPERADORA comunicará à CONTROLADORA, em até 48 (quarenta e oito) horas da ciência, qualquer incidente de segurança que possa acarretar risco ou dano relevante aos titulares, com as informações disponíveis para que a CONTROLADORA cumpra o art. 48 da LGPD e a regulamentação da ANPD (Resolução CD/ANPD nº 15/2024).
      </p>
      <p>
        <strong>Cláusula 9ª — Retenção e eliminação.</strong> Encerrado o contrato administrativo cadastrado, os dados permanecerão armazenados pelo prazo configurado pela CONTROLADORA (padrão: 5 anos), para comprovação perante o órgão contratante e defesa em processos judiciais e administrativos, e serão anonimizados ou eliminados ao final, com aviso prévio de 30 (trinta) dias. No cancelamento da assinatura, a CONTROLADORA terá 90 (noventa) dias para exportar os dados; após esse prazo, os dados serão eliminados, ressalvadas as hipóteses de conservação do art. 16 da LGPD.
      </p>
      <p>
        <strong>Cláusula 10ª — Responsabilidade.</strong> Cada parte responde pelos danos a que der causa, nos termos dos arts. 42 a 45 da LGPD. A OPERADORA responde solidariamente somente quando descumprir as obrigações da legislação de proteção de dados ou não seguir as instruções lícitas da CONTROLADORA (art. 42, §1º, I).
      </p>
      <p>
        <strong>Cláusula 11ª — Informações de segurança.</strong> A CONTROLADORA poderá solicitar, uma vez por ano, informações sobre as medidas de segurança adotadas, que a OPERADORA prestará por escrito em até 15 (quinze) dias úteis.
      </p>
      <p>
        <strong>Cláusula 12ª — Vigência, prevalência e foro.</strong> Este adendo vigora enquanto a CONTROLADORA utilizar o Módulo Terceirização e, quanto às obrigações de sigilo e eliminação, até a eliminação definitiva dos dados. Em caso de conflito com os Termos de Uso, prevalece este adendo quanto à proteção de dados pessoais. Fica eleito o foro previsto nos Termos de Uso.
      </p>
      <p>
        <strong>Encarregado pelo tratamento de dados pessoais da OPERADORA (art. 41):</strong> canal de contato {OPERADORA.canalEncarregado}.
      </p>
      <h3 className="text-base font-bold">Anexo I — Suboperadores</h3>
      <ul>
        {SUBOPERADORES.map((s) => (
          <li key={s.nome}>
            <strong>{s.nome}</strong> — {s.papel} ({s.local}).
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        O aceite eletrônico registra usuário, conta (CNPJ), data, hora, IP e versão do adendo.
      </p>
    </article>
  );
}
