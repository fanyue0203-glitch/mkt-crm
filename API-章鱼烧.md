# MKT-CRM Octo大客户模块 API文档（章鱼烧专用）v2

## 基础信息
- 外网地址：`https://margarine-ferry-chatroom.ngrok-free.dev`
- 内网地址：`http://10.172.49.233:3000`
- 你的API Key：`mkt-octo-zhangyushao-202610`
- 请求头必须带：`X-API-Key: mkt-octo-zhangyushao-202610`
- Content-Type：`application/json`
- 你的权限范围：accounts（客户档案）、account_contacts（联系人）、account_reports（周报）、account_timeline（推进时间线）、octo汇总面板

## 通用规则
1. **GET请求不带Key也能读，但建议始终带上**
2. **POST/PUT必须带X-API-Key请求头**
3. **DELETE操作已禁用**（除管理员外所有API Key无删除权限），只能新增和修改，不能删除任何数据
4. 更新用PUT只传改动字段，别全量覆盖
5. **所有写操作自动记录审计日志**：谁（edited_by）、改了哪个字段、改前值(old_value)、改后值(new_value)、精确时间(edited_at)，日志不可删除
6. notes更新时标注来源和日期，建议格式：`[章鱼烧 2026-10-12] 内容`
7. leads/SDR数据/CEO活动(ceo_events)那些表不要碰（无权限）
8. 客户id可先GET /api/accounts获取列表查找
9. 如发现录入错误需要删除/修正，请联系管理员处理

---

## 一、客户档案（accounts）

### 1. 查询客户列表
```
GET /api/accounts?tier=B&customer_stage=投标中&search=吉利&page=1&limit=50
```
查询参数（全部可选）：tier(S/A/B/C/D)、customer_stage、industry、search(搜索公司名/行业/负责人)、page、limit
返回：`{ data: [...], total, page, limit }`，按S→D等级+金额排序

### 2. 查询单个客户全景档案
```
GET /api/accounts/:id
```
返回完整客户信息，附带：
- `contacts`：联系人列表
- `reports`：周报/月报列表
- `timeline`：推进时间线记录
- `key_events`：关键事件数组（已解析为JSON）
- `events`：参与的CEO活动
- `leads`：关联SDR线索

### 3. 新建客户
```
POST /api/accounts
X-API-Key: mkt-octo-zhangyushao-202610

{
  "company_name": "公司名称*",
  "tier": "B",
  "industry": "制造/汽车",
  "scale": "大型企业",
  "region": "浙江杭州",
  "customer_stage": "B类重点推进",
  "assigned_to": "负责人",
  "deal_amount": 200,
  "needs_summary": "需求摘要",
  "octo_status": "当前状态",
  "notes": "详细备注[章鱼烧 2026-10-12]"
}
```
必填：company_name，其余可选。返回新建id。

### 4. 更新客户信息（最常用）
```
PUT /api/accounts/:id
X-API-Key: mkt-octo-zhangyushao-202610

{
  "octo_status": "B类重点推进｜最新状态",
  "next_step": "下一步行动",
  "notes": "[章鱼烧 2026-10-12] 更新备注",
  "blockers": "新卡点",
  "health_tier": "健康推进",
  "industry_group": "制造业",
  "demand_type": "私有化部署,特定场景AI化"
}
```
只传需要更新的字段。**支持所有字段**包括新增的health_tier/industry_group/demand_type/blocker_type/failure_mode等。

