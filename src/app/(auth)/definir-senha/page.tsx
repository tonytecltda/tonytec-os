"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/form-message";
import { setPassword } from "../actions";

export default function DefinirSenhaPage() {
  const [state, action, pending] = useActionState(setPassword, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Definir ou alterar senha</CardTitle>
        <CardDescription>Crie a senha que você usará para acessar o sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus
            />
            <p className="text-muted-foreground text-xs">Mínimo de 8 caracteres.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <FormMessage error={state?.error} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Salvar senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
