import { supabase } from "./supabase";
import type { Goods, GoodsWithStock, HistoryAction, HistoryGoods, HistoryGoodsItem, HistoryRow, Stock } from "./types";

function mergeGoodsStock(goods: Goods[], stocks: Stock[]): GoodsWithStock[] {
  const stockMap = new Map(stocks.map((item) => [item.id, item]));
  return goods.map((item) => {
    const stock = stockMap.get(item.id);
    return {
      ...item,
      remain_num: Number(stock?.remain_num ?? 0),
      historical_saled_num: Number(stock?.historical_saled_num ?? 0),
      stock_updated_at: stock?.updated_at ?? null,
      has_stock: Boolean(stock),
    };
  });
}

export async function fetchGoodsWithStock(includeArchived: boolean): Promise<GoodsWithStock[]> {
  let goodsQuery = supabase.from("Goods").select("id, name, picture_url, archived, created_at").order("id", {
    ascending: true,
  });
  if (!includeArchived) {
    goodsQuery = goodsQuery.eq("archived", false);
  }

  const [{ data: goods, error: goodsError }, { data: stocks, error: stockError }] = await Promise.all([
    goodsQuery,
    supabase.from("Stock").select("id, remain_num, historical_saled_num, updated_at"),
  ]);

  if (goodsError) throw goodsError;
  if (stockError) throw stockError;
  return mergeGoodsStock((goods ?? []) as Goods[], (stocks ?? []) as Stock[]);
}

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function uploadGoodsPicture(file: File, accessToken?: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const contentType = IMAGE_MIME[ext] || file.type || "image/jpeg";
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const body = new Blob([await file.arrayBuffer()], { type: contentType });

  const { error } = await supabase.storage.from("good_picture").upload(path, body, {
    cacheControl: "3600",
    upsert: true,
    contentType,
    ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
  });
  if (error) throw error;
  return supabase.storage.from("good_picture").getPublicUrl(path).data.publicUrl;
}

