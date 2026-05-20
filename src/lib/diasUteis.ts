/**
 * Cálculo de dias úteis pra prazos legais.
 *
 * Lei 14.133/2021 — todos os prazos do procedimento apuratório são contados
 * em DIAS ÚTEIS (defesa, alegações finais, recurso). Sábados, domingos e
 * feriados nacionais NÃO contam.
 *
 * Esta implementação cobre fins de semana. Feriados nacionais móveis
 * (Páscoa, Corpus Christi, etc.) seriam um próximo passo via tabela
 * pré-computada ou biblioteca dedicada.
 */

/** Adiciona N dias úteis a uma data, pulando sábados e domingos. */
export function adicionarDiasUteis(inicio: Date, diasUteis: number): Date {
  if (diasUteis <= 0) return new Date(inicio);
  const d = new Date(inicio);
  let restantes = diasUteis;
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dia = d.getUTCDay(); // 0 = domingo, 6 = sábado
    if (dia !== 0 && dia !== 6) restantes--;
  }
  return d;
}

/** Conta dias úteis entre duas datas (exclusivo no início, inclusivo no fim). */
export function contarDiasUteis(inicio: Date, fim: Date): number {
  if (fim.getTime() <= inicio.getTime()) return 0;
  let count = 0;
  const d = new Date(inicio);
  while (d.getTime() < fim.getTime()) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6) count++;
  }
  return count;
}

/** Quantos dias úteis faltam de hoje até a data alvo. Negativo se passou. */
export function diasUteisRestantes(alvo: Date): number {
  const hoje = new Date();
  const hojeUtc = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 12, 0, 0),
  );
  if (alvo.getTime() > hojeUtc.getTime()) {
    return contarDiasUteis(hojeUtc, alvo);
  }
  return -contarDiasUteis(alvo, hojeUtc);
}
