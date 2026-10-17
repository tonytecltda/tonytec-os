"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV, type Area, type NavItem } from "./nav-config";
import { SinoNotificacoes } from "./sino-notificacoes";
import { UserMenu } from "./user-menu";

type ShellUser = { nome: string; email: string; papel: string };
type ShellEmpresa = { nome: string; logoUrl: string | null };

function corresponde(pathname: string, item: NavItem, raiz: string) {
  if (item.href === raiz) return pathname === raiz;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Item ativo = o de rota mais específica (ex.: "Abrir chamado" e não "Meus chamados"). */
function hrefAtivo(pathname: string, itens: NavItem[], raiz: string) {
  return itens
    .filter((i) => !i.fase && corresponde(pathname, i, raiz))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function NavLinks({ area, onNavigate }: { area: Area; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { itens } = NAV[area];
  const raiz = itens[0].href;
  const ativoHref = hrefAtivo(pathname, itens, raiz);

  return (
    <nav className="grid gap-0.5" aria-label="Navegação principal">
      {itens.map((item) => {
        const Icon = item.icon;
        const ativo = item.href === ativoHref;
        const base =
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

        if (item.fase) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title={`Disponível na Fase ${item.fase}`}
              className={cn(base, "text-sidebar-foreground/45 cursor-not-allowed")}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              <Badge
                variant="outline"
                className="border-sidebar-border text-sidebar-foreground/50 h-5 px-1.5 text-[10px]"
              >
                F{item.fase}
              </Badge>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              base,
              ativo
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  area,
  user,
  empresa,
  children,
}: {
  area: Area;
  user: ShellUser;
  empresa: ShellEmpresa;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { titulo } = NAV[area];

  return (
    <div className="flex min-h-svh">
      {/* Sidebar desktop */}
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r lg:flex">
        <div className="border-sidebar-border flex h-16 items-center border-b px-4">
          <Brand subtitle={titulo} logoUrl={empresa.logoUrl} nome={empresa.nome} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks area={area} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur lg:h-16 lg:px-6">
          {/* Menu mobile */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="bg-sidebar text-sidebar-foreground border-sidebar-border w-72 p-0"
            >
              <SheetHeader className="border-sidebar-border border-b">
                <SheetTitle className="text-sidebar-foreground">
                  <Brand subtitle={titulo} logoUrl={empresa.logoUrl} nome={empresa.nome} />
                </SheetTitle>
              </SheetHeader>
              <div className="p-3">
                <NavLinks area={area} onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <span className="font-semibold tracking-tight">{empresa.nome} OS</span>
          </div>
          <div className="flex-1" />
          <span className="text-muted-foreground hidden truncate text-sm sm:block">{user.nome}</span>
          <SinoNotificacoes />
          <UserMenu nome={user.nome} email={user.email} papel={user.papel} />
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
