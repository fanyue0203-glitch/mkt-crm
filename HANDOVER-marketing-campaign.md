# 📣 市场营销活动获客 板块 — 交接文档

> 最后更新：2026-10-29 千寻
> 状态：已上线，集成在 MKT-CRM 固定地址内

## 一、访问入口

**固定地址（永久不变）：**
👉 https://margarine-ferry-chatroom.ngrok-free.dev

- 左侧导航新增「📣 市场营销活动获客」（业务板块区，位于「线索转化漏斗」下方）
- 四个页面：
  - `/marketing-campaign` — 标签全景仪表盘（首页）
  - `/marketing-campaign/leads` — 线索列表（服务端筛选+分页+导出）
  - `/marketing-campaign/leads/:id` — 线索详情（标签修正+留痕）
  - `/marketing-campaign/insight` — 分析看板（趋势+交叉矩阵+洞察）

## 二、数据

- 表名：`marketing_campaign_leads`
- 数据量：**401 条**（CSV 原 403 行，按「手机号+企业简称」唯一键去重跳过 2 条）
  - 跳过的 2 条：`18680393875|平安银行`、`18672394665|乐金生活健康贸易（上海）有限公司`
- 表定义：`mkt-crm/db.js`（与 `seeds/create_table_marketing_campaign_leads.txt` 一致）
- 索引：industry_group / source_type / campaign_name / province / created_date
- 原始文件留档：`mkt-crm/seeds/`（leads_v1_2.csv、leads.csv、建表SQL、字段映射、原始xlsx）
- 导入脚本：`mkt-crm/scripts/import_marketing_campaign.mjs`（幂等，默认跳过已有数据；`--force` 清空重导）
- 备份脚本：`mkt-crm/scripts/backup-marketing-campaign.sh` → 输出到 `mkt-crm/backups/`（DB快照 + 线索CSV，保留30天）

## 三、后端 API

路由文件：`mkt-crm/routes-marketing-campaign.js`（在 server.js 中通过 `setMarketingCampaignRoutes(app, db)` 挂载）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/marketing-campaign/overview` | 标签全景（KPI + 5维标签树，二级明细实时聚合） |
| GET | `/api/marketing-campaign/leads` | 线索列表，支持 industry_group/source_type/campaign/product/region/province/city/month/registrar/q + 分页排序 |
| GET | `/api/marketing-campaign/options` | 全部筛选项枚举 |
| GET | `/api/marketing-campaign/cross?row=&col=` | 任意两维交叉矩阵 + 重点组合洞察 |
| GET | `/api/marketing-campaign/trend` | 月度进线趋势（总量 + 按来源拆分） |
| GET | `/api/marketing-campaign/leads/:id` | 单条详情 + 修改留痕 |
| PUT | `/api/marketing-campaign/leads/:id` | 标签人工修正（写 edit_history） |
| POST | `/api/marketing-campaign/leads` | 新增线索（唯一键冲突返回 409） |
| GET | `/api/marketing-campaign/export` | 按当前筛选导出 CSV（带 BOM） |

**鉴权**：GET 放行；POST/PUT 需 Header `X-API-Key: mkt-admin-qianxun-202610`

## 四、5 大标签维度（二级明细全部由 collect 值实时聚合，不建二级表）

| 维度 | 字段 | 二级明细 |
|---|---|---|
| 行业大类 | industry_group（19类） | industry_raw（55种细分行业） |
| 内容来源 | source_type（5类） | campaign_name（13种活动名称） |
| 意向产品线 | product_interest（多值，竖线分隔） | — |
| 地域大区 | province→大区映射（7大区+其他） | city |
| 进线月份 | created_date 解析 | — |

## 五、实际数据分布（401条）

**内容来源**：白皮书/报告下载 232 · 官方账号 110 · 线下活动 45 · 产品试用申请 7 · 其他社媒平台 7
（注：与 PRD 预期相比，官方账号 -1、其他社媒 +1，差异来自 2 条重复记录中一条来源打标不同）

**意向产品线**（多值计数）：消费者洞察 211 · 种草/DOMO 103 · GEO 94 · AI/大模型 73 · 广告监测 13 · 出海营销 7

**行业TOP**：代理商/服务商 100 · 食品饮料 68 · 互联网/科技 33 · 美妆个护 29 · 医药健康 28 · 零售电商 25

**覆盖**：373 家企业 / 26 省 / 49 市 / 2026-01 ~ 2026-10 / 2 位登记人（樊越等）

## 六、服务运维

- systemd（user）：`mkt-crm.service`（Node 服务 :3000）+ `mkt-crm-ngrok.service`（固定域名隧道）
- 重启：`systemctl --user restart mkt-crm.service`
- ⚠️ **vite build 会清空 dist/**，build 后必须：
  1. `cp node_modules/chart.js/dist/chart.umd.js dist/chart.js`（前端图表库本地化，dist/index.html 引用 `/chart.js`）
  2. `systemctl --user restart mkt-crm.service`
- 前端源码：`src/pages/MarketingCampaign.jsx`（4个导出组件）+ `src/styles.css` 末尾 `.mc-*` 样式段
- 路由注册：`src/App.jsx` / `src/components/Sidebar.jsx`

## 七、设计决策记录

1. **不建二级标签表**：二级明细（细分行业/具体活动/城市）由 `overview` 接口按 group by 实时聚合，避免维护两套数据。
2. **唯一键保持 (phone, company_name)**：如需保留重复行，需改成含日期的复合键并重导。
3. **地域大区映射**：复用 server.js `getRegion()` 逻辑，独立实现在 routes 文件内（避免循环依赖）。
4. **产品线多值**：存储为竖线分隔，筛选/统计均按 split 后处理。