import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center p-4">
      <div className="w-full max-w-md">
        <EmptyState
          icon={SearchX}
          titulo="Página não encontrada"
          descricao="O endereço não existe ou o registro foi removido."
        >
          <Button asChild>
            <Link href="/">Voltar ao início</Link>
          </Button>
        </EmptyState>
      </div>
    </main>
  );
}
