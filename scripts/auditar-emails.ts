import "./_env";
import { prisma } from "@/lib/prisma";
import { checarEmail } from "@/lib/emailValido";

/**
 * Varre a base atrás de e-mail digitado errado — o que já entrou antes de a
 * validação existir (Igor, 18/09/2026).
 *
 * SOMENTE LEITURA por padrão. Com `--corrigir`, aplica a correção sugerida nos
 * e-mails de USUÁRIO, que é onde o erro cega a comunicação. Mesmo assim só age
 * quando a sugestão é inequívoca e não colide com outro cadastro — e-mail de
 * usuário é login: trocar por um que já existe derruba os dois.
 */
const CORRIGIR = process.argv.includes("--corrigir");

type Achado = { onde: string; quem: string; email: string; sugestao?: string; motivo: string };

async function main() {
  const achados: Achado[] = [];

  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      contaId: true,
      conta: { select: { statusAssinatura: true } },
    },
  });
  for (const u of usuarios) {
    const p = checarEmail(u.email);
    if (p) {
      achados.push({
        onde: "Usuário",
        quem: `${u.nome} (${u.conta?.statusAssinatura ?? "—"})`,
        email: u.email,
        sugestao: p.sugestao,
        motivo: p.mensagem,
      });
    }
  }

  const empresas = await prisma.empresa.findMany({
    select: { id: true, razaoSocial: true, email: true, emails: true },
  });
  for (const e of empresas) {
    for (const end of [e.email, ...e.emails]) {
      if (!end) continue;
      const p = checarEmail(end);
      if (p) {
        achados.push({
          onde: "Empresa",
          quem: e.razaoSocial,
          email: end,
          sugestao: p.sugestao,
          motivo: p.mensagem,
        });
      }
    }
  }

  console.log(`Usuários verificados: ${usuarios.length}`);
  console.log(`Empresas verificadas: ${empresas.length}`);
  console.log(`\nE-mails com problema: ${achados.length}`);
  for (const a of achados) {
    console.log(`\n  [${a.onde}] ${a.quem}`);
    console.log(`     ${a.email}${a.sugestao ? `  →  ${a.sugestao}` : ""}`);
    console.log(`     ${a.motivo}`);
  }

  if (!CORRIGIR) {
    if (achados.length) console.log(`\n(nada foi alterado — rode com --corrigir para aplicar)`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n--- APLICANDO CORREÇÕES EM E-MAIL DE USUÁRIO ---`);
  let corrigidos = 0;
  for (const u of usuarios) {
    const p = checarEmail(u.email);
    if (!p?.sugestao) continue;

    // E-mail de usuário é o login. Se o corrigido já pertence a outra conta,
    // parar e avisar — juntar dois logins é pior que o erro de digitação.
    const colide = await prisma.usuario.findFirst({
      where: { email: p.sugestao, NOT: { id: u.id } },
      select: { id: true },
    });
    if (colide) {
      console.log(`  ! ${u.email} → ${p.sugestao} NÃO aplicado: já existe outro usuário com esse e-mail`);
      continue;
    }

    await prisma.usuario.update({ where: { id: u.id }, data: { email: p.sugestao } });
    console.log(`  ✓ ${u.nome}: ${u.email} → ${p.sugestao}`);
    corrigidos++;

    if (u.contaId) {
      await prisma.logAuditoria.create({
        data: {
          contaId: u.contaId,
          acao: "ATUALIZAR",
          recurso: "Usuario",
          recursoId: u.id,
          resumo: `E-mail corrigido de ${u.email} para ${p.sugestao} (erro de digitação no domínio). Igor/Regina 18/09/2026.`,
        },
      });
    }
  }

  // E-mail da empresa: é o contato comercial, não o login. Aqui não há risco de
  // colisão de acesso, então a correção é direta.
  for (const e of empresas) {
    const dados: { email?: string; emails?: string[] } = {};

    const pPrincipal = checarEmail(e.email);
    if (pPrincipal?.sugestao) dados.email = pPrincipal.sugestao;

    if (e.emails.length) {
      const listaNova = e.emails.map((end) => checarEmail(end)?.sugestao ?? end);
      if (listaNova.some((novo, i) => novo !== e.emails[i])) dados.emails = listaNova;
    }

    if (!dados.email && !dados.emails) continue;

    await prisma.empresa.update({ where: { id: e.id }, data: dados });
    console.log(
      `  ✓ ${e.razaoSocial}: ${dados.email ? `email ${e.email} → ${dados.email}` : ""}${
        dados.emails ? `  lista → ${dados.emails.join(", ")}` : ""
      }`,
    );
    corrigidos++;
  }

  console.log(`\nCorrigidos: ${corrigidos}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
