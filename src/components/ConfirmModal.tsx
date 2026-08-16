import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  children?: ReactNode;
  error?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  pending?: boolean;
  tone?: "copper" | "pine";
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  title,
  children,
  error,
  confirmLabel = "确认",
  cancelLabel = "取消",
  hideCancel = false,
  pending = false,
  tone = "copper",
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        {children && <div className="mt-3 text-sm text-muted">{children}</div>}
        {error && <p className="mt-3 text-sm text-copper">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          {!hideCancel && (
            <button
              type="button"
              disabled={pending}
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-paper disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60 ${
              tone === "pine" ? "bg-pine hover:bg-pine-dark" : "bg-copper"
            }`}
          >
            {pending ? "处理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
