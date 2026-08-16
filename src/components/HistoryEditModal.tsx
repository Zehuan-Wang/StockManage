import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Thumb } from "../pages/Inventory";
import { fetchGoodsWithStock, updateHistory } from "../lib/api";
import { authErrorMessage, formatNumber } from "../lib/format";
import type { GoodsWithStock, HistoryRow } from "../lib/types";

type DraftLine = {
  id: number;
  name: string;
  picture_url: string | null;
  quantity: string;
};

type Props = {
  open: boolean;
  row: HistoryRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

function parseQty(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function HistoryEditModal({ open, row, onClose, onSaved }: Props) {
  const [catalog, setCatalog] = useState<GoodsWithStock[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  useEffect(() => {
    if (!open || !row) return;
    let cancelled = false;
    setKeyword("");
    setError("");
    setLoading(true);
    setLines(
      row.allItems.map((item) => ({
        id: item.id,
        name: item.name,
        picture_url: item.picture_url,
        quantity: String(item.quantity),
      })),
    );
    fetchGoodsWithStock(true)
      .then((data) => {
        if (cancelled) return;
        setCatalog(data);
        const map = new Map(data.map((item) => [item.id, item]));
        setLines(
          row.allItems.map((item) => {
            const goods = map.get(item.id);
            return {
              id: item.id,
              name: goods?.name ?? item.name,
              picture_url: goods?.picture_url ?? item.picture_url,
              quantity: String(item.quantity),
            };
          }),
        );
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, row]);

  const oldQty = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of row?.allItems ?? []) map.set(item.id, item.quantity);
    return map;
  }, [row]);

  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const lineIds = useMemo(() => new Set(lines.map((line) => line.id)), [lines]);

  const addable = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return catalog.filter((item) => {
      if (item.archived || lineIds.has(item.id)) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || String(item.id).includes(q);
    });
  }, [catalog, keyword, lineIds]);

  const parsed = useMemo(() => {
    const invalid: string[] = [];
    const next: { id: number; name: string; picture_url: string | null; quantity: number }[] = [];
    for (const line of lines) {
      const qty = parseQty(line.quantity);
      if (qty == null) {
        invalid.push(`「${line.name}」数量必须是大于等于 0 的整数`);
        continue;
      }
      if (qty > 0) next.push({ id: line.id, name: line.name, picture_url: line.picture_url, quantity: qty });
    }
    return { invalid, next };
  }, [lines]);

  const diffs = useMemo(() => {
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    const nextMap = new Map(parsed.next.map((item) => [item.id, item]));
    for (const item of parsed.next) {
      const prev = oldQty.get(item.id);
      if (prev == null) added.push(`${item.name} × ${item.quantity}`);
      else if (prev !== item.quantity) changed.push(`${item.name} ${prev} → ${item.quantity}`);
    }
    for (const item of row?.allItems ?? []) {
      if (!nextMap.has(item.id)) removed.push(`${item.name} × ${item.quantity}`);
    }
    return { added, removed, changed };
  }, [oldQty, parsed.next, row]);

  const hasChanges = diffs.added.length + diffs.removed.length + diffs.changed.length > 0;
  const action = row?.goods.action;

  function previewRemain(line: DraftLine): number | null {
    const qty = parseQty(line.quantity);
    if (qty == null || !action) return null;
    const current = catalogById.get(line.id)?.remain_num;
    if (current == null) return null;
    const prev = oldQty.get(line.id) ?? 0;
    return action === "shipment" ? current + prev - qty : current - prev + qty;
  }

  function addGoods(item: GoodsWithStock) {
    setLines((prev) => [
      ...prev,
      { id: item.id, name: item.name, picture_url: item.picture_url, quantity: "1" },
    ]);
    setError("");
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((line) => line.id !== id));
    setError("");
  }

  async function save() {
    if (!row) return;
    if (parsed.invalid.length > 0) {
      setError(parsed.invalid[0] ?? "数量不合法");
      return;
    }
    if (parsed.next.length === 0) {
      setError("请至少保留一件数量不为 0 的商品，或直接删除整条流水");
      return;
    }
    if (!hasChanges) {
      setError("没有修改");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateHistory(row.id, parsed.next);
      await onSaved();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open || !row) return null;

  const title = row.goods.action === "shipment" ? "编辑发货流水" : "编辑补货流水";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-line bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-paper disabled:opacity-50"
          >
            <X size={36} />
          </button>
        </div>
        <p className="mt-1 shrink-0 text-sm text-muted">可增删改商品种类和数量，保存后会按差额更新库存。</p>
        {row.allItems.length > row.goods.items.length && (
          <p className="mt-1 shrink-0 text-sm text-muted">搜索只显示了部分商品，编辑会包含本条流水中的全部商品。</p>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-muted">加载中…</p>
        ) : (
          <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="pb-2 font-medium">商品</th>
                  <th className="pb-2 font-medium">原数量</th>
                  <th className="pb-2 font-medium">新数量</th>
                  <th className="pb-2 font-medium">当前库存</th>
                  <th className="pb-2 font-medium">改后库存</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted">
                      还没有商品，请从下方添加
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => {
                    const remain = previewRemain(line);
                    const current = catalogById.get(line.id)?.remain_num;
                    return (
                      <tr key={line.id} className="border-t border-line">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-3">
                            <Thumb url={line.picture_url} />
                            <div>
                              <div className="font-medium">{line.name}</div>
                              <div className="text-xs text-muted">ID {line.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-muted">{formatNumber(oldQty.get(line.id) ?? 0)}</td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={line.quantity}
                            onChange={(event) =>
                              setLines((prev) =>
                                prev.map((item) =>
                                  item.id === line.id ? { ...item, quantity: event.target.value } : item,
                                ),
                              )
                            }
                            className={`w-24 rounded-lg border px-3 py-2 outline-none focus:border-pine ${
                              remain != null && remain < 0 ? "border-copper" : "border-line"
                            }`}
                          />
                        </td>
                        <td className="py-2 pr-3">{current == null ? "—" : formatNumber(current)}</td>
                        <td className={`py-2 pr-3 ${remain != null && remain < 0 ? "text-copper" : ""}`}>
                          {remain == null ? "—" : formatNumber(remain)}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => removeLine(line.id)}
                            className="text-copper hover:underline disabled:opacity-50"
                          >
                            移除
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div>
              <div className="text-sm text-muted">添加商品</div>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索在售商品名称或 ID"
                className="mt-1 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-sm outline-none focus:border-pine"
              />
              <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-line">
                {addable.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted">没有可添加的在售商品</p>
                ) : (
                  addable.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={saving}
                      onClick={() => addGoods(item)}
                      className="flex w-full items-center gap-3 border-t border-line px-3 py-2 text-left text-sm first:border-t-0 hover:bg-paper disabled:opacity-50"
                    >
                      <Thumb url={item.picture_url} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted">
                          ID {item.id} · 库存 {formatNumber(item.remain_num)}
                        </div>
                      </div>
                      <Plus size={28} className="shrink-0 text-pine" />
                    </button>
                  ))
                )}
              </div>
            </div>

            {hasChanges && parsed.invalid.length === 0 && parsed.next.length > 0 && (
              <div className="rounded-xl bg-paper px-3 py-3 text-sm text-muted">
                <div className="font-medium text-ink">变更摘要</div>
                <ul className="mt-1 space-y-1">
                  {diffs.added.map((text) => (
                    <li key={`a-${text}`}>新增 {text}</li>
                  ))}
                  {diffs.removed.map((text) => (
                    <li key={`r-${text}`}>移除 {text}</li>
                  ))}
                  {diffs.changed.map((text) => (
                    <li key={`c-${text}`}>{text}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 shrink-0 text-sm text-copper">{error}</p>}

        <div className="mt-6 flex shrink-0 justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-paper disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving || loading || !hasChanges}
            onClick={() => void save()}
            className="rounded-lg bg-pine px-4 py-2 text-sm text-white hover:bg-pine-dark disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存并更新库存"}
          </button>
        </div>
      </div>
    </div>
  );
}
