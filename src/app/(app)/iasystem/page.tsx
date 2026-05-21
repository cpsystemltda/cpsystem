import { exigirUsuario } from "@/lib/auth";
import { IAsystemChat } from "@/components/IAsystemChat";

export const metadata = {
  title: "IAsystem · CP System",
  description: "Assistente jurídico especializado em Lei 14.133/2021",
};

export default async function IAsystemPage() {
  await exigirUsuario();
  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <IAsystemChat />
    </div>
  );
}