### 5. 客户全部可写字段
| 字段 | 说明 | 类型/可选值 |
|---|---|---|
| company_name | 公司名称* | 文本，POST必填 |
| tier | 客户分层 | S/A/B/C/D |
| industry | 行业 | 文本 |
| scale | 规模 | 文本 |
| region | 地区 | 文本 |
| customer_stage | 客户阶段 | 已签约/交付中/投标中/POC中/B类重点推进/C类跟进/D类观察/战败/放弃 |
| assigned_to | 我方负责人 | 文本 |
| octo_status | 当前状态简述 | 文本，建议30字内 |
| needs_summary | 需求摘要 | 文本 |
| deal_amount | 预估金额(万元) | 数字 |
| deal_stage | 商机阶段描述 | 文本 |
| lead_source | 线索来源 | 文本 |
| deployment_type | 部署方式 | 私有化/SaaS/混合 |
| product_solutions_detail | 产品方案详情 | 长文本 |
| competitors | 竞品信息 | 文本 |
| customer_recognition | 客户认可点 | 长文本 |
| core_painpoint | 核心痛点 | 长文本 |
| blockers | 卡点/阻塞 | 长文本 |
| next_step | 下一步行动 | 文本 |
| next_deadline | 下一步截止 | YYYY-MM-DD |
| key_departments | 覆盖部门 | 文本 |
| ecosystem_lock | 生态锁定评估 | 文本 |
| lessons_learned | 经验教训 | 长文本 |
| notes | 备注 | 长文本 |
| ceo_involvement | CEO直推标记 | 0/1 |
| **health_tier** | 健康度 | 健康推进/有风险/静默极早期/战败冻结 |
| **industry_group** | 行业分组 | 制造业/医疗健康/金融投资/科技互联网/教育/央国企 |
| **demand_type** | 需求类型 | AI原生组织变革/私有化部署/特定场景AI化/生态渠道合作/试用探索（逗号分隔多值） |
| **blocker_type** | 卡点类型 | 部署≠使用/竞品锁定/决策链长/产品技术卡点/合规硬门槛/关系线索衰减（逗号分隔多值） |
| **failure_mode** | 失败模式 | A部署后沉默/B竞品锁定/C合规硬门槛/D需求未建立 |
| **key_events** | 关键事件 | JSON数组，见下方 |

### 6. 追加关键事件（推荐用此接口而非直接改key_events字段）
```
POST /api/accounts/:id/key-events
X-API-Key: mkt-octo-zhangyushao-202610

{
  "date": "2026-10-12",
  "event": "述标完成",
  "note": "纯技术打分，等结果"
}
```
自动追加到key_events数组并按日期排序。

### 7. 查询关键事件
```
GET /api/accounts/:id/key-events
```
返回解析后的关键事件数组。

---

## 二、联系人（account_contacts）

### 1. 查询联系人列表
```
GET /api/accounts/:id/contacts
```
按关键联系人(champion)优先排序。

### 2. 查询单个联系人
```
GET /api/accounts/contacts/:contactId
```

### 3. 新增联系人
```
POST /api/accounts/:id/contacts
X-API-Key: mkt-octo-zhangyushao-202610

{
  "name": "联系人姓名*",
  "title": "职位",
  "department": "部门",
  "role_level": "角色层级",
  "phone": "手机",
  "email": "邮箱",
  "wechat": "微信号",
  "is_champion": 1,
  "is_key_contact": 1,
  "decision_level": "决策层/管理层/执行层",
  "relationship_status": "champion/supporter/neutral/opponent/unknown",
  "notes": "备注[章鱼烧 2026-10-12]"
}
```
必填：name。is_champion=1时is_key_contact自动=1。

### 4. 更新联系人
```
PUT /api/accounts/contacts/:contactId
X-API-Key: mkt-octo-zhangyushao-202610

{
  "title": "新职位",
  "wechat": "wxid_xxx",
  "is_key_contact": 1,
  "notes": "[章鱼烧 2026-10-12] 补充信息"
}
```
只传改动字段。

### 5. 删除联系人
```
DELETE /api/accounts/contacts/:contactId
X-API-Key: mkt-octo-zhangyushao-202610
```
⚠️ 只删自己创建的错误记录，不要删已有数据。

---

## 三、推进周报/月报（account_reports）

### 1. 查询周报列表
```
GET /api/accounts/:id/reports
```
按周期倒序排列。

### 2. 查询单个周报
```
GET /api/accounts/reports/:reportId
```

### 3. 新增周报
```
POST /api/accounts/:id/reports
X-API-Key: mkt-octo-zhangyushao-202610

{
  "report_type": "weekly",
  "report_period": "2026-W41",
  "most_important": "本周最重要的一件事",
  "key_work": "1. 重点工作1\n2. 重点工作2",
  "need_decision": "需要决策的事",
  "cross_team_needs": "跨团队需求",
  "bottlenecks": "卡点",
  "next_important": "下周最重要的事"
}
```
report_type: weekly(默认)/monthly

### 4. 更新周报
```
PUT /api/accounts/reports/:reportId
X-API-Key: mkt-octo-zhangyushao-202610
```

### 5. 删除周报
```
DELETE /api/accounts/reports/:reportId
X-API-Key: mkt-octo-zhangyushao-202610
```
⚠️ 只删自己创建的错误记录。

---

## 四、推进时间线（account_timeline）⭐ 新增

这是独立于key_events的更丰富的跟进记录表，适合记录每次会议、电话、微信沟通等推进动态。

### 1. 查询时间线
```
GET /api/accounts/:id/timeline
```
按日期倒序返回所有推进记录。

