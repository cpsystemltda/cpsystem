import "server-only";

/**
 * Filtro para dado PESSOAL de usuário, correto também em modo espionagem.
 *
 * Regina, 23/09/2026, olhando a tela de um cliente: *"está mostrando meu
 * e-mail, erro grave."* A página de Integrações dizia "Conectado como
 * regina@cpsystem.app.br" dentro da conta do cliente.
 *
 * A causa é uma decisão proposital com efeito colateral: no modo espionagem o
 * swap troca `contaId`/`conta` mas **mantém o id do super admin**, para a
 * auditoria registrar quem espionou. Só que aí toda consulta escrita como
 * `where: { usuarioId: usuario.id }` devolve o dado pessoal do espião —
 * conexão Google, avisos, preferências — dentro da tela de outra empresa.
 *
 * Trocar o id consertaria a tela e quebraria a auditoria. Então quem muda é o
 * filtro: espionando, o dado vem da CONTA que está sendo olhada, que é de
 * quem a tela fala.
 *
 * Vale para dado que pertence a uma PESSOA. Dado da empresa (ata, contrato,
 * empenho) já é filtrado por conta e não passa por aqui.
 */
export function ondeDoUsuario(u: {
  id: string;
  contaId: string;
  espionando: boolean;
}): { usuarioId: string } | { usuario: { contaId: string } } {
  return u.espionando ? { usuario: { contaId: u.contaId } } : { usuarioId: u.id };
}
