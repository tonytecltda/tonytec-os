import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, erro } = await searchParams;
  return (
    <LoginForm
      next={typeof next === "string" ? next : undefined}
      linkError={erro === "link" ? "O link é inválido ou expirou. Solicite um novo." : undefined}
    />
  );
}
