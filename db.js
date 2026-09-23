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

// ===== Schema =====
db.exec(`
  -- Octo大客户（核心表，扩展完整复盘字段）
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    industry TEXT DEFAULT '',
    scale TEXT DEFAULT '',
    region TEXT DEFAULT '',
    source TEXT DEFAULT '',
    tier TEXT DEFAULT 'C' CHECK(tier IN ('S','A','B','C','D')),
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
    created_by TEXT DEFAULT '',
    -- ===== 大客户复盘扩展字段 =====
    customer_stage TEXT DEFAULT '',
    deal_amount REAL DEFAULT 0,
    deal_stage TEXT DEFAULT '',
    lead_source TEXT DEFAULT '',
    key_contacts_count INTEGER DEFAULT 0,
    key_departments TEXT DEFAULT '',
    competitors TEXT DEFAULT '',
    customer_recognition TEXT DEFAULT '',
    deployment_type TEXT DEFAULT '',
    product_solutions_detail TEXT DEFAULT '',
    core_painpoint TEXT DEFAULT '',
    blockers TEXT DEFAULT '',
    next_step TEXT DEFAULT '',
    next_deadline TEXT DEFAULT '',
    key_events TEXT DEFAULT '[]',
    ceo_involvement INTEGER DEFAULT 0,
    ecosystem_lock TEXT DEFAULT '',
    lessons_learned TEXT DEFAULT ''
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
    business_design TEXT DEFAULT '',
    story_lines TEXT DEFAULT '[]',
    agenda TEXT DEFAULT '[]',
    product_solutions TEXT DEFAULT '',
    target_market TEXT DEFAULT '',
    joint_division TEXT DEFAULT '',
    host TEXT DEFAULT '',
    organizer TEXT DEFAULT '',
    partners TEXT DEFAULT '[]',
    speakers TEXT DEFAULT '[]',
    registration_count INTEGER DEFAULT 0,
    attendance_count INTEGER DEFAULT 0,
    attendance_rate REAL DEFAULT 0,
    vip_count INTEGER DEFAULT 0,
    vip_attendance_rate REAL DEFAULT 0,
    booth_visitors INTEGER DEFAULT 0,
    wechat_followers_new INTEGER DEFAULT 0,
    industry_distribution TEXT DEFAULT '[]',
    job_level_distribution TEXT DEFAULT '[]',
    dept_distribution TEXT DEFAULT '[]',
    channel_sources TEXT DEFAULT '[]',
    checkin_industry_distribution TEXT DEFAULT '[]',
    checkin_job_level_distribution TEXT DEFAULT '[]',
    checkin_dept_distribution TEXT DEFAULT '[]',
    leads_count INTEGER DEFAULT 0,
    mql_count INTEGER DEFAULT 0,
    sql_count INTEGER DEFAULT 0,
    opportunity_count INTEGER DEFAULT 0,
    estimated_ppl TEXT DEFAULT '',
    roi TEXT DEFAULT '',
    product_signals TEXT DEFAULT '[]',
    industry_signals TEXT DEFAULT '[]',
    region_highlights TEXT DEFAULT '',
    key_opportunities TEXT DEFAULT '[]',
    customer_feedback TEXT DEFAULT '',
    investor_feedback TEXT DEFAULT '',
    media_feedback TEXT DEFAULT '',
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

// ===== 插入示例数据 =====
db.exec(`
  -- Events
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
    '到访展位客户问最多的是两家公司的关系以及明略主业务',
    '投资人肯定了联合展位规模和具身智能方向',
    '软件与模型归明略，硬件本体归海康——让机器人像agent一样参与协作',
    'VLM/VLA多模态感知+智能推理规划+多智能体协同；MY线下门店智能运营；海康AGV硬件本体',
    '策划预期是工业+餐饮TOB国内，实际来访以海外客户为主',
    '5000接待证明联合参展的流量价值',
    '暴露最大结构性问题：品牌认知模糊',
    '[{"action":"品牌话术修复","owner":"PR+市场","deadline":"最紧急","detail":"产出3秒/30秒/3分钟版明略AI定位话术"}]',
    '明略科技×海康机器人',
    '["海康机器人"]'
  );

  -- ===== Octo大客户（真实大客户数据） =====
  -- 1. 卓正医疗：已签约/交付，S级
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '卓正医疗', '医疗健康', '中型连锁', '华南', 'Octo直客', 'S',
    '2026-06-01', '2026-09-20', 12, '医疗私有化AI平台，诊疗+运营双场景',
    'Amy(张晓)', '交付中', '已签约回款，培训阶段',
    '已签约', 700, '500万已回款+200万后续增购', '姜平"必须发生"项目，医疗可复制标杆',
    3, 'IT+医务+运营', '', '认可Octo AI原生平台架构，医疗场景适配能力强',
    '私有化', '诊疗知识问答+运营效率提升+患者服务Agent',
    '医疗行业AI落地缺乏成熟方案，传统HIS系统智能化程度低',
    '', '完成全员培训，推动标杆案例输出', '2026-10-15', 1, '无强锁定',
    '[{"date":"2026-06-01","event":"首次接触","note":"姜平定调必须发生的战略客户"},{"date":"2026-07-15","event":"签约","note":"500万合同签署"},{"date":"2026-08-20","event":"私有化部署完成","note":"系统上线"},{"date":"2026-09-10","event":"回款完成","note":"首期回款到账"},{"date":"2026-09-20","event":"培训阶段","note":"进入全员使用培训"}]',
    '医疗行业标杆客户，姜平亲自推动"必须发生"，私有化已完成部署回款，后续200万增购预期。医疗行业可复制标杆案例。'
  );

  -- 2. 南孚电池：已签约/交付，A级
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '南孚电池', '快消/电池', '大型企业', '福建', 'CEO直通', 'A',
    '2026-07-01', '2026-09-14', 8, '全场景AI Agent平台，10场景含AtoA标杆',
    '常晓飞/威少', '交付中', '9/14部署中',
    '交付中', 20, '20万(两年期合同)，部署进行中', 'CEO+CMO辉哥直通，前宝洁系管理团队，愿景统一替代钉飞企微',
    4, '市场+IT+运营+销售', '腾讯Hermes', '认可Octo AI原生定位，愿景统一：替代钉钉/飞书/企微成为AI时代工作平台',
    '私有化', '10大场景AI Agent部署，含AtoA(Agent-to-Agent)标杆石墨烯研发案例',
    '传统办公协同工具无法满足AI时代Agent协作需求，研发效率提升有强诉求',
    '', '完成10场景部署上线，推动石墨烯AtoA案例标杆输出', '2026-10-31', 1, '目标替代钉飞企微，当前无强锁定',
    '[{"date":"2026-07-01","event":"CEO直通接触","note":"辉哥与南孚CEO直接对接，前宝洁系背景"},{"date":"2026-08-01","event":"签约","note":"20万两年期合同"},{"date":"2026-09-14","event":"部署启动","note":"私有化部署进行中"}]',
    'CEO+CMO辉哥直通客户，前宝洁系管理团队。愿景高度统一：用Octo替代钉钉/飞书/企微，成为AI原生工作平台。10场景部署含AtoA标杆(石墨烯研发案例)，竞品腾讯Hermes。'
  );

  -- 3. HKIC：POC中，B级
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    'HKIC香港会计', '专业服务/会计', '中型', '香港', '香港渠道', 'B',
    '2026-08-15', '2026-09-18', 5, '香港会计行业AI审计/税务助手',
    'Amy/梦林', 'POC中', '9/18现场安装POC',
    'POC中', 5, '5万港币POC阶段', '香港渠道引荐',
    2, 'IT+审计', '', '认可Octo多语言能力和行业适配潜力',
    '私有化(云主机)', '审计底稿AI辅助+税务咨询Agent+报告自动生成',
    '香港会计行业合规要求高，传统审计流程效率低',
    '1.Token用量显示缺失，客户无法预估费用；2.云主机2000元/月费用有异议', '解决Token显示问题+给出云主机费用优化方案', '2026-09-30', 0, '香港合规环境，无强生态锁定',
    '[{"date":"2026-08-15","event":"首次接触","note":"香港渠道引荐"},{"date":"2026-09-10","event":"POC确认","note":"5万港币POC合同"},{"date":"2026-09-18","event":"现场安装","note":"现场安装POC，发现Token显示和费用问题"}]',
    '香港会计行业客户，9/18现场安装POC。卡点：Token用量显示功能缺失导致客户无法预估费用，云主机2000元/月费用客户有异议。需尽快解决后推进转付费。'
  );

  -- 4. 宇通客车：投标中，A级
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '宇通客车', '制造/汽车', '大型(8.5万人)', '河南郑州', '官网进线→招标翻转', 'A',
    '2026-05-09', '2026-09-18', 20, '全员AI平台，11月需量化提效',
    'Amy主跟/玉平BD/威少方案', '投标中', '9/18郑州述标完成，9/25前出结果',
    '投标中', 600, '一期≤200万，二三期各200万，总计600万+。9/18述标完成，纯技术打分，等9/25结果', '贾祥轩5/9官网主动联系，9/10招标翻转(营销线C类→IT线CIO景宏源招标)',
    16, '10条线：IT/营销/研发/HR/制造/供应链/财务/法务/售后/质量', '酷开/浙江实在/联想/腾讯WorkBuddy/阿里QoderWork', '客户明确认可Octo是AI原生平台(非AI增强工具)，这是核心差异化',
    '私有化', '全员AI工作平台，覆盖营销/研发/HR/制造/售后等场景，11月需量化提效数据',
    '传统IT系统智能化不足，8.5万人组织效率提升诉求强，11月需有量化提效数据交付',
    '等9/25招标结果，竞争激烈(5家竞品)', '等待9/25招标结果，如中标即刻启动交付团队组建', '2026-09-25', 1, '飞书/钉钉均有接触，但最终走CIO招标流程',
    '[{"date":"2026-05-09","event":"贾祥轩官网主动联系","note":"营销线C类线索进线"},{"date":"2026-09-10","event":"招标翻转","note":"营销线C类→IT线CIO景宏源招标，从被动进线变主动投标"},{"date":"2026-09-18","event":"郑州述标完成","note":"纯技术打分，9/25前出结果。姜平定调亏本也拿"}]',
    '🔥 核心战略客户。从5/9贾祥轩官网C类线索→9/10招标翻转(营销线→IT线CIO景宏源)，16+联系人覆盖10条线。9/18郑州述标完成等结果。竞品5家(酷开/浙江实在/联想/腾讯WorkBuddy/阿里QoderWork)，客户认可Octo AI原生定位。姜平定调"亏本也拿"。11月需量化提效。'
  );

  -- 5. 吉利汽车：重点推进，B级
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '吉利汽车', '制造/汽车', '超大型(8.5万人)', '浙江杭州', '辉哥CEO分享', 'B',
    '2026-06-01', '2026-09-20', 25, '4场景+元动力平台，9月底POC结项',
    '刘静统筹/CC对接/威少方案/徐浩日会/常晓飞部署', '重点推进', '9月底POC结项，飞书私有化融入工作台',
    '重点推进', 390, '390万/908人天报价。客户已选定飞书私有化，Octo融入飞书工作台。9月底POC结项', '辉哥7/18给CEO团队分享后正式启动',
    8, '3DM(刘昊CDO/乔帅AI运营部长/陈勇AIC)+营销+HR+研发', '飞书AI(已选定飞书私有化)', '刘昊(CDO)自写《OCTO产品第一性原理》，深度认可产品理念',
    '私有化(融入飞书工作台)', '4场景：营销内容生成+HR智能助手+周例会Loop+AI Coding；元动力平台~1500高管覆盖至2027.9',
    '8.5万人/9军团/数字化预算40亿，组织效率提升和数字化转型强诉求',
    '客户已选定飞书私有化，Octo需融入飞书工作台，产品集成有工作量', '9月底POC结项，推动正式合同签署；完成飞书集成方案', '2026-09-30', 1, '已选定飞书私有化，Octo融入飞书工作台（生态锁定既是挑战也是机会）',
    '[{"date":"2026-06-01","event":"首次接触","note":"吉利数字化转型需求初步沟通"},{"date":"2026-07-18","event":"辉哥CEO团队分享","note":"辉哥给吉利CEO团队做AI分享，启动正式合作"},{"date":"2026-08-01","event":"POC启动","note":"4场景POC启动，徐浩驻场日会"},{"date":"2026-09-20","event":"POC接近结项","note":"9月底POC结项，390万/908人天报价已提交"}]',
    '🔥超大型客户，8.5万人/9军团/数字化预算40亿。3DM铁三角(刘昊CDO/乔帅AI运营部长/陈勇AIC)。辉哥7/18 CEO团队分享后启动，刘昊自写《OCTO产品第一性原理》深度认可。4场景+元动力平台~1500高管。已选飞书私有化，Octo融入工作台，9月底POC结项。徐浩驻场日会推进。'
  );

  -- 6. 三一重工：重点推进，B级
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '三一重工', '制造/重工', '大型(5万人)', '湖南长沙/广州', '吉利案例引荐', 'B',
    '2026-08-26', '2026-09-17', 6, '端到端AI协同平台，AGV省力不省人问题解决',
    '玉平BD/刘静策略/徐浩HR/辉哥10月主讲', '重点推进', '9/17梁在中升级，10月辉哥广州分享',
    '重点推进', 0, '待报价。9/17创始人之子梁在中亲自牵头升级，10月第一周辉哥广州几百人分享', '龙瑶(SSC部长)通过吉利案例引荐，8/26深度交流5.5h',
    5, 'HR(SSC)+IT+制造+运营+战略', '腾讯Hermes+Dify(已部署700+老系统)', '认可Octo从点状AI到端到端协同的理念',
    '待定', 'HR数字化+制造端到端协同+AGV场景AI升级',
    '现有700+老系统+Hermes+Dify已部署，AGV场景省力不省人，核心痛点是从点状AI到端到端协同的跨越',
    '客户已有大量系统(Hermes/Dify)，替换或共存策略需明确', '10月第一周辉哥广州几百人峰会主讲，做好会前高层对接；输出端到端方案', '2026-10-07', 1, '已有Hermes+Dify部署，700+老系统，生态复杂',
    '[{"date":"2026-08-26","event":"龙瑶引荐深度交流","note":"吉利案例引荐，深度交流5.5h"},{"date":"2026-09-17","event":"梁在中升级","note":"创始人之子梁在中亲自牵头，项目升级🔥"},{"date":"2026-10-01","event":"辉哥广州分享(计划)","note":"10月第一周广州几百人峰会辉哥主讲"}]',
    '🔥 9/17重大升级：创始人之子梁在中亲自牵头。5万人规模，龙瑶(SSC部长)通过吉利案例引荐8/26深度交流5.5h。现有700+老系统+Hermes+Dify，核心痛点AGV省力不省人→从点状到端到端。辉哥10月广州几百人峰会主讲是关键节点。'
  );

  -- 7. 墨迹天气：重点推进，B级
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '墨迹天气', '互联网/SaaS', '中型', '北京', '创始人招标', 'B',
    '2026-08-01', '2026-09-20', 10, 'AI Coding全流程，5大需求，POC接近完成',
    '贾彤前期/威少方案/朱翾蒙销售', '重点推进', 'POC接近完成，付费意愿强',
    '重点推进', 100, '~100万预估。POC接近完成，付费意愿强，等正式商务流程', '金犁(创始人)亲自发起AI Coding招标',
    3, '研发+产品+IT', '阿里MuleRun/埃森哲', '认可Octo多智能体协同和最佳实践沉淀能力',
    'SaaS/混合', 'AI Coding 5大场景：需求自动生成+方案自动生成+用例自动生成+打通GitLab+多智能体协同+最佳实践沉淀+提效量化',
    '研发效能提升，从需求到代码全流程AI化，打通GitLab实现闭环',
    '', 'POC结项后推进正式合同签署，给出商务报价', '2026-10-15', 1, '无强生态锁定',
    '[{"date":"2026-08-01","event":"金犁发起招标","note":"创始人亲自发起AI Coding招标"},{"date":"2026-09-01","event":"POC启动","note":"5大需求场景POC"},{"date":"2026-09-20","event":"POC接近完成","note":"付费意愿强，竞品阿里MuleRun/埃森哲"}]',
    '金犁(创始人)发起AI Coding招标，5大需求(需求/方案/用例自动生成+GitLab+多智能体+最佳实践+提效量化)。POC接近完成付费意愿强，竞品阿里MuleRun/埃森哲。预估~100万。'
  );

  -- 8. 希慎Hysan：战败，D级
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, lessons_learned, notes) VALUES (
    'Hysan希慎', '香港/地产', '中型', '香港', '香港渠道', 'D',
    '2026-08-01', '2026-09-10', 4, '香港地产AI办公平台',
    'Amy', '已战败', '法务三大卡点导致战败',
    '战败', 0, '法务三大卡点无法短期解决，项目战败', '香港渠道引荐',
    2, 'IT+法务', '', '产品认可但合规门槛无法逾越',
    '', '', '香港地产行业数字化转型需求',
    '法务三大卡点：1.SOC2/ISO27001资质缺失；2.Token费用不封顶客户无法接受；3.专业责任险(Professional Indemnity Insurance)明略无法提供',
    '', '', 0, '香港合规环境',
    '[{"date":"2026-08-01","event":"首次接触","note":"香港渠道引荐，地产行业需求"},{"date":"2026-09-01","event":"法务审核","note":"三大卡点浮现"},{"date":"2026-09-10","event":"战败确认","note":"法务卡点无法短期解决，客户放弃"}]',
    '香港合规门槛极高：1.SOC2/ISO27001等国际安全资质是香港客户硬性门槛，需提前布局认证；2.Token费用不封顶模式在香港企业客户接受度低，需设计封顶/套餐模式；3.专业责任险(PII)是香港商业合作标配，国内SaaS公司普遍缺失。香港市场需前置解决合规三要素才适合推进。',
    '香港地产客户战败案例。法务三大卡点(SOC2/ISO27001资质/Token费用不封顶/专业责任险)无法短期解决。教训：香港市场合规门槛极高，需前置解决安全资质+费用模式+保险三大要素。'
  );

  -- ===== MKT活动线索（保留在leads表，accounts表不放MKT活动客户） =====
  -- MKT活动客户只在leads/key_opportunities体现，不入Octo大客户accounts表

  -- Speeches
  INSERT INTO speeches (date, location, event_name, topic, speech_type, audience_count, leads_count,
    business_design, story_line, audience_profile, follow_up_plan) VALUES
    ('2026-08-20', '北京·WRC主论坛', '2026世界机器人大会', 'Agent协同网络：两个大脑×HAO×L1-L5具身演化',
     '主论坛演讲', 3000, 0,
     '面向机器人+AI行业决策者，讲明略在具身智能的技术叙事',
     '从Octo到具身智能的叙事延伸：Agent网络连接物理世界',
     '机器人行业从业者+投资人+媒体+政府官员',
     '技术社区内容二次分发');

  -- Leads（MKT活动线索保留不变）
  INSERT INTO leads (company_name, contact_name, source_channel, source_detail, status, product, industry, inbound_date, requirement) VALUES
    ('嘉顿食品', '张经理', '下午茶活动', '媒介力学·广州场', 'qualified', 'DOMO', '饮料', '2026-09-03', '本周约产品会议，DOMO+微伴，预期PPL 10万'),
    ('莲藕健康', '李总', '下午茶活动', '媒介力学·广州场', 'contacted', 'GEO', '医药大健康', '2026-09-03', 'GEO优化，预期PPL 20万'),
    ('维他奶', '王总', '下午茶活动', '媒介力学·广州场', 'contacted', 'AIGC', '食品饮料', '2026-09-03', 'AIGC需求，预期PPL 10万'),
    ('徕芬', '刘经理', '下午茶活动', '媒介力学·广州场', 'new', 'DOMO', '美妆个护', '2026-09-03', 'DOMO+妙啊，预期PPL 5万'),
    ('分众传媒', '赵总', '下午茶活动', '媒介力学·广州场', 'new', 'AdEff', '互联网', '2026-09-03', 'AdEff广告创意前测'),
    ('玛氏箭牌', '陈经理', '下午茶活动', '媒介力学·广州场', 'new', 'CVB', '食品饮料', '2026-09-03', 'CVB数据方案+AI数字人');
