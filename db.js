import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, unlinkSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data', 'mkt-crm.db');
mkdirSync(join(__dirname, 'data'), { recursive: true });

// Fresh schema — delete old db if exists (no real data yet)
if (existsSync(dbPath)) { try { unlinkSync(dbPath); } catch(e) {} }

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===== Schema v2 — 对齐真实活动复盘报告数据结构 =====
db.exec(`
  -- 目标客户（核心表，ABM Account-Centric）
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    industry TEXT DEFAULT '',
    scale TEXT DEFAULT '',
    region TEXT DEFAULT '',
    source TEXT DEFAULT '',
    tier TEXT DEFAULT 'C' CHECK(tier IN ('S','A','B','C')),
    first_touch_date TEXT DEFAULT '',
    last_touch_date TEXT DEFAULT '',
    touch_count INTEGER DEFAULT 0,
    needs_summary TEXT DEFAULT '',
    estimated_budget TEXT DEFAULT '',
    octo_status TEXT DEFAULT '',
    assigned_to TEXT DEFAULT '',
    follow_up_status TEXT DEFAULT '待跟进',
    ai_suggestion TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    created_by TEXT DEFAULT ''
  );

  -- 活动（v2：完整复盘报告数据结构）
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    event_type TEXT DEFAULT '论坛' CHECK(event_type IN ('论坛','展会','参访','峰会','沙龙','发布会','路演','其他')),
    date TEXT DEFAULT '',
    end_date TEXT DEFAULT '',
    location TEXT DEFAULT '',
    scale INTEGER DEFAULT 0,
    budget TEXT DEFAULT '',
    status TEXT DEFAULT '筹备中' CHECK(status IN ('筹备中','进行中','已结束','已取消')),
    theme TEXT DEFAULT '',
    target_audience TEXT DEFAULT '',

    -- 业务设计（独有输入项）
    business_design TEXT DEFAULT '',
    story_lines TEXT DEFAULT '[]',
    agenda TEXT DEFAULT '[]',
    product_solutions TEXT DEFAULT '',
    target_market TEXT DEFAULT '',
    joint_division TEXT DEFAULT '',

    -- 组织信息
    host TEXT DEFAULT '',
    organizer TEXT DEFAULT '',
    partners TEXT DEFAULT '[]',
    speakers TEXT DEFAULT '[]',

    -- 核心数据速览（真实报告命脉）
    registration_count INTEGER DEFAULT 0,
    attendance_count INTEGER DEFAULT 0,
    attendance_rate REAL DEFAULT 0,
    vip_count INTEGER DEFAULT 0,
    vip_attendance_rate REAL DEFAULT 0,
    booth_visitors INTEGER DEFAULT 0,
    wechat_followers_new INTEGER DEFAULT 0,

    -- 多维度分析（JSON数组：[{name, count, pct}]）
    industry_distribution TEXT DEFAULT '[]',
    job_level_distribution TEXT DEFAULT '[]',
    dept_distribution TEXT DEFAULT '[]',
    channel_sources TEXT DEFAULT '[]',

    -- 签到分析（对比报名）
    checkin_industry_distribution TEXT DEFAULT '[]',
    checkin_job_level_distribution TEXT DEFAULT '[]',
    checkin_dept_distribution TEXT DEFAULT '[]',

    -- 线索漏斗
    leads_count INTEGER DEFAULT 0,
    mql_count INTEGER DEFAULT 0,
    sql_count INTEGER DEFAULT 0,
    opportunity_count INTEGER DEFAULT 0,
    estimated_ppl TEXT DEFAULT '',
    roi TEXT DEFAULT '',

    -- 信号分析
    product_signals TEXT DEFAULT '[]',
    industry_signals TEXT DEFAULT '[]',
    region_highlights TEXT DEFAULT '',

    -- 重点商机（JSON数组：[{level, company, industry, product_need, ppl, notes}]）
    key_opportunities TEXT DEFAULT '[]',

    -- 现场反馈
    customer_feedback TEXT DEFAULT '',
    investor_feedback TEXT DEFAULT '',
    media_feedback TEXT DEFAULT '',

    -- 复盘
    feedback_summary TEXT DEFAULT '',
    lessons_learned TEXT DEFAULT '',
    structural_insights TEXT DEFAULT '',
    action_items TEXT DEFAULT '[]',
    long_tail_content TEXT DEFAULT '',

    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    created_by TEXT DEFAULT ''
  );

  -- 活动-客户关联
  CREATE TABLE IF NOT EXISTS event_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_name TEXT DEFAULT '',
    contact_title TEXT DEFAULT '',
    attendance_status TEXT DEFAULT '已邀请',
    response_level TEXT DEFAULT '',
    feedback TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(event_id, account_id)
  );

  -- 辉哥演讲
  CREATE TABLE IF NOT EXISTS speeches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT DEFAULT '',
    location TEXT DEFAULT '',
    event_name TEXT DEFAULT '',
    topic TEXT NOT NULL,
    speech_type TEXT DEFAULT '主题演讲',
    audience_count INTEGER DEFAULT 0,
    audience_profile TEXT DEFAULT '',
    story_line TEXT DEFAULT '',
    key_messages TEXT DEFAULT '[]',
    business_design TEXT DEFAULT '',
    leads_count INTEGER DEFAULT 0,
    industry_distribution TEXT DEFAULT '[]',
    feedback TEXT DEFAULT '',
    follow_up_plan TEXT DEFAULT '',
    content_assets TEXT DEFAULT '[]',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    created_by TEXT DEFAULT ''
  );

  -- 演讲-客户触达
  CREATE TABLE IF NOT EXISTS speech_touches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    speech_id INTEGER NOT NULL REFERENCES speeches(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_name TEXT DEFAULT '',
    contact_title TEXT DEFAULT '',
    response_level TEXT DEFAULT '温' CHECK(response_level IN ('热','温','冷')),
    follow_up_status TEXT DEFAULT '待跟进',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(speech_id, account_id)
  );

  -- SDR线索（漏斗数据）—— 字段对齐千寻SDR字段表
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    contact_title TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    source_channel TEXT DEFAULT '',
    source_detail TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    product TEXT DEFAULT '',
    industry TEXT DEFAULT '',
    team TEXT DEFAULT '',
    assigned_to TEXT DEFAULT '',
    inbound_date TEXT DEFAULT '',
    transfer_date TEXT DEFAULT '',
    opportunity_id TEXT DEFAULT '',
    opportunity_stage TEXT DEFAULT '',
    deal_amount REAL DEFAULT 0,
    lost_reason TEXT DEFAULT '',
    requirement TEXT DEFAULT '',
    account_id INTEGER DEFAULT NULL REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    created_by TEXT DEFAULT ''
  );

  -- 编辑历史
  CREATE TABLE IF NOT EXISTS edit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT DEFAULT '',
    new_value TEXT DEFAULT '',
    edited_by TEXT DEFAULT '',
    edited_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 数据导入记录
  CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    target_table TEXT NOT NULL,
    total_rows INTEGER DEFAULT 0,
    success_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    errors TEXT DEFAULT '[]',
    imported_by TEXT DEFAULT '',
    imported_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// ===== 插入示例数据（基于真实复盘报告） =====
db.exec(`
  INSERT INTO events (name, event_type, date, end_date, location, status, theme, scale,
    registration_count, attendance_count, attendance_rate, vip_count, vip_attendance_rate,
    leads_count, mql_count, sql_count, estimated_ppl,
    industry_distribution, job_level_distribution, dept_distribution, channel_sources,
    product_signals, industry_signals, region_highlights,
    key_opportunities, customer_feedback, feedback_summary, structural_insights,
    business_design, host, target_audience)
  VALUES (
    '第七届媒介力学论坛·广州场', '论坛', '2026-09-03', '2026-09-03', '广州', '已结束',
    'AI驱动营销变革', 259,
    259, 146, 56.4, 19, 100.0,
    48, 10, 1, '45万',
    '[{"name":"服务代理商","count":54,"pct":20.8},{"name":"互联网与技术","count":48,"pct":18.5},{"name":"快消-个人护理","count":32,"pct":12.4},{"name":"制药和医疗保健","count":24,"pct":9.3},{"name":"快消-食饮","count":22,"pct":8.5},{"name":"快消-美妆日化","count":14,"pct":5.4},{"name":"汽车","count":9,"pct":3.5},{"name":"零售","count":8,"pct":3.1},{"name":"消费电子","count":7,"pct":2.7}]',
    '[{"name":"经理/主管级","count":83,"pct":32.0},{"name":"总监级","count":47,"pct":18.1},{"name":"C-Suite/VP/总经理","count":30,"pct":11.6},{"name":"专员/执行级","count":24,"pct":9.3},{"name":"其他","count":75,"pct":29.0}]',
    '[{"name":"市场/品牌/公关","count":84,"pct":32.4},{"name":"产品/技术/运营","count":29,"pct":11.2},{"name":"销售/商务","count":26,"pct":10.0},{"name":"采购/资源","count":25,"pct":9.7},{"name":"管理层","count":11,"pct":4.2}]',
    '[{"name":"市场部","count":136},{"name":"华南","count":59},{"name":"宝洁","count":27},{"name":"营销生态","count":15}]',
    '[{"name":"AIGC相关","count":4,"note":"最热产品方向"},{"name":"GEO优化","count":2,"note":"新兴增长点"},{"name":"DOMO","count":2},{"name":"AdEff","count":2},{"name":"CBP/CDP","count":1},{"name":"Social运营","count":1}]',
    '[{"name":"快消","count":8,"pct":62,"note":"绝对主力行业"},{"name":"医药","count":1},{"name":"媒体","count":1},{"name":"旅游","count":1}]',
    '广州场医药行业参会24人（9.3%），华南医药产业集聚效应显著。宝洁华南总部效应：渠道码报名27人+4条线索覆盖4个产品线。快消行业合计68人占报名总量26.3%',
    '[{"level":"商机","company":"嘉顿食品","industry":"饮料","need":"DOMO+微伴","ppl":"10万","notes":"本周约产品会议"},{"level":"高潜","company":"莲藕健康","industry":"医药","need":"GEO优化","ppl":"20万"},{"level":"高潜","company":"维他奶","industry":"快消","need":"AIGC","ppl":"10万"},{"level":"战略","company":"宝洁","industry":"快消","need":"CBP/AIGC/GEO/Social","notes":"4条线索，全面评估产品矩阵"},{"level":"关注","company":"徕芬","industry":"日护","need":"DOMO+妙啊","ppl":"5万"},{"level":"关注","company":"分众传媒","industry":"媒体","need":"AdEff"}]',
    '品牌客户190人占73.4%，服务代理商54人占20.8%。参会者以经理/主管级和总监级为主力，市场/品牌/公关部门占比最高，决策层合计占29.7%',
    '品牌方到场意愿显著高于代理商。签到品牌客户占79.4%，总监及以上决策层占26.8%。AIGC是线索中出现频率最高的产品方向（31%），与报名需求热点高度吻合',
    '快消行业全线覆盖（68人报名+8条线索），AIGC和GEO是核心需求。医药赛道潜力初显（24人+1条GEO线索），宝洁深度合作窗口打开',
    '面对CMO/VP/市场总监为主的品牌客户群，讲AI驱动营销变革的故事。品牌客户占73.4%，是核心TA',
    '明略科技', 'CMO/VP Marketing，互联网+快消+医药+汽车'
  );

  INSERT INTO events (name, event_type, date, end_date, location, status, theme, scale,
    registration_count, attendance_count, booth_visitors, wechat_followers_new,
    leads_count, sql_count,
    customer_feedback, investor_feedback,
    business_design, product_solutions, target_market,
    feedback_summary, structural_insights, action_items, host, partners)
  VALUES (
    '2026世界机器人大会(WRC)', '展会', '2026-08-19', '2026-08-23', '北京', '已结束',
    '明略×海康联合参展 · Agent+具身智能', 557000,
    0, 0, 5000, 523,
    552, 3,
    '到访展位客户问最多的是两家公司的关系以及明略主业务：明略和海康是什么关系？明略以前不是营销/数据么？明略是以后要发展具身了么？大模型和世界模型有什么区别？明略做什么的？有家用场景吗？落地哪些场景？机器人多少钱？——本质是同一个问题：明略是谁，在这里干嘛',
    '投资人肯定了联合展位规模和具身智能方向。疑问集中在：1）明略和海康机器人的合作具体是哪个部分？边界在哪？2）机器人会不会成为明略未来核心业务方向？这是一次campaign还是战略主线？——直击战略意图，需要书面口径主动跟进',
    '软件与模型归明略，硬件本体归海康——让机器人像agent一样参与协作。VLM/VLA多模态感知+智能推理+多智能体协同，联合MY的线下门店智能运营方案',
    'VLM/VLA多模态感知+智能推理规划+多智能体协同；MY线下门店智能运营（餐饮零售连锁）；海康AGV硬件本体',
    '策划预期是工业+餐饮TOB国内，实际来访以海外客户为主（韩国+欧洲+中东）。结构性错位：设计国内TOB来的是海外客户',
    '5000接待证明联合参展的流量价值，但5000人中多少关注明略本体能力vs冲着海康来的，没有数据。552留资→3个SDR，转化率约0.5%。这3个SDR是谁、什么场景触发兴趣、代表哪类TA特征，比转化率数字本身更有价值',
    '暴露最大结构性问题：品牌认知模糊。7类客户问题本质是同一个——明略是谁在这干嘛。联合参展带来流量和背书，也带来品牌边界模糊。不能靠优化话术解决，要从策划逻辑层解决',
    '[{"action":"品牌话术修复","owner":"PR+市场","deadline":"最紧急","detail":"产出3秒/30秒/3分钟版明略AI定位话术"},{"action":"投资人书面口径","owner":"樊信","deadline":"展后一周","detail":"合作边界和战略定位标准表述"},{"action":"素材二次分发+技术社区内容","owner":"王文婧","deadline":"展后两周","detail":"6篇+问答运营"},{"action":"评估明年是否继续参展","owner":"亚琪/Elva","deadline":"Q4规划前"},{"action":"Checklist固化","owner":"武永春","deadline":"展后两周","detail":"物料备量/讲解员培训SOP/leads登记流程"}]',
    '明略科技×海康机器人',
    '["海康机器人"]'
  );

  INSERT INTO accounts (company_name, industry, tier, source, region, needs_summary, touch_count, first_touch_date) VALUES
    ('宝洁', '快消', 'S', 'event', '华南', 'CBP/AIGC/GEO/Social运营，4条产品线需求', 3, '2026-09-03'),
    ('嘉顿食品', '饮料', 'A', 'event', '华南', 'DOMO+微伴', 1, '2026-09-03'),
    ('莲藕健康', '医药', 'A', 'event', '华南', 'GEO优化，预期PPL 20万', 1, '2026-09-03'),
    ('维他奶', '快消', 'B', 'event', '华南', 'AIGC', 1, '2026-09-03'),
    ('徕芬', '日护', 'B', 'event', '华南', 'DOMO+妙啊', 1, '2026-09-03'),
    ('分众传媒', '媒体', 'B', 'event', '华南', 'AdEff广告创意前测', 1, '2026-09-03'),
    ('玛氏箭牌', '快消', 'B', 'event', '华南', 'CVB数据方案+AI数字人', 1, '2026-09-03');

  INSERT INTO speeches (date, location, event_name, topic, speech_type, audience_count, leads_count,
    business_design, story_line, audience_profile, follow_up_plan) VALUES
    ('2026-08-20', '北京·WRC主论坛', '2026世界机器人大会', 'Agent协同网络：两个大脑×HAO×L1-L5具身演化',
     '主论坛演讲', 3000, 0,
     '面向机器人+AI行业决策者，讲明略在具身智能的技术叙事（两个大脑/HAO/CoALA记忆/L1-L5）',
     '从Octo到具身智能的叙事延伸：Agent网络连接物理世界',
     '机器人行业从业者+投资人+媒体+政府官员',
     '技术社区内容二次分发（6篇+问答运营），把演讲观点转译成技术社区语言');

  INSERT INTO leads (company_name, contact_name, source_channel, source_detail, status, product, industry, inbound_date, requirement) VALUES
    ('嘉顿食品', '张经理', '下午茶活动', '媒介力学·广州场', 'qualified', 'DOMO', '饮料', '2026-09-03', '本周约产品会议，DOMO+微伴，预期PPL 10万'),
    ('莲藕健康', '李总', '下午茶活动', '媒介力学·广州场', 'contacted', 'GEO', '医药大健康', '2026-09-03', 'GEO优化，预期PPL 20万'),
    ('维他奶', '王总', '下午茶活动', '媒介力学·广州场', 'contacted', 'AIGC', '食品饮料', '2026-09-03', 'AIGC需求，预期PPL 10万'),
    ('徕芬', '刘经理', '下午茶活动', '媒介力学·广州场', 'new', 'DOMO', '美妆个护', '2026-09-03', 'DOMO+妙啊，预期PPL 5万'),
    ('分众传媒', '赵总', '下午茶活动', '媒介力学·广州场', 'new', 'AdEff', '互联网', '2026-09-03', 'AdEff广告创意前测'),
    ('玛氏箭牌', '陈经理', '下午茶活动', '媒介力学·广州场', 'new', 'CVB', '食品饮料', '2026-09-03', 'CVB数据方案+AI数字人');
`);

export default db;
