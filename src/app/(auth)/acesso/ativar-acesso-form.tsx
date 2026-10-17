"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-message";
import { ativarAcesso } from "../actions";

export function AtivarAcessoForm({ token, tipo }: { token: string; tipo: string }) {
  const [state, action, pending] = useActionState(ativarAcesso, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="tipo" value={tipo} />
      <FormMessage error={state?.error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Continuar
      </Button>
    </form>
  );
}
