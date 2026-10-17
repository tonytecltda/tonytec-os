import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { getEmpresaPublica } from "@/lib/config";

export const dynamic = "force-dynamic";

// O token está na URL: não envia o endereço completo para outros sites.
export const metadata: Metadata = { title: "Assinatura de OS", referrer: "no-referrer" };

export default async function AssinarLayout({ children }: { children: React.ReactNode }) {
  const empresa = await getEmpresaPublica();
  return (
    <div className="bg-muted/30 min-h-svh">
      <header className="bg-background border-b">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Brand subtitle={empresa.razaoSocial} logoUrl={empresa.logoUrl} nome={empresa.nome} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  );
}
