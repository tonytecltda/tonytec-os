import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut } from "../actions";

export const metadata = { title: "Sem acesso" };

export default function SemAcessoPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Acesso indisponível</CardTitle>
        <CardDescription>
          Seu usuário está desativado ou ainda não tem um perfil configurado. Entre em contato com a Tonytec.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Sair
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
