"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import SignaturePad from "signature_pad";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export type QuadroAssinaturaHandle = {
  vazio: () => boolean;
  /** PNG (data URL) ou null se não houver assinatura. */
  imagem: () => string | null;
  limpar: () => void;
};

/**
 * Quadro de assinatura com o dedo/caneta (signature_pad). Ajusta-se à densidade
 * de pixels da tela e preserva o desenho ao girar o celular/redimensionar.
 */
export function QuadroAssinatura({
  ref,
  rotulo,
  onMudar,
}: {
  ref?: React.Ref<QuadroAssinaturaHandle>;
  rotulo: string;
  onMudar?: (vazio: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const onMudarRef = useRef(onMudar);

  useEffect(() => {
    onMudarRef.current = onMudar;
  }, [onMudar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePad(canvas, {
      penColor: "#0f172a",
      backgroundColor: "rgba(0,0,0,0)",
      minWidth: 0.8,
      maxWidth: 2.6,
    });
    padRef.current = pad;

    const ajustar = () => {
      const tracos = pad.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear();
      pad.fromData(tracos);
    };
    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(canvas);
    const aoTerminar = () => onMudarRef.current?.(pad.isEmpty());
    pad.addEventListener("endStroke", aoTerminar);

    return () => {
      observador.disconnect();
      pad.removeEventListener("endStroke", aoTerminar);
      pad.off();
      padRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    vazio: () => padRef.current?.isEmpty() ?? true,
    imagem: () =>
      padRef.current && !padRef.current.isEmpty() ? padRef.current.toDataURL("image/png") : null,
    limpar: () => {
      padRef.current?.clear();
      onMudarRef.current?.(true);
    },
  }));

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{rotulo}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            padRef.current?.clear();
            onMudarRef.current?.(true);
          }}
        >
          <Eraser /> Limpar
        </Button>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="h-44 w-full touch-none rounded-lg border-2 border-dashed bg-white"
          aria-label={rotulo}
          role="img"
        />
        <span className="pointer-events-none absolute right-4 bottom-3 left-4 border-t border-slate-300" />
        <span className="pointer-events-none absolute bottom-4 left-4 text-[10px] text-slate-400">
          assine acima da linha
        </span>
      </div>
    </div>
  );
}
