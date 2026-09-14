import Link from "next/link";
import { Award, Clock, FileText } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filtroEmpresaWhere } from "@/lib/empresaContexto";
import { BannerEmpresaEmFoco } from "@/components/BannerEmpresaEmFoco";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { FiltroLista } from "@/components/FiltroLista";
import { podeAcessarModulo } from "@/lib/modulosAcesso";
import { diasDecorridos, whereAguardandoOrgao, whereAtestadoPendente } from "@/lib/atestados";

/**
 * O registro de atestados da empresa (Regina 11/09).
 *
 * "Ele faz a solicitação e anexa no sistema, mantendo assim o registro de
 * todos os atestados de capacidade técnica dele."
 *
 * O atestado fica guardado na Ata/Contrato que o originou, que é onde ele
 * nasce — mas não é ali que ele é USADO. Ele é usado meses depois, montando
 * habilitação de uma licitação nova, quando a pergunta é "o que eu tenho que
 * comprove experiência nisso?" e ninguém lembra em qual contrato foi. Esta
 * tela responde essa pergunta: tudo junto, buscável por órgão e por objeto.
 *
 * Acesso: a rota de propósito NÃO está em MODULOS. Ela atravessa Atas e
 * Contratos, e prender a um dos dois tiraria a tela de quem tem só o outro.
 * O corte é feito aqui dentro, por origem — quem não tem Atas não vê os
 * atestados vindos de Ata, e quem não tem nenhum dos dois não entra.
 */
