'use client';

import { useEffect, useMemo, useRef, useState } from "react";

export type AnnotationPoint = { x: number; y: number };
export type AnnotationStroke = { color: string; width: number; points: AnnotationPoint[] };

type BookAnnotationLayerProps = {
  width: number;
  height: number;
  strokes: AnnotationStroke[];
  onChange: (strokes: AnnotationStroke[]) => void;
  onSave?: () => void;
};

const DRAW_COLOR = "#2563eb";
const DRAW_WIDTH = 2;

export default function BookAnnotationLayer({
  width,
  height,
  strokes,
  onChange,
  onSave,
}: BookAnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<AnnotationStroke | null>(null);

  const canvasSize = useMemo(() => ({ width: Math.max(width, 1), height: Math.max(height, 1) }), [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function drawStroke(stroke: AnnotationStroke) {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.lineWidth = stroke.width;
      ctx.strokeStyle = stroke.color;
      ctx.moveTo(stroke.points[0]!.x * canvasSize.width, stroke.points[0]!.y * canvasSize.height);
      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i]!;
        ctx.lineTo(point.x * canvasSize.width, point.y * canvasSize.height);
      }
      ctx.stroke();
    }

    strokes.forEach(drawStroke);
    if (currentStroke) {
      drawStroke(currentStroke);
    }
  }, [canvasSize.height, canvasSize.width, currentStroke, strokes]);

  function normalizePoint(event: React.PointerEvent<HTMLCanvasElement>): AnnotationPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingMode) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = normalizePoint(event);
    setCurrentStroke({ color: DRAW_COLOR, width: DRAW_WIDTH, points: [start] });
    setIsDrawing(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    event.preventDefault();
    const point = normalizePoint(event);
    setCurrentStroke((prev) => {
      if (!prev) return prev;
      return { ...prev, points: [...prev.points, point] };
    });
  }

  function finishStroke() {
    setIsDrawing(false);
    setCurrentStroke((prev) => {
      if (prev && prev.points.length > 1) {
        onChange([...strokes, prev]);
      }
      return null;
    });
  }

  function handleUndo() {
    if (!strokes.length) return;
    onChange(strokes.slice(0, -1));
  }

  function handleClear() {
    if (!strokes.length) return;
    onChange([]);
  }

  return (
    <div className="h-full w-full">
      <canvas
        ref={canvasRef}
        className={`absolute left-0 top-0 h-full w-full ${isDrawingMode ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
      />
      <div className="pointer-events-auto absolute right-3 top-3 flex flex-col gap-2 rounded-2xl bg-white/90 p-2 shadow">
        <button
          type="button"
          onClick={() => setIsDrawingMode((prev) => !prev)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isDrawingMode ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          {isDrawingMode ? "Mode gambar aktif" : "Aktifkan gambar"}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUndo}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
          >
            Clear
          </button>
        </div>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500"
          >
            Simpan coretan
          </button>
        )}
      </div>
    </div>
  );
}
