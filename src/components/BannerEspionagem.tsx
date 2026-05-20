import { Eye, LogOut } from "lucide-react";
import { sairEspionagemAction } from "@/lib/espionagem";

export function BannerEspionagem({ contaNome }: { contaNome: string }) {
  return (
    <div className="sticky top-0 z-50 border-b border-violet-700/40 bg-gradient-to-r from-violet-700 to-violet-600 text-white shadow-sm">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-2.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/20">
          <Eye className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 text-sm">
          <span className="font-semibold">Modo espionagem · </span>
          <span className="opacity-90">
            Você está vendo o espaço de{" "}
            <strong className="font-bold">{contaNome}</strong> em somente leitura.
            Nenhuma alteração será gravada.
          </span>
        </div>
        <form action={sairEspionagemAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair do modo espionagem
          </button>
        </form>
      </div>
    </div>
  );
}
