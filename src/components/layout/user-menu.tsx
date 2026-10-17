"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(auth)/actions";
import { ThemeSubmenu } from "./theme-toggle";

function iniciais(nome: string) {
  // Só palavras que começam com letra: "Fabiano (Admin)" -> "F", "Síndico Alfa (DEMO)" -> "SA".
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => /^\p{L}/u.test(p));
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes.at(-1)![0] : "")).toUpperCase() || "?";
}

export function UserMenu({ nome, email, papel }: { nome: string; email: string; papel: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu do usuário">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {iniciais(nome || email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{nome || email}</div>
          <div className="text-muted-foreground truncate text-xs">{email}</div>
          <div className="text-muted-foreground mt-1 text-xs">{papel}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeSubmenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
