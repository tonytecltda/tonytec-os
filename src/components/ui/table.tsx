"use client"

import * as React from "react"
import { cn } from "cn"

/**
 * modoMovel:
 *  - "cartoes" (padrão): no celular cada linha vira um cartão com "rótulo: valor" (sem rolagem lateral);
 *  - "rolagem": mantém a tabela com rolagem horizontal (relatórios com muitas colunas numéricas).
 * Os rótulos vêm do cabeçalho da própria tabela (ver o CSS em globals.css).
 */
function Table({
  className,
  modoMovel = "cartoes",
  ...props
}: React.ComponentProps<"table"> & { modoMovel?: "cartoes" | "rolagem" }) {
  const ref = React.useRef<HTMLTableElement>(null)

  React.useEffect(() => {
    const tabela = ref.current
    if (!tabela || modoMovel !== "cartoes") return
    const rotular = () => {
      const ths = Array.from(tabela.querySelectorAll<HTMLElement>("thead tr:last-child > th"))
      // Colunas só com texto para leitor de tela (ações) ficam sem rótulo visível.
      const rotulos = ths.map((th) => (th.querySelector(".sr-only") ? "" : (th.textContent ?? "").trim()))
      tabela.querySelectorAll<HTMLElement>("tbody > tr").forEach((tr) => {
        const celulas = Array.from(tr.children) as HTMLElement[]
        if (celulas.length !== ths.length) return
        celulas.forEach((td, i) => {
          if (td.dataset.label !== rotulos[i]) td.dataset.label = rotulos[i]
        })
      })
    }
    rotular()
    const observador = new MutationObserver(rotular)
    observador.observe(tabela, { childList: true, subtree: true })
    return () => observador.disconnect()
  }, [modoMovel])

  return (
    <div
      data-slot="table-container"
      data-modo-movel={modoMovel}
      className="relative w-full overflow-x-auto"
    >
      <table
        ref={ref}
        data-slot="table"
        data-modo-movel={modoMovel}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
