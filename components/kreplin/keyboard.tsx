'use client';

import type { ReactNode } from "react";

type KeyboardMode = "manual" | "auto";

type KeyboardProps = {
  mode: KeyboardMode;
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
};

type KeyButtonProps = {
  children: ReactNode;
  onClick: () => void;
  className?: string;
};

function KeyButton({ children, onClick, className = "" }: KeyButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-semibold text-white shadow transition active:translate-y-px active:bg-slate-800 ${className}`}
    >
      {children}
    </button>
  );
}

export default function Keyboard({ mode, onKeyPress, onBackspace, onSubmit }: KeyboardProps) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="grid w-full max-w-sm grid-cols-3 gap-3">
      {keys.map((key) => (
        <KeyButton key={key} onClick={() => onKeyPress(key)}>
          {key}
        </KeyButton>
      ))}

      {mode === "manual" ? (
        <>
          <KeyButton onClick={onBackspace} className="bg-slate-200 text-slate-700">
            ←
          </KeyButton>
          <KeyButton onClick={() => onKeyPress("0")}>0</KeyButton>
          <KeyButton onClick={onSubmit} className="bg-emerald-600">
            ✓
          </KeyButton>
        </>
      ) : (
        <KeyButton onClick={() => onKeyPress("0")} className="col-start-2">
          0
        </KeyButton>
      )}
    </div>
  );
}
