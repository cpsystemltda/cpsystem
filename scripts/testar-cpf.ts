import { validarCpf } from "@/lib/cpf";
let f = 0;
const c = (nome: string, obtido: boolean, esperado: boolean) => {
  const ok = obtido === esperado; if (!ok) f++;
  console.log(`  ${ok ? "✓" : "✗"} ${nome}`);
};
console.log("\nCPFs que devem PASSAR (válidos de verdade):");
c("529.982.247-25", validarCpf("529.982.247-25"), true);
c("75926882206 (analista Fernanda)", validarCpf("75926882206"), true);
c("16998092750 (analista Edenilton)", validarCpf("16998092750"), true);
console.log("\nCPFs que devem SER BARRADOS:");
c("111.111.111-11 (repetido)", validarCpf("11111111111"), false);
c("000.000.000-00", validarCpf("00000000000"), false);
c("123.456.789-00 (inventado)", validarCpf("12345678900"), false);
c("529.982.247-24 (dígito errado)", validarCpf("52998224724"), false);
c("curto demais", validarCpf("1234567890"), false);
console.log(`\n${f === 0 ? "TUDO PASSOU" : `${f} FALHA(S)`}\n`);
process.exit(f === 0 ? 0 : 1);
