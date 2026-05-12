# 礼尚 - Harmony Ledger

<div align="center">

<p>一款现代化的全栈人情往来记账与协作应用</p>

<p>
  <img src="https://img.shields.io/badge/React-18-blue" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue" alt="TypeScript 5.8" />
  <img src="https://img.shields.io/badge/Cloudflare%20Workers-✓-orange" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-3.4-38bdf8" alt="Tailwind CSS 3.4" />
  <img src="https://img.shields.io/badge/开源协议-MIT-green" alt="License MIT" />
</p>

</div>

---

## 📖 简介

**礼尚**（和谐账本 / Harmony Ledger）是一款专注于记录中国"人情往来"礼金往来的全栈 Web 应用。帮助家庭管理婚礼、生日、节日等场合的礼金记录，支持多用户协作，提供完善的统计分析和数据备份功能。

后端基于 **Cloudflare Workers** 与 **Hono** 框架，前端使用 **React 18** + **TypeScript** 构建，开箱即用。

## 📸 项目预览

### 界面预览
![项目预览图](https://img.952737.xyz/file/1778551781929_Stitch_20260512_100741.png)

### 在线体验

> [!TIP]
> 🌐 **在线演示**：[https://ledge.952737.xyz](https://ledge.952737.xyz)
> 🔒 **邮箱&密码**：test@163.com/123456

## ✨ 功能特性

### 🏠 首页概览
- 当前结余、总收到、总送出一目了然
- 最近活动记录动态流
- 生成分享卡片（含二维码），一键复制或分享

### 👨‍👩‍👧‍👦 家庭协作
- 创建家庭或通过邀请码加入
- 支持多家庭，随时切换
- 家庭成员数据实时同步

### 📒 礼簿管理
- 按活动创建专属礼簿（如"表哥婚礼"、"外公八十大寿"）
- 自动统计收/送总额
- 查看和管理礼簿内所有明细

### 📝 记录管理
- 区分"送出"和"收到"两种类型
- 支持 10 种事项类型：结婚、生日、升学、宝宝、周岁、节日、乔迁、探望、白事、其它
- 搜索、过滤、分页浏览
- 无限滚动加载

### 👤 联系人管理
- 维护家庭通讯录
- 查看单人的往来统计：月度趋势柱状图、事项分布饼图
- 时间轴视图，按日期分组展示所有记录
- 搜索时快速新建联系人

### 📊 数据分析
- 月度收支趋势对比（柱状图）
- 事项分类占比（饼图）
- 最常往来事项、最大单笔礼金

### 🌐 多语言
- 完整的中文（简体）和英文支持
- 自动检测浏览器语言

### 📦 数据管理
- 导出 JSON 格式备份
- 导入恢复数据（自动重新生成 ID，确保数据隔离）
- 生成分享卡片图片，支持下载

## 🧩 技术栈

### 前端
| 技术 | 用途 |
|---|---|
| **React 18** | UI 框架 |
| **TypeScript 5.8** | 类型安全 |
| **Vite 6** | 构建工具 & 开发服务器 |
| **Tailwind CSS 3.4** | 样式 |
| **shadcn/ui** | 组件库 |
| **Framer Motion** | 动画效果 |
| **TanStack Query** | 服务端状态管理 |
| **React Router 6** | 客户端路由 |
| **React Hook Form + Zod** | 表单验证 |
| **Recharts** | 图表与数据分析 |
| **i18next** | 国际化 |
| **Sonner** | 消息提示 |

### 后端
| 技术 | 用途 |
|---|---|
| **Cloudflare Workers** | 无服务器运行环境 |
| **Hono** | API 框架 |
| **D1 (SQLite)** | 数据库 |
| **Wrangler** | CLI 工具 & 部署 |

## 📁 项目结构

```
harmony-ledger-workers/
├── src/                          # 前端源码
│   ├── components/               # 可复用 React 组件
│   │   ├── ui/                   # shadcn/ui 基础组件
│   │   ├── layout/               # 布局与导航
│   │   └── ...                   # 功能组件
│   ├── pages/                    # 页面级组件
│   ├── context/                  # React Context 提供者
│   ├── hooks/                    # 自定义 Hook
│   ├── lib/                      # 工具函数
│   ├── i18n/                     # 国际化配置
│   ├── constants/                # 常量定义（事项类型）
│   └── main.tsx                  # 入口文件
├── worker/                       # 后端源码
│   ├── index.ts                  # Worker 入口
│   ├── user-routes.ts            # 所有 API 路由定义
│   ├── entities.ts               # 领域实体类
│   ├── d1-utils.ts               # 数据库工具
│   └── schema.sql                # 数据库表结构
├── shared/                       # 前后端共享
│   └── types.ts                  # TypeScript 类型定义
├── public/                       # 静态资源
├── wrangler.jsonc                # Cloudflare Wrangler 配置
├── vite.config.ts                # Vite 配置
├── tailwind.config.js            # Tailwind CSS 配置
└── package.json                  # 依赖与脚本
```

## 🚀 快速开始

### 前置要求

- [Bun](https://bun.sh/)（或 npm/yarn/pnpm）
- [Node.js](https://nodejs.org/) 18+
- [Cloudflare](https://dash.cloudflare.com/) 账号（用于部署）

### 本地开发

1. **克隆并安装依赖：**
   ```bash
   git clone https://github.com/chengzhnag/harmony-ledger-workers.git
   cd harmony-ledger-workers
   bun install
   ```

2. **创建 Cloudflare D1 数据库：**
   ```bash
   # 创建新数据库
   npx wrangler d1 create harmony-ledger-workers
   
   # 将 database_id 更新到 wrangler.jsonc
   
   # 应用数据库表结构
   npx wrangler d1 execute harmony-ledger-workers --file worker/schema.sql
   ```

3. **启动开发服务器：**
   ```bash
   bun run dev
   ```

4. **打开浏览器：**
   - 前端：`http://localhost:3000`
   - API：自动通过 Vite 代理转发

### 生产构建与部署

```bash
# 构建生产版本
bun run build

# 部署到 Cloudflare
bun run deploy
```

> [!NOTE]
> 部署前请确保已在 `wrangler.jsonc` 中配置好 D1 数据库。

### 可用脚本

| 命令 | 说明 |
|---|---|
| `bun run dev` | 启动开发服务器 |
| `bun run build` | 构建生产版本 |
| `bun run preview` | 本地预览生产构建 |
| `bun run deploy` | 构建并部署到 Cloudflare |
| `bun run lint` | 运行 ESLint 检查 |
| `bun run cf-typegen` | 生成 Cloudflare Worker 类型声明 |


## 🏋️‍♀️ 手动部署：Fork 项目 Cloudflare 部署

如果你想快速部署到自己的 Cloudflare 账号，推荐使用 Fork 方式：

1.  **Star 和 Fork 项目**
    - 访问项目仓库：[和谐账本](https://github.com/chengzhnag/harmony-ledger-workers)
    - 点击右上角的 `Star` ⭐️ ⭐️ 按钮，再点击 `Fork` 按钮将项目复制到你的 GitHub 账户。

2.  **登录 Cloudflare**
    - 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)，登录你的账户。

3.  **创建 D1 数据库并初始化表**
    - 在左侧导航栏选择 **存储和数据库** > **D1 SQL 数据库**。
    - 点击 **创建数据库**，按提示创建数据库实例。
    - 记录数据库的 **名称**（例如：`harmony-ledger`）。
    ![image](https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.1zivsdd8hh.webp)
    - 初始化表：
      - **控制台**（在 D1 数据库管理界面手动执行 `worker/schema.sql` 中的建表语句）。
      ![image](https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.7pwxgufny.webp)
      ![image](https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.7w7fzdvvn6.webp)
      ![image](https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.92qr7zlt4x.webp)

4.  **创建 Workers 应用**
    - 在左侧导航栏选择 **计算** > **Workers 和 Pages**。
    - 点击 **创建应用程序**，选择 **with GitHub**。

5.  **选择仓库**
    - 选择 **GitHub**，登录并授权。
    - 从列表中找到并选择你的 Fork 仓库（例如：`<你的用户名>/harmony-ledger-workers`）。
    - 确认 **Branch** 为 `master`（或你的主分支）。
    - 后续直接点击部署
    ![image](https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.8dxhnz0ew5.webp)

6.  **绑定B1数据库**
    - 部署构建完成后在绑定里面添加D1数据库绑定
    ![image](https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.41yogfj8tu.webp)
    - 添加自定义域名
    ![image](https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.6po4qsfja2.webp)



## 🔧 配置

### wrangler.jsonc

```jsonc
{
  "name": "harmony-ledger-workers",
  "main": "worker/index.ts",
  "compatibility_date": "2025-04-24",
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "你的数据库名称",
      "database_id": "你的数据库ID"
    }
  ]
}
```

## 🌐 API 文档

完整的 API 接口文档请参阅 [API.md](./API.md)。

## 🗄️ 数据库结构

项目使用 Cloudflare D1（SQLite）作为数据库，包含以下表：

- **users** — 用户账户与偏好设置
- **families** — 家庭分组，含邀请码
- **contacts** — 联系人
- **ledgers** — 活动礼簿
- **records** — 人情记录

完整表结构见 [`worker/schema.sql`](./worker/schema.sql)。

## 🤝 贡献

欢迎提交 Pull Request 或 Issue！

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/新功能`）
3. 提交更改（`git commit -m '新增：XXX功能'`）
4. 推送到分支（`git push origin feature/新功能`）
5. 提交 Pull Request

## ⬆️ 支持我

如果你喜欢我的项目或工作，并希望通过捐赠来支持我，非常感谢您的慷慨！

### 我的收款码
<img src="https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/1000056304.2rvhsy1c5e.png" style="width: 160px;" />

### 注意事项：

- 请在确认金额无误后进行支付。
- 捐赠时可以选择填写留言，告诉我你是谁或者对项目的建议和期待，这对我非常重要！
- 如果遇到任何问题，请联系我。

感谢您的支持与鼓励！


## 📄 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。

## 🙏 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/) — 无服务器平台
- [Hono](https://hono.dev/) — 极速 Web 框架
- [shadcn/ui](https://ui.shadcn.com/) — 精美的 UI 组件
- [Recharts](https://recharts.org/) — 图表库
- [Tailwind CSS](https://tailwindcss.com/) — 原子化 CSS 框架

---

<div align="center">
  <p>用 ❤️ 记录人情往来，温馨维系社交</p>
  <p>
    <a href="https://ledge.952737.xyz">在线演示</a> •
    <a href="./API.md">API 文档</a> •
    <a href="./LICENSE">许可证</a>
  </p>
</div>
