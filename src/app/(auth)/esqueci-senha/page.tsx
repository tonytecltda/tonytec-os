"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/form-message";
import { requestPasswordReset } from "../actions";

export default function EsqueciSenhaPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Redefinir senha</CardTitle>
        <CardDescription>Enviaremos um link para o seu e-mail.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>
          <FormMessage error={state?.error} success={state?.success} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Enviar link
          </Button>
          <Link
            href="/login"
            className="text-muted-foreground text-center text-sm underline-offset-4 hover:underline"
          >
            Voltar para o login
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
