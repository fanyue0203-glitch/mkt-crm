import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, unlinkSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data', 'mkt-crm.db');
mkdirSync(join(__dirname, 'data'), { recursive: true });

// Fresh schema — delete old db if exists
if (existsSync(dbPath)) { try { unlinkSync(dbPath); } catch(e) {} }

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===== Schema =====
db.exec(`
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

  -- ===== Octo大客户真实数据 =====

  -- 1. 卓正医疗：已签约
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '卓正医疗', '医疗健康', '中型连锁', '华南', '姜平定调战略客户', 'S',
    '2026-06-01', '2026-09-20', 12, '医疗私有化AI平台，诊疗知识问答+运营效率+患者服务Agent',
    'Amy(张晓)', '交付中', '私有化完成已回款，全员培训阶段，姜平"必须发生"',
    '已签约', 700, '500万已回款+200万后续增购预期', '姜平"必须发生"项目，医疗可复制标杆',
    3, 'IT+医务+运营', '无强竞品', '认可Octo AI原生平台架构，医疗场景适配能力强',
    '私有化', '诊疗知识问答+运营效率提升+患者服务Agent',
    '医疗行业AI落地缺乏成熟方案，传统HIS系统智能化程度低',
    '', '完成全员培训，推动标杆案例输出', '2026-10-15', 1, '无强锁定',
    '[{"date":"2026-06-01","event":"首次接触","note":"姜平定调必须发生的战略客户"},{"date":"2026-07-15","event":"签约","note":"500万合同签署"},{"date":"2026-08-20","event":"私有化部署完成","note":"系统上线"},{"date":"2026-09-10","event":"回款完成","note":"首期回款到账"},{"date":"2026-09-20","event":"培训阶段","note":"进入全员使用培训"}]',
    '医疗行业标杆客户，姜平亲自推动"必须发生"。私有化完成已回款，后续200万增购预期。医疗可复制标杆案例。'
  );

  -- 2. 南孚电池：已签约
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '南孚电池', '快消/电池', '大型企业', '福建', 'CEO+CMO辉哥直通', 'A',
    '2026-07-01', '2026-09-14', 8, '全场景AI Agent平台，10场景含AtoA石墨烯研发标杆，愿景统一替代钉飞企微',
    '常晓飞/威少', '部署中', '9/14资源到位部署中，CEO+CMO辉哥直通（前宝洁系），竞品腾讯Hermes',
    '交付中', 20, '20万(两年期合同)，部署进行中', 'CEO+CMO辉哥直通，前宝洁系管理团队，愿景统一替代钉飞企微',
    4, '市场+IT+运营+研发', '腾讯Hermes', '认可Octo AI原生定位，愿景统一：替代钉钉/飞书/企微成为AI时代工作平台',
    '私有化', '10大场景AI Agent部署，含AtoA(Agent-to-Agent)标杆石墨烯研发案例',
    '传统办公协同工具无法满足AI时代Agent协作需求，研发效率提升有强诉求',
    '', '完成10场景部署上线，推动石墨烯AtoA案例标杆输出', '2026-09-30', 1, '目标替代钉飞企微',
    '[{"date":"2026-07-01","event":"CEO直通接触","note":"辉哥与南孚CEO直接对接，前宝洁系背景"},{"date":"2026-08-01","event":"签约","note":"20万两年期合同"},{"date":"2026-09-14","event":"资源到位部署启动","note":"私有化部署资源到位，正式启动"}]',
    'CEO+CMO辉哥直通客户，前宝洁系。愿景高度统一替代钉飞企微。10场景含AtoA标杆(石墨烯研发案例)，竞品腾讯Hermes。'
  );

  -- 3. HKIC：已签约POC
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    'HKIC香港会计师公会', '专业服务/会计', '中型机构', '香港', '香港渠道', 'B',
    '2026-08-15', '2026-09-18', 5, '香港会计行业AI审计/税务助手POC',
    'Amy/梦林', 'POC中', '9/18现场安装POC，卡点：Token显示缺失、云主机2000元/月异议',
    'POC中', 5, '5万港币POC阶段', '香港渠道引荐',
    2, 'IT+审计', '', '认可Octo多语言能力和行业适配潜力',
    '私有化(云主机)', '审计底稿AI辅助+税务咨询Agent+报告自动生成',
    '香港会计行业合规要求高，传统审计流程效率低',
    '1.Token用量显示缺失，客户无法预估费用；2.云主机2000元/月费用有异议', '解决Token显示问题+给出云主机费用优化方案', '2026-09-30', 0, '香港合规环境',
    '[{"date":"2026-08-15","event":"首次接触","note":"香港渠道引荐"},{"date":"2026-09-10","event":"POC确认","note":"5万港币POC合同"},{"date":"2026-09-18","event":"现场安装","note":"现场安装POC，发现Token显示和费用问题"}]',
    '香港会计行业客户，9/18现场安装POC。卡点：Token用量显示缺失+云主机费用异议。'
  );

  -- 4. 宇通客车：投标中
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '宇通客车', '制造/汽车', '大型企业', '河南郑州', '官网进线→招标翻转', 'A',
    '2026-05-09', '2026-09-18', 20, '全员AI工作平台，11月需量化提效数据',
    'Amy主跟/玉平BD/威少方案', '投标中', '9/18郑州述标完成，等9/25结果，姜平定调"亏本也拿"',
    '投标中', 600, '一期≤200万，二三期各200万，总计600万+。9/18述标完成纯技术打分', '贾祥轩5/9官网主动联系→9/10招标翻转(营销线C类→IT线CIO景宏源招标)',
    16, '10条线：IT/营销/研发/HR/制造/供应链/财务/法务/售后/质量', '酷开/浙江实在/联想/腾讯WorkBuddy/阿里QoderWork', '客户明确认可Octo是AI原生平台(非AI增强工具)，核心差异化',
    '私有化', '全员AI工作平台，覆盖营销/研发/HR/制造/售后等场景，11月需量化提效数据',
    '传统IT系统智能化不足，组织效率提升诉求强，11月需有量化提效数据交付',
    '等9/25招标结果，5家竞品竞争激烈', '9/25跟进结果，中标后24h内启动交付准备', '2026-09-25', 1, '走CIO招标流程',
    '[{"date":"2026-05-09","event":"贾祥轩官网主动联系","note":"营销线C类线索进线，贾祥轩官网主动注册"},{"date":"2026-09-10","event":"招标翻转","note":"营销线C类→IT线CIO景宏源招标，从被动进线变主动投标"},{"date":"2026-09-18","event":"郑州述标完成","note":"纯技术打分，9/25前出结果。姜平定调亏本也拿"}]',
    '🔥 第一优先级战略客户。5/9贾祥轩官网C类线索→9/10翻转到IT线CIO景宏源招标，16+联系人覆盖10条线。9/18述标完成等9/25结果。竞品5家，客户认可Octo AI原生定位。姜平定调"亏本也拿"。11月需量化提效。'
  );

  -- 5. 吉利汽车：B类重点推进
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '吉利汽车', '制造/汽车', '超大型(8.5万人/9军团)', '浙江杭州', '辉哥CEO团队分享', 'B',
    '2026-06-01', '2026-09-20', 25, '4场景+元动力平台~1500高管，已选飞书私有化Octo融入工作台',
    '刘静统筹/CC对接/威少方案/徐浩日会/常晓飞部署', '重点推进', '9/15元动力里程碑结果待确认→9月底POC有条件结项',
    '重点推进', 390, '390万/908人天报价，客户已选定飞书私有化，Octo融入飞书工作台', '辉哥7/18给淦家阅CEO团队40+人分享后正式启动',
    8, '3DM(刘昊CDO/乔帅AI运营部长/陈勇AIC)+营销+HR+研发', '飞书AI(已选定飞书私有化)', '刘昊(CDO)自写《OCTO产品第一性原理》，224条消息+30+文档最重项目',
    '私有化(融入飞书工作台)', '4场景：营销内容生成+HR智能助手+周例会Loop+AI Coding；元动力平台~1500高管覆盖至2027.9；6个Bot深度参与(艾娃/毕达哥拉拉/Kotter/Brooks/杨贵妃/吉利项目助手)',
    '8.5万人/9军团/数字化预算40亿，组织效率提升和数字化转型强诉求',
    '客户已选定飞书私有化，Octo需融入飞书工作台，产品集成有工作量；元动力里程碑结果待确认', '确认9/15元动力里程碑结果，9月底POC有条件结项，推动正式合同', '2026-09-30', 1, '已选定飞书私有化，Octo融入飞书工作台',
    '[{"date":"2026-06-01","event":"首次接触","note":"吉利数字化转型需求初步沟通"},{"date":"2026-07-18","event":"辉哥CEO团队分享","note":"辉哥给淦家阅CEO团队40+人做AI分享，启动正式合作"},{"date":"2026-08-01","event":"POC启动","note":"4场景POC启动，徐浩驻场日会"},{"date":"2026-09-15","event":"元动力里程碑","note":"元动力里程碑节点，结果待确认"},{"date":"2026-09-30","event":"POC结项(目标)","note":"9月底POC有条件结项"}]',
    '🔥超大型客户8.5万人/9军团/数字化预算40亿。3DM铁三角(刘昊CDO/乔帅AI运营部长/陈勇AIC)。刘昊自写《OCTO产品第一性原理》是最强champion。辉哥7/18 CEO团队分享，4场景+元动力平台~1500高管，6个Bot深度参与。已选飞书私有化Octo融入工作台。9/15元动力里程碑结果待确认→9月底POC结项。'
  );

  -- 6. 三一重工：B类重点推进
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '三一重工', '制造/重工', '大型(5万人)', '湖南长沙/广州', '吉利案例龙瑶引荐', 'B',
    '2026-08-26', '2026-09-17', 6, '端到端AI协同平台，解决AGV省力不省人→从点状到端到端',
    '玉平BD/刘静策略/徐浩HR/辉哥10月主讲', '重点推进', '9/17梁在中(创始人之子)亲自牵头🔥升级，10月第一周辉哥广州几百人分享',
    '重点推进', 0, '待报价。梁在中亲自牵头后预计百万级', '龙瑶(SSC部长)通过吉利案例引荐8/26深度交流5.5h',
    5, 'HR(SSC)+IT+制造+运营+战略', '腾讯Hermes+Dify(已部署700+老系统)', '认可Octo从点状AI到端到端协同的理念',
    '待定', 'HR数字化+制造端到端协同+AGV场景AI升级',
    '现有700+老系统+Hermes+Dify已部署，AGV场景省力不省人，核心痛点从点状AI到端到端协同跨越',
    '客户已有大量系统(Hermes/Dify)，替换或共存策略需明确', '10月第一周辉哥广州几百人峰会主讲，做好会前高层对接；输出端到端方案', '2026-10-07', 1, '已有Hermes+Dify部署，700+老系统生态复杂',
    '[{"date":"2026-08-26","event":"龙瑶引荐深度交流","note":"吉利案例引荐，深度交流5.5h"},{"date":"2026-09-17","event":"梁在中升级🔥","note":"创始人之子/总监事长梁在中亲自牵头，项目重大升级"},{"date":"2026-10-01","event":"辉哥广州分享(计划)","note":"10月第一周广州几百人峰会辉哥主讲"}]',
    '🔥9/17重大升级：创始人之子/总监事长梁在中亲自牵头。5万人规模，龙瑶(SSC部长)吉利案例引荐8/26深度交流5.5h。张名全(HR总监)AI转型牵头人。现有700+老系统+Hermes+Dify，核心痛点AGV省力不省人→端到端。辉哥10月广州几百人峰会主讲是关键节点。'
  );

  -- 7. 极光湾：B类重点推进
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '极光湾科技', '制造/汽车动力', '大型(1.9万人/130国18工厂)', '浙江', '吉利生态（吉利+雷诺合资雷神动力）', 'B',
    '2026-08-01', '2026-09-20', 5, '7场景AI平台，完全复刻吉利路径，必须私有化',
    '刘静主跟/威少/技术负责人9月驻场', '重点推进', '尾随吉利战术(跟AIC陈博团队copy)，10月启动，赵福成要求40+管理层全打卡辉哥视频',
    '重点推进', 0, '待报价，吉利模式复刻预计百万级', '吉利生态延伸，吉利+雷诺合资公司(雷神动力)',
    3, '研究院+IT+HR', '飞书AI(跟随吉利)', '赵福成(研究院总负责人)认可辉哥分享，要求40+管理层全打卡',
    '私有化', '7场景：原动力/会议Agent/研发AI/数据治理/BPM/端侧模型/数字员工',
    '1.9万人/130国18工厂，跨国多工厂协同效率痛点，数字化转型跟随吉利',
    '需等吉利POC结项后完整复刻，时间线依赖吉利进展', '吉利POC复盘后10月正式启动极光湾，技术负责人9月驻场准备', '2026-10-15', 1, '跟随吉利飞书生态',
    '[{"date":"2026-08-01","event":"首次接触","note":"吉利生态引荐，吉利+雷诺合资公司"},{"date":"2026-09-01","event":"赵福成看辉哥视频","note":"研究院总负责人赵福成要求40+管理层全打卡辉哥视频"},{"date":"2026-09-20","event":"技术驻场准备","note":"技术负责人9月驻场，为10月启动做准备"}]',
    '吉利+雷诺合资(雷神动力)，1.9万人/130国18工厂。尾随吉利战术跟AIC陈博团队copy，完全复刻吉利路径。赵福成(研究院总负责人)要求40+管理层全打卡辉哥视频。必须私有化，7场景(原动力/会议Agent/研发AI/数据治理/BPM/端侧模型/数字员工)。10月启动。'
  );

  -- 8. 墨迹天气：B类重点推进
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '墨迹天气', '互联网/SaaS', '中型', '北京', '创始人金犁招标', 'B',
    '2026-08-01', '2026-09-20', 10, 'AI Coding全流程5大需求，POC接近完成付费意愿强',
    '贾彤前期/威少方案/朱翾蒙销售', '重点推进', 'POC接近完成付费意愿强，~100万预估',
    '重点推进', 100, '~100万预估，POC接近完成等正式商务流程', '金犁(创始人)亲自发起AI Coding招标',
    4, '研发+产品+IT+销售', '阿里MuleRun/埃森哲', '认可Octo多智能体协同和最佳实践沉淀能力',
    'SaaS/混合', 'AI Coding 5大场景：需求/方案/用例自动生成+打通简单云GitLab+多智能体协同+最佳实践沉淀+提效量化',
    '研发效能提升，从需求到代码全流程AI化，打通GitLab实现闭环',
    '', 'POC结项后推进正式合同签署，朱翾蒙准备商务方案', '2026-10-15', 1, '无强生态锁定',
    '[{"date":"2026-08-01","event":"金犁发起招标","note":"创始人亲自发起AI Coding招标"},{"date":"2026-09-01","event":"POC启动","note":"5大需求场景POC，贾彤前期，威少方案"},{"date":"2026-09-20","event":"POC接近完成","note":"付费意愿强，竞品阿里MuleRun/埃森哲"}]',
    '金犁(创始人)发起AI Coding招标，5大需求(需求/方案/用例自动生成+GitLab+多智能体+最佳实践+提效量化)。POC接近完成付费意愿强。贾彤前期/威少方案/朱翾蒙销售。预估~100万。'
  );

  -- 9. 金智教育：B类重点推进
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '金智教育', '教育/高校信息化', '中型', '南京', '郭超董事长-辉哥直接关系', 'B',
    '2026-07-01', '2026-09-07', 8, '三重属性(客户/渠道/共创)，15Bot/11员工/4群跑通，CCF论坛双logo+南科试职+中传答辩',
    '叶佳/胡曦/张旭9/7接手', '重点推进', '三重属性(客户/渠道/共创)，核心卡点：商务模式未定，需辉哥碰定位',
    '重点推进', 0, '待定(渠道+共创模式)，商务模式未定', '郭超(董事长)辉哥直接关系，知途子公司(于总)',
    4, '技术+产品+市场+知途子公司', '', '郭超与辉哥直接关系，15Bot/11员工/4群已跑通，16自建skill',
    '私有化/SaaS混合', '教育行业智能体平台+CCF论坛双logo展示+南京科技职业学院试点+中传智能体答辩共创',
    '高校信息化AI转型，教育行业智能体平台需求强',
    '商务模式未定：客户/渠道/共创三身份如何定位需辉哥拍板', '安排辉哥与郭超会面，明确商务定位和合作模式', '2026-09-30', 1, '无强锁定',
    '[{"date":"2026-07-01","event":"郭超引荐","note":"郭超董事长辉哥直接关系"},{"date":"2026-08-15","event":"15Bot跑通","note":"15Bot/11员工/4群跑通，16自建skill"},{"date":"2026-09-01","event":"CCF论坛+南科试职","note":"CCF论坛双logo展示、南京科技职业学院试点、中传智能体答辩共创"},{"date":"2026-09-07","event":"叶佳/胡曦/张旭接手","note":"新对接团队接手"}]',
    '三重属性(客户/渠道/共创)。郭超(董事长)辉哥直接关系，知途子公司(于总)。15Bot/11员工/4群跑通，16自建skill。CCF论坛双logo、南京科技职业学院试点、中传智能体答辩共创。核心卡点：商务模式未定(三身份)，需辉哥碰定位。叶佳/胡曦/张旭9/7接手。'
  );

  -- 10. 致远互联：B类重点推进
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '致远互联', '企业软件/OA', '大型上市公司', '北京', '吴明辉亲自创建子区', 'B',
    '2026-07-12', '2026-08-31', 6, 'Token+FDE模式，互补定位(致远=System of Record/Octo=System of Agent)，覆盖35家一级央企',
    '史佳艳主跟', '重点推进', '辉哥定调"代码开源随便用，赚token+FDE"，须签一页边界备忘防白嫖，8/31已用Loop做内部汇报',
    '重点推进', 0, 'Token+FDE模式，覆盖35家一级央企渠道价值大', '吴明辉(明略创始人)7/12亲自创建子区，创始人徐总7/14带队来访',
    3, '创始人+产品+渠道', '致远自有OA AI', '认可互补定位：致远=System of Record/Octo=System of Agent',
    '混合(开源+FDE)', 'Token用量计费+FDE(Frontier Development Environment)服务，代码开源，覆盖35家一级央企渠道',
    '央国企OA系统AI升级需求强，致远覆盖35家一级央企渠道价值极高',
    '须签一页边界备忘防止白嫖，代码开源后的商业模式需清晰', '推进边界备忘签署，确认Token+FDE商业模式细节', '2026-10-15', 1, '致远自有OA生态，Octo作为Agent层嵌入',
    '[{"date":"2026-07-12","event":"吴明辉创建子区","note":"明略创始人吴明辉亲自创建Octo子区"},{"date":"2026-07-14","event":"徐总带队来访","note":"致远创始人徐总带队来访明略"},{"date":"2026-08-31","event":"Loop内部汇报","note":"致远已用Loop做内部汇报工具"}]',
    '吴明辉7/12亲自创建子区，创始人徐总7/14带队来访。互补定位：致远=System of Record/Octo=System of Agent。辉哥定调"代码开源随便用，赚token+FDE"。覆盖35家一级央企(央国企渠道关键)。须签一页边界备忘防白嫖。史佳艳主跟。8/31已用Loop做内部汇报。'
  );

  -- 11. 普联香港：B类重点推进
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '普联香港(TP-Link)', '制造/网络设备', '大型(年预算600万)', '香港', '姜平亲推', 'B',
    '2026-08-01', '2026-09-20', 4, 'OA+Octo融合共建(系统级集成)，不提供产研只提供培训，9月底出第一批bot',
    'Amy', '重点推进', '姜平亲推，9月底出第一批bot硬时点，进度会待安排(姜平已催)',
    '重点推进', 600, '客户年预算600万', '姜平亲推',
    2, 'IT+业务', '', '姜平亲自推动，客户预算充足',
    '系统级集成', 'OA+Octo融合共建，系统级集成(不提供产研只提供培训)',
    '企业AI办公升级，OA系统AI化需求',
    '进度会待安排，姜平已催但尚未落实', '尽快安排进度会，确保9月底第一批bot交付硬时点', '2026-09-30', 1, '',
    '[{"date":"2026-08-01","event":"姜平亲推接触","note":"姜平亲自推荐推进"},{"date":"2026-09-20","event":"9月底硬时点","note":"9月底出第一批bot，姜平已催进度会"}]',
    '姜平亲推，客户年预算600万。OA+Octo融合共建(系统级集成)，不提供产研只提供培训。9月底出第一批bot硬时点，进度会待安排(姜平已催)。Amy负责。'
  );

  -- 12. 中信资本：C类跟进
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '中信资本', '金融/投资', '大型机构', '北京', 'S级/Octopush待装', 'C',
    '2026-08-01', '2026-09-15', 3, '投资研究AI助手，Octopush待装',
    '卉子', '跟进中', 'S级客户，Octopush待装但费用见底',
    '跟进中', 0, '待评估', '高管渠道',
    2, '投资研究+IT', '', '',
    '待定', '投资研究AI助手+Octopush消息推送',
    '金融投研效率提升',
    'Octopush费用见底，需确认费用方案才能继续推进', '确认Octopush费用方案后推进安装', '2026-10-15', 0, '',
    '[{"date":"2026-08-01","event":"S级接触","note":"S级客户初步接触"},{"date":"2026-09-15","event":"费用卡点","note":"Octopush待装但费用见底"}]',
    'S级客户，Octopush待装但费用见底是当前卡点。卉子负责(资本市场渠道)。'
  );

  -- 13. 混沌学园：C类跟进
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '混沌学园', '教育/创新培训', '中型', '北京', '活动注册', 'C',
    '2026-08-01', '2026-09-10', 4, '教育创新AI Agent，注册未用，价格敏感对标Coze',
    '贾金良(贾叔)', '跟进中', 'A级/注册未用/价格敏感对标Coze',
    '跟进中', 0, '价格敏感，待转化', 'CEO活动获客(混沌+晚点贡献96%开通量)',
    2, '产品+IT', 'Coze(字节)', '注册后未深度使用',
    'SaaS', '教育创新内容AI助手',
    '教育创新培训场景AI化',
    '价格敏感，对标Coze免费/低价方案，转化难度大', '持续跟进价值输出，降低价格敏感度', '', 0, '无强锁定但价格敏感',
    '[{"date":"2026-08-01","event":"活动注册","note":"CEO活动后注册开通"},{"date":"2026-09-10","event":"注册未用","note":"A级但注册后未深度使用，价格敏感"}]',
    'A级/注册未用/价格敏感对标Coze。混沌+晚点贡献96%开通量但转化率低。贾叔负责。教训：活动获客≠大客户获取。'
  );

  -- 14. 健主任：C类跟进
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '健主任', '医疗/连锁诊所', '小型连锁', '华南', '医疗渠道', 'C',
    '2026-08-15', '2026-09-15', 3, '10万服务包，医疗连锁AI助手，已付费',
    'Amy', '已付费', '10万服务包，医疗连锁，已付费',
    '已付费', 10, '10万服务包已付费', '医疗渠道',
    2, '运营+IT', '', '小客户但已付费，医疗赛道补充',
    'SaaS', '医疗连锁运营AI助手',
    '连锁诊所运营效率提升',
    '', '交付服务包内容，确保客户满意度', '2026-10-31', 0, '',
    '[{"date":"2026-08-15","event":"接触","note":"医疗渠道引荐"},{"date":"2026-09-15","event":"已付费","note":"10万服务包已付费"}]',
    '10万服务包已付费，医疗连锁客户。Amy负责，医疗赛道补充。'
  );

  -- 15. 刀法咨询：D类观察
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, notes) VALUES (
    '刀法咨询', '咨询/营销', '小型(刀姐IP)', '上海', 'CEO活动/刀姐IP', 'D',
    '2026-08-01', '2026-09-01', 2, '1人1Agent概念，PR价值评估中',
    '贾金良(贾叔)', '观察中', '刀姐IP/1人1Agent/PR价值评估',
    '观察中', 0, 'PR价值大于直接商业价值', 'CEO活动获客',
    1, '创始人', '', '刀姐(创始人)IP影响力大，1人1Agent概念有PR传播价值',
    'SaaS', '1人1Agent营销内容助手',
    '营销咨询行业个人IP效率提升',
    '商业价值有限，主要评估PR价值', '评估PR合作价值，不投入重型资源', '', 0, '',
    '[{"date":"2026-08-01","event":"活动注册","note":"刀姐活动后注册"}]',
    '刀姐IP/1人1Agent概念。PR价值大于直接商业价值，观察中不投重型资源。'
  );

  -- 16. Hysan希慎：战败
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
    'Amy', '已战败', '法务三大卡点战败：SOC2/ISO27001资质、Token费用不封顶、专业责任险',
    '战败', 0, '法务三大卡点无法短期解决，项目战败', '香港渠道引荐',
    2, 'IT+法务', '', '产品认可但合规门槛无法逾越',
    '', '', '香港地产行业数字化转型需求',
    '法务三大卡点：1.SOC2/ISO27001资质缺失；2.Token费用不封顶客户无法接受；3.专业责任险(Professional Indemnity Insurance)明略无法提供',
    '', '', 0, '香港合规环境硬门槛',
    '[{"date":"2026-08-01","event":"首次接触","note":"香港渠道引荐"},{"date":"2026-09-01","event":"法务审核","note":"三大卡点浮现"},{"date":"2026-09-10","event":"战败确认","note":"法务卡点无法短期解决"}]',
    '香港合规门槛极高：SOC2/ISO27001资质是硬门槛；Token费用不封顶模式香港企业不接受；专业责任险(PII)是香港商业合作标配。香港市场需前置解决合规三要素。',
    '香港地产战败。法务三大卡点(SOC2/ISO27001/Token不封顶/专业责任险)。教训：香港市场合规门槛极高需前置准备。'
  );

  -- 17. 方里：战败
  INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, last_touch_date, touch_count, needs_summary,
    assigned_to, follow_up_status, octo_status,
    customer_stage, deal_amount, deal_stage, lead_source,
    key_contacts_count, key_departments, competitors, customer_recognition,
    deployment_type, product_solutions_detail, core_painpoint, blockers,
    next_step, next_deadline, ceo_involvement, ecosystem_lock,
    key_events, lessons_learned, notes) VALUES (
    '方里(FunnyElves)', '美妆个护', '中型新消费', '华东', 'CEO活动/A级Onboarding', 'D',
    '2026-07-01', '2026-09-01', 6, '美妆新消费AI营销助手',
    '贾金良(贾叔)', '已战败', '飞书Aily双闭环(内部+外部)锁定，原A级客户战败',
    '战败', 0, '飞书Aily生态锁定，无法突破', 'CEO活动获客，原A级Onboarding客户',
    2, '市场+IT', '飞书Aily', 'Onboarding体验好但飞书生态锁定不可破',
    '', '', '美妆新消费品牌营销AI化需求',
    '飞书Aily双闭环(内部协同+外部营销)已深度使用，生态锁定极强；A级Onboarding≠高转化',
    '', '', 0, '飞书Aily强锁定',
    '[{"date":"2026-07-01","event":"A级接触","note":"CEO活动后A级Onboarding，看似高潜"},{"date":"2026-08-15","event":"生态锁定发现","note":"发现客户深度使用飞书Aily双闭环"},{"date":"2026-09-01","event":"战败确认","note":"飞书生态锁定无法突破"}]',
    'A级Onboarding≠高转化！原A级客户战败教训：必须先评估"生态锁定度"再定级。方里飞书Aily双闭环(内部+外部)一旦建立几乎不可破。得到/方里/联合影像/欢瑞/吉利都受飞书生态锁定影响。',
    '原A级客户战败。飞书Aily双闭环生态锁定。教训：先评生态锁定度再定级，A级Onboarding≠高转化。'
  );

  -- Speeches
  INSERT INTO speeches (date, location, event_name, topic, speech_type, audience_count, leads_count,
    business_design, story_line, audience_profile, follow_up_plan) VALUES
    ('2026-08-20', '北京·WRC主论坛', '2026世界机器人大会', 'Agent协同网络：两个大脑×HAO×L1-L5具身演化',
     '主论坛演讲', 3000, 0,
     '面向机器人+AI行业决策者，讲明略在具身智能的技术叙事',
     '从Octo到具身智能的叙事延伸：Agent网络连接物理世界',
     '机器人行业从业者+投资人+媒体+政府官员',
     '技术社区内容二次分发');

  -- Leads
  INSERT INTO leads (company_name, contact_name, source_channel, source_detail, status, product, industry, inbound_date, requirement) VALUES
    ('嘉顿食品', '张经理', '下午茶活动', '媒介力学·广州场', 'qualified', 'DOMO', '饮料', '2026-09-03', '本周约产品会议，DOMO+微伴，预期PPL 10万'),
    ('莲藕健康', '李总', '下午茶活动', '媒介力学·广州场', 'contacted', 'GEO', '医药大健康', '2026-09-03', 'GEO优化，预期PPL 20万'),
    ('维他奶', '王总', '下午茶活动', '媒介力学·广州场', 'contacted', 'AIGC', '食品饮料', '2026-09-03', 'AIGC需求，预期PPL 10万'),
    ('徕芬', '刘经理', '下午茶活动', '媒介力学·广州场', 'new', 'DOMO', '美妆个护', '2026-09-03', 'DOMO+妙啊，预期PPL 5万'),
    ('分众传媒', '赵总', '下午茶活动', '媒介力学·广州场', 'new', 'AdEff', '互联网', '2026-09-03', 'AdEff广告创意前测'),
    ('玛氏箭牌', '陈经理', '下午茶活动', '媒介力学·广州场', 'new', 'CVB', '食品饮料', '2026-09-03', 'CVB数据方案+AI数字人');
`);