export async function createGoods(input: {
  name: string;
  picture_url: string | null;
  archived: boolean;
  remain_num: number;
}): Promise<void> {
  const { error } = await supabase.from("Goods").insert({
    name: input.name,
    picture_url: input.picture_url,
    archived: input.archived,
  });
  if (error) throw error;

  let goodsId: number | null = null;
  if (input.picture_url) {
    const { data, error: readError } = await supabase
      .from("Goods")
      .select("id")
      .eq("picture_url", input.picture_url)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) throw readError;
    goodsId = data?.id ?? null;
  }
  if (goodsId == null) {
    const { data, error: readError } = await supabase
      .from("Goods")
      .select("id")
      .eq("name", input.name)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) throw readError;
    goodsId = data?.id ?? null;
  }
  if (goodsId == null) {
    throw new Error("商品已保存，但当前账号无法读取新行（缺少 Goods 的 SELECT 策略）。请执行 supabase/goods_policies.sql");
  }

  const { error: stockError } = await supabase.from("Stock").upsert(
    {
      id: goodsId,
      remain_num: input.remain_num,
      historical_saled_num: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (stockError) throw stockError;
}

export async function deleteGoods(id: number): Promise<void> {
  const { error: stockError } = await supabase.from("Stock").delete().eq("id", id);
  if (stockError) throw stockError;

  const { error } = await supabase.from("Goods").delete().eq("id", id);
  if (error) throw error;
}

export async function updateGoods(input: {
  id: number;
  name: string;
  picture_url: string | null;
  archived: boolean;
  remain_num: number;
}): Promise<void> {
  const { error } = await supabase
    .from("Goods")
    .update({
      name: input.name,
      picture_url: input.picture_url,
      archived: input.archived,
    })
    .eq("id", input.id);
  if (error) throw error;

  const { data: existing, error: readError } = await supabase.from("Stock").select("id").eq("id", input.id).maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const { error: stockError } = await supabase
      .from("Stock")
      .update({
        remain_num: input.remain_num,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (stockError) throw stockError;
  } else {
    const { error: stockError } = await supabase.from("Stock").insert({
      id: input.id,
      remain_num: input.remain_num,
      historical_saled_num: 0,
      updated_at: new Date().toISOString(),
    });
    if (stockError) throw stockError;
  }
}

export async function recordShipment(entries: { item: GoodsWithStock; quantity: number }[]): Promise<void> {
  const selected = entries.filter((entry) => Number.isInteger(entry.quantity) && entry.quantity > 0);
  if (selected.length === 0) {
    throw new Error("请至少填写一件数量不为 0 的商品");
  }

  const stocks: { item: GoodsWithStock; quantity: number; remain: number; sold: number }[] = [];
  const shortages: string[] = [];

  for (const { item, quantity } of selected) {
    const { data: stock, error: readError } = await supabase
      .from("Stock")
      .select("id, remain_num, historical_saled_num")
      .eq("id", item.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!stock) throw new Error(`「${item.name}」还没有库存记录`);

    const remain = Number(stock.remain_num ?? 0);
    const sold = Number(stock.historical_saled_num ?? 0);
    if (remain < quantity) {
      shortages.push(`「${item.name}」发货 ${quantity} / 库存 ${remain}`);
    }
    stocks.push({ item, quantity, remain, sold });
  }

  if (shortages.length > 0) {
    throw new Error(`以下商品发货数量超过库存，已拒绝整单发货：${shortages.join("、")}`);
  }

  const historyItems: HistoryGoodsItem[] = [];
  const now = new Date().toISOString();
  for (const { item, quantity, remain, sold } of stocks) {
    const nextRemain = remain - quantity;
    const nextSold = sold + quantity;
    const { error } = await supabase
      .from("Stock")
      .update({
        remain_num: nextRemain,
        historical_saled_num: nextSold,
        updated_at: now,
      })
      .eq("id", item.id);
    if (error) throw error;

    historyItems.push({
      id: item.id,
      name: item.name,
      picture_url: item.picture_url,
      quantity,
      remain_num: nextRemain,
      historical_saled_num: nextSold,
    });
  }

  await insertHistory("shipment", historyItems);
}

export async function recordRestock(entries: { item: GoodsWithStock; quantity: number }[]): Promise<void> {
  const selected = entries.filter((entry) => Number.isInteger(entry.quantity) && entry.quantity > 0);
  if (selected.length === 0) {
    throw new Error("请至少填写一件数量不为 0 的商品");
  }

  const now = new Date().toISOString();
  const historyItems: HistoryGoodsItem[] = [];

  for (const { item, quantity } of selected) {
    const { data: stock, error: readError } = await supabase
      .from("Stock")
      .select("id, remain_num, historical_saled_num")
      .eq("id", item.id)
      .maybeSingle();
    if (readError) throw readError;

    let nextRemain = quantity;
    let nextSold = 0;

    if (!stock) {
      const { error } = await supabase.from("Stock").insert({
        id: item.id,
        remain_num: quantity,
        historical_saled_num: 0,
        updated_at: now,
      });
      if (error) throw error;
    } else {
      nextRemain = Number(stock.remain_num ?? 0) + quantity;
      nextSold = Number(stock.historical_saled_num ?? 0);
      const { error } = await supabase
        .from("Stock")
        .update({
          remain_num: nextRemain,
          updated_at: now,
        })
        .eq("id", item.id);
      if (error) throw error;
    }

    historyItems.push({
      id: item.id,
      name: item.name,
      picture_url: item.picture_url,
      quantity,
      remain_num: nextRemain,
      historical_saled_num: nextSold,
    });
  }

  await insertHistory("restock", historyItems);
}

async function insertHistory(action: HistoryGoods["action"], items: HistoryGoodsItem[]): Promise<void> {
  const nonzero = items.filter((item) => Number.isFinite(item.quantity) && item.quantity !== 0);
  if (nonzero.length === 0) return;
  const { error } = await supabase.from("history").insert({
    goods: { action, items: nonzero },
  });
  if (error) throw error;
}

function parseHistoryItem(raw: unknown): HistoryGoodsItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<HistoryGoodsItem> & { action?: string };
  const quantity = Number(item.quantity ?? 0);
  if (!Number.isFinite(quantity) || quantity === 0) return null;
  return {
    id: Number(item.id ?? 0),
    name: String(item.name ?? ""),
    picture_url: item.picture_url ?? null,
    quantity,
    remain_num: Number(item.remain_num ?? 0),
    historical_saled_num: Number(item.historical_saled_num ?? 0),
  };
}

function parseHistoryGoods(raw: unknown): HistoryGoods | null {
  try {
    const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (!value || typeof value !== "object") return null;
    const obj = value as Partial<HistoryGoods> & Partial<HistoryGoodsItem> & { action?: string };
    const action = obj.action === "shipment" || obj.action === "restock" ? obj.action : null;
    if (!action) return null;

    const sourceItems = Array.isArray(obj.items) ? obj.items : [obj];
    const items = sourceItems
      .map((item) => parseHistoryItem(item))
      .filter((item): item is HistoryGoodsItem => item !== null);
    if (items.length === 0) return null;
    return { action, items };
  } catch {
    return null;
  }
}

export function historyItemMatches(item: HistoryGoodsItem, keyword: string): boolean {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;
  return item.name.toLowerCase().includes(q) || String(item.id).includes(q);
}

function parseHistoryRows(data: { id: number; goods: unknown; created_at: string }[] | null): HistoryRow[] {
  return (data ?? [])
    .map((row) => {
      const goods = parseHistoryGoods(row.goods);
      if (!goods) return null;
      return {
        id: Number(row.id),
        goods,
        created_at: String(row.created_at),
        allItems: goods.items,
      };
    })
    .filter((row): row is HistoryRow => row !== null);
}

export const HISTORY_PAGE_SIZE = 7;

export async function fetchHistory(input: {
  page: number;
  action?: "all" | HistoryAction;
  keyword?: string;
}): Promise<{ rows: HistoryRow[]; total: number }> {
  const page = Math.max(1, input.page);
  const action = input.action ?? "all";
  const keyword = input.keyword?.trim().toLowerCase() ?? "";
  const from = (page - 1) * HISTORY_PAGE_SIZE;
  const to = from + HISTORY_PAGE_SIZE - 1;

  let query = supabase
    .from("history")
    .select("id, goods, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (action !== "all") {
    query = query.contains("goods", { action });
  }

  if (keyword) {
    const { data, error } = await query;
    if (error) throw error;
    const filtered = parseHistoryRows(data)
      .map((row) => {
        const items = row.goods.items.filter((item) => historyItemMatches(item, keyword));
        if (items.length === 0) return null;
        return { ...row, goods: { ...row.goods, items } };
      })
      .filter((row): row is HistoryRow => row !== null);
    return {
      rows: filtered.slice(from, from + HISTORY_PAGE_SIZE),
      total: filtered.length,
    };
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { rows: parseHistoryRows(data), total: count ?? 0 };
}

type StockSnapshot = {
  id: number;
  remain_num: number;
  historical_saled_num: number;
};

async function restoreStock(snapshots: StockSnapshot[]): Promise<void> {
  const now = new Date().toISOString();
  for (const snap of snapshots) {
    const { error } = await supabase
      .from("Stock")
      .update({
        remain_num: snap.remain_num,
        historical_saled_num: snap.historical_saled_num,
        updated_at: now,
      })
      .eq("id", snap.id);
    if (error) throw error;
  }
}

export async function deleteHistory(id: number): Promise<void> {
  const { data, error: readError } = await supabase
    .from("history")
    .select("id, goods")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw readError;
  if (!data) throw new Error("流水不存在或已被删除");

  const goods = parseHistoryGoods(data.goods);
  if (!goods) throw new Error("流水数据无法解析，未回滚库存");

  const snapshots: StockSnapshot[] = [];
  const now = new Date().toISOString();

  try {
    for (const item of goods.items) {
      const { data: stock, error: stockReadError } = await supabase
        .from("Stock")
        .select("id, remain_num, historical_saled_num")
        .eq("id", item.id)
        .maybeSingle();
      if (stockReadError) throw stockReadError;
      if (!stock) throw new Error(`「${item.name}」没有库存记录，无法回滚`);

      const remain = Number(stock.remain_num ?? 0);
      const sold = Number(stock.historical_saled_num ?? 0);
      snapshots.push({ id: item.id, remain_num: remain, historical_saled_num: sold });

      const qty = item.quantity;
      let nextRemain: number;
      let nextSold: number;
      if (goods.action === "shipment") {
        nextRemain = remain + qty;
        nextSold = Math.max(0, sold - qty);
      } else {
        if (remain < qty) {
          throw new Error(`「${item.name}」当前库存 ${remain}，不足以撤销补货数量 ${qty}`);
        }
        nextRemain = remain - qty;
        nextSold = sold;
      }

      const { error } = await supabase
        .from("Stock")
        .update({
          remain_num: nextRemain,
          historical_saled_num: nextSold,
          updated_at: now,
        })
        .eq("id", item.id);
      if (error) throw error;
    }

    const { error } = await supabase.from("history").delete().eq("id", id);
    if (error) throw error;
  } catch (err) {
    try {
      if (snapshots.length > 0) await restoreStock(snapshots);
    } catch {
      // keep original error
    }
    throw err;
  }
}