`);

// ===== 报告 & 联系人（prepared statements） =====
const insertReport = db.prepare(`INSERT INTO account_reports (account_id, report_type, report_period, most_important, key_work, need_decision, cross_team_needs, bottlenecks, next_important) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertContact = db.prepare(`INSERT INTO account_contacts (account_id, name, title, department, role_level, phone, email, is_champion, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const insertSampleData = db.transaction(() => {
  // === 1. 卓正医疗 (id=1) ===
  insertReport.run(1, 'weekly', '2026-W38',
    '卓正医疗私有化部署完成，首期500万回款到账，进入全员培训阶段',
    '1. 私有化部署完成并通过验收\n2. 首期500万回款到账\n3. 启动全员使用培训计划\n4. 与医务部门确认AI诊疗辅助场景优先级',
    '需要确认后续200万增购的具体范围和时间线',
    '需要交付团队驻场支持培训；需要客户成功团队制定上线推广计划',
    '',
    '完成全员培训，输出医疗行业标杆案例材料');
  insertContact.run(1, '姜平', 'CEO', '管理层', '决策层', '', '', 1, '战略决策人，亲自定调"必须发生"');
  insertContact.run(1, 'CIO', 'CIO', 'IT部', '决策层', '', '', 0, 'IT决策人，私有化部署技术对接');
  insertContact.run(1, '医务总监', '医务总监', '医务部', '管理层', '', '', 0, '业务场景确认人');

  // === 2. 南孚电池 (id=2) ===
  insertReport.run(2, 'weekly', '2026-W38',
    '南孚电池9/14启动私有化部署，10场景含AtoA石墨烯标杆，CEO+CMO直通',
    '1. 9/14私有化部署启动\n2. 与CEO确认10场景优先级\n3. AtoA石墨烯研发案例方案确认\n4. 常晓飞/威少驻场支持',
    '',
    '需要研发团队支持AtoA场景的Agent协同架构',
    '',
    '完成10场景部署，重点打磨石墨烯AtoA标杆案例');
  insertContact.run(2, 'CEO', 'CEO', '管理层', '决策层', '', '', 1, 'CEO直通，前宝洁系，愿景高度统一');
  insertContact.run(2, 'CMO', 'CMO', '市场部', '决策层', '', '', 0, '辉哥直接对接');
  insertContact.run(2, 'IT总监', 'IT总监', 'IT部', '管理层', '', '', 0, '部署对接人');
  insertContact.run(2, '研发负责人', '研发负责人', '研发部', '管理层', '', '', 0, '石墨烯AtoA场景对接');

  // === 3. HKIC (id=3) ===
  insertReport.run(3, 'weekly', '2026-W38',
    'HKIC 9/18现场安装POC，发现Token显示缺失和云主机费用两个卡点',
    '1. 9/18现场安装完成\n2. 审计AI助手POC启动\n3. 客户反馈Token用量无法查看\n4. 云主机2000元/月费用客户有异议',
    '需要产品确认Token用量显示功能排期；需要给出云主机费用优化方案',
    '需要产品团队优先排期Token显示功能',
    'Token显示缺失+费用异议可能影响POC转付费',
    '本周内解决Token显示问题，给出费用方案，推进POC顺利进行');
  insertContact.run(3, 'IT负责人', 'IT负责人', 'IT部', '管理层', '', '', 1, 'POC技术对接人');
  insertContact.run(3, '审计合伙人', '审计合伙人', '审计部', '决策层', '', '', 0, '业务决策人');

  // === 4. 宇通客车 (id=4) ===
  insertReport.run(4, 'weekly', '2026-W38',
    '🔥 9/18郑州述标完成！纯技术打分，等9/25结果。姜平定调"亏本也拿"',
    '1. 9/18郑州现场述标完成\n2. 纯技术评分环节，5家竞品同台\n3. Amy主跟/玉平BD/威少方案铁三角配合\n4. 16+联系人覆盖10条线关系铺垫到位',
    '如中标需即刻组建交付团队，请品鉴者提前评估资源',
    '需要交付团队提前了解宇通需求，做好中标后快速启动准备',
    '等待9/25招标结果，这是最关键节点',
    '等待9/25结果，中标后24h内启动交付团队组建，11月必须产出量化提效数据');
  insertContact.run(4, '景宏源', 'CIO', 'IT部', '决策层', '', '', 1, 'CIO，招标决策关键人，9/10翻转核心');
  insertContact.run(4, '营销VP', '营销VP', '营销线', '决策层', '', '', 0, '最初进线的营销线，C类线索起源');
  insertContact.run(4, 'IT总监', 'IT总监', 'IT部', '管理层', '', '', 0, '招标执行对接人');
  insertContact.run(4, '研发负责人', '研发负责人', '研发中心', '管理层', '', '', 0, 'AI Coding场景对接');

  // === 5. 吉利汽车 (id=5) ===
  insertReport.run(5, 'weekly', '2026-W38',
    '吉利POC 9月底结项冲刺，390万/908人天报价已提交，飞书集成方案确认',
    '1. 4场景POC进展顺利(营销/HR/周例会Loop/AI Coding)\n2. 徐浩驻场日会推进\n3. 390万/908人天报价提交\n4. 飞书私有化Octo融入工作台方案确认\n5. 元动力平台~1500高管方案对齐',
    '飞书集成工作量较大，需要产品确认飞书插件排期',
    '需要飞书集成专项开发支持；需要常晓飞部署支持到结项',
    '飞书集成是POC结项前提，排期紧张',
    '9月底POC顺利结项，推动正式合同签署；飞书插件开发排期确认');
  insertContact.run(5, '刘昊', 'CDO', '数字化中心', '决策层', '', '', 1, 'CDO，3DM核心，自写《OCTO产品第一性原理》，最强champion');
  insertContact.run(5, '乔帅', 'AI运营部长', 'AI运营部', '管理层', '', '', 0, '3DM成员，POC执行负责人');
  insertContact.run(5, '陈勇', 'AIC负责人', 'AI中心', '管理层', '', '', 0, '3DM成员，技术架构对接');
  insertContact.run(5, 'HR VP', 'HR VP', '人力资源', '决策层', '', '', 0, '元动力平台决策人');

  // === 6. 三一重工 (id=6) ===
  insertReport.run(6, 'weekly', '2026-W38',
    '🔥 9/17重大升级！创始人之子梁在中亲自牵头，10月辉哥广州几百人峰会是关键',
    '1. 9/17梁在中(创始人之子)亲自升级项目\n2. 龙瑶(SSC部长)持续推动\n3. 完成初步需求调研：700+老系统+Hermes+Dify现状\n4. 核心痛点确认：AGV省力不省人→端到端协同',
    '需要辉哥确认10月广州峰会时间和演讲内容设计',
    '需要刘静输出端到端AI协同策略方案；需要HR场景方案(徐浩)',
    '已有Hermes+Dify部署，需明确共存/替换策略',
    '10月第一周辉哥广州峰会做好高层对接，输出端到端方案，推动POC启动');
  insertContact.run(6, '梁在中', '创始人之子/战略负责人', '战略层', '决策层', '', '', 1, '创始人之子，9/17亲自牵头升级，最高决策人🔥');
  insertContact.run(6, '龙瑶', 'SSC部长', '人力资源(SSC)', '管理层', '', '', 0, '吉利案例引荐人，内部推动者');
  insertContact.run(6, 'IT总监', 'IT总监', 'IT部', '管理层', '', '', 0, '技术对接人');

  // === 7. 墨迹天气 (id=7) ===
  insertReport.run(7, 'weekly', '2026-W38',
    '墨迹天气AI Coding POC接近完成，付费意愿强，预估~100万',
    '1. 5大需求场景POC进展顺利\n2. 多智能体协同场景客户高度认可\n3. GitLab打通联调完成\n4. 提效量化数据开始积累',
    '',
    '需要朱翾蒙准备商务方案和报价',
    '',
    'POC结项后即刻启动商务谈判，目标10月签约');
  insertContact.run(7, '金犁', '创始人/CEO', '管理层', '决策层', '', '', 1, '创始人，亲自发起AI Coding招标');
  insertContact.run(7, '研发VP', '研发VP', '研发部', '决策层', '', '', 0, '技术决策人');
  insertContact.run(7, '技术负责人', '技术负责人', '研发部', '执行层', '', '', 0, 'POC技术对接人');

  // === 8. Hysan希慎 (id=8) ===
  insertReport.run(8, 'weekly', '2026-W37',
    'Hysan希慎确认战败，法务三大卡点无法短期解决',
    '1. 法务审核反馈三大卡点\n2. SOC2/ISO27001资质缺失短期内无法补\n3. Token不封顶模式客户坚决不接受\n4. 专业责任险明略无法提供\n5. 客户正式通知放弃',
    '',
    '',
    '三大卡点均为公司层面问题，非单点项目能解决',
    '沉淀香港市场合规准入Checklist，为后续香港客户前置准备');
  insertContact.run(8, 'IT负责人', 'IT负责人', 'IT部', '管理层', '', '', 0, '项目对接人');
  insertContact.run(8, '法务负责人', '法务负责人', '法务部', '决策层', '', '', 0, '合规审核决策人');
});
insertSampleData();

export default db;
