'use client';

import { useEffect, useMemo, useRef, useState } from "react";

export type AnnotationPoint = { x: number; y: number };
export type AnnotationStroke = {
  type?: "pen" | "circle" | "cross";
  color: string;
  width: number;
  points: AnnotationPoint[];
};

type ToolType = "pen" | "circle" | "cross";

type BookAnnotationLayerProps = {
  width: number;
  height: number;
  strokes: AnnotationStroke[];
  onChange: (strokes: AnnotationStroke[]) => void;
  onSave?: () => void;
};

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#f97316", "#9333ea", "#111827"];

export default function BookAnnotationLayer({
  width,
  height,
  strokes,
  onChange,
  onSave,
}: BookAnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<ToolType>("pen");
  const [color, setColor] = useState(COLORS[0]!);
  const [thickness, setThickness] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<AnnotationStroke | null>(null);
  const [panelPosition, setPanelPosition] = useState({ top: 12, left: 12 });
  const dragState = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const panelMovedRef = useRef(false);

  const canvasSize = useMemo(() => ({ width: Math.max(width, 1), height: Math.max(height, 1) }), [width, height]);

  useEffect(() => {
    if (panelMovedRef.current) {
      return;
    }
    const defaultLeft = Math.max(width - 210, 12);
    setPanelPosition((prev) => ({ ...prev, left: isFinite(defaultLeft) ? defaultLeft : prev.left }));
  }, [width]);

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
      const type = stroke.type ?? "pen";
      const points = stroke.points;
      if (!points.length) return;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;

      if (type === "pen") {
        if (points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(points[0]!.x * canvasSize.width, points[0]!.y * canvasSize.height);
        for (let i = 1; i < points.length; i++) {
          const point = points[i]!;
          ctx.lineTo(point.x * canvasSize.width, point.y * canvasSize.height);
        }
        ctx.stroke();
        return;
      }

      if (points.length < 2) {
        return;
      }
      const [start, end] = points;
      const centerX = start!.x * canvasSize.width;
      const centerY = start!.y * canvasSize.height;
      const radiusX = (end!.x - start!.x) * canvasSize.width;
      const radiusY = (end!.y - start!.y) * canvasSize.height;
      const radius = Math.hypot(radiusX, radiusY);

      if (type === "circle") {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      if (type === "cross") {
        ctx.beginPath();
        ctx.moveTo(centerX - radius, centerY - radius);
        ctx.lineTo(centerX + radius, centerY + radius);
        ctx.moveTo(centerX + radius, centerY - radius);
        ctx.lineTo(centerX - radius, centerY + radius);
        ctx.stroke();
      }
    }

    strokes.forEach(drawStroke);
    if (currentStroke) {
      drawStroke(currentStroke);
    }
  }, [canvasSize.height, canvasSize.width, currentStroke, strokes]);

  function normalizePoint(event: React.PointerEvent<HTMLCanvasElement>): AnnotationPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return { x: Math.min(Math.max(x, 0), 1), y: Math.min(Math.max(y, 0), 1) };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = normalizePoint(event);
    const stroke: AnnotationStroke = {
      type: tool,
      color,
      width: thickness,
      points: tool === "pen" ? [start] : [start, start],
    };
    setCurrentStroke(stroke);
    setIsDrawing(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    event.preventDefault();
    const point = normalizePoint(event);
    setCurrentStroke((prev) => {
      if (!prev) return prev;
      if ((prev.type ?? "pen") === "pen") {
        return { ...prev, points: [...prev.points, point] };
      }
      const nextPoints = [...prev.points];
      nextPoints[1] = point;
      return { ...prev, points: nextPoints };
    });
  }

  function finishStroke() {
    setIsDrawing(false);
    setCurrentStroke((prev) => {
      if (!prev) return null;
      const type = prev.type ?? "pen";
      if (type === "pen" && prev.points.length < 2) {
        return null;
      }
      if (type !== "pen") {
        const [start, end] = prev.points;
        if (!end || (start?.x === end.x && start?.y === end.y)) {
          return null;
        }
      }
      onChange([...strokes, prev]);
      return null;
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.releasePointerCapture(event.pointerId);
    finishStroke();
  }

  function handleUndo() {
    if (!strokes.length) return;
    onChange(strokes.slice(0, -1));
  }

  function handleClear() {
    if (!strokes.length) return;
    onChange([]);
  }

  function clampPosition(top: number, left: number) {
    const maxTop = Math.max(height - 160, 12);
    const maxLeft = Math.max(width - 180, 12);
    return {
      top: Math.min(Math.max(top, 12), isFinite(maxTop) ? maxTop : top),
      left: Math.min(Math.max(left, 12), isFinite(maxLeft) ? maxLeft : left),
    };
  }

  function handlePanelPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - panelPosition.left,
      offsetY: event.clientY - panelPosition.top,
    };
  }

  function handlePanelPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    event.preventDefault();
    panelMovedRef.current = true;
    const next = clampPosition(event.clientY - dragState.current.offsetY, event.clientX - dragState.current.offsetX);
    setPanelPosition(next);
  }

  function handlePanelPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    event.preventDefault();
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragState.current = null;
  }

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="absolute left-0 top-0 h-full w-full touch-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={finishStroke}
      />
      <div
        className="pointer-events-auto absolute flex w-48 flex-col gap-2 rounded-2xl bg-white/95 p-3 text-xs font-semibold text-slate-600 shadow-lg"
        style={{ top: panelPosition.top, left: panelPosition.left }}
      >
        <div
          className="flex cursor-move items-center justify-between text-[11px] font-semibold text-slate-400"
          onPointerDown={handlePanelPointerDown}
          onPointerMove={handlePanelPointerMove}
          onPointerUp={handlePanelPointerUp}
          onPointerCancel={handlePanelPointerUp}
        >
          <span>Alat</span>
          <span className="text-[10px]">Geser panel</span>
        </div>
        <div className="flex items-center gap-2">
          {(["pen", "circle", "cross"] as ToolType[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTool(item)}
              className={`rounded-full px-3 py-1 ${
                tool === item ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {item === "pen" ? "Pen" : item === "circle" ? "O" : "X"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {COLORS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setColor(item)}
              className={`h-5 w-5 rounded-full border ${
                color === item ? "border-slate-900" : "border-slate-200"
              }`}
              style={{ backgroundColor: item }}
              aria-label={`Pilih warna ${item}`}
            />
          ))}
        </div>
        <label className="flex flex-col gap-1 text-[11px] font-normal">
          Ketebalan
          <input
            type="range"
            min={1}
            max={8}
            value={thickness}
            onChange={(event) => setThickness(Number(event.target.value))}
            className="accent-sky-600"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleUndo}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
          >
            Clear
          </button>
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="rounded-full bg-sky-600 px-4 py-1 text-xs font-semibold text-white"
            >
              Simpan coretan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
