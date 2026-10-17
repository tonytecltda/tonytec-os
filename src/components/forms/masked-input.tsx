"use client";

import { Input } from "@/components/ui/input";
import { MASCARAS, type Mascara } from "@/lib/masks";

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  mascara: Mascara;
  value: string;
  onChange: (valor: string) => void;
};

/** Input com máscara (telefone, CEP, CPF/CNPJ) aplicada durante a digitação. */
export function MaskedInput({ mascara, value, onChange, ...props }: Props) {
  const aplicar = MASCARAS[mascara];
  return (
    <Input
      {...props}
      value={aplicar(value ?? "")}
      onChange={(e) => onChange(aplicar(e.target.value))}
      inputMode={mascara === "documento" ? "text" : "numeric"}
      autoCapitalize={mascara === "documento" ? "characters" : undefined}
    />
  );
}
