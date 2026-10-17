import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Brand subtitle="Tonytec Ltda" />
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-muted-foreground text-center text-xs">
        CFTV • Centrais Telefônicas • Portões Eletrônicos • Controle de Acesso
      </p>
    </main>
  );
}