export default async function AtestadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; orgao?: string }>;
}) {
  const [usuario, sp] = await Promise.all([exigirUsuario(), searchParams]);
  const filtroEmpresa = await filtroEmpresaWhere(usuario.contaId);

  const verAtas = podeAcessarModulo(usuario, "ATAS");
  const verContratos = podeAcessarModulo(usuario, "CONTRATOS");

  if (!verAtas && !verContratos) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <Award className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
        <h1 className="mt-4 text-[20px] font-extrabold" style={{ color: "var(--text)" }}>
          Tela não disponível para o seu acesso
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
          Os atestados vêm das Atas e dos Contratos. Peça ao titular da conta para liberar um
          desses módulos.
        </p>
      </div>
    );
  }

  const q = (sp.q || "").trim();
  const orgao = sp.orgao || "";
  const hoje = new Date();

  // Só traz o que a pessoa pode ver: um atestado nasce de uma Ata ou de um
  // Contrato, então o módulo da origem decide.
  const origensPermitidas = [
    ...(verAtas ? [{ ata: { empresa: filtroEmpresa } }] : []),
    ...(verContratos ? [{ contrato: { empresa: filtroEmpresa } }] : []),
  ];

  const [atestados, orgaosDistintos, atasPendentes, contratosPendentes, atasEsperando, contratosEsperando] =
    await Promise.all([
      prisma.atestadoCapacidade.findMany({
        where: {
          OR: origensPermitidas,
          ...(q && {
            AND: [
              {
                OR: [
                  { orgaoEmissor: { contains: q, mode: "insensitive" as const } },
                  { objeto: { contains: q, mode: "insensitive" as const } },
                  { numero: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ],
          }),
          ...(orgao && { orgaoEmissor: orgao }),
        },
        orderBy: { dataEmissao: "desc" },
        include: {
          ata: { select: { id: true, numero: true, objeto: true } },
          contrato: { select: { id: true, numero: true, objeto: true } },
        },
      }),
      prisma.atestadoCapacidade.groupBy({
        by: ["orgaoEmissor"],
        where: { OR: origensPermitidas },
        orderBy: { orgaoEmissor: "asc" },
      }),
      verAtas
        ? prisma.ata.findMany({
            where: { empresa: filtroEmpresa, ...whereAtestadoPendente(hoje) },
            orderBy: { vigenciaFim: "desc" },
            select: { id: true, numero: true, orgaoNome: true, objeto: true, vigenciaFim: true },
          })
        : [],
      verContratos
        ? prisma.contrato.findMany({
            where: { empresa: filtroEmpresa, ...whereAtestadoPendente(hoje) },
            orderBy: { vigenciaFim: "desc" },
            select: { id: true, numero: true, orgaoNome: true, objeto: true, vigenciaFim: true },
          })
        : [],
      verAtas
        ? prisma.ata.findMany({
            where: { empresa: filtroEmpresa, ...whereAguardandoOrgao() },
            orderBy: { atestadoSolicitadoEm: "asc" },
            select: { id: true, numero: true, orgaoNome: true, atestadoSolicitadoEm: true },
          })
        : [],
      verContratos
        ? prisma.contrato.findMany({
            where: { empresa: filtroEmpresa, ...whereAguardandoOrgao() },
            orderBy: { atestadoSolicitadoEm: "asc" },
            select: { id: true, numero: true, orgaoNome: true, atestadoSolicitadoEm: true },
          })
        : [],
    ]);

  const pendentes = [
    ...atasPendentes.map((a) => ({ ...a, tipo: "Ata" as const, href: `/atas/${a.id}` })),
    ...contratosPendentes.map((c) => ({ ...c, tipo: "Contrato" as const, href: `/contratos/${c.id}` })),
  ].sort((a, b) => b.vigenciaFim.getTime() - a.vigenciaFim.getTime());

  const esperando = [
    ...atasEsperando.map((a) => ({ ...a, tipo: "Ata" as const, href: `/atas/${a.id}` })),
    ...contratosEsperando.map((c) => ({ ...c, tipo: "Contrato" as const, href: `/contratos/${c.id}` })),
  ].sort(
    (a, b) =>
      (a.atestadoSolicitadoEm?.getTime() ?? 0) - (b.atestadoSolicitadoEm?.getTime() ?? 0),
  );

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <BannerEmpresaEmFoco contaId={usuario.contaId} />
      <PageHeader
        eyebrow="Qualificação técnica"
        titulo="Atestados de"
        destaque="Capacidade"
        subtitulo={`${atestados.length} atestado(s) arquivado(s)${
          pendentes.length > 0 ? ` · ${pendentes.length} contratação(ões) a solicitar` : ""
        }.`}
      />

      {pendentes.length > 0 && (
        <section className="mt-6">
          <TituloSecao
            icone={<Award className="h-4 w-4" />}
            titulo="A solicitar ao órgão"
            ajuda="Encerraram e ainda não tiveram o atestado pedido. Abra a contratação para registrar a solicitação ou dispensar."
          />
          <div className="mt-3 space-y-2">
            {pendentes.map((p) => {
              const dias = diasDecorridos(p.vigenciaFim, hoje);
              return (
                <Link
                  key={`${p.tipo}-${p.id}`}
                  href={p.href}
                  className="glass-tile flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-5 py-3 transition hover:-translate-y-0.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-extrabold" style={{ color: "var(--text)" }}>
                      {p.tipo} {p.numero} · {p.orgaoNome}
                    </p>
                    <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--text-soft)" }}>
                      {p.objeto}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-[12px] font-bold"
                    style={{ color: "var(--primary-deep)" }}
                  >
                    encerrou há {dias} dia{dias === 1 ? "" : "s"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {esperando.length > 0 && (
        <section className="mt-8">
          <TituloSecao
            icone={<Clock className="h-4 w-4" />}
            titulo="Solicitados, aguardando o órgão"
            ajuda="O pedido já foi feito. Passando de 45 dias, vale cobrar o fiscal do contrato."
          />
          <div className="mt-3 space-y-2">
            {esperando.map((e) => {
              const dias = e.atestadoSolicitadoEm
                ? Math.max(0, diasDecorridos(e.atestadoSolicitadoEm, hoje))
                : 0;
              return (
                <Link
                  key={`${e.tipo}-${e.id}`}
                  href={e.href}
                  className="glass-tile flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-5 py-3 transition hover:-translate-y-0.5"
                >
                  <p className="text-[13px] font-extrabold" style={{ color: "var(--text)" }}>
                    {e.tipo} {e.numero} · {e.orgaoNome}
                  </p>
                  <span
                    className="shrink-0 text-[12px] font-bold"
                    style={{ color: dias >= 45 ? "var(--coral-deep)" : "var(--text-mute)" }}
                  >
                    pedido há {dias} dia{dias === 1 ? "" : "s"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <TituloSecao
          icone={<FileText className="h-4 w-4" />}
          titulo="Atestados arquivados"
          ajuda="O acervo que comprova sua qualificação técnica. Busque por órgão ou pelo objeto na hora de montar a habilitação."
        />

        <div className="mt-4">
          <FiltroLista
            placeholderBusca="Buscar por órgão, objeto ou nº do atestado…"
            filtros={[
              {
                name: "orgao",
                label: "Todos os órgãos",
                opcoes: orgaosDistintos.map((o) => ({
                  value: o.orgaoEmissor,
                  label: o.orgaoEmissor,
                })),
              },
            ]}
          />
        </div>

        {atestados.length === 0 ? (
          <div
            className="glass-tile mt-4 rounded-[20px] p-12 text-center"
            style={{ border: "0.5px dashed var(--hairline)" }}
          >
            <Award className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
            <p className="mt-3 text-sm font-extrabold" style={{ color: "var(--text)" }}>
              {q || orgao ? "Nenhum atestado com esse filtro." : "Nenhum atestado arquivado ainda."}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
              Ao encerrar uma contratação, solicite o atestado ao órgão e anexe o PDF na Ata ou no
              Contrato de origem. Ele passa a aparecer aqui.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {atestados.map((a) => {
              const origem = a.ata
                ? { rotulo: `Ata ${a.ata.numero}`, href: `/atas/${a.ata.id}`, objeto: a.ata.objeto }
                : a.contrato
                  ? {
                      rotulo: `Contrato ${a.contrato.numero}`,
                      href: `/contratos/${a.contrato.id}`,
                      objeto: a.contrato.objeto,
                    }
                  : null;
              return (
                <article key={a.id} className="glass-tile rounded-[16px] px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-3">
                        <h3 className="text-[14px] font-extrabold" style={{ color: "var(--text)" }}>
                          {a.numero ? `Atestado ${a.numero}` : "Atestado"}
                        </h3>
                        <span
                          className="text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: "var(--text-mute)" }}
                        >
                          {a.dataEmissao.toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px]" style={{ color: "var(--text-soft)" }}>
                        <strong>{a.orgaoEmissor}</strong>
                      </p>
                      <p className="mt-1 text-[12px]" style={{ color: "var(--text-soft)" }}>
                        {a.objeto || origem?.objeto}
                      </p>
                      {origem && (
                        <Link
                          href={origem.href}
                          className="mt-2 inline-block text-[11px] font-bold underline"
                          style={{ color: "var(--sky-deep, #3F638F)" }}
                        >
                          {origem.rotulo}
                        </Link>
                      )}
                    </div>
                    <a
                      href={a.arquivoPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition hover:opacity-80"
                      style={{
                        background: "rgba(63,99,143,0.10)",
                        color: "var(--sky-deep, #3F638F)",
                        border: "0.5px solid rgba(63,99,143,0.2)",
                      }}
                    >
                      <FileText className="h-3 w-3" /> Abrir PDF
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function TituloSecao({
  icone,
  titulo,
  ajuda,
}: {
  icone: React.ReactNode;
  titulo: string;
  ajuda: string;
}) {
  return (
    <header>
      <h2
        className="flex items-center gap-2 text-[12px] font-bold uppercase"
        style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
      >
        {icone}
        {titulo}
      </h2>
      <p className="mt-1 text-[12px]" style={{ color: "var(--text-soft)" }}>
        {ajuda}
      </p>
    </header>
  );
}
