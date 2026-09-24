import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EquipeClient } from "./EquipeClient";
import { PageHeader } from "@/components/ui/SecaoGlass";

export default async function EquipePage() {
  const usuario = await exigirUsuario();

  // O plano decide quantos colaboradores vêm inclusos (Regina 24/09).
  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    select: { plano: true },
  });

  const membros = await prisma.usuario.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: {
      id: true,
      nome: true,
      email: true,
      perfil: true,
      criadoEm: true,
      acessoRestrito: true,
      modulosPermitidos: true,
      funcaoNaEmpresa: true,
      telefoneWhatsApp: true,
    },
  });

  // Titular = o usuario mais antigo da conta. Ele nunca e restringido: e quem
  // administra os acessos dos outros, entao tirar o dele trancaria a conta.
  const titularId = membros[0]?.id ?? null;

  // Quem cuida de quê. Demanda de cliente 24/09: *"ter um painelzinho de
  // colaborador — Bruno está responsável por essa ata e esse empenho, fulano
  // por esse e esse."* Sem isso, a informação existe espalhada dentro de cada
  // documento e ninguém consegue ver a divisão do time de uma vez.
  const empresaIds = (
    await prisma.empresa.findMany({ where: { contaId: usuario.contaId }, select: { id: true } })
  ).map((e) => e.id);

  const [atasPorResp, contratosPorResp, empenhosPorResp] = await Promise.all([
    prisma.ata.findMany({
      where: { empresaId: { in: empresaIds }, responsavelId: { not: null } },
      select: { id: true, numero: true, orgaoNome: true, responsavelId: true, vigenciaFim: true },
      orderBy: { vigenciaFim: "asc" },
    }),
    prisma.contrato.findMany({
      where: { empresaId: { in: empresaIds }, responsavelId: { not: null } },
      select: { id: true, numero: true, orgaoNome: true, responsavelId: true, vigenciaFim: true },
      orderBy: { vigenciaFim: "asc" },
    }),
    prisma.empenho.findMany({
      where: { empresaId: { in: empresaIds }, responsavelId: { not: null }, status: { not: "PAGO" } },
      select: { id: true, numero: true, orgaoNome: true, responsavelId: true, vigenciaFim: true },
      orderBy: { vigenciaFim: "asc" },
    }),
  ]);

  const carteiraPorMembro = new Map<
    string,
    { tipo: "ata" | "contrato" | "empenho"; id: string; numero: string; orgao: string }[]
  >();
  const acrescentar = (
    tipo: "ata" | "contrato" | "empenho",
    linhas: { id: string; numero: string; orgaoNome: string; responsavelId: string | null }[],
  ) => {
    for (const l of linhas) {
      if (!l.responsavelId) continue;
      const atual = carteiraPorMembro.get(l.responsavelId) ?? [];
      atual.push({ tipo, id: l.id, numero: l.numero, orgao: l.orgaoNome });
      carteiraPorMembro.set(l.responsavelId, atual);
    }
  };
  acrescentar("ata", atasPorResp);
  acrescentar("contrato", contratosPorResp);
  acrescentar("empenho", empenhosPorResp);

  const carteira = membros.map((m) => ({
    id: m.id,
    nome: m.nome,
    funcao: m.funcaoNaEmpresa,
    temWhats: !!m.telefoneWhatsApp,
    documentos: carteiraPorMembro.get(m.id) ?? [],
  }));

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        eyebrow="Conta · Acessos"
        titulo="Equipe e"
        destaque="níveis de acesso"
        subtitulo="Cadastre colaboradores para dividir a operação e escolha, módulo a módulo, o que cada um enxerga."
      />

      <div className="mt-8">
        <EquipeClient
          membros={membros}
          meuId={usuario.id}
          ehAdmin={usuario.perfil === "ADMIN"}
          titularId={titularId}
          plano={conta?.plano ?? "BASICO"}
          carteira={carteira}
        />
      </div>
    </div>
  );
}
