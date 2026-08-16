# 存货后台

基于 Supabase 的存货管理后台：邮箱密码登录（不提供注册），按 `public.admins.role` 区分管理员与仓管。

## 功能

- **登录**：Supabase Auth 邮箱 + 密码。账号在 Dashboard 中创建，前端不能注册。
- **存货总览**（admin / manager）：查看 `Goods.archived = false` 的商品，以及对应 `Stock.remain_num`、`Stock.historical_saled_num`。
- **商品管理**（仅 admin）：维护商品 `name`、`picture_url`、`archived`；图片上传到 Storage bucket `good_picture` 后再写入 `picture_url`。
- **发货记录**（admin / manager）：录入本次发货数量，扣减 `remain_num`，增加 `historical_saled_num`。

约定：`Stock.id` 与 `Goods.id` 一一对应。

## 本地运行

```bash
cp .env.example .env
npm install
npm run dev
```

`.env` 填写：

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=你的 anon key
```

## Supabase 配置

1. 在 Authentication 中创建用户（邮箱+密码），不要打开公开注册。
2. 把该用户写入 `public.admins`：

```sql
insert into public.admins (user_id, role)
values ('这里填 auth.users 的 uuid', 'admin');
-- 或 'manager'
```

3. Storage bucket：`good_picture`（**Public**）。
4. 在 SQL Editor 中执行 `supabase/rls.sql`。若图片无法公开访问，再执行 `supabase/storage.sql`。

`Goods.picture_url` 保存公开地址，例如：

`https://<项目>.supabase.co/storage/v1/object/public/good_picture/<文件名>`

新增商品时会用 `Goods.id` 写入 `Stock.id`。请保证 `Stock.id` 允许手动指定（`IDENTITY BY DEFAULT`，或插入时覆盖序列）。

## GitHub Pages

路由已使用 `HashRouter`，刷新子页面不会 404。地址形如：

`https://<用户名>.github.io/<仓库名>/#/login`

1. 把本仓库推到 GitHub（默认分支 `main`）。
2. 仓库 **Settings → Secrets and variables → Actions** 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 仓库 **Settings → Pages**：Source 选 **GitHub Actions**。
4. 推送到 `main` 后，工作流 `.github/workflows/deploy.yml` 会自动构建并发布。
