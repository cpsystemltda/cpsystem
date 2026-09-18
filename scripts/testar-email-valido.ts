import { checarEmail } from "@/lib/emailValido";

/**
 * Exercita a detecção de e-mail digitado errado.
 *
 * O caso que originou tudo é o primeiro da lista: `gmial.com`, que o
 * `z.string().email()` aprovava sem piscar. Os casos "PASSA" importam tanto
 * quanto os "BARRA" — barrar cliente legítimo no cadastro é pior do que deixar
 * escapar um typo, porque a pessoa simplesmente desiste e vai embora.
 */
let falhas = 0;

function barra(email: string, sugestaoEsperada?: string) {
  const r = checarEmail(email);
  if (!r) {
    falhas++;
    console.log(`  ✗ ${email.padEnd(34)} deveria BARRAR, passou`);
    return;
  }
  if (sugestaoEsperada && r.sugestao !== sugestaoEsperada) {
    falhas++;
    console.log(`  ✗ ${email.padEnd(34)} sugeriu "${r.sugestao}", esperado "${sugestaoEsperada}"`);
    return;
  }
  console.log(`  ✓ ${email.padEnd(34)} barrado${r.sugestao ? ` → ${r.sugestao}` : ""}`);
}

function passa(email: string) {
  const r = checarEmail(email);
  if (r) {
    falhas++;
    console.log(`  ✗ ${email.padEnd(34)} deveria PASSAR, barrou (${r.mensagem})`);
    return;
  }
  console.log(`  ✓ ${email.padEnd(34)} passa`);
}

console.log("\nO caso real da HMD:");
barra("hmdcomercial01@gmial.com", "hmdcomercial01@gmail.com");

console.log("\nErros de digitação conhecidos:");
barra("joao@gmai.com", "joao@gmail.com");
barra("joao@gmail.con", "joao@gmail.com");
barra("joao@gmail.co", "joao@gmail.com");
barra("joao@gamil.com", "joao@gmail.com");
barra("joao@hotmial.com", "joao@hotmail.com");
barra("joao@hotnail.com", "joao@hotmail.com");
barra("joao@outlok.com", "joao@outlook.com");
barra("joao@yaho.com", "joao@yahoo.com");
barra("joao@iclod.com", "joao@icloud.com");
barra("joao@uol.com", "joao@uol.com.br");

console.log("\nErros novos, que não estão em lista nenhuma (distância 1):");
barra("joao@gmaul.com", "joao@gmail.com"); // substituição
barra("joao@gmailc.om"); // ponto no lugar errado
barra("joao@hotmali.com", "joao@hotmail.com"); // letras trocadas
barra("joao@yahooo.com", "joao@yahoo.com"); // letra a mais

console.log("\nEstrutura quebrada:");
barra("joao@gmail");
barra("joao@gmail..com");
barra("joao@.com");
barra("joao@gmail.c");

console.log("\nE-mails legítimos — nenhum pode ser barrado:");
passa("hmdcomercial01@gmail.com");
passa("contato@cpsystem.app.br");
passa("igor@contratospublicos.com.br");
passa("regina.luiza@greis.com.br");
passa("compras@unb.br");
passa("licitacao@tjdft.jus.br");
passa("fulano@yahoo.com.br");
passa("fulano@hotmail.com.br");
passa("fulano@outlook.com.br");
passa("fulano@bol.com.br");
passa("fulano@terra.com.br");
passa("fulano@uol.com.br");
passa("fulano@globo.com");
passa("fulano@empresa-de-nome-grande.com.br");
passa("nome.sobrenome+tag@gmail.com");
passa("a@b.co"); // domínio curto e legítimo

console.log(`\n${falhas === 0 ? "TUDO PASSOU" : `${falhas} FALHA(S)`}\n`);
process.exit(falhas === 0 ? 0 : 1);
