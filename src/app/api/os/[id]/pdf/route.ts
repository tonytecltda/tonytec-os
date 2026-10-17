import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Download do PDF final da OS. A RLS decide se o usuário pode ver a OS;
 * depois emitimos uma URL assinada de 60 s e redirecionamos.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/os/[id]/pdf">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ erro: "OS inválida" }, { status: 400 });

  const supabase = await createClient();
  const { data: os } = await supabase
    .from("ordens_servico")
    .select("numero, pdf_path")
    .eq("id", id)
    .maybeSingle();
  if (!os) return NextResponse.json({ erro: "OS não encontrada" }, { status: 404 });
  if (!os.pdf_path) return NextResponse.json({ erro: "PDF ainda não disponível" }, { status: 404 });

  const { data, error } = await createAdminClient()
    .storage.from("os-pdfs")
    .createSignedUrl(os.pdf_path, 60, { download: `${os.numero}.pdf` });
  if (error || !data) return NextResponse.json({ erro: "Não foi possível gerar o link" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
