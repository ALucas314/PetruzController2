import { useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { ImageDown, Loader2 } from "lucide-react";

export interface ExportToPngProps {
  /** Ref do elemento DOM a ser capturado (ex.: card da tabela) */
  targetRef: RefObject<HTMLElement | null>;
  /** Prefixo do nome do arquivo (será sufixado com data e .png) */
  filenamePrefix?: string;
  /** Desabilita o botão (ex.: durante loading ou sem dados) */
  disabled?: boolean;
  /** Classes adicionais no botão */
  className?: string;
  /** Texto do botão */
  label?: string;
  /** Se true, expande containers com overflow para capturar tabela/conteúdo inteiro */
  expandScrollable?: boolean;
  /** Marca d'água exibida no canto inferior direito do PNG (ex.: "Bela", "Petruz") */
  watermark?: string;
  /** Chamado antes da captura (ex.: substituir inputs por texto para aparecer completo no PNG) */
  onBeforeCapture?: () => void | Promise<void>;
  /** Chamado depois da captura (ex.: restaurar DOM) */
  onAfterCapture?: () => void | Promise<void>;
  /** Atributo title do botão (tooltip) */
  title?: string;
}

type RestoreStyle = { el: HTMLElement; styles: Record<string, string> };

/**
 * Remove temporariamente a classe `dark` do `<html>` durante a captura.
 * No modo escuro, o fundo do PNG é branco mas o DOM ainda usava cores `dark:` / variáveis escuras — texto claro em fundo branco.
 */
export async function runWithLightThemeForCapture<T>(work: () => Promise<T>): Promise<T> {
  const root = document.documentElement;
  const hadDark = root.classList.contains("dark");
  if (hadDark) root.classList.remove("dark");
  try {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await new Promise((r) => setTimeout(r, 120));
    return await work();
  } finally {
    if (hadDark) root.classList.add("dark");
  }
}

/** Expande temporariamente overflow e tamanhos para capturar conteúdo completo (ex.: tabela inteira no celular). */
function expandScrollableContainers(root: HTMLElement): RestoreStyle[] {
  const restores: RestoreStyle[] = [];
  const toExpand: HTMLElement[] = [];

  const collect = (el: HTMLElement) => {
    const cls = el.className?.toString() ?? "";
    const computed = window.getComputedStyle(el);
    const overflowX = computed.overflowX;
    const overflowY = computed.overflowY;
    const hasOverflowClass = /overflow-x-auto|overflow-y-auto|overflow-auto/.test(cls);
    const isScrollableComputed = overflowX === "auto" || overflowX === "scroll" || overflowY === "auto" || overflowY === "scroll";
    const hasScrollContent = el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
    const shouldExpand = (isScrollableComputed && hasScrollContent) || hasOverflowClass;
    if (shouldExpand) toExpand.push(el);
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      if (child instanceof HTMLElement) collect(child);
    }
  };

  collect(root);

  // Primeiro expande os filhos (do mais interno ao mais externo), assim scrollHeight do root fica correto
  toExpand.forEach((el) => {
    const backup: Record<string, string> = {
      overflow: el.style.overflow,
      overflowX: el.style.overflowX,
      overflowY: el.style.overflowY,
      height: el.style.height,
      maxHeight: el.style.maxHeight,
      width: el.style.width,
      maxWidth: el.style.maxWidth,
      minHeight: el.style.minHeight,
      minWidth: el.style.minWidth,
    };
    el.style.overflow = "visible";
    el.style.overflowX = "visible";
    el.style.overflowY = "visible";
    el.style.minHeight = "0";
    el.style.minWidth = "0";
    el.style.height = `${el.scrollHeight}px`;
    el.style.maxHeight = "none";
    el.style.width = `${el.scrollWidth}px`;
    el.style.maxWidth = "none";
    restores.push({ el, styles: backup });
  });

  // Por último expande o root para o tamanho total do conteúdo (assim a captura pega a tabela inteira)
  const rootComputed = window.getComputedStyle(root);
  const rootClips = rootComputed.overflow !== "visible" || rootComputed.overflowX !== "visible" || rootComputed.overflowY !== "visible";
  if (rootClips || toExpand.length > 0) {
    const backup: Record<string, string> = {
      overflow: root.style.overflow,
      overflowX: root.style.overflowX,
      overflowY: root.style.overflowY,
      height: root.style.height,
      maxHeight: root.style.maxHeight,
      width: root.style.width,
      maxWidth: root.style.maxWidth,
      minHeight: root.style.minHeight,
      minWidth: root.style.minWidth,
    };
    root.style.overflow = "visible";
    root.style.overflowX = "visible";
    root.style.overflowY = "visible";
    root.style.minHeight = "0";
    root.style.minWidth = "0";
    root.style.maxHeight = "none";
    root.style.maxWidth = "none";
    root.style.height = `${root.scrollHeight}px`;
    root.style.width = `${root.scrollWidth}px`;
    restores.push({ el: root, styles: backup });
  }
  return restores;
}

