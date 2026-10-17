"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { cn } from "@/lib/utils";

export type OpcaoCliente = { id: string; nome: string; documento?: string | null };

/** Seleção de cliente com busca por nome/documento. */
export function ClienteCombobox({
  id,
  clientes,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id?: string;
  clientes: OpcaoCliente[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selecionado = clientes.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selecionado && "text-muted-foreground")}>
            {selecionado ? selecionado.nome : "Selecione o cliente…"}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue
              .toLowerCase()
              .normalize("NFD")
              .replace(/\p{M}/gu, "")
              .includes(search.toLowerCase().normalize("NFD").replace(/\p{M}/gu, ""))
              ? 1
              : 0
          }
        >
          <CommandInput placeholder="Buscar cliente…" />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {clientes.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.nome} ${c.documento ?? ""} ${c.id}`}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn(value === c.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{c.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
