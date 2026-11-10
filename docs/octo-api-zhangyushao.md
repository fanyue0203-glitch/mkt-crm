# MKT-CRM Octo大客户模块 API文档（章鱼烧专用）

## 基础信息
- **API地址：** `https://margarine-ferry-chatroom.ngrok-free.dev`
- **API Key：** `mkt-octo-zhangyushao-202610`
- **请求头：** `Content-Type: application/json`，`X-API-Key: mkt-octo-zhangyushao-202610`
- **权限范围：** 大客户管理模块（accounts/contacts/reports）+ Octo汇总/管线；无leads/ceo_events等其他模块写入权限
- **GET请求无需Key（只读），POST/PUT/DELETE必须带Key**

---

## 接口列表

### 1. 客户列表
- `GET /api/accounts` — 获取所有大客户列表
- 支持query参数：`tier`(A/B/C/D)、`health_tier`(🔥热推进等)、`keyword`(搜索公司名)

### 2. 单个客户详情
- `GET /api/accounts/:id` — 获取指定客户完整信息
- 返回所有字段（notes、blockers、next_step、key_events等）

### 3. 新增客户
- `POST /api/accounts`
- Body示例：
```json
{
  "company_name": "客户名称",
  "industry": "制造业",
  "scale": "大型(1万+人)",
  "tier": "B",
  "octo_status": "B类｜当前推进状态简述",
  "health_tier": "🟡跟进中",
  "first_touch_date": "2026-10-10",
  "last_touch_date": "2026-10-10",
  "needs_summary": "核心需求简述",
  "estimated_budget": "100-200万",
  "assigned_to": "刘静",
  "core_painpoint": "痛点描述",
  "blockers": "卡点描述",
  "next_step": "下一步行动",
  "key_events": "[{\"date\":\"2026-10-10\",\"event\":\"事件名\",\"note\":\"详情\"}]",
  "notes": "完整档案备注（支持长文本）",
  "competitors": "竞品信息",
  "ecosystem_lock": "生态锁定情况",
  "product_solutions_detail": "方案方向",
  "key_departments": "关键部门",
  "customer_recognition": "客户认知",
  "ceo_involvement": 1
}
```

### 4. 更新客户信息
- `PUT /api/accounts/:id`
- Body传需要更新的字段即可（不需要全量传）
- 例：更新notes和next_step
```json
{
  "notes": "更新后的完整档案...",
  "next_step": "新的下一步...",
  "last_touch_date": "2026-10-11"
}
```

### 5. 删除客户
- `DELETE /api/accounts/:id`（慎用）

### 6. 获取客户联系人
- `GET /api/accounts/:id/contacts` — 获取某客户所有联系人

### 7. 新增联系人
- `POST /api/accounts/:id/contacts`
```json
{
  "name": "姓名",
  "title": "职位",
  "department": "部门",
  "role_level": "角色层级(如：最高决策人/技术支撑/内部推手)",
  "phone": "",
  "email": "",
  "is_champion": 0,
  "notes": "备注信息"
}
```

### 8. 更新联系人
- `PUT /api/accounts/contacts/:contactId`

### 9. 删除联系人
- `DELETE /api/accounts/contacts/:contactId`

### 10. 客户报告
- `GET /api/accounts/:id/reports` — 获取客户相关报告
- `POST /api/accounts/:id/reports` — 上传/关联报告

### 11. Octo汇总看板
- `GET /api/octo/summary` — 大客户全局汇总（分层统计、管线金额等）

### 12. Octo管线
- `GET /api/octo/pipeline` — 商机管线数据

---

## 使用说明
1. 更新客户时优先用PUT只传改动字段，不要全量覆盖
2. notes字段是长文本，支持完整的档案备注，用换行符分段
3. key_events是JSON字符串格式的数组，新增事件时先GET取现有events，push新事件后PUT回去
4. 联系人的is_champion：1=关键champion/决策人，0=一般联系人
5. tier字段：A(已签约交付)/B(重点推进)/C(跟进)/D(观察)，战败/放弃直接在notes标注
6. health_tier常用值：🔥热推进-高层接触后、🟡跟进中、🟢初期观察、⚠️卡点、❌战败/放弃
7. 所有写入操作必须带Header `X-API-Key: mkt-octo-zhangyushao-202610`

## 注意事项
- ❌ 不要操作leads、ceo_events、sdr_monthly_stats等表（无权限）
- ❌ 不要删除已有客户数据
- ✅ 新增/更新客户后，notes里标注更新时间和来源（如"10/11章鱼烧更新"）
- ✅ 字段不确定时先GET现有数据看格式，再PUT更新