function restoreStyles(restores: RestoreStyle[]) {
  restores.forEach(({ el, styles }) => {
    Object.entries(styles).forEach(([key, value]) => {
      (el.style as unknown as Record<string, string>)[key] = value;
    });
  });
}

const PADDING = 40;

/** Desenha marca d'água pequena no canto inferior direito do canvas. */
function drawWatermark(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, text: string) {
  if (!text?.trim()) return;
  const label = String(text).trim();
  ctx.save();
  ctx.font = "500 26px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = "#374151";
  const x = canvas.width / 2;
  const y = PADDING + 12;
  ctx.fillText(label, x, y);
  ctx.restore();
}

export interface CaptureToPngBlobOptions {
  expandScrollable?: boolean;
  onBeforeCapture?: () => void | Promise<void>;
  onAfterCapture?: () => void | Promise<void>;
  filenamePrefix?: string;
  /** Marca d'água no canto inferior direito (ex.: "Bela", "Petruz") */
  watermark?: string;
}

const PADDING_BETWEEN = 24;

/**
 * Combina vários blobs PNG em uma única imagem vertical (um embaixo do outro).
 * Útil para relatório único com vários blocos (gráficos, tabelas).
 */
export async function combinePngBlobsVertical(
  blobs: Blob[],
  paddingBetween: number = PADDING_BETWEEN
): Promise<Blob> {
  if (blobs.length === 0) throw new Error("Nenhum blob para combinar");
  const loadImage = (blob: Blob): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  const allImages = await Promise.all(blobs.map(loadImage));
  allImages.forEach((img) => img?.src && URL.revokeObjectURL(img.src));
  const images = allImages.filter((img): img is HTMLImageElement => img != null && img.width > 0 && img.height > 0);
  if (images.length === 0) throw new Error("Nenhuma imagem válida para combinar");

  const padding = 40;
  let totalHeight = padding * 2;
  let maxWidth = 800;
  for (const img of images) {
    totalHeight += img.height + paddingBetween;
    if (img.width > maxWidth) maxWidth = img.width;
  }
  totalHeight -= paddingBetween;
  totalHeight += padding;

  const canvas = document.createElement("canvas");
  canvas.width = maxWidth + padding * 2;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d não disponível");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = padding;
  for (const img of images) {
    const x = padding + (maxWidth - img.width) / 2;
    ctx.drawImage(img, x, y, img.width, img.height);
    y += img.height + paddingBetween;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar PNG"))),
      "image/png",
      1.0
    );
  });
}

/**
 * Captura um elemento DOM como PNG e retorna o blob e o nome do arquivo.
 * Útil para exportação em lote e compartilhamento (ex.: Web Share API no mobile).
 */
