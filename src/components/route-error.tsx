"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

/** Tela de erro das áreas logadas (error.tsx). */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      icon={TriangleAlert}
      titulo="Algo deu errado"
      descricao={`Não foi possível carregar esta tela. Tente novamente.${error.digest ? ` (código ${error.digest})` : ""}`}
    >
      <Button onClick={reset}>Tentar novamente</Button>
    </EmptyState>
  );
}