### 2. 新增推进记录
```
POST /api/accounts/:id/timeline
X-API-Key: mkt-octo-zhangyushao-202610

{
  "event_date": "2026-10-12",
  "event_type": "会议",
  "title": "郑州现场述标",
  "content": "Amy/玉平/威少铁三角赴郑州现场述标，客户认可AI原生定位",
  "participants": "Amy/玉平/威少/景宏源(CIO)",
  "next_action": "9/25跟进招标结果",
  "next_action_date": "2026-09-25",
  "source": "周会纪要/群消息/人工录入"
}
```
event_type可选值：会议/电话/微信/邮件/投标/签约/部署/培训/里程碑/卡点/跟进/其他
title或content至少填一项。event_date默认今天。

### 3. 更新推进记录
```
PUT /api/accounts/timeline/:timelineId
X-API-Key: mkt-octo-zhangyushao-202610
```

### 4. 删除推进记录
```
DELETE /api/accounts/timeline/:timelineId
X-API-Key: mkt-octo-zhangyushao-202610
```
⚠️ 只删自己创建的错误记录。

---

## 五、汇总面板

### 大客户全景汇总
```
GET /api/octo/summary
```
返回全量客户KPI统计（签约数/投标数/管线金额/分层分布等）。

### 管线视图
```
GET /api/octo/pipeline
```
返回按阶段分组的管线数据。

---

## curl示例

```bash
# 更新三一重工状态+追加关键事件
curl -X PUT https://margarine-ferry-chatroom.ngrok-free.dev/api/accounts/6 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mkt-octo-zhangyushao-202610" \
  -d '{"octo_status":"🔥梁在中亲自牵头，辉哥10/10广州总部演讲90分钟","next_step":"会后跟进梁在中反馈","health_tier":"健康推进"}'

# 追加关键事件
curl -X POST https://margarine-ferry-chatroom.ngrok-free.dev/api/accounts/6/key-events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mkt-octo-zhangyushao-202610" \
  -d '{"date":"2026-10-10","event":"辉哥广州总部演讲","note":"梁在中+全体高管参会，90分钟AI组织转型演讲+总裁晚宴"}'

# 新增推进时间线记录
curl -X POST https://margarine-ferry-chatroom.ngrok-free.dev/api/accounts/6/timeline \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mkt-octo-zhangyushao-202610" \
  -d '{"event_date":"2026-10-10","event_type":"会议","title":"辉哥广州总部AI转型演讲","content":"梁在中董事长亲自组织，全体高管参会，90分钟演讲+总裁晚宴","participants":"辉哥/梁在中/总裁彭松/各部门负责人","next_action":"各部门报场景后逐个拜访"}'

# 新增联系人
curl -X POST https://margarine-ferry-chatroom.ngrok-free.dev/api/accounts/6/contacts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mkt-octo-zhangyushao-202610" \
  -d '{"name":"梁在中","title":"总监事长/创始人之子","department":"董事会","role_level":"决策层","is_champion":1,"is_key_contact":1,"decision_level":"决策层","notes":"10/10后亲自牵头项目"}'

# 新增周报
curl -X POST https://margarine-ferry-chatroom.ngrok-free.dev/api/accounts/6/reports \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mkt-octo-zhangyushao-202610" \
  -d '{"report_period":"2026-W41","most_important":"辉哥10/10广州总部演讲成功，梁在中亲自牵头","key_work":"1. 10/10辉哥广州演讲，全体高管参会\n2. 梁在中升级为项目sponsor\n3. 各部门开始报AI场景","next_important":"逐个部门拜访，收集场景需求"}'
```

---

## v2 更新日志（2026-10-12）
1. ✅ **联系人完整CRUD**：新增wechat/is_key_contact/decision_level/relationship_status字段，支持单个联系人查询/更新/删除
2. ✅ **推进时间线（新）**：独立account_timeline表，支持记录每次会议/电话/微信等推进动态，含参会人、下一步行动等
3. ✅ **关键事件追加接口**：POST /key-events 可方便追加单条事件，不用手动操作JSON
4. ✅ **客户字段全开放**：POST/PUT支持所有字段包括health_tier/industry_group/demand_type/blocker_type/failure_mode/source_coverage等
5. ✅ **详情接口扩展**：GET /api/accounts/:id 现在返回timeline数据
6. ✅ **所有写操作审计**：自动记录谁改了什么
7. 🔒 外网地址更新为ngrok固定地址（loca.lt已废弃）