// ===== 报告 & 联系人 =====
const insertReport = db.prepare(`INSERT INTO account_reports (account_id, report_type, report_period, most_important, key_work, need_decision, cross_team_needs, bottlenecks, next_important) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertContact = db.prepare(`INSERT INTO account_contacts (account_id, name, title, department, role_level, phone, email, is_champion, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const insertSampleData = db.transaction(() => {

  // === 1. 卓正医疗 (id=1) ===
  insertReport.run(1, 'weekly', '2026-W39',
    '卓正医疗私有化完成已回款，全员培训推进中，姜平"必须发生"，医疗标杆打造',
    '1. 全员使用培训持续推进，覆盖医务+运营+IT三条线\n2. 与医务部门确认AI诊疗辅助场景首批上线清单\n3. 启动医疗行业标杆案例材料撰写\n4. Amy(张晓)驻场跟进培训反馈',
    '需要确认后续200万增购的具体范围和时间线，请姜平对齐',
    '需要客户成功团队制定90天激活计划，防止"部署≠使用"',
    '',
    '完成首批场景上线，输出医疗标杆案例初稿，推动200万增购谈判启动');
  insertContact.run(1, '姜平', 'CEO/明略科技', '管理层', '决策层', '', '', 1, '明略CEO，亲自定调卓正"必须发生"，战略级推动');
  insertContact.run(1, '张晓(Amy)', '大客户经理(明略)', '客户成功', '管理层', '', '', 0, '明略方主跟负责人，驻场培训推动');
  insertContact.run(1, '卓正CIO', 'CIO', 'IT部', '决策层', '', '', 0, '客户方IT决策人，私有化部署验收对接');
  insertContact.run(1, '卓正医务总监', '医务总监', '医务部', '管理层', '', '', 0, '客户方业务决策人，AI诊疗场景确认');
  insertContact.run(1, '卓正IT运维', 'IT运维主管', 'IT部', '执行层', '', '', 0, '日常运维对接人');

  // === 2. 南孚电池 (id=2) ===
  insertReport.run(2, 'weekly', '2026-W39',
    '南孚9/14资源到位部署中，CEO+CMO辉哥直通(前宝洁系)，10场景含AtoA石墨烯标杆，目标替代钉飞企微',
    '1. 9/14私有化部署资源到位，常晓飞驻场部署推进\n2. 与CEO/CMO辉哥对齐10场景优先级排序\n3. AtoA石墨烯研发案例技术方案确认，进入开发阶段\n4. 竞品腾讯Hermes差异化分析输出\n5. 部署环境搭建完成，首批3个场景(市场+研发+运营)开始配置',
    '需要辉哥与南孚CEO确认10月中旬里程碑Check-in时间',
    '需要研发团队支持AtoA场景的Agent协同架构设计；需要威少持续方案支持',
    '',
    '完成首批3场景上线运行，石墨烯AtoA案例开发完成进入测试，9月底部署里程碑达成');
  insertContact.run(2, '南孚CEO', 'CEO', '管理层', '决策层', '', '', 1, 'CEO直通，前宝洁系，愿景高度统一：替代钉飞企微');
  insertContact.run(2, '辉哥', 'CMO(明略)', '市场部', '决策层', '', '', 1, '明略CMO，直接对接南孚CEO/CMO，前宝洁系共同语言');
  insertContact.run(2, '常晓飞', '商务+部署(明略)', '交付部', '管理层', '', '', 0, '明略方驻场部署负责人');
  insertContact.run(2, '南孚IT总监', 'IT总监', 'IT部', '管理层', '', '', 0, '客户方IT负责人，部署对接');
  insertContact.run(2, '南孚研发负责人', '研发负责人', '研发部', '执行层', '', '', 0, '石墨烯AtoA研发场景对接人');

  // === 3. HKIC (id=3) ===
  insertReport.run(3, 'weekly', '2026-W39',
    'HKIC 9/18现场安装POC完成，Token显示缺失+云主机2000元/月费用异议需紧急解决',
    '1. 9/18 Amy/梦林赴香港现场安装POC完成\n2. 审计底稿AI助手基础功能跑通\n3. 客户反馈两个卡点：Token用量无法实时查看、云主机2000元/月费用过高\n4. 多语言(中英双语)功能验证通过',
    '需要产品团队确认Token用量显示功能排期(客户要求本周内解决)；需要给出云主机费用优化方案(客户建议降配或自建)',
    '需要产品团队优先排期Token显示功能(香港客户POC阻断项)',
    'Token显示缺失+费用异议如不解决，POC转付费风险大',
    '本周内给出Token显示解决方案+云主机费用优化方案，确保POC顺利推进到转付费阶段');
  insertContact.run(3, 'HKIC IT负责人', 'IT负责人', 'IT部', '管理层', '', '', 1, 'POC技术主对接人，香港现场配合安装');
  insertContact.run(3, 'HKIC审计合伙人', '审计合伙人', '审计部', '决策层', '', '', 0, '业务决策人，关注AI审计效果和ROI');
  insertContact.run(3, '梦林', '交付工程师(明略)', '交付部', '执行层', '', '', 0, '明略方现场安装执行人员');
  insertContact.run(3, '张晓(Amy)', '大客户经理(明略)', '客户成功', '管理层', '', '', 0, '明略方主跟，香港客户关系维护');

  // === 4. 宇通客车 (id=4) ===
  insertReport.run(4, 'weekly', '2026-W39',
    '🔥 9/18郑州述标完成！纯技术打分，等9/25出结果。姜平定调"亏本也拿"，11月需量化提效',
    '1. 贾祥轩5/9官网主动联系(营销线C类线索)→8月持续跟进→9/10关键翻转：从营销线C类线索升级为IT线CIO景宏源主导的正式招标项目\n2. 9/18 Amy/玉平/威少铁三角赴郑州现场述标，纯技术打分环节\n3. 16+联系人已覆盖IT/营销/研发/HR/制造/供应链/财务/法务/售后/质量10条线\n4. 竞品5家同台：酷开/浙江实在/联想/腾讯WorkBuddy/阿里QoderWork\n5. 述标中重点强调Octo是AI原生平台(非AI增强工具)，客户技术团队高度认可这一差异化',
    '如中标需即刻组建交付团队(预计需5-8人驻场)，请品鉴者提前评估交付资源排期',
    '需要交付团队提前了解宇通需求(11月需量化提效数据)，做好中标后快速启动准备；需要HR线徐浩配合HR场景方案',
    '等待9/25招标结果是唯一卡点，结果未出前一切筹备都是预案',
    '9/25前跟进景宏源获取结果信号；中标后24h内启动交付团队组建和kickoff准备；开始准备11月量化提效方案框架');
  insertContact.run(4, '景宏源', 'CIO', 'IT部', '决策层', '', '', 1, 'CIO，招标决策关键人，9/10翻转核心人物，掌握最终决策权');
  insertContact.run(4, '贾祥轩', 'IT线/官网最初联系人', 'IT部', '执行层', '', '', 1, '5/9官网主动联系的第一人，最初是营销线C类线索入口，内部champion持续推动');
  insertContact.run(4, '张晓(Amy)', '大客户经理(明略)', '客户成功', '管理层', '', '', 0, '明略方主跟，述标主讲人');
  insertContact.run(4, '宇通营销VP', '营销VP', '营销线', '决策层', '', '', 0, '最初进线的营销线高层，C类线索起源部门');
  insertContact.run(4, '宇通IT总监', 'IT总监', 'IT部', '管理层', '', '', 0, '招标执行层面对接人，技术评审参与者');
  insertContact.run(4, '宇通研发负责人', '研发中心负责人', '研发中心', '管理层', '', '', 0, 'AI Coding和研发场景对接人');
  insertContact.run(4, '威少(杨威)', '方案架构VP(明略)', '方案部', '管理层', '', '', 0, '明略方方案架构师，述标技术主讲');
  insertContact.run(4, '赵玉平', 'BD(明略)', '市场部', '执行层', '', '', 0, '明略方BD支持，关系维护');

  // === 5. 吉利汽车 (id=5) ===
  insertReport.run(5, 'weekly', '2026-W39',
    '吉利9/15元动力里程碑结果待确认→9月底POC有条件结项冲刺，390万/908人天报价已提交，飞书集成推进中',
    '1. 9/15元动力里程碑节点已过，结果待客户确认(元动力平台~1500高管至2027.9)\n2. 4场景POC持续推进：营销内容生成+HR智能助手+周例会Loop+AI Coding\n3. 3DM铁三角高频互动：刘昊(CDO)自写《OCTO产品第一性原理》深度认可、乔帅(AI运营部长)执行推进、陈勇(AIC)技术架构\n4. 徐浩驻场日会机制运转良好，每日同步进展\n5. 6个Bot(艾娃/毕达哥拉拉/Kotter/Brooks/杨贵妃/吉利项目助手)深度参与日常运营\n6. 客户已选定飞书私有化，Octo融入飞书工作台方案确认，飞书插件开发启动\n7. 224条消息+30+文档，是最重的POC项目',
    '飞书集成工作量较大(Octo融入飞书工作台)，需要产品确认飞书插件正式排期和人力资源；元动力里程碑结果需要CC对接确认',
    '需要飞书集成专项开发支持(常晓飞部署+飞书插件开发)；需要徐浩继续驻场日会到POC结项',
    '飞书集成是POC结项前提条件，排期紧张；元动力里程碑结果未确认影响后续节奏',
    '确认9/15元动力里程碑结果，9月底POC有条件结项，推动390万正式合同签署，飞书插件开发排期锁定');
  insertContact.run(5, '淦家阅', 'CEO', '管理层', '决策层', '', '', 0, '吉利集团CEO，辉哥7/18给其团队40+人做AI分享');
  insertContact.run(5, '刘昊', 'CDO(首席数字官)', '数字化中心(3DM)', '决策层', '', '', 1, 'CDO，3DM核心铁三角之首，自写《OCTO产品第一性原理》，最强champion🔥');
  insertContact.run(5, '乔帅', 'AI运营部长', 'AI运营部(3DM)', '管理层', '', '', 0, '3DM成员，POC执行层面负责人');
  insertContact.run(6, '张名全', 'HR总监', '人力资源部', '管理层', '', '', 0, 'AI转型牵头人，HR场景对接人');
  insertContact.run(5, '陈勇', 'AIC负责人', 'AI中心(3DM)', '管理层', '', '', 0, '3DM成员，技术架构和AIC对接，极光湾尾随其团队copy');
  insertContact.run(5, '吉利HR VP', 'HR VP', '人力资源', '决策层', '', '', 0, '元动力平台HR决策人');
  insertContact.run(5, 'CC', '对接人', '项目对接', '执行层', '', '', 0, '日常项目对接人，刘静统筹下的执行窗口');
  insertContact.run(5, '徐浩', 'HR线(明略)', 'HR方案', '执行层', '', '', 0, '明略方驻场日会负责人，HR场景方案');
  insertContact.run(5, '刘静(Elva)', '大客户经理(明略)', '客户成功', '管理层', '', '', 0, '明略方统筹负责人，吉利生态整体把控');

  // === 6. 三一重工 (id=6) ===
  insertReport.run(6, 'weekly', '2026-W39',
    '🔥 9/17重大升级！梁在中(创始人之子/总监事长)亲自牵头，10月第一周辉哥广州几百人峰会是关键引爆点',
    '1. 9/17项目重大升级：创始人之子/总监事长梁在中亲自牵头，从SSC部门级升级为集团战略级🔥\n2. 回顾时间线：龙瑶(SSC部长)通过吉利案例引荐→8/26深度交流5.5h→张名全(HR总监)AI转型对接→9/17梁在中亲自接手\n3. 完成初步需求调研：客户现有700+老系统+腾讯Hermes+Dify已部署\n4. 核心痛点确认：AGV场景省力不省人→需要从点状AI升级到端到端AI协同\n5. 10月第一周辉哥广州峰会几百人规模演讲已确认，梁在中亲自安排',
    '需要辉哥确认10月广州峰会演讲内容框架(建议聚焦"从点状AI到端到端协同"，结合三一AGV痛点设计)',
    '需要刘静输出端到端AI协同策略方案；需要徐浩准备HR数字化方案；需要玉平持续BD维护龙瑶关系',
    '客户已有Hermes+Dify+700老系统，需明确共存/替换策略，避免变成"又加一个系统"',
    '10月第一周辉哥广州峰会前完成：与梁在中pre-brief对齐、端到端方案初稿输出、高层关系加固；峰会后推动POC启动');
  insertContact.run(6, '梁在中', '总监事长/创始人之子', '战略层', '决策层', '', '', 1, '创始人之子/总监事长，9/17亲自牵头升级项目，最高决策人🔥');
  insertContact.run(6, '龙瑶', 'SSC部长', '人力资源(SSC)', '管理层', '', '', 1, '吉利案例引荐人，8/26深度交流5.5h，内部核心推动者');
  insertContact.run(6, '张名全', 'HR总监', '人力资源部', '管理层', '', '', 0, 'AI转型牵头人，HR场景对接');
  insertContact.run(6, '三一IT总监', 'IT总监', 'IT部', '管理层', '', '', 0, '技术架构对接人，700+老系统/Hermes/Dify现状梳理');
  insertContact.run(6, '玉平(赵玉平)', 'BD(明略)', '市场部', '执行层', '', '', 0, '明略方BD负责人，龙瑶关系维护');
  insertContact.run(6, '徐浩', 'HR线(明略)', 'HR方案', '执行层', '', '', 0, '明略方HR场景方案支持');

  // === 7. 极光湾 (id=7) ===
  insertReport.run(7, 'weekly', '2026-W39',
    '极光湾尾随吉利战术推进(跟AIC陈博团队copy)，赵福成要求40+管理层全打卡辉哥视频，技术负责人9月驻场准备10月启动',
    '1. 吉利+雷诺合资公司(雷神动力)1.9万人/130国18工厂\n2. 赵福成(研究院总负责人)要求40+管理层全员打卡辉哥视频学习\n3. 策略完全复刻吉利路径：7场景(原动力/会议Agent/研发AI/数据治理/BPM/端侧模型/数字员工)\n4. 技术负责人9月已开始驻场准备\n5. 必须私有化部署，跟随吉利飞书生态',
    '需要确认吉利POC结项时间线，极光湾10月启动节奏依赖吉利复盘输出',
    '需要刘静统筹吉利-极光湾资源调配；需要威少方案复用吉利材料快速适配',
    '吉利POC未结项前，极光湾方案无法最终定稿',
    '完成吉利POC复盘后，10月正式启动极光湾项目，输出7场景适配方案');
  insertContact.run(7, '赵福成', '研究院总负责人', '研究院', '决策层', '', '', 1, '研究院总负责人，要求40+管理层全打卡辉哥视频，核心决策人');
  insertContact.run(7, '陈博', 'AIC团队', 'AI中心', '管理层', '', '', 0, 'AIC团队负责人，极光湾尾随copy其团队打法');
  insertContact.run(7, '极光湾IT负责人', 'IT负责人', 'IT部', '执行层', '', '', 0, '技术对接人');
  insertContact.run(7, '刘静(Elva)', '大客户经理(明略)', '客户成功', '管理层', '', '', 0, '明略方主跟，吉利-极光湾生态统筹');

  // === 8. 墨迹天气 (id=8) ===
  insertReport.run(8, 'weekly', '2026-W39',
    '墨迹天气AI Coding POC接近完成，5大需求验证通过，付费意愿强，朱翾蒙准备商务方案~100万',
    '1. AI Coding 5大场景POC进展：需求自动生成✓/方案自动生成✓/用例自动生成✓/打通简单云GitLab✓/多智能体协同✓\n2. 最佳实践沉淀功能开发中，提效量化数据开始积累\n3. 金犁(创始人)高度关注进展，贾彤前期关系铺垫到位\n4. 威少方案架构获得研发团队认可\n5. 竞品对比：阿里MuleRun/埃森哲，Octo多智能体协同能力差异化明显',
    '',
    '需要朱翾蒙准备正式商务方案和报价(预估~100万)；需要威少配合商务技术答疑',
    '',
    'POC正式结项后即刻启动商务谈判，目标10月内签约');
  insertContact.run(8, '金犁', '创始人/CEO', '管理层', '决策层', '', '', 1, '创始人，亲自发起AI Coding招标，最高决策人');
  insertContact.run(8, '墨迹研发VP', '研发VP', '研发部', '决策层', '', '', 0, '技术决策人，POC效果评审');
  insertContact.run(8, '墨迹技术负责人', '技术负责人', '研发部', '执行层', '', '', 0, 'POC技术对接，日常联调');
  insertContact.run(8, '贾彤', '早期客户(明略)', '销售部', '管理层', '', '', 0, '明略方前期关系铺垫');
  insertContact.run(8, '朱翾蒙', '销售(明略)', '销售部', '执行层', '', '', 0, '明略方销售，负责商务方案');
  insertContact.run(8, '威少(杨威)', '方案架构VP(明略)', '方案部', '管理层', '', '', 0, '明略方方案架构师');

  // === 9. 金智教育 (id=9) ===
  insertReport.run(9, 'weekly', '2026-W39',
    '金智教育三重属性(客户/渠道/共创)跑通15Bot，但商务模式未定是核心卡点，需辉哥与郭超(董事长)碰定位',
    '1. 15Bot/11员工/4群已稳定运行，16自建skill\n2. CCF论坛双logo展示、南京科技职业学院试点、中传智能体答辩共创均在推进\n3. 知途子公司(于总)教育渠道合作探讨\n4. 叶佳/胡曦/张旭9/7接手后持续对接\n5. 核心卡点：郭超(董事长)辉哥直接关系，但商务模式(客户/渠道/共创三身份)未定',
    '需要辉哥安排与郭超会面，明确商务定位：是直接客户、还是渠道合作伙伴、还是产品共创方？三种模式资源投入和商业回报差异很大',
    '需要叶佳持续对接叶佳/胡曦/张旭维持项目热度；需要明确商务后才能投入更多产研资源',
    '商务模式未定前无法推进正式合同，也无法大规模投入产研资源',
    '安排辉哥-郭超会面明确合作定位，锁定商务模式后推进合同签署');
  insertContact.run(9, '郭超', '董事长', '管理层', '决策层', '', '', 1, '董事长，辉哥直接关系，核心决策人');
  insertContact.run(9, '于总', '知途子公司负责人', '知途子公司', '管理层', '', '', 0, '知途子公司负责人，教育渠道合作');
  insertContact.run(9, '叶佳', '对接人(明略)', '技术对接', '执行层', '', '', 0, '明略方9/7接手主对接');
  insertContact.run(9, '胡曦', '对接人(明略)', '技术对接', '执行层', '', '', 0, '明略方技术对接团队');
  insertContact.run(9, '张旭', '对接人(明略)', '技术对接', '执行层', '', '', 0, '明略方技术对接团队');

  // === 10. 致远互联 (id=10) ===
  insertReport.run(10, 'weekly', '2026-W39',
    '致远互联互补定位明确(致远=System of Record/Octo=System of Agent)，辉哥定调"代码开源赚token+FDE"，须签边界备忘防白嫖',
    '1. 回顾关键时间线：吴明辉(明略创始人)7/12亲自创建Octo子区→致远创始人徐总7/14带队来访明略→8/31致远已用Loop做内部汇报\n2. 互补定位清晰：致远35家一级央企客户的OA是System of Record，Octo作为System of Agent嵌入\n3. 辉哥定调商业模式：代码开源随便用，赚Token用量费+FDE(Frontier Development Environment)服务费\n4. 史佳艳持续对接推进',
    '需要法务/产品输出一页边界备忘录：明确哪些代码开源、哪些是商业服务、Token计费标准、FDE服务范围，防止致远白嫖开源部分后不签商业协议',
    '需要法务配合输出边界备忘录；需要产品明确开源边界',
    '边界备忘未签前，不宜过度开放核心能力',
    '推动边界备忘录签署，确认Token+FDE商业模式细节，依托致远35家一级央企渠道启动联合拓客');
  insertContact.run(10, '吴明辉', '明略科技创始人', '管理层', '决策层', '', '', 1, '明略创始人，7/12亲自为致远创建Octo子区，内部最高推动者');
  insertContact.run(10, '徐总', '致远互联创始人', '管理层', '决策层', '', '', 0, '致远创始人，7/14带队来访明略');
  insertContact.run(10, '史佳艳(佳艳)', '大客户经理(明略)', '客户成功', '执行层', '', '', 0, '明略方主跟，致远生态日常对接');

  // === 11. 普联香港 (id=11) ===
  insertReport.run(11, 'weekly', '2026-W39',
    '普联香港姜平亲推年预算600万，OA+Octo融合共建，9月底第一批bot硬时点，进度会待安排(姜平已催)',
    '1. 姜平亲自推荐推进，客户年预算600万\n2. 合作模式：OA+Octo系统级融合共建(明略不提供产研资源，只提供培训支持)\n3. 9月底出第一批bot是硬性时间节点\n4. Amy负责对接',
    '进度会待安排(姜平已催但尚未落实)，需要尽快锁定会议时间',
    '需要Amy尽快安排进度会；需要准备培训材料(不提供产研只提供培训)',
    '进度会未开，9月底硬时点压力大',
    '本周内安排进度会，锁定第一批bot需求清单和交付计划，确保9月底硬时点达成');
  insertContact.run(11, '姜平', 'CEO(明略)', '管理层', '决策层', '', '', 1, '明略CEO，亲自推荐推动普联项目');
  insertContact.run(11, '普联IT负责人', 'IT负责人', 'IT部', '管理层', '', '', 0, '客户方IT对接人');
  insertContact.run(11, '张晓(Amy)', '大客户经理(明略)', '客户成功', '执行层', '', '', 0, '明略方主跟');

  // === 12. 中信资本 (id=12) ===
  insertReport.run(12, 'weekly', '2026-W39',
    '中信资本S级客户Octopush待装，但费用见底是当前卡点，需卉子确认费用方案',
    '1. S级金融客户持续跟进\n2. Octopush消息推送功能待安装\n3. 费用问题导致推进停滞',
    '需要确认Octopush费用方案(是否可以特批/试用延期)',
    '需要卉子与资本市场渠道确认费用支持方案',
    'Octopush费用见底，客户不愿在未体验价值前付费',
    '确认费用方案后推进Octopush安装，展示投资研究场景价值');
  insertContact.run(12, '中信资本IT负责人', 'IT负责人', 'IT部', '管理层', '', '', 0, '技术对接人');
  insertContact.run(12, '中信资本投研负责人', '投研负责人', '投资研究部', '决策层', '', '', 0, '业务决策人');
  insertContact.run(12, '卉子', '资本市场渠道(明略)', '渠道部', '执行层', '', '', 0, '明略方资本市场渠道负责人');

  // === 13. 混沌学园 (id=13) ===
  insertReport.run(13, 'weekly', '2026-W39',
    '混沌学园注册未用，价格敏感对标Coze，A级Onboarding≠高转化的典型案例',
    '1. CEO活动后注册开通，但开通后未深度使用\n2. 客户对标Coze免费/低价方案，价格敏感度高\n3. 混沌+晚点贡献96%活动开通量但转化率极低',
    '',
    '',
    '价格敏感+已有免费替代方案(Coze)，转化难度大',
    '保持轻量触达不投重型资源，等待客户主动需求或产品有差异化突破点');
  insertContact.run(13, '混沌产品负责人', '产品负责人', '产品部', '管理层', '', '', 0, '产品对接人');
  insertContact.run(13, '贾金良(贾叔)', 'SDR线索(明略)', 'SDR', '执行层', '', '', 0, '明略方早期客户跟进');

  // === 14. 健主任 (id=14) ===
  insertReport.run(14, 'weekly', '2026-W39',
    '健主任10万服务包已付费，医疗连锁AI助手交付中',
    '1. 10万服务包已完成付费\n2. 医疗连锁运营AI助手功能开发中\n3. Amy负责交付跟进',
    '',
    '',
    '',
    '完成服务包交付，确保客户满意度，争取增购或转介绍');
  insertContact.run(14, '健主任CEO', 'CEO', '管理层', '决策层', '', '', 0, '创始人/决策人');
  insertContact.run(14, '健主任运营负责人', '运营负责人', '运营部', '执行层', '', '', 0, '日常运营对接');
  insertContact.run(14, '张晓(Amy)', '大客户经理(明略)', '客户成功', '管理层', '', '', 0, '明略方主跟');

  // === 15. 刀法咨询 (id=15) ===
  insertReport.run(15, 'weekly', '2026-W38',
    '刀法咨询(刀姐IP)评估PR合作价值，1人1Agent概念有传播潜力',
    '1. 刀姐IP影响力评估中\n2. 1人1Agent概念适合作为PR传播案例\n3. 商业价值有限',
    '',
    '',
    '',
    '评估PR合作价值，如合适可做联合内容营销，不投入重型产研资源');
  insertContact.run(15, '刀姐(创始人)', '创始人', '管理层', '决策层', '', '', 0, '刀法咨询创始人，IP核心');
  insertContact.run(15, '贾金良(贾叔)', 'SDR线索(明略)', 'SDR', '执行层', '', '', 0, '明略方跟进');

  // === 16. Hysan希慎 (id=16) 战败 ===
  insertReport.run(16, 'weekly', '2026-W37',
    'Hysan希慎确认战败，香港法务三大卡点(SOC2/ISO27001/Token不封顶/专业责任险)无法短期解决',
    '1. 法务审核最终反馈：SOC2/ISO27001资质缺失短期内无法补救\n2. Token费用不封顶模式客户坚决不接受(香港企业要求可预期成本)\n3. 专业责任险(Professional Indemnity Insurance)明略无法提供\n4. 客户正式通知放弃合作',
    '',
    '',
    '三大卡点均为公司层面合规和商业模式问题，非单点项目团队能解决',
    '沉淀香港市场合规准入Checklist(SOC2认证+Token封顶/套餐方案+PII保险)，为后续香港客户前置准备；不继续投入资源');
  insertContact.run(16, 'Hysan IT负责人', 'IT负责人', 'IT部', '管理层', '', '', 0, '项目对接人，对产品认可');
  insertContact.run(16, 'Hysan法务负责人', '法务负责人', '法务部', '决策层', '', '', 0, '合规审核决策人，三大卡点最终裁定者');
  insertContact.run(16, '张晓(Amy)', '大客户经理(明略)', '客户成功', '执行层', '', '', 0, '明略方主跟');

  // === 17. 方里 (id=17) 战败 ===
  insertReport.run(17, 'weekly', '2026-W37',
    '方里(FunnyElves)战败确认：飞书Aily双闭环(内部+外部)生态锁定，原A级客户战败教训→先评生态锁定度再定级',
    '1. 原A级Onboarding客户，Onboarding体验良好\n2. 深入了解后发现客户已深度使用飞书Aily：内部协同Aily+外部营销Aily双闭环\n3. 飞书Aily已嵌入客户日常工作流，替换成本极高\n4. 客户明确表示无意愿引入第二套AI平台\n5. 战败教训：A级Onboarding≠高转化！必须先评估"生态锁定度"',
    '',
    '',
    '飞书Aily生态锁定一旦建立几乎不可破(得到/方里/联合影像/欢瑞/吉利都受影响)',
    '沉淀教训：今后定级前必须先评估客户的生态锁定度(飞书/钉钉/企微AI使用深度)；飞书深度客户策略调整为"融入飞书"而非"替代飞书"(如吉利模式)');
  insertContact.run(17, '方里市场负责人', '市场负责人', '市场部', '管理层', '', '', 0, '最初对接人，Onboarding积极但最终因飞书锁定无法推进');
  insertContact.run(17, '方里IT负责人', 'IT负责人', 'IT部', '决策层', '', '', 0, 'IT决策人，明确表示飞书Aily已满足需求');
  insertContact.run(17, '贾金良(贾叔)', 'SDR线索(明略)', 'SDR', '执行层', '', '', 0, '明略方跟进');
});
insertSampleData();

export default db;
