import Link from "next/link";
import {
  AlarmClock,
  BarChart3,
  Boxes,
  CalendarClock,
  ClipboardList,
  FileClock,
  Flame,
  LineChart,
  Receipt,
  ScrollText,
  Smile,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { RELATORIOS } from "@/lib/relatorios";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Relatórios" };

const ICONES: Record<string, LucideIcon> = {
  clientes: Users,
  problemas: ClipboardList,
  tecnicos: Wrench,
  sla: AlarmClock,
  faturamento: Receipt,
  contratos: ScrollText,
  evolucao: LineChart,
  satisfacao: Smile,
  materiais: Boxes,
  calor: Flame,
  "os-pendentes": FileClock,
};

export default async function RelatoriosPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        titulo="Relatórios"
        descricao="Escolha um relatório, filtre o período e exporte em CSV, XLSX ou PDF."
      >
        <Link
          href="/admin/agenda"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <CalendarClock className="size-4" /> Agenda dos técnicos
        </Link>
      </PageHeader>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {RELATORIOS.map((r) => {
          const Icone = ICONES[r.id] ?? BarChart3;
          return (
            <li key={r.id}>
              <Link
                href={`/admin/relatorios/${r.id}`}
                className="block h-full rounded-xl outline-none focus-visible:ring-3"
              >
                <Card className="hover:bg-muted/40 h-full transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="bg-primary/10 text-primary grid size-8 place-items-center rounded-lg">
                        <Icone className="size-4" />
                      </span>
                      {r.titulo}
                    </CardTitle>
                    <CardDescription>{r.descricao}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-xs">
                    {r.secoes.length} seção(ões) · CSV · XLSX · PDF
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
