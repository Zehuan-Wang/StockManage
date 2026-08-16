export type Role = "admin" | "manager";

export type Admin = {
  user_id: string;
  role: Role;
};

export type Goods = {
  id: number;
  name: string;
  picture_url: string | null;
  archived: boolean;
  created_at: string;
};

export type Stock = {
  id: number;
  remain_num: number;
  historical_saled_num: number;
  updated_at: string | null;
};

export type GoodsWithStock = Goods & {
  remain_num: number;
  historical_saled_num: number;
  stock_updated_at: string | null;
  has_stock: boolean;
};

export type HistoryAction = "shipment" | "restock";

export type HistoryGoodsItem = {
  id: number;
  name: string;
  picture_url: string | null;
  quantity: number;
  remain_num: number;
  historical_saled_num: number;
};

export type HistoryGoods = {
  action: HistoryAction;
  items: HistoryGoodsItem[];
};

export type HistoryRow = {
  id: number;
  goods: HistoryGoods;
  created_at: string;
  allItems: HistoryGoodsItem[];
};
