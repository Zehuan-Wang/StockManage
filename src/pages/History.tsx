import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ConfirmModal } from "../components/ConfirmModal";
import { HistoryEditModal } from "../components/HistoryEditModal";
import { Thumb } from "./Inventory";
import { deleteHistory, fetchHistory, HISTORY_PAGE_SIZE } from "../lib/api";
import { authErrorMessage, formatDateTime, formatNumber } from "../lib/format";
import type { HistoryAction, HistoryRow } from "../lib/types";

const ACTION_LABEL: Record<HistoryAction, string> = {
  shipment: "发货",
  restock: "补货",
};

export function History() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [action, setAction] = useState<"all" | HistoryAction>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<HistoryRow | null>(null);
  const [editing, setEditing] = useState<HistoryRow | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHistory({ page, action, keyword })
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
        const lastPage = Math.max(1, Math.ceil(result.total / HISTORY_PAGE_SIZE));
        if (result.rows.length === 0 && result.total > 0 && page > lastPage) {
          setPage(lastPage);
        }
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
  }, [page, action, keyword]);

  async function remove(row: HistoryRow) {
    setPendingId(row.id);
    setError("");
    try {
      await deleteHistory(row.id);
      setDeleting(null);
      const result = await fetchHistory({ page, action, keyword });
      if (result.rows.length === 0 && page > 1) {
        setPage(page - 1);
      } else {
        setRows(result.rows);
        setTotal(result.total);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-6 lg:p-8">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">历史流水</h2>
          <p className="mt-1 text-sm text-muted">
            发货与补货都会写入 history 表。编辑或删除流水时会按差额同步更新库存。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={action}
            onChange={(event) => {
              setPage(1);
              setAction(event.target.value as "all" | HistoryAction);
            }}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-pine"
          >
            <option value="all">全部类型</option>
            <option value="shipment">发货</option>
            <option value="restock">补货</option>
          </select>
          <input
            value={keyword}
            onChange={(event) => {
              setPage(1);
              setKeyword(event.target.value);
            }}
            placeholder="搜索商品名称或 ID"
            className="w-full max-w-xs rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-pine"
          />
        </div>
      </div>

      {error && <p className="mt-4 shrink-0 text-sm text-copper">{error}</p>}

      {loading ? (
        <p className="mt-8 text-sm text-muted">加载中…</p>
      ) : (
        <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[53.75rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-paper text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">商品</th>
                <th className="px-4 py-3 font-medium">数量</th>
                <th className="px-4 py-3 font-medium">变动后库存</th>
                <th className="px-4 py-3 font-medium">变动后累计销量</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    暂无流水
                  </td>
                </tr>
              ) : (
                rows.map((row) =>
                  row.goods.items.map((item, index) => (
                    <tr key={`${row.id}-${item.id}-${index}`} className="border-t border-line">
                      <td className="px-4 py-3 text-muted">
                        {index === 0 ? formatDateTime(row.created_at) : ""}
                      </td>
                      <td className="px-4 py-3">
                        {index === 0 && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              row.goods.action === "shipment" ? "bg-copper/10 text-copper" : "bg-pine/10 text-pine"
                            }`}
                          >
                            {ACTION_LABEL[row.goods.action]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb url={item.picture_url} />
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted">ID {item.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{formatNumber(item.quantity)}</td>
                      <td className="px-4 py-3">{formatNumber(item.remain_num)}</td>
                      <td className="px-4 py-3">{formatNumber(item.historical_saled_num)}</td>
                      <td className="px-4 py-3 text-right">
                        {index === 0 && (
                          <div className="flex justify-end gap-3 whitespace-nowrap">
                            <button
                              type="button"
                              disabled={pendingId === row.id}
                              onClick={() => {
                                setError("");
                                setEditing(row);
                              }}
                              className="text-pine hover:underline disabled:opacity-50"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              disabled={pendingId === row.id}
                              onClick={() => setDeleting(row)}
                              className="text-copper hover:underline disabled:opacity-50"
                            >
                              {pendingId === row.id ? "删除中…" : "删除"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )),
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex shrink-0 items-center justify-center gap-3">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted hover:bg-paper disabled:opacity-40"
        >
          <ChevronLeft size={28} />
          上一页
        </button>
        <span className="text-sm text-muted">
          第 {page} / {totalPages} 页
        </span>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((current) => current + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted hover:bg-paper disabled:opacity-40"
        >
          下一页
          <ChevronRight size={28} />
        </button>
      </div>

      <HistoryEditModal
        open={Boolean(editing)}
        row={editing}
        onClose={() => {
          if (pendingId === null) setEditing(null);
        }}
        onSaved={async () => {
          setEditing(null);
          const result = await fetchHistory({ page, action, keyword });
          setRows(result.rows);
          setTotal(result.total);
        }}
      />

      <ConfirmModal
        open={Boolean(deleting)}
        title={`确定删除这条${deleting ? ACTION_LABEL[deleting.goods.action] : ""}流水？`}
        confirmLabel="确认删除并回滚"
        pending={pendingId !== null}
        error={error}
        onCancel={() => {
          if (pendingId === null) setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting) void remove(deleting);
        }}
      >
        <p>
          {deleting?.goods.action === "shipment"
            ? "删除后会把发货数量加回库存，并扣减累计销量。"
            : "删除后会从库存中扣回本次补货数量，累计销量不变。"}
        </p>
        {deleting && deleting.allItems.length > deleting.goods.items.length && (
          <p className="mt-2">搜索只显示匹配商品，删除仍会回滚本条流水中的全部商品。</p>
        )}
        <ul className="mt-2 max-h-60 space-y-1 overflow-auto">
          {(deleting?.allItems ?? []).map((item) => (
            <li key={item.id}>
              {item.name} × {item.quantity}
            </li>
          ))}
        </ul>
      </ConfirmModal>
    </div>
  );
}
