"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/form-message";
import { signIn } from "../actions";

export function LoginForm({ next, linkError }: { next?: string; linkError?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Acesse com o e-mail e a senha cadastrados.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link
                href="/esqueci-senha"
                className="text-muted-foreground -my-2 inline-block py-2 text-sm underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <FormMessage error={state?.error ?? linkError} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
