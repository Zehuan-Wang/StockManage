import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { GoodsFormModal } from "../components/GoodsFormModal";
import { Thumb } from "./Inventory";
import { createGoods, deleteGoods, fetchGoodsWithStock, updateGoods } from "../lib/api";
import { authErrorMessage, formatDateTime, formatNumber } from "../lib/format";
import type { GoodsWithStock } from "../lib/types";

export function GoodsManage() {
  const [items, setItems] = useState<GoodsWithStock[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GoodsWithStock | null>(null);
  const [deleting, setDeleting] = useState<GoodsWithStock | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deletePending, setDeletePending] = useState(false);

  async function reload() {
    const data = await fetchGoodsWithStock(true);
    setItems(data);
  }

  useEffect(() => {
    reload()
      .catch((err) => setError(authErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q) || String(item.id).includes(q));
  }, [items, keyword]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-6 lg:p-8">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">商品管理</h2>
          {/* <p className="mt-1 text-sm text-muted">管理员可维护名称、图片、archived，以及对应 Stock 库存。</p> */}
        </div>
        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索商品"
            className="w-48 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-pine"
          />
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-pine px-3 py-2 text-sm text-white hover:bg-pine-dark"
          >
            <Plus size={32} />
            添加商品
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-copper">{error}</p>}
      {loading ? (
        <p className="mt-8 text-sm text-muted">加载中…</p>
      ) : (
        <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[53.75rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-paper text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">商品</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">剩余库存</th>
                <th className="px-4 py-3 font-medium">累计销量</th>
                <th className="px-4 py-3 font-medium">创建时间</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Thumb url={item.picture_url} />
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted">ID {item.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        item.archived ? "bg-line text-muted" : "bg-pine/10 text-pine"
                      }`}
                    >
                      {item.archived ? "已下架" : "在售"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatNumber(item.remain_num)}</td>
                  <td className="px-4 py-3">{formatNumber(item.historical_saled_num)}</td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(item.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item);
                        setOpen(true);
                      }}
                      className="text-pine hover:underline"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setDeleting(item);
                        setDeleteStep(1);
                      }}
                      className="ml-4 text-copper hover:underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GoodsFormModal
        open={open}
        initial={editing}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          if (editing) {
            await updateGoods({ id: editing.id, ...input });
          } else {
            await createGoods(input);
          }
          await reload();
        }}
      />

      {deleting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">
              {deleteStep === 1 ? "确认删除商品" : "再次确认删除"}
            </h3>
            <p className="mt-3 text-sm text-muted">
              {deleteStep === 1
                ? `确定删除「${deleting.name}」（ID ${deleting.id}）吗？对应库存记录也会一并删除。`
                : `删除后无法恢复。请再次确认删除「${deleting.name}」。`}
            </p>
            {error && <p className="mt-3 text-sm text-copper">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deletePending}
                onClick={() => {
                  setDeleting(null);
                  setDeleteStep(1);
                }}
                className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-paper"
              >
                取消
              </button>
              {deleteStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setDeleteStep(2)}
                  className="rounded-lg bg-copper px-4 py-2 text-sm text-white hover:opacity-90"
                >
                  继续删除
                </button>
              ) : (
                <button
                  type="button"
                  disabled={deletePending}
                  onClick={() => {
                    void (async () => {
                      setDeletePending(true);
                      setError("");
                      try {
                        await deleteGoods(deleting.id);
                        setDeleting(null);
                        setDeleteStep(1);
                        await reload();
                      } catch (err) {
                        setError(authErrorMessage(err));
                      } finally {
                        setDeletePending(false);
                      }
                    })();
                  }}
                  className="rounded-lg bg-copper px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
                >
                  {deletePending ? "删除中…" : "确认删除"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
