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

  -- 客户周报/月报推进记录
  CREATE TABLE IF NOT EXISTS account_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    report_type TEXT DEFAULT 'weekly' CHECK(report_type IN ('weekly','monthly')),
    report_period TEXT DEFAULT '',
    most_important TEXT DEFAULT '',
    key_work TEXT DEFAULT '',
    need_decision TEXT DEFAULT '',
    cross_team_needs TEXT DEFAULT '',
    bottlenecks TEXT DEFAULT '',
    next_important TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    created_by TEXT DEFAULT ''
  );

  -- 客户联系人/组织架构
  CREATE TABLE IF NOT EXISTS account_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    title TEXT DEFAULT '',
    department TEXT DEFAULT '',
    role_level TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    is_champion INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
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

// ===== 示例报告 & 联系人数据（用 prepared statement 避免SQL转义问题） =====
const insertReport = db.prepare(`INSERT INTO account_reports (account_id, report_type, report_period, most_important, key_work, need_decision, cross_team_needs, bottlenecks, next_important) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertContact = db.prepare(`INSERT INTO account_contacts (account_id, name, title, department, role_level, phone, email, is_champion, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const insertSampleData = db.transaction(() => {
  // 宝洁 id=1: 周报W39
  insertReport.run(1, 'weekly', '2026-W39',
    '媒介力学广州场后与宝洁CMO办公室建立直接对接，确认4条产品线全面评估需求',
    '1. 媒介力学广州场宝洁到场27人，覆盖4个产品线\n2. 会后与品牌总监张雯完成1v1深度交流\n3. 输出CBP/AIGC/GEO/Social四份产品介绍材料\n4. 协调产品线团队准备定制化demo',
    '宝洁要求品鉴者层面确认是否可以开放CBP早期测试环境给宝洁做POC，涉及数据安全合规审批',
    '需要产品团队（CBP线+AIGC线）配合准备demo环境；需要售前团队输出方案书',
    'CBP早期测试环境的合规审批流程尚未启动，可能影响POC时间线',
    '完成宝洁POC方案书提交，争取10月第1周启动正式POC');
  // 宝洁 id=1: 周报W38
  insertReport.run(1, 'weekly', '2026-W38',
    '媒介力学广州场筹备，确认宝洁作为战略级客户重点邀约',
    '1. 完成宝洁华南总部4个BU的定向邀约\n2. 协调华南团队提供客户背景资料\n3. 准备宝洁专属产品矩阵介绍材料',
    '',
    '需要华南销售团队提供宝洁最新组织架构和决策链信息',
    '',
    '确保宝洁CMO办公室高层到场，安排会后1v1交流');
  // 宝洁 id=1: 月报9月
  insertReport.run(1, 'monthly', '2026-09',
    '9月成功将宝洁从活动触达推进到POC评估阶段，是Octo大客户模块的标杆突破',
    '1. 媒介力学广州场宝洁深度参与\n2. 建立CMO办公室直接沟通渠道\n3. 完成4条产品线需求梳理\n4. 启动CBP+AIGC组合方案设计\n5. 内部协调3条产品线资源',
    '需要确定宝洁项目的资源优先级——是否将宝洁列为Q4 TOP1战略客户，配置专属交付团队',
    '需要交付团队提前介入POC阶段；需要法务提前准备数据安全协议模板',
    '跨产品线资源协调机制不够顺畅，需要品鉴者层面明确主R',
    '10月完成POC签约，启动联合创新项目立项');
  // 嘉顿 id=2
  insertReport.run(2, 'weekly', '2026-W39',
    '嘉顿张经理确认本周约产品会议，DOMO+微伴组合方案初步对齐需求',
    '1. 与嘉顿市场部张经理完成电话沟通\n2. 确认核心需求：经销商管理+终端物料数字化\n3. 准备DOMO+企业微信集成demo',
    '嘉顿要求给出10万预算范围内的交付边界和时间线，需要确认标准产品包还是定制化',
    '需要微伴团队确认集成方案和商务模式',
    '',
    '本周产品demo会议，争取拿到确认函');
  // 莲藕健康 id=3
  insertReport.run(3, 'weekly', '2026-W39',
    '莲藕健康GEO优化需求明确，预期PPL 20万，等待客户内部预算审批',
    '1. 完成莲藕健康官网SEO现状诊断\n2. 输出GEO优化初步方案\n3. 与李总确认技术对接人',
    '',
    '需要GEO产品团队输出详细技术方案和报价',
    '客户Q3预算已锁定，需等到Q4预算释放（10月中旬）',
    '跟进Q4预算审批进度，提前准备合同');
  // 维他奶 id=4
  insertReport.run(4, 'weekly', '2026-W39',
    '维他奶AIGC内容生成需求初步沟通，客户对营销文案自动生成场景感兴趣',
    '1. 会后与王总交换微信\n2. 发送AIGC营销文案产品介绍\n3. 等待客户反馈具体使用场景',
    '',
    '快消行业AIGC内容合规标准需要确认，尤其是食品饮料行业的广告法约束',
    '客户尚未明确决策人和预算规模',
    '约第二次深度沟通，明确使用场景和预算');
  // 徕芬 id=5
  insertReport.run(5, 'weekly', '2026-W39',
    '徕芬DOMO+妙啊创意内容需求确认，但客户预算有限（约5万）',
    '1. 与刘经理电话沟通\n2. 确认需求集中在短视频脚本生成\n3. 探讨标准SaaS订阅模式',
    '',
    '',
    '客户预算偏低，需要评估是否值得投入售前资源',
    '发送标准报价单，看客户反馈再决定推进力度');
  // 分众 id=6
  insertReport.run(6, 'weekly', '2026-W39',
    '分众传媒对AdEff广告创意前测产品感兴趣，但属于同行/生态合作定位',
    '1. 与赵总交换联系方式\n2. 初步探讨AdEff在分众投放场景的应用可能\n3. 明确分众更可能是渠道合作伙伴而非直接客户',
    '需要品鉴者确认分众的合作定位——是客户还是渠道伙伴？这决定后续推进策略',
    '需要BD团队评估渠道合作可能性',
    '',
    '内部讨论后确定合作定位，再安排正式沟通');
  // 玛氏 id=7
  insertReport.run(7, 'weekly', '2026-W39',
    '玛氏箭牌CVB数据方案+AI数字人需求，陈经理表示需内部汇报后反馈',
    '1. 会后发送CVB产品资料\n2. 介绍AI数字人在快消终端场景的应用案例',
    '',
    '需要CVB团队提供快消行业案例',
    '客户尚未明确跟进时间，可能需要二次触达',
    '下周跟进客户反馈，争取安排产品介绍会');

  // 联系人：宝洁（3人）
  insertContact.run(1, '张雯', '品牌总监', '品牌管理部', '管理层', '138****1001', 'zhangwen@pg.com', 1, '媒介力学广州场到场，活动后主动约1v1，是内部最强champion');
  insertContact.run(1, '李明', 'CMO', 'CMO办公室', '决策层', '', '', 0, '宝洁华南区最高决策人，张雯汇报线，需通过张雯触达');
  insertContact.run(1, '王晓燕', '数字营销经理', '数字营销中心', '执行层', '139****1003', 'wangxy@pg.com', 0, '具体产品评估和技术对接人');
  // 嘉顿
  insertContact.run(2, '张经理', '市场部经理', '市场部', '管理层', '136****2001', '', 1, '活动现场主动留资，本周约产品会议');
  // 莲藕健康
  insertContact.run(3, '李总', '市场副总裁', '市场部', '决策层', '', 'li@lianou.com', 1, 'GEO优化需求明确，预算20万，等Q4预算释放');
  insertContact.run(3, '陈工', '技术负责人', '技术部', '执行层', '', '', 0, '后续技术对接人');
  // 维他奶
  insertContact.run(4, '王总', '品牌总监', '品牌部', '管理层', '', '', 0, 'AIGC内容生成场景感兴趣，待二次沟通');
  // 徕芬
  insertContact.run(5, '刘经理', '新媒体经理', '市场部', '执行层', '137****5001', '', 0, '短视频脚本生成需求，预算约5万');
  // 分众
  insertContact.run(6, '赵总', '产品总监', '产品部', '管理层', '', '', 0, '更可能是渠道合作而非直接客户，待确认定位');
  // 玛氏
  insertContact.run(7, '陈经理', '数字营销经理', '市场部', '执行层', '', '', 0, 'CVB+AI数字人需求，需内部汇报后反馈');
});
insertSampleData();

export default db;
