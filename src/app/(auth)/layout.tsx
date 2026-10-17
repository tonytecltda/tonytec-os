import { Brand } from "@/components/brand";
import { getEmpresaPublica } from "@/lib/config";

// A logo/nome vêm das Configurações: renderiza a cada acesso (não congela no build).
export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const empresa = await getEmpresaPublica();
  return (
    <main className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Brand subtitle={empresa.razaoSocial} logoUrl={empresa.logoUrl} nome={empresa.nome} />
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-muted-foreground text-center text-xs">
        CFTV • Centrais Telefônicas • Portões Eletrônicos • Controle de Acesso
      </p>
    </main>
  );
}
