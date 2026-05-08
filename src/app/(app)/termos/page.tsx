import { ScrollText, Download, Lock } from "lucide-react";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { aceitarTermosAction } from "@/app/actions/equipe";
import { PageHeader } from "@/components/ui/SecaoGlass";

export default async function TermosPage() {
  const usuario = await exigirUsuario();
  const aceito = usuario.conta.termosAceitosEm;

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <PageHeader
        eyebrow="Conta · Conformidade legal"
        titulo="Termos &"
        destaque="LGPD"
        subtitulo="Conformidade LGPD (Lei 13.709/2018) e PCI-DSS no processamento de pagamentos."
      />

      {aceito ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          ✓ Você aceitou os termos em {aceito.toLocaleString("pt-BR")}.
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ Você ainda não aceitou os termos formais. Aceite ao final desta página.
        </div>
      )}

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="text-base font-semibold text-slate-900">1. Termos de uso</h2>
          <p className="mt-2">
            Ao utilizar a plataforma <strong>CP System</strong>, operada pela Contratos Públicos System (filial do Grupo Contratos Públicos),
            você (Usuário/Contratante) concorda com as condições aqui descritas.
          </p>
          <p className="mt-2">
            <strong>1.1 Objeto.</strong> O CP System é uma plataforma SaaS de gestão pós-licitação de Atas de Registro de Preços, Contratos
            Administrativos e Notas de Empenho derivados da Lei 14.133/2021.
          </p>
          <p className="mt-2">
            <strong>1.2 Planos.</strong> O serviço é oferecido em duas modalidades: Básico (R$ 397/mês) e Premium (R$ 997/mês), com
            franquia anual de consultoria jurídica conforme detalhado em /juridico.
          </p>
          <p className="mt-2">
            <strong>1.3 Uso.</strong> O Usuário se compromete a fornecer dados verídicos, manter o sigilo de suas credenciais e usar a
            plataforma exclusivamente para fins lícitos relacionados à execução de contratos públicos.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">2. Política de privacidade (LGPD)</h2>
          <p className="mt-2">
            <strong>2.1 Controlador.</strong> A Contratos Públicos System atua como controladora dos dados pessoais coletados.
          </p>
          <p className="mt-2">
            <strong>2.2 Finalidade e necessidade.</strong> Coletamos apenas os dados estritamente necessários para a gestão dos contratos
            cadastrados (razão social, CNPJ, endereço, dados de contato, dados bancários quando aplicável).
          </p>
          <p className="mt-2">
            <strong>2.3 Base legal.</strong> O tratamento se baseia na execução do contrato (art. 7º V LGPD) e em legítimo interesse para
            funcionalidades de auditoria e segurança.
          </p>
          <p className="mt-2">
            <strong>2.4 Armazenamento e segurança.</strong> Dados em repouso são criptografados em AES-256. Dados em trânsito usam SSL/TLS
            256 bits. Backups diários automáticos. Hospedagem em AWS com uptime de 99,9%.
          </p>
          <p className="mt-2">
            <strong>2.5 Compartilhamento.</strong> Não vendemos dados. Compartilhamos apenas com o gateway de pagamento (Stripe/ASAAS) o
            mínimo necessário, em conformidade com PCI-DSS (tokenização — não armazenamos dados de cartão).
          </p>
          <p className="mt-2">
            <strong>2.6 Direitos do titular.</strong> Você pode a qualquer momento solicitar exportação ou exclusão dos seus dados.{" "}
            <a href="mailto:dpo@contratospublicos.com.br" className="text-blue-700 hover:underline">
              dpo@contratospublicos.com.br
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">3. Privacy Rules</h2>
          <p className="mt-2">
            Cada conta opera em isolamento total — usuários da Conta A jamais acessam dados da Conta B, ainda que tentem manipular URLs.
            Logs de auditoria registram todas as ações.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">4. Direitos do titular — ações disponíveis</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Link
              href="/equipe"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 hover:border-blue-300"
            >
              <Download className="h-4 w-4" /> Exportar meus dados
            </Link>
            <a
              href="mailto:dpo@contratospublicos.com.br?subject=Solicita%C3%A7%C3%A3o%20de%20exclus%C3%A3o%20LGPD"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 hover:border-red-300"
            >
              <Lock className="h-4 w-4" /> Solicitar exclusão da conta
            </a>
          </div>
        </section>
      </div>

      {!aceito && (
        <form action={aceitarTermosAction} className="mt-8 rounded-xl border-2 border-blue-300 bg-blue-50 p-5">
          <p className="text-sm text-slate-800">
            Li e concordo com os <strong>Termos de uso</strong> e a <strong>Política de privacidade</strong> do CP System.
          </p>
          <button type="submit" className="mt-4 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            Aceitar termos
          </button>
        </form>
      )}
    </div>
  );
}
