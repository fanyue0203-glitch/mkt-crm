const Database = require('better-sqlite3');
const db = new Database(require('path').join(__dirname, '..', 'data', 'mkt-crm.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS sdr_weekly_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_label TEXT UNIQUE,
  week_start TEXT,
  week_end TEXT,
  inbound_total INTEGER DEFAULT 0,
  valid_total INTEGER DEFAULT 0,
  transferred_total INTEGER DEFAULT 0,
  following_total INTEGER DEFAULT 0,
  inbound_400 INTEGER DEFAULT 0,
  valid_400 INTEGER DEFAULT 0,
  transferred_400 INTEGER DEFAULT 0,
  inbound_wechat INTEGER DEFAULT 0,
  valid_wechat INTEGER DEFAULT 0,
  transferred_wechat INTEGER DEFAULT 0,
  inbound_octo INTEGER DEFAULT 0,
  valid_octo INTEGER DEFAULT 0,
  transferred_octo INTEGER DEFAULT 0,
  inbound_emp INTEGER DEFAULT 0,
  valid_emp INTEGER DEFAULT 0,
  transferred_emp INTEGER DEFAULT 0,
  grade_a_count INTEGER DEFAULT 0,
  pipeline_min INTEGER DEFAULT 0,
  pipeline_max INTEGER DEFAULT 0,
  key_clients TEXT DEFAULT '',
  octo_updates TEXT DEFAULT '',
  ai_native_updates TEXT DEFAULT '',
  next_week_focus TEXT DEFAULT '',
  full_text TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
`);

const stmt = db.prepare(`INSERT OR REPLACE INTO sdr_weekly_stats 
(week_label, week_start, week_end, inbound_total, valid_total, transferred_total, following_total,
 inbound_400, valid_400, transferred_400, inbound_wechat, valid_wechat, transferred_wechat,
 inbound_octo, valid_octo, transferred_octo, inbound_emp, valid_emp, transferred_emp,
 grade_a_count, pipeline_min, pipeline_max, key_clients, octo_updates, ai_native_updates, next_week_focus, full_text, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`);

const fullText = `## 本周周报（10/16-10/23）

### 一、线索数据
本周进线99条，转出16条。
- 渠道表现：官微/官网/公号56条（环比+19.1%）；400电话21条（环比-27.6%，转化率最高）；EMP及其他2条（环比-92.9%）；Octo体验4条。
- 产品分布：GEO 3条、知识图谱 3条、灵听工牌 2条、魔方Pro/Social 2条、广告监测 2条、消费者洞察 1条、爆米花 1条、DMP 1条、Octo智能体平台 1条。
- S/A级线索：A级5条，总管线231-632万。

### 二、Octo客户
- 发那科：线下沟通完成，已同步视频资料，待客户明确需求后移交佼佼
- 三一重工：本部龙瑶已移交佼佼跟进；研究院/三一重能待客户下一步动作移交

### 三、AI Native
- MKT-CRM线索转化模块可通过千寻编辑维护
- 线索分析链路：大圆提取会话做分析，WorkBuddy可进群分发，CRM录入目前用WorkBuddy（一条约400积分），豆包可免费替代但需人工复制
- 周报数据豆包可处理，按四板块整理发布

### 四、下周重点工作
1. 常规进线+存量线索沟通转化
2. 跟进发那科反馈移交佼佼，跟踪三一研究院/重能推进
3. 持续优化工作流程，尝试其他可能性
4. 推进姜哥腾讯生态大会演讲准备`;

stmt.run(
  '2026-10-16~10-22', '2026-10-16', '2026-10-22',
  99, 91, 16, 75,
  21, 13, 0,
  56, 56, 0,
  4, 4, 0,
  2, 2, 0,
  5, 231, 632,
  '锐捷网络(知识图谱/20-80万)/曙光信息(消费者洞察/20-60万)/百度(灵听工牌/20-50万)/北京时趣(广告监测/10-30万)/橡树黑卡(Octo平台/20-50万)',
  '发那科线下沟通完成待移交佼佼；三一重工本部龙瑶已移交佼佼，研究院/重能待移交',
  'MKT-CRM线索模块千寻可维护；线索分析链路大圆+WorkBuddy+豆包方案对比；周报豆包可处理',
  '1.常规+存量线索转化 2.发那科移交+三一跟踪 3.优化工作流程 4.姜哥腾讯生态大会演讲准备',
  fullText
);

const row = db.prepare('SELECT id, week_label, inbound_total, transferred_total, grade_a_count FROM sdr_weekly_stats WHERE week_label=?').get('2026-10-16~10-22');
console.log('Weekly report written to MKT-CRM:', JSON.stringify(row));
