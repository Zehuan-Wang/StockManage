import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { fetchGoodsWithStock } from "../lib/api";
import { authErrorMessage, formatNumber, formatDateTime } from "../lib/format";
import type { GoodsWithStock } from "../lib/types";

export function Inventory() {
  const [items, setItems] = useState<GoodsWithStock[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchGoodsWithStock(false)
      .then((data) => {
        if (!cancelled) setItems(data);
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
  }, []);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q) || String(item.id).includes(q));
  }, [items, keyword]);

  const totalRemain = items.reduce((sum, item) => sum + item.remain_num, 0);
  const totalSold = items.reduce((sum, item) => sum + item.historical_saled_num, 0);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-6 lg:p-8">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">存货总览</h2>
          <p className="mt-1 text-sm text-muted">仅显示在售商品</p>
        </div>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索商品名称或 ID"
          className="w-full max-w-xs rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-pine"
        />
      </div>

      <div className="mt-6 grid shrink-0 gap-3 sm:grid-cols-3">
        <Stat label="在售商品" value={formatNumber(items.length)} />
        <Stat label="库存总量 remain_num" value={formatNumber(totalRemain)} />
        <Stat label="累计销量 historical_saled_num" value={formatNumber(totalSold)} />
      </div>

      {error && <p className="mt-4 text-sm text-copper">{error}</p>}
      {loading ? (
        <p className="mt-8 text-sm text-muted">加载中…</p>
      ) : (
        <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[45rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-paper text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">商品</th>
                <th className="px-4 py-3 font-medium">剩余库存</th>
                <th className="px-4 py-3 font-medium">累计销量</th>
                <th className="px-4 py-3 font-medium">库存更新时间</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    没有在售商品
                  </td>
                </tr>
              ) : (
                visible.map((item) => (
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
                    <td className="px-4 py-3 font-medium">{formatNumber(item.remain_num)}</td>
                    <td className="px-4 py-3">{formatNumber(item.historical_saled_num)}</td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(item.stock_updated_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function Thumb({ url }: { url: string | null }) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-paper">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Package size={36} className="text-muted" />}
    </div>
  );
}