export async function captureElementToPngBlob(
  element: HTMLElement,
  options: CaptureToPngBlobOptions = {}
): Promise<{ blob: Blob; fileName: string }> {
  const {
    expandScrollable = true,
    onBeforeCapture,
    onAfterCapture,
    filenamePrefix = "export",
    watermark,
  } = options;

  let restores: RestoreStyle[] = [];

  try {
    if (onBeforeCapture) {
      await Promise.resolve(onBeforeCapture());
      await new Promise((r) => setTimeout(r, 50));
    }

    if (expandScrollable) {
      restores = expandScrollableContainers(element);
      element.style.overflow = "visible";
      element.style.maxHeight = "none";
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await new Promise((r) => setTimeout(r, 150));
    }

    const dataUrl = await runWithLightThemeForCapture(() =>
      toPng(element, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        quality: 1.0,
        cacheBust: true,
        skipAutoScale: false,
        skipFonts: false,
        filter: () => true,
      })
    );

    const img = new Image();
    img.src = dataUrl;

    const { blob, fileName } = await new Promise<{ blob: Blob; fileName: string }>((resolve, reject) => {
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width + PADDING * 2;
          canvas.height = img.height + PADDING * 2;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, PADDING, PADDING);
            if (watermark) drawWatermark(ctx, canvas, watermark);
          }
          const safePrefix = (filenamePrefix || "export").replace(/[^a-zA-Z0-9_-]/g, "-");
          const date = new Date();
          const dateStr = date.toISOString().slice(0, 10);
          const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, "");
          const fileName = `${safePrefix}-${dateStr}-${timeStr}.png`;

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Falha ao gerar PNG"));
                return;
              }
              resolve({ blob, fileName });
            },
            "image/png",
            1.0
          );
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    });

    return { blob, fileName };
  } finally {
    if (restores.length) restoreStyles(restores);
    if (onAfterCapture) await Promise.resolve(onAfterCapture());
  }
}

/**
 * Botão que exporta o elemento referenciado por targetRef como PNG.
 * Usado para exportar o Histórico de Análise de Produção (e outros blocos) como imagem.
 */
export function ExportToPng({
  targetRef,
  filenamePrefix = "historico-analise-producao",
  disabled = false,
  className,
  label = "Exportar PNG",
  expandScrollable = true,
  watermark,
  onBeforeCapture,
  onAfterCapture,
  title,
}: ExportToPngProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!targetRef?.current || exporting) return;

    setExporting(true);

    let restores: RestoreStyle[] = [];

    try {
      await new Promise((r) => setTimeout(r, 300));

      const element = targetRef.current;

      if (onBeforeCapture) {
        await Promise.resolve(onBeforeCapture());
        await new Promise((r) => setTimeout(r, 50));
      }

      if (expandScrollable) {
        restores = expandScrollableContainers(element);
        element.style.overflow = "visible";
        element.style.maxHeight = "none";
        // Reflow: espera o layout atualizar (importante no mobile para pegar tabela inteira)
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await new Promise((r) => setTimeout(r, 150));
      }

      const dataUrl = await runWithLightThemeForCapture(() =>
        toPng(element, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
          quality: 1.0,
          cacheBust: true,
          skipAutoScale: false,
          skipFonts: false,
          filter: () => true,
        })
      );

      const img = new Image();
      img.src = dataUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.width + PADDING * 2;
            canvas.height = img.height + PADDING * 2;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, PADDING, PADDING);
              if (watermark) drawWatermark(ctx, canvas, watermark);
            }
            // Nome seguro: só letras, números, hífen e underscore (evita "Ol.png" ou nome truncado no Windows)
            const safePrefix = (filenamePrefix || "historico-analise-producao").replace(/[^a-zA-Z0-9_-]/g, "-");
            const date = new Date();
            const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
            const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, ""); // HHmmss
            const fileName = `${safePrefix}-${dateStr}-${timeStr}.png`;

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error("Falha ao gerar PNG"));
                  return;
                }
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.download = fileName;
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 200);
                resolve();
              },
              "image/png",
              1.0
            );
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error("Falha ao carregar imagem"));
      });
    } catch (err) {
      console.error("Export to PNG failed:", err);
      if (typeof window !== "undefined" && "toast" in window) {
        (window as unknown as { toast: { error: (m: string) => void } }).toast?.error?.(
          "Não foi possível exportar a imagem. Tente novamente."
        );
      }
    } finally {
      if (restores.length) restoreStyles(restores);
      if (onAfterCapture) await Promise.resolve(onAfterCapture());
      setExporting(false);
    }
  };

  return (
    <>
      {exporting &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
            aria-hidden
          >
            <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-5 py-3 shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">Gerando imagem…</span>
            </div>
          </div>,
          document.body
        )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={disabled || exporting}
        className={`gap-2 ${className ?? ""}`}
        title={title ?? "Baixar histórico como imagem PNG"}
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImageDown className="h-4 w-4 shrink-0" />
        )}
        <span className="hidden min-[791px]:inline">{label}</span>
      </Button>
    </>
  );
}
