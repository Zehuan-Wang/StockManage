export function formatNumber(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString("zh-CN");
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ErrorShape = {
  message?: string;
  error?: string;
  statusCode?: string | number;
  status?: number;
};

export function authErrorMessage(error: unknown): string {
  const obj = error && typeof error === "object" ? (error as ErrorShape) : null;
  const raw =
    (error instanceof Error ? error.message : null) ||
    obj?.message ||
    obj?.error ||
    (typeof error === "string" ? error : "");
  const status = String(obj?.statusCode ?? obj?.status ?? "");
  const text = `${raw} ${status}`;

  if (/invalid login credentials/i.test(raw)) return "邮箱或密码错误";
  if (/email not confirmed/i.test(raw)) return "该邮箱尚未确认，请在 Supabase 中确认或关闭邮箱确认";
  if (/Bucket not found/i.test(text) || status === "404") {
    return "找不到 Storage bucket「good_picture」，请在 Supabase Storage 中确认该 bucket 已创建并设为 Public。";
  }
  if (
    /row-level security|violates.*policy|not allowed|Unauthorized|42501/i.test(text) ||
    status === "403"
  ) {
    if (/Goods/i.test(text)) {
      return "没有写入 Goods 的权限。请在 SQL Editor 执行 supabase/goods_policies.sql（INSERT 还需要 admin 的 SELECT 策略）。";
    }
    return "图片上传被 Storage 权限拒绝。请确认已登录 admin，且 bucket「good_picture」允许认证用户上传。";
  }
  if (/Invalid Compact JWS|not authenticated|JWT expired/i.test(text) || status === "401") {
    return "登录已失效，请退出后重新登录再上传图片。";
  }
  if (/mime type/i.test(text)) {
    return "该图片类型不被 bucket 允许，请在 Storage 设置中放行 image/jpeg、image/png、image/webp。";
  }
  if (!raw) return "操作失败，请稍后重试";
  return raw;
}
