import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AtivarAcessoForm } from "./ativar-acesso-form";

export const metadata: Metadata = { title: "Ativar acesso" };

export default async function AcessoPage({ searchParams }: PageProps<"/acesso">) {
  const { token, tipo } = await searchParams;
  const tokenValido = typeof token === "string" && token.length >= 10;
  const tipoValido = typeof tipo === "string" ? tipo : "recovery";

  if (!tokenValido) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Link inválido</CardTitle>
          <CardDescription>Este link está incompleto. Peça um novo link de acesso à Tonytec.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm underline-offset-4 hover:underline">
            Ir para o login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Ativar seu acesso</CardTitle>
        <CardDescription>
          Clique em continuar para criar a sua senha de acesso ao sistema de chamados da Tonytec.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AtivarAcessoForm token={token} tipo={tipoValido} />
      </CardContent>
    </Card>
  );
}
