"use client";

import { useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";

type Props = Omit<React.ComponentProps<typeof InputGroupInput>, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (valor: number | null) => void;
  /** Casas decimais (0 = inteiro). */
  decimais?: number;
  prefixo?: string;
  sufixo?: string;
};

const formatar = (v: number | null, decimais: number) =>
  v == null
    ? ""
    : v.toLocaleString("pt-BR", { minimumFractionDigits: decimais, maximumFractionDigits: decimais });

/** Aceita "1.234,56" ou "1234.56". Retorna null para vazio. */
function interpretar(texto: string, decimais: number): number | null {
  const limpo = texto.replace(/\s/g, "");
  if (limpo === "") return null;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  if (!Number.isFinite(n)) return null;
  const fator = 10 ** decimais;
  return Math.round(n * fator) / fator;
}

/**
 * Campo numérico no padrão brasileiro (vírgula decimal), com prefixo opcional (R$).
 * Mantém o texto digitado e formata ao sair do campo.
 */
export function NumberInput({ value, onChange, decimais = 2, prefixo, sufixo, onBlur, ...props }: Props) {
  const [texto, setTexto] = useState(() => formatar(value, decimais));
  const [valorAnterior, setValorAnterior] = useState(value);

  // Sincroniza quando o valor muda por fora (ex.: reset do formulário),
  // ajustando o estado durante a renderização (sem efeito).
  if (value !== valorAnterior) {
    setValorAnterior(value);
    if (interpretar(texto, decimais) !== value) setTexto(formatar(value, decimais));
  }

  return (
    <InputGroup>
      {prefixo ? (
        <InputGroupAddon>
          <InputGroupText>{prefixo}</InputGroupText>
        </InputGroupAddon>
      ) : null}
      <InputGroupInput
        {...props}
        type="text"
        inputMode={decimais > 0 ? "decimal" : "numeric"}
        value={texto}
        onChange={(e) => {
          const t = e.target.value.replace(decimais > 0 ? /[^\d.,]/g : /\D/g, "");
          setTexto(t);
          onChange(interpretar(t, decimais));
        }}
        onBlur={(e) => {
          setTexto(formatar(interpretar(texto, decimais), decimais));
          onBlur?.(e);
        }}
      />
      {sufixo ? (
        <InputGroupAddon align="inline-end">
          <InputGroupText>{sufixo}</InputGroupText>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
