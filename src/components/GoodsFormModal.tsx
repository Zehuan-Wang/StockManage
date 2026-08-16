import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { uploadGoodsPicture } from "../lib/api";
import { authErrorMessage } from "../lib/format";
import type { GoodsWithStock } from "../lib/types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Props = {
  open: boolean;
  initial: GoodsWithStock | null;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    picture_url: string | null;
    archived: boolean;
    remain_num: number;
  }) => Promise<void>;
};

export function GoodsFormModal({ open, initial, onClose, onSubmit }: Props) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [archived, setArchived] = useState(false);
  const [remainNum, setRemainNum] = useState("0");
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewUrlRef = useRef<string | null>(null);

  function applyImageFile(next: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (!next) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!next.type.startsWith("image/")) {
      setError("请选择图片文件（jpg / png / webp）");
      return;
    }
    if (next.size > MAX_IMAGE_BYTES) {
      setError("图片不能超过 5MB");
      return;
    }
    const url = URL.createObjectURL(next);
    previewUrlRef.current = url;
    setFile(next);
    setPreview(url);
    setError("");
  }

  function onDropZoneDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }

  function onDropZoneDragLeave(event: DragEvent) {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragOver(false);
    }
  }

  function onDropZoneDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const next = event.dataTransfer.files?.[0] ?? null;
    applyImageFile(next);
  }

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setArchived(initial?.archived ?? false);
    setRemainNum(String(initial?.remain_num ?? 0));
    setPictureUrl(initial?.picture_url ?? null);
    setDragOver(false);
    setError("");
    applyImageFile(null);
  }, [open, initial]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    const remain = Number(remainNum);
    if (!trimmed) {
      setError("请填写商品名称");
      return;
    }
    if (!Number.isInteger(remain) || remain < 0) {
      setError("库存数量必须为大于等于 0 的整数");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let nextPicture = pictureUrl;
      if (file) {
        nextPicture = await uploadGoodsPicture(file, session?.access_token);
      }
      await onSubmit({
        name: trimmed,
        picture_url: nextPicture,
        archived,
        remain_num: remain,
      });
      onClose();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? "编辑商品" : "添加商品"}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-paper">
            <X size={36} />
          </button>
        </div>

        <label className="mt-5 block text-sm text-muted">
          商品名称
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-ink outline-none focus:border-pine"
            placeholder="例如：按键款"
          />
        </label>

        <label className="mt-4 block text-sm text-muted">
          当前库存
          <input
            type="number"
            min={0}
            step={1}
            value={remainNum}
            onChange={(event) => setRemainNum(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-ink outline-none focus:border-pine"
          />
        </label>

        <div className="mt-4 text-sm text-muted">商品图片</div>
        <label
          onDragEnter={onDropZoneDragOver}
          onDragOver={onDropZoneDragOver}
          onDragLeave={onDropZoneDragLeave}
          onDrop={onDropZoneDrop}
          className={`mt-1 flex cursor-pointer items-center gap-4 rounded-xl border border-dashed p-4 transition ${
            dragOver ? "border-pine bg-pine/10" : "border-line bg-paper/50"
          }`}
        >
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-lg bg-white">
            {preview || pictureUrl ? (
              <img src={preview || pictureUrl || ""} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="text-muted" size={44} />
            )}
          </div>
          <div>
            <p className="text-ink">{dragOver ? "松开鼠标即可上传" : "点击或拖拽图片到此处"}</p>
            <p className="text-xs">支持 jpg / png / webp，最大 5MB</p>
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              applyImageFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          已下架（archived）
        </label>

        {error && <p className="mt-4 text-sm text-copper">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-paper">
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-pine px-4 py-2 text-sm text-white hover:bg-pine-dark disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}
