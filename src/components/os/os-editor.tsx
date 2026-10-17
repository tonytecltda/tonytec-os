"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CloudOff, Loader2, Plus, RotateCcw, Save, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow } from "@/components/forms/field-row";
import { NumberInput } from "@/components/forms/number-input";
import { concluirOs, salvarOs } from "@/actions/os";
import { formatBRL } from "@/lib/format";
import { ITEM_TIPO, TIPO_ATENDIMENTO, opcoes } from "@/lib/labels";
import type { ItemOsInput, OsSnapshot } from "@/lib/validators";
import { ItemCatalogoCombobox, type ItemCatalogo } from "./item-catalogo-combobox";

type Estado = "salvo" | "pendente" | "salvando" | "offline" | "erro";
type Rascunho = { dados: OsSnapshot; ts: number; sessao: string };

/** Identifica esta abertura da página (rascunhos de sessões anteriores podem ser recuperados). */
const SESSAO =
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());

const assinarStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

function lerRascunho(valor: string | null): Rascunho | null {
  if (!valor) return null;
  try {
    return JSON.parse(valor) as Rascunho;
  } catch {
    return null;
  }
}

const novoId = () => crypto.randomUUID();

export function OsEditor({
  osId,
  inicial,
  atualizadoEm,
  catalogo,
  urlAssinatura,
  podeConcluir = true,
}: {
  osId: string;
  inicial: OsSnapshot;
  atualizadoEm: string;
  catalogo: ItemCatalogo[];
  /** Para onde ir depois de concluir (tela de assinatura). */
  urlAssinatura: string;
  /** O admin edita, mas quem conclui e coleta as assinaturas é o técnico. */
  podeConcluir?: boolean;
}) {
  const router = useRouter();
  const chave = `tonytec-os-rascunho-${osId}`;
  const [dados, setDados] = useState<OsSnapshot>(inicial);
  const [estado, setEstado] = useState<Estado>("salvo");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [descartado, setDescartado] = useState(false);
  const [concluindo, startConcluir] = useTransition();

  const dadosRef = useRef(dados);
  const sujoRef = useRef(false);
  const salvandoRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  // Rascunho guardado no aparelho por uma sessão anterior (ex.: página fechada sem sinal).
  const armazenado = useSyncExternalStore(
    assinarStorage,
    () => localStorage.getItem(chave),
    () => null,
  );
  const rascunhoAntigo = lerRascunho(armazenado);
  const mostrarRecuperacao =
    !descartado &&
    !!rascunhoAntigo &&
    rascunhoAntigo.sessao !== SESSAO &&
    rascunhoAntigo.ts > Date.parse(atualizadoEm);

  const gravarLocal = useCallback(
    (d: OsSnapshot) => {
      try {
        localStorage.setItem(
          chave,
          JSON.stringify({ dados: d, ts: Date.now(), sessao: SESSAO } satisfies Rascunho),
        );
      } catch {
        // armazenamento indisponível (modo privado): segue só com o servidor
      }
    },
    [chave],
  );

  const salvar = useCallback(async (): Promise<boolean> => {
    if (salvandoRef.current) return false;
    if (!sujoRef.current) return true;
    // Não confia em navigator.onLine (dá falso "offline" em alguns aparelhos/redes):
    // sempre tenta; só a falha real da requisição vira "offline".
    salvandoRef.current = true;
    setEstado("salvando");
    try {
      // Repete enquanto houver alterações feitas durante o envio anterior.
      while (sujoRef.current) {
        const enviado = dadosRef.current;
        let r: Awaited<ReturnType<typeof salvarOs>> | null = null;
        try {
          r = await salvarOs(osId, enviado);
        } catch (e) {
          console.error("[os] falha ao salvar", e);
          r = null; // sem rede / servidor inacessível
        }
        if (!r) {
          setEstado("offline");
          return false;
        }
        if (!r.ok) {
          setEstado("erro");
          setErros(r.fieldErrors ?? {});
          toast.error(r.error);
          return false;
        }
        setErros({});
        if (dadosRef.current === enviado) sujoRef.current = false;
      }
      setEstado("salvo");
      try {
        localStorage.removeItem(chave);
      } catch {}
      return true;
    } finally {
      salvandoRef.current = false;
    }
  }, [osId, chave]);

  const atualizar = (patch: Partial<OsSnapshot>) => {
    const novo = { ...dadosRef.current, ...patch };
    dadosRef.current = novo;
    sujoRef.current = true;
    setDados(novo);
    gravarLocal(novo);
    setEstado("pendente");
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void salvar(), 1200);
  };

  // Voltou a conexão: sincroniza o que ficou pendente. Avisa antes de sair com alterações não salvas.
  useEffect(() => {
    const aoVoltar = () => {
      if (sujoRef.current) void salvar();
    };
    const antesDeSair = (e: BeforeUnloadEvent) => {
      if (sujoRef.current) e.preventDefault();
    };
    window.addEventListener("online", aoVoltar);
    window.addEventListener("beforeunload", antesDeSair);
    return () => {
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("beforeunload", antesDeSair);
      window.clearTimeout(timerRef.current);
    };
  }, [salvar]);

  const setItem = (id: string, patch: Partial<ItemOsInput>) =>
    atualizar({ itens: dadosRef.current.itens.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  const totalItens = dados.itens
    .filter((i) => i.cobrado)
    .reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0);

  const concluir = () =>
    startConcluir(async () => {
      window.clearTimeout(timerRef.current);
      const salvo = await salvar();
      if (!salvo && sujoRef.current) {
        toast.error(
          "Sem conexão: as alterações ainda não foram enviadas. Tente de novo quando houver sinal.",
        );
        return;
      }
      const r = await concluirOs(osId);
      if (!r.ok) {
        setErros(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      router.push(urlAssinatura);
    });

  return (
    <div className="grid gap-4 pb-24">
      {mostrarRecuperacao && rascunhoAntigo ? (
        <Alert className="border-amber-500/40">
          <TriangleAlert className="text-amber-600" />
          <AlertTitle>Há alterações salvas neste aparelho que não chegaram ao servidor</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => {
                atualizar(rascunhoAntigo.dados);
                toast.success("Rascunho recuperado. Salvando…");
              }}
            >
              <RotateCcw /> Recuperar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  localStorage.removeItem(chave);
                } catch {}
                setDescartado(true);
              }}
            >
              Descartar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atendimento</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <FieldRow label="Tipo de atendimento" htmlFor="os-tipo">
              <Select
                value={dados.tipo_atendimento}
                onValueChange={(v) => atualizar({ tipo_atendimento: v as OsSnapshot["tipo_atendimento"] })}
              >
                <SelectTrigger id="os-tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcoes(TIPO_ATENDIMENTO).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            {(
              [
                ["problema_relatado", "Problema relatado", 3, false],
                ["diagnostico", "Diagnóstico", 3, false],
                ["servico_executado", "Serviço executado", 4, true],
                ["observacoes_tecnicas", "Observações técnicas", 2, false],
                ["recomendacoes", "Recomendações ao cliente", 2, false],
              ] as const
            ).map(([campo, label, linhas, obrigatorio]) => (
              <FieldRow
                key={campo}
                label={label}
                htmlFor={`os-${campo}`}
                error={erros[campo]}
                required={obrigatorio}
              >
                <Textarea
                  id={`os-${campo}`}
                  rows={linhas}
                  value={dados[campo]}
                  onChange={(e) => atualizar({ [campo]: e.target.value })}
                  aria-invalid={!!erros[campo]}
                />
              </FieldRow>
            ))}
            <div className="grid gap-2">
              <label className="flex items-center gap-3 text-sm font-medium">
                <Switch checked={dados.pendencias} onCheckedChange={(v) => atualizar({ pendencias: v })} />
                Ficou alguma pendência?
              </label>
              {dados.pendencias ? (
                <FieldRow
                  label="Descreva as pendências"
                  htmlFor="os-pend"
                  error={erros.pendencias_texto}
                  required
                >
                  <Textarea
                    id="os-pend"
                    rows={2}
                    value={dados.pendencias_texto}
                    onChange={(e) => atualizar({ pendencias_texto: e.target.value })}
                    placeholder="Ex.: aguardando peça; retorno agendado para…"
                  />
                </FieldRow>
              ) : null}
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Materiais e serviços</CardTitle>
          <div className="flex flex-wrap gap-2">
            <ItemCatalogoCombobox
              itens={catalogo}
              onEscolher={(c) =>
                atualizar({
                  itens: [
                    ...dadosRef.current.itens,
                    {
                      id: novoId(),
                      catalogo_id: c.id,
                      descricao: c.descricao,
                      tipo: c.tipo,
                      quantidade: 1,
                      valor_unitario: c.valor_unitario,
                      cobrado: true,
                    },
                  ],
                })
              }
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                atualizar({
                  itens: [
                    ...dadosRef.current.itens,
                    {
                      id: novoId(),
                      catalogo_id: null,
                      descricao: "",
                      tipo: "material",
                      quantidade: 1,
                      valor_unitario: 0,
                      cobrado: true,
                    },
                  ],
                })
              }
            >
              <Plus /> Item avulso
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!dados.itens.length ? (
            <p className="text-muted-foreground text-sm">Nenhum material ou serviço lançado.</p>
          ) : (
            dados.itens.map((item, idx) => (
              <div key={item.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12 sm:items-end">
                <FieldRow
                  label="Descrição"
                  htmlFor={`it-d-${item.id}`}
                  className="sm:col-span-5"
                  error={erros[`itens.${idx}.descricao`]}
                >
                  <Input
                    id={`it-d-${item.id}`}
                    value={item.descricao}
                    onChange={(e) => setItem(item.id, { descricao: e.target.value })}
                    placeholder="Ex.: Fonte 12V 5A"
                  />
                </FieldRow>
                <FieldRow label="Tipo" htmlFor={`it-t-${item.id}`} className="sm:col-span-2">
                  <Select
                    value={item.tipo}
                    onValueChange={(v) => setItem(item.id, { tipo: v as ItemOsInput["tipo"] })}
                  >
                    <SelectTrigger id={`it-t-${item.id}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoes(ITEM_TIPO).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Qtd." htmlFor={`it-q-${item.id}`} className="sm:col-span-1">
                  <NumberInput
                    id={`it-q-${item.id}`}
                    decimais={2}
                    value={item.quantidade}
                    onChange={(v) => setItem(item.id, { quantidade: v && v > 0 ? v : 1 })}
                  />
                </FieldRow>
                <FieldRow label="Valor unit." htmlFor={`it-v-${item.id}`} className="sm:col-span-2">
                  <NumberInput
                    id={`it-v-${item.id}`}
                    prefixo="R$"
                    value={item.valor_unitario}
                    onChange={(v) => setItem(item.id, { valor_unitario: v ?? 0 })}
                  />
                </FieldRow>
                <div className="flex items-center justify-between gap-2 sm:col-span-2 sm:justify-end">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={item.cobrado}
                      onCheckedChange={(v) => setItem(item.id, { cobrado: v })}
                    />
                    Cobrar
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${item.descricao || "item"}`}
                    onClick={() =>
                      atualizar({ itens: dadosRef.current.itens.filter((i) => i.id !== item.id) })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))
          )}
          {dados.itens.length ? (
            <p className="text-right text-sm">
              Total cobrado em itens: <strong className="tabular-nums">{formatBRL(totalItens)}</strong>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Barra fixa: situação do salvamento + concluir */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <IndicadorSalvamento estado={estado} />
          <div className="flex-1" />
          {estado === "offline" || estado === "erro" ? (
            <Button variant="outline" size="lg" onClick={() => void salvar()}>
              <Save /> Tentar salvar
            </Button>
          ) : null}
          {podeConcluir ? (
            <Button size="lg" onClick={concluir} disabled={concluindo}>
              {concluindo ? <Spinner /> : <CheckCircle2 />}
              Concluir e assinar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IndicadorSalvamento({ estado }: { estado: Estado }) {
  const mapa: Record<Estado, { icone: React.ReactNode; texto: string; cor: string }> = {
    salvo: { icone: <CheckCircle2 className="size-4" />, texto: "Tudo salvo", cor: "text-emerald-600" },
    pendente: {
      icone: <Loader2 className="size-4" />,
      texto: "Alterações a salvar…",
      cor: "text-muted-foreground",
    },
    salvando: {
      icone: <Loader2 className="size-4 animate-spin" />,
      texto: "Salvando…",
      cor: "text-muted-foreground",
    },
    offline: {
      icone: <CloudOff className="size-4" />,
      texto: "Offline: salvo no aparelho",
      cor: "text-amber-600",
    },
    erro: {
      icone: <TriangleAlert className="size-4" />,
      texto: "Não foi possível salvar",
      cor: "text-destructive",
    },
  };
  const m = mapa[estado];
  return (
    <span className={`flex items-center gap-1.5 text-sm ${m.cor}`} role="status" aria-live="polite">
      {m.icone}
      <span className="hidden sm:inline">{m.texto}</span>
      <span className="sm:hidden">
        {estado === "salvo" ? "Salvo" : estado === "offline" ? "Offline" : m.texto.split(" ")[0]}
      </span>
    </span>
  );
}
