"use client";

import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBRL } from "@/lib/format";

export type ItemCatalogo = {
  id: string;
  descricao: string;
  tipo: "material" | "equipamento" | "mao_de_obra" | "servico";
  unidade: string;
  valor_unitario: number;
};

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Busca no catálogo de itens/serviços para adicionar à OS. */
export function ItemCatalogoCombobox({
  itens,
  onEscolher,
  disabled,
}: {
  itens: ItemCatalogo[];
  onEscolher: (item: ItemCatalogo) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled || !itens.length}>
          <PackagePlus /> Do catálogo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,26rem)] p-0" align="start">
        <Command filter={(valor, busca) => (normalizar(valor).includes(normalizar(busca)) ? 1 : 0)}>
          <CommandInput placeholder="Buscar material ou serviço…" />
          <CommandList>
            <CommandEmpty>Nada encontrado. Use “Item avulso”.</CommandEmpty>
            <CommandGroup>
              {itens.map((i) => (
                <CommandItem
                  key={i.id}
                  value={`${i.descricao} ${i.id}`}
                  onSelect={() => {
                    onEscolher(i);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{i.descricao}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {formatBRL(i.valor_unitario)}/{i.unidade}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
