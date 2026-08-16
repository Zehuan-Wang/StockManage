import { useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { Thumb } from "./Inventory";
import { fetchGoodsWithStock, recordShipment } from "../lib/api";
import { authErrorMessage, formatNumber } from "../lib/format";
import type { GoodsWithStock } from "../lib/types";

function positiveQty(raw: string | undefined): number {
  const qty = Number(raw);
  return Number.isInteger(qty) && qty > 0 ? qty : 0;
}

export function Shipments() {
  const [items, setItems] = useState<GoodsWithStock[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lowStock, setLowStock] = useState<GoodsWithStock[]>([]);

  async function reload() {
    const data = await fetchGoodsWithStock(false);
    setItems(data);
    return data;
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

  const selected = useMemo(
    () =>
      items
        .map((item) => ({ item, quantity: positiveQty(quantities[item.id]) }))
        .filter((entry) => entry.quantity > 0),
    [items, quantities],
  );

  const overstocked = useMemo(
    () => selected.filter(({ item, quantity }) => quantity > item.remain_num),
    [selected],
  );

  function overstockMessage() {
    return `以下商品发货数量超过库存，已拒绝整单发货：${overstocked
      .map(({ item, quantity }) => `「${item.name}」发货 ${quantity} / 库存 ${item.remain_num}`)
      .join("、")}`;
  }

  function requestConfirm() {
    if (selected.length === 0) {
      setError("请至少填写一件数量不为 0 的商品");
      return;
    }
    if (overstocked.length > 0) {
      setMessage("");
      setError(overstockMessage());
      return;
    }
    setError("");
    setConfirmOpen(true);
  }

  async function submit() {
    if (selected.length === 0) {
      setError("请至少填写一件数量不为 0 的商品");
      return;
    }
    if (overstocked.length > 0) {
      setConfirmOpen(false);
      setMessage("");
      setError(overstockMessage());
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      await recordShipment(selected);
      setQuantities({});
      const next = await reload();
      setConfirmOpen(false);
      setMessage(`已记录 ${selected.length} 种商品发货`);
      setLowStock(next.filter((item) => item.remain_num < 10).sort((a, b) => a.remain_num - b.remain_num));
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-6 lg:p-8">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">发货记录</h2>
          <p className="mt-1 text-sm text-muted">录入今日发货数量，只提交数量不为 0 的商品</p>
        </div>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索商品"
          className="w-full max-w-xs rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-pine"
        />
      </div>

      {error && <p className="mt-4 text-sm text-copper">{error}</p>}
      {message && <p className="mt-4 text-sm text-pine">{message}</p>}

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
                <th className="px-4 py-3 font-medium">本次发货数量</th>
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
                  <td className="px-4 py-3 font-medium">{formatNumber(item.remain_num)}</td>
                  <td className="px-4 py-3">{formatNumber(item.historical_saled_num)}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={quantities[item.id] ?? ""}
                      onChange={(event) =>
                        setQuantities((prev) => ({ ...prev, [item.id]: event.target.value }))
                      }
                      className={`w-32 rounded-lg border px-3 py-2 outline-none focus:border-pine ${
                        positiveQty(quantities[item.id]) > item.remain_num
                          ? "border-copper"
                          : "border-line"
                      }`}
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex shrink-0 justify-center">
        <button
          type="button"
          disabled={pending || selected.length === 0}
          onClick={requestConfirm}
          className="rounded-lg bg-copper px-8 py-3 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          确认发货
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={`确认发货 ${selected.length} 种商品？`}
        confirmLabel="确认发货"
        pending={pending}
        error={error}
        onCancel={() => {
          if (!pending) setConfirmOpen(false);
        }}
        onConfirm={() => void submit()}
      >
        <ul className="max-h-60 space-y-1 overflow-auto">
          {selected.map(({ item, quantity }) => (
            <li key={item.id}>
              {item.name} × {quantity}
            </li>
          ))}
        </ul>
      </ConfirmModal>

      <ConfirmModal
        open={lowStock.length > 0}
        title={`有 ${lowStock.length} 种商品库存不足 10 件`}
        confirmLabel="知道了"
        hideCancel
        onCancel={() => setLowStock([])}
        onConfirm={() => setLowStock([])}
      >
        <p>发货后请及时补货：</p>
        <ul className="mt-2 max-h-60 space-y-1 overflow-auto">
          {lowStock.map((item) => (
            <li key={item.id}>
              {item.name}（ID {item.id}）剩余 {formatNumber(item.remain_num)}
            </li>
          ))}
        </ul>
      </ConfirmModal>
    </div>
  );
}
