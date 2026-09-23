import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, unlinkSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data', 'mkt-crm.db');
mkdirSync(join(__dirname, 'data'), { recursive: true });

// Fresh schema — delete old db if exists
if (process.env.RESET_DB === '1' && existsSync(dbPath)) { try { unlinkSync(dbPath); } catch(e) {} }

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

  -- CEO活动/演讲(辉哥获客活动)
  CREATE TABLE IF NOT EXISTS ceo_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    event_type TEXT DEFAULT '演讲' CHECK(event_type IN ('演讲','峰会','论坛','私享会','闭门会','发布会','沙龙','展会','其他')),
    date TEXT DEFAULT '',
    end_date TEXT DEFAULT '',
    location TEXT DEFAULT '',
    topic TEXT NOT NULL DEFAULT '',
    speech_type TEXT DEFAULT '主题演讲',
    status TEXT DEFAULT '已结束' CHECK(status IN ('筹备中','进行中','已结束','已取消')),
    audience_count INTEGER DEFAULT 0,
    audience_profile TEXT DEFAULT '',
    business_design TEXT DEFAULT '',
    story_line TEXT DEFAULT '',
    key_messages TEXT DEFAULT '',
    wechat_followers INTEGER DEFAULT 0,
    registrations INTEGER DEFAULT 0,
    activations INTEGER DEFAULT 0,
    mql_count INTEGER DEFAULT 0,
    sql_count INTEGER DEFAULT 0,
    opportunity_count INTEGER DEFAULT 0,
    estimated_ppl TEXT DEFAULT '',
    customer_feedback TEXT DEFAULT '',
    investor_feedback TEXT DEFAULT '',
    feedback_summary TEXT DEFAULT '',
    structural_insights TEXT DEFAULT '',
    long_tail_content TEXT DEFAULT '',
    action_items TEXT DEFAULT '',
    most_important TEXT DEFAULT '',
    key_work TEXT DEFAULT '',
    need_decision TEXT DEFAULT '',
    cross_team_needs TEXT DEFAULT '',
    bottlenecks TEXT DEFAULT '',
    next_important TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    created_by TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS ceo_event_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES ceo_events(id) ON DELETE CASCADE,
    source_event_id INTEGER DEFAULT NULL REFERENCES ceo_events(id) ON DELETE SET NULL,
    account_id INTEGER DEFAULT NULL REFERENCES accounts(id) ON DELETE SET NULL,
    contact_name TEXT DEFAULT '',
    contact_title TEXT DEFAULT '',
    company_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    source TEXT DEFAULT '现场扫码',
    response_level TEXT DEFAULT '温' CHECK(response_level IN ('热','温','冷')),
    is_champion INTEGER DEFAULT 0,
    follow_up_status TEXT DEFAULT '待跟进',
    assigned_to TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
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
    source_event_id INTEGER DEFAULT NULL REFERENCES ceo_events(id) ON DELETE SET NULL,
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

// ===== 种子数据：仅在空库时插入（防止重启重复导入）=====
const __accountsCount = (() => { try { return db.prepare('SELECT COUNT(*) as c FROM accounts').get().c; } catch(e) { return -1; } })();
if (__accountsCount === 0) {
  // ===== 插入示例数据 =====
  db.exec(`
    -- 旧events种子已移除(通用Event板块已删除)
    -- 媒介力学+WRC数据后续迁移到ceo_events

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
      '已签约', 20, '20万(两年期合同)，部署进行中', 'CEO+CMO辉哥直通，前宝洁系管理团队，愿景统一替代钉飞企微',
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
      'HKIC', '专业服务/会计', '中型机构', '香港', '香港渠道', 'B',
      '2026-08-15', '2026-09-18', 5, '香港会计行业AI审计/税务助手POC',
      'Amy/梦林', '已签约', '9/18现场安装POC，卡点：Token显示缺失、云主机2000元/月异议',
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
      '投标中', 200, '首期≤200万（咨询+bot搭建全案服务），二三期每期约200万，12/31前闭环。9/18述标完成纯技术打分', '贾祥轩5/9官网主动联系→9/10招标翻转(营销线C类→IT线CIO景宏源招标)',
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
      '普联香港', '制造/网络设备', '大型(年预算600万)', '香港', '姜平亲推', 'B',
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
      'Amy', 'C类跟进', '10万服务包，医疗连锁，已付费',
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
      '方里', '美妆个护', '中型新消费', '华东', 'CEO活动/A级Onboarding', 'D',
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

    -- 18. 曼伦：C类跟进/on hold
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      '曼伦', '', '', '', 'Onboarding S级', 'C',
      '2026-08-01', '2026-09-01', 2, 'S级评级高付费潜力，但信息极少on hold',
      '叶佳', 'on hold', 'S级/on hold/信息少，原因待补充',
      '观察', 0, '待评估', 'Onboarding S级',
      1, '', '', '',
      '', '', '',
      '信息极少，客户画像不完整(行业/规模/需求/联系人均缺失)；on hold原因不明',
      '叶佳补充客户完整信息，明确on hold原因', '', 0, '',
      '[{"date":"2026-08-01","event":"S级Onboarding","note":"前期评估为S级高付费潜力客户"},{"date":"2026-09-01","event":"on hold","note":"进入on hold状态，原因待查"}]',
      'S级客户on hold，信息极少。叶佳负责，需补充客户完整信息(行业/规模/需求/联系人)和on hold原因。S级客户每月至少一次主动触达。'
    );

    -- 19. PPIO：C类跟进/攻坚后停滞
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      'PPIO', '云计算/边缘计算', '中型(分布式GPU云平台)', '', '第一梯队攻坚目标', 'C',
      '2026-07-01', '2026-08-15', 5, '边缘计算/分布式GPU云平台，11人2Agent，攻坚后停滞，场景匹配度待验证',
      '刘静(Elva)', 'on hold', '11人+2Agent但无活跃使用，攻坚后停滞',
      '观察', 0, '待评估，场景匹配度待验证', '第一梯队攻坚',
      1, '技术/研发', '', '技术型团队上手门槛低，11人+2Agent已有基础但无活跃使用',
      'SaaS', 'AI团队协同+潜在算力+Agent平台生态合作',
      '分布式GPU/边缘计算团队的AI协同需求场景不明确(内部协同？客户服务？研发流程？)',
      '攻坚后无后续实质性进展；11人+2Agent但缺乏杀手级场景驱动；PPIO核心业务与Octo协同定位场景交叉点不清晰',
      '刘静重新接触客户了解实际需求，探索算力+Agent平台生态合作，识别1个高价值场景做Demo', '', 0, '无强锁定',
      '[{"date":"2026-07-01","event":"首次接触","note":"定位为第一梯队攻坚目标"},{"date":"2026-08-01","event":"开通账号","note":"11人+2Agent开通"},{"date":"2026-08-15","event":"攻坚后停滞","note":"初期接触未转化为持续需求，进入on hold"}]',
      '边缘计算/分布式GPU云平台，曾定位第一梯队攻坚。11人+2Agent但无活跃使用，场景交叉点不清晰。潜力：GPU云+Octo Agent互补可能。刘静负责。'
    );

    -- 20. 联合影像(Kickers.ai)：C类跟进/飞书迁移中
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      '联合影像', '医疗影像/AI', '小型(10+人AI团队)', '', '贾叔跟进', 'C',
      '2026-07-15', '2026-09-01', 4, '医疗AI团队独立协作空间，飞书主力新项目用Octo，潜在模型网关商机(5%差价)',
      '贾金良(贾叔)', '跟进中', '飞书主力/新项目用Octo，使用深度极浅(7/15仅3条消息0条bot)',
      '跟进中', 0, '待评估，潜在模型网关5%差价商机', '贾叔跟进',
      3, 'AI研发', '飞书/OpenClaw/Cloud Code/CodeBuddy', '10+人AI团队对Agent/多模型协同有真实需求，迁移策略已定(新项目Octo/老项目飞书)',
      'SaaS/混合', 'AI团队独立协作空间+统一模型网关平台(5%模型调用差价)',
      'AI团队需要独立于公司飞书的协作空间；统一模型调用网关需求',
      '飞书使用惯性极大(全公司飞书)；7/15仅3条人类消息0条bot协作使用深度极浅；多工具并行分散注意力(飞书/OpenClaw/Cloud Code/CodeBuddy)',
      '推动重新安装Octopush让团队日常使用，发吉利分享录屏展示多Agent价值，推动产研用Octo跑新项目', '', 0, '飞书主力(双轨运行摩擦成本)',
      '[{"date":"2026-07-15","event":"跟进","note":"贾叔跟进，空间名Kickers.ai，仅3条消息0条bot"},{"date":"2026-07-18","event":"迁移策略确定","note":"新项目用Octo/老项目留飞书"}]',
      '医疗AI 10+人团队，飞书主力/新项目用Octo。对接人刘应龙/新意/青山。潜在模型网关商机(5%差价)。使用深度极浅需推动Octopush重新安装。与卓正形成医疗双案例。贾叔负责。'
    );

    -- 21. 中金公司：C类跟进/早期试用
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      '中金公司', '金融/证券', '大型券商', '北京', '卉子资本市场渠道', 'C',
      '2026-08-01', '2026-09-01', 2, '金融证券AI投研助手，资本市场早期试用',
      '卉子', '跟进中', '卉子资本市场渠道引入，早期试用阶段',
      '跟进中', 0, '待评估', '卉子资本市场渠道',
      1, '', '', '',
      '', '投研AI助手+研报生成+数据分析',
      '证券投研效率提升',
      '早期试用阶段，使用情况待跟踪；场景需求待明确',
      '跟进使用情况，了解场景需求；鹏扬基金合同审核跑通后可复制', '', 0, '',
      '[{"date":"2026-08-01","event":"渠道引入","note":"卉子资本市场渠道引入"}]',
      '卉子资本市场渠道引入，金融证券行业早期试用。公募基金合同审核场景(鹏扬)跑通后可复制到中金。'
    );

    -- 22. 华泰研究所：C类跟进/早期试用
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      '华泰研究所', '金融/研究', '大型券商研究所', '', '卉子资本市场渠道', 'C',
      '2026-08-01', '2026-09-01', 2, '研究所研报AI辅助+分析场景，早期试用',
      '卉子', '跟进中', '卉子引入，研究报告/分析场景方向，早期试用',
      '跟进中', 0, '待评估', '卉子资本市场渠道',
      1, '研究', '', '',
      '', '研报AI辅助+数据分析+报告自动生成',
      '券商研究所研报产出效率提升',
      '早期试用阶段，场景需求待深入了解',
      '跟进使用情况，明确研报场景需求', '', 0, '',
      '[{"date":"2026-08-01","event":"渠道引入","note":"卉子资本市场渠道引入"}]',
      '卉子引入，研究报告/分析场景方向。鹏扬合同审核跑通后可复制到华泰等金融客户。'
    );

    -- 23. 鹏扬基金：C类跟进/合同审核数字化
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      '鹏扬基金', '金融/公募基金', '中型公募基金', '', '卉子渠道→玉平对接', 'C',
      '2026-08-18', '2026-09-20', 6, '合同审核流程数字化(专家团+webhook)，提交→法务评审→财务评审→OA调API，原邮件流转效率低',
      '赵玉平/贾金良/刘静', '跟进中', '8/18产品沟通会确认方案方向(专家团+webhook)，8/23刘静建子区，升温中🔥',
      '跟进中', 0, '待报价，专家团+webhook方案确认', '卉子资本市场渠道',
      1, '技术部', '', '黄梦成(技术部)对产品理解快推动执行力强；8/18沟通会已确认方案方向',
      '云上虚拟机(2核2G)/私有化待定', '合同审核数字化：专家团(法务+财务+AI Bot编排)+webhook精准推送，SOP写在专家团指引，运行时云上2核2G虚拟机',
      '合同审核原通过单点邮件流转，效率低无法追溯；期望迁移到群聊+AI协作模式实现串行审核',
      '1.私有化版本无Loop功能(客户看了Loop演示有兴趣)；2.多群webhook精准匹配待验证(10个业务同学各一群，专家团审核后需精准通知)；3.从试用到付费转化路径和商务模式未明确(SaaS按量vs私有化买断)',
      '玉平完成多群webhook精准匹配测试；跟进黄梦成专家团SaaS试用反馈；明确商务模式(SaaS按量or私有化注意Loop缺失)', '2026-10-15', 0, '',
      '[{"date":"2026-08-18","event":"产品沟通会","note":"黄梦成/玉平/刘静/贾叔参会，确认专家团+webhook方案方向"},{"date":"2026-08-23","event":"创建子区","note":"刘静创建鹏扬基金子区"},{"date":"2026-09-20","event":"升温中","note":"方案确认，技术验证中"}]',
      '公募基金合同审核数字化场景，需求清晰痛点明确(邮件→AI协作)。对接人黄梦成(技术部)。方案：专家团+webhook。卡点：私有化无Loop、多群webhook待验证、商务模式未定。跑通后可复制到中金/华泰。玉平/贾叔/刘静负责。🔥升温中。'
    );

    -- 24. 卓望：D类观察/中国移动子公司
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      '卓望', '通信/央企子公司', '大型(中国移动子公司)', '', 'Onboarding B级', 'D',
      '2026-07-01', '2026-08-01', 3, '中国移动子公司，对产品感兴趣想培训+产品合作，SaaS接入问题已解决但后续停滞',
      '贾彤', '观察中', '客户对产品感兴趣想培训+合作，SaaS版bot接入困难已远程解决，后续停滞',
      '观察', 0, '待评估', 'Onboarding B级',
      1, '', '', '客户主动表达培训+合作意向',
      'SaaS', '产品培训+合作探索',
      '央企子公司数字化转型需求',
      'SaaS接入问题解决后客户未进一步推进；央企决策链长内部审批采购流程可能较长',
      '贾彤联系李奕诺了解停滞原因，安排产品培训，明确合作模式', '', 0, '中国移动体系',
      '[{"date":"2026-07-01","event":"B级Onboarding","note":"评为B级高优先级"},{"date":"2026-07-15","event":"SaaS问题解决","note":"SaaS版接入bot困难已远程解决"},{"date":"2026-08-01","event":"停滞","note":"后续无新动态"}]',
      '中国移动子公司，对接人李奕诺。Onboarding B级，客户感兴趣想培训+产品合作。SaaS接入问题已解决但后续停滞。央企决策链长。贾彤负责。'
    );

    -- 25. 祥承：D类观察/pending未开始
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      '祥承', '', '', '', '叶佳/pending angelclaw', 'D',
      '2026-08-01', '2026-08-01', 1, 'pending/angelclaw/还未开始，信息极少',
      '叶佳', '待开始', 'pending angelclaw，尚未开始',
      '观察', 0, '待评估', 'pending',
      0, '', '', '',
      '', '', '',
      '尚未开始，无任何信息',
      '等待客户侧明确需求后再推进', '', 0, '',
      '[{"date":"2026-08-01","event":"pending","note":"angelclaw相关，尚未开始"}]',
      'pending/angelclaw，还未开始。叶佳负责，信息极少待补充。'
    );

    -- 26. 欢瑞世纪：D类观察/原C类降级
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      '欢瑞世纪', '影视/娱乐', '中型上市公司(200+员工)', '', '玉平跟进', 'D',
      '2026-07-01', '2026-09-07', 8, '上市影视公司，私有化部署+培训完成，51只虾仅2活跃，董秘Agent/CEO全景/录音豆场景，预算有限飞书迁移阻力大',
      '赵玉平', '观察中', '私有化+培训完成，51虾仅2活跃，9月从C类降级D类',
      '观察', 0, '预算有限，付费意愿低', '玉平跟进',
      2, '', '飞书', '私有化部署已完成，技术基础设施就位',
      '私有化', '董秘Agent(信息披露/合规问答)+CEO全景视角(经营数据+AI决策)+录音豆沉淀知识库+IR投资者关系',
      '上市公司董秘合规、经营决策、知识管理场景AI化需求',
      '1.预算有限(影视公司AI工具预算池小，付费意愿低)；2.场景空泛(董秘Agent/CEO全景/录音豆停在概念阶段)；3.飞书迁移阻力大(51只虾仅2活跃，推广不力)',
      '评估是否值得继续投入(2人活跃vs投入产出比)；如继续聚焦董秘Agent单场景做MVP', '', 0, '飞书迁移阻力大',
      '[{"date":"2026-07-01","event":"安装测试","note":"郭颂解决安装问题"},{"date":"2026-07-22","event":"场景提出","note":"赵玉平提出董秘Agent/CEO全景/录音豆三大方向"},{"date":"2026-08-14","event":"私有化完成","note":"私有化+培训完成，付费意愿低"},{"date":"2026-09-07","event":"试用中","note":"7月后无新进展仅2人活跃"},{"date":"2026-09-15","event":"降级D类","note":"从C类降级为D类观察"}]',
      '200+员工上市影视公司，原C类9月降级D类。私有化部署+培训完成但51虾仅2活跃。董秘Agent概念独特但预算有限+场景空泛+飞书阻力。技术支持郭颂。玉平负责。教训："部署≠使用"典型案例。'
    );

    -- 27. 青钜科技：D类观察/私有化完成Loop未用
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '青钜科技', '咨询/工程', '中型', '', '玉平/郭松', 'D',
      '2026-07-01', '2026-09-01', 4, '咨询/工程公司，私有化完成Loop未用，"部署≠使用"教训',
      '赵玉平/郭松', '观察中', '私有化完成，Loop未使用，待培训推进',
      '观察', 0, '待激活', '玉平跟进',
      1, '', '', '私有化已完成，技术基础设施就位',
      '私有化', '',
      '咨询/工程行业AI协同需求',
      'Loop未用=核心功能未体验(客户不了解或未培训)；整体使用深度和活跃度信息缺失',
      '安排Loop培训让客户体验核心功能，了解当前使用情况', '', 0, '',
      '[{"date":"2026-07-01","event":"私有化部署","note":"私有化部署完成"},{"date":"2026-09-01","event":"Loop未用","note":"Loop功能未使用，待培训"}]',
      '"部署≠使用"教训：私有化完成后停滞，需建立"部署后30天激活"机制。部署完成≠项目完成，培训+场景引导才是关键。与我思科技同类案例。',
      '咨询/工程公司，私有化完成但Loop未用。"部署≠使用"教训典型案例。玉平/郭松负责。待安排Loop培训。'
    );

    -- 28. 卓越教育：D类观察/建群阶段
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      '卓越教育', '教育', '', '', '8/17周会新增', 'D',
      '2026-08-17', '2026-08-17', 1, '教育行业新商机，8/17周会新增，建群阶段，待深入了解需求',
      '', '建群阶段', '8/17周会新增，建群阶段，待深入了解',
      '观察', 0, '待评估', '8/17周会新增',
      0, '', '', '',
      '', '', '教育行业AI转型需求待确认',
      '新商机，尚在建群阶段，需求未明确',
      '建群后深入了解客户需求', '', 0, '',
      '[{"date":"2026-08-17","event":"新增商机","note":"8/17周会新增，建群阶段"}]',
      '教育行业新商机，8/17周会新增，建群阶段待深入了解需求。'
    );

    -- 29. 新世纪医疗：D类观察/AI转型意向
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, notes) VALUES (
      '新世纪医疗集团', '医疗健康', '', '', '8/17周会新增', 'D',
      '2026-08-17', '2026-08-17', 1, '医疗健康集团，AI架构转型意向，8/17周会新增，需求待确认',
      '', '观察中', 'AI架构转型意向，需求待确认',
      '观察', 0, '待评估', '8/17周会新增',
      0, '', '', '',
      '', '', '医疗集团AI架构转型需求',
      'AI转型意向但具体需求和场景待确认',
      '跟进确认AI架构转型具体需求和场景', '', 0, '',
      '[{"date":"2026-08-17","event":"新增商机","note":"8/17周会新增，AI架构转型意向"}]',
      '医疗健康集团AI转型意向，8/17周会新增。与卓正/健主任形成医疗行业客户群。需求待确认。'
    );

    -- 30. 得到：放弃/飞书+自研AI生态锁定
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '得到', '知识服务/在线教育', '中型', '北京', 'Onboarding B级', 'D',
      '2026-07-01', '2026-08-01', 3, '知识服务平台，飞书+自研AI成熟，飞书生态锁定，放弃',
      '贾金良(贾叔)', '已放弃', '内部飞书+自研AI成熟，对接人忙于新产品，生态锁定无法突破',
      '放弃', 0, '飞书+自研AI已满足需求，无Octo增量价值', 'Onboarding B级',
      1, '', '飞书Aily+自研AI', '内部深度使用飞书，并已构建自研AI能力，Octo无法提供飞书生态内增量价值',
      '', '', '知识服务在线教育AI化',
      '1.内部飞书+自研AI体系成熟，Octo无法提供飞书生态内增量价值；2.对接人忙于新产品开发无精力评估外部工具',
      '', '', 0, '飞书生态+自研AI强锁定',
      '[{"date":"2026-07-01","event":"B级Onboarding","note":"曾重点跟进B级"},{"date":"2026-08-01","event":"放弃","note":"飞书+自研AI成熟，对接人忙新产品"}]',
      '飞书生态锁定典型：内部深度使用飞书+自研AI成熟，Octo无法提供增量价值。复活条件：飞书Aily无法满足多Agent协作时。教训：飞书深度客户先评生态锁定度再投入资源。',
      '飞书+自研AI成熟，飞书生态锁定放弃。贾叔负责。复活概率低。飞书生态锁定战败典型。'
    );

    -- 31. 流利说：放弃/内网限制+部署不统一
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '流利说', '教育/AI语言学习', '中型', '上海', '叶佳跟进', 'D',
      '2026-07-01', '2026-08-01', 3, 'AI英语学习平台，内网限制严格+部署方式不统一，SaaS试用后放弃',
      '叶佳', '已放弃', '内网限制多+部署不统一，SaaS版反馈后放弃',
      '放弃', 0, '内网兼容性无法解决', '叶佳跟进',
      1, '', '', '',
      '', '', 'AI教育平台内部协同AI化',
      '1.内网对外部工具接入限制严格，SaaS版无法顺畅使用；2.内部对SaaS vs私有化没有明确决策，试用后未推进正式评估；3.SaaS版试用后客户未给出正面反馈直接搁置',
      '', '', 0, '内网限制强',
      '[{"date":"2026-07-01","event":"SaaS试用","note":"SaaS版试用"},{"date":"2026-08-01","event":"放弃","note":"内网限制+部署不统一，试用后放弃"}]',
      '内网兼容性问题战败：内网限制严格SaaS无法顺畅使用，部署方式不统一(SaaS vs私有化未定)。复活条件：提供标准化企业级部署方案解决内网兼容。',
      '内网限制+部署不统一导致放弃。叶佳负责。复活条件：标准化企业级部署方案解决内网兼容。'
    );

    -- 32. 我思科技：放弃/部署≠使用
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '我思科技', '科技', '中型', '', '贾叔跟进/原C类试用', 'D',
      '2026-07-01', '2026-08-15', 4, '科技公司，私有化部署完成但使用停滞，"部署≠使用"典型',
      '贾金良(贾叔)', '已放弃', '私有化已部署但使用停滞，升级需求未推进',
      '放弃', 0, '私有化后沉寂', '原C类试用',
      1, '', '', '',
      '私有化', '', '科技企业AI协同需求',
      '私有化部署完成但客户内部未真正使用起来；缺乏内部推动力和明确应用场景；升级需求未推进自然搁置',
      '', '', 0, '',
      '[{"date":"2026-07-01","event":"私有化部署","note":"完成私有化部署"},{"date":"2026-08-15","event":"停滞放弃","note":"使用停滞，升级需求未推进"}]',
      '"部署≠使用"典型：私有化完成但缺乏场景引导和使用培训，客户部署后沉寂。教训：需建立"部署后30天激活"跟进机制，私有化交付不是终点。复活条件：客户主动提出升级需求。',
      '私有化部署但使用停滞。贾叔负责。"部署≠使用"教训，与青钜科技同类。复活概率有条件。'
    );

    -- 33. 元梦灵境：放弃/开通后完全沉寂
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '元梦灵境', '游戏/元宇宙', '', '', '贾叔跟进', 'D',
      '2026-07-01', '2026-07-15', 2, '游戏/元宇宙公司，开通后完全沉寂无任何使用',
      '贾金良(贾叔)', '已放弃', '开通后完全沉寂，无任何使用',
      '放弃', 0, '开通后未使用', '活动/注册获客',
      0, '', '', '',
      '', '', '',
      '开通后完全沉寂无任何使用，无内部推动者无明确需求',
      '', '', 0, '',
      '[{"date":"2026-07-01","event":"开通","note":"账号开通"},{"date":"2026-07-15","event":"沉寂","note":"完全无使用"}]',
      '开通后完全沉寂无任何使用，"部署≠使用"类别。复活概率低，需客户主动重新激活。',
      '开通后完全沉寂。贾叔负责。"部署≠使用"案例。复活概率低。'
    );

    -- 34. 云迹：放弃/攻坚后停滞
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '云迹科技', '机器人/酒店科技', '中型', '北京', '攻坚客户', 'D',
      '2026-07-01', '2026-08-01', 3, '机器人/酒店科技公司，攻坚后停滞无后续更新',
      '', '已放弃', '攻坚后停滞，无后续更新',
      '放弃', 0, '攻坚未转化', '攻坚目标',
      0, '', '', '',
      '', '', '酒店/机器人场景AI协同',
      '攻坚后停滞，未找到酒店/机器人场景切入点；无持续推进动力',
      '', '', 0, '',
      '[{"date":"2026-07-01","event":"攻坚","note":"定位攻坚目标"},{"date":"2026-08-01","event":"停滞","note":"攻坚后无后续更新"}]',
      '机器人/酒店科技攻坚后停滞，未找到场景切入点。复活条件：找到酒店/机器人场景切入点。',
      '攻坚后停滞。"部署≠使用"/开通后沉寂类别。复活条件：找到酒店/机器人场景切入点。'
    );

    -- 35. 北京破圈：放弃/内部BU停滞
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '北京破圈', '营销/代运营', '内部BU', '北京', '内部BU(明略)', 'D',
      '2026-05-01', '2026-05-09', 3, '明略内部BU(营销/代运营)，非外部客户，价值待验证停滞，最后活跃5/9',
      '贾金良(贾叔)/孙方超', '已放弃', '内部BU非外部客户，缺乏商务驱动力，子区最后活跃5/9超4个月无消息',
      '放弃', 0, '内部BU无商务驱动力', '内部BU',
      1, '', '', '',
      '', '', '内部营销代运营BU AI工具',
      '1.内部BU定位尴尬，不是真正外部客户，推进缺乏商务驱动力，内部协调成本高；2.子区最后活跃5/9已超4个月无消息，内部使用推动力完全消失',
      '', '', 0, '',
      '[{"date":"2026-05-01","event":"建子区","note":"创建子区"},{"date":"2026-05-09","event":"最后活跃","note":"子区20条消息后停滞，最后活跃5/9"}]',
      '内部BU不是真正外部客户，缺乏商务驱动力。教训：内部BU需明确业务价值和管理层推动才能推进。复活概率低，需新的内部战略方向。',
      '明略内部BU(营销/代运营)非外部客户，缺乏商务驱动力停滞。贾叔/孙方超负责。最后活跃5/9。复活概率低。'
    );

    -- 36. 香港中企：放弃/需求未建立信息不足
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '香港中企', '多行业/香港', '', '香港', '第三梯队SaaS试用', 'D',
      '2026-07-01', '2026-08-01', 2, '香港中资企业，第三梯队SaaS试用，信息极少需求不明',
      'Amy', '已放弃', '第三梯队SaaS试用，信息极少需求不明，无实质进展',
      '放弃', 0, '需求未建立', 'SaaS试用',
      0, '', '', '',
      'SaaS', '', '',
      '信息极少，客户未提出明确需求，SaaS试用后无实质进展',
      '', '', 0, '',
      '[{"date":"2026-07-01","event":"SaaS试用","note":"第三梯队SaaS试用"},{"date":"2026-08-01","event":"放弃","note":"信息极少无实质进展"}]',
      '需求未建立/信息不足：SaaS试用后无反馈无进展。复活条件：客户主动提出明确需求。教训：第三梯队客户不过度投入资源。',
      '第三梯队SaaS试用，信息极少需求不明。Amy负责。复活概率低。'
    );

    -- 37. 海归爸爸：放弃/需求未建立
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '海归爸爸', '教育', '', '', '第三梯队SaaS', 'D',
      '2026-07-01', '2026-08-01', 1, '教育行业，第三梯队SaaS试用，无实质进展需求未建立',
      '', '已放弃', '第三梯队SaaS，无实质进展',
      '放弃', 0, '需求未建立', 'SaaS试用',
      0, '', '', '',
      'SaaS', '', '教育行业AI需求',
      '无实质进展，客户未提出明确需求',
      '', '', 0, '',
      '[{"date":"2026-07-01","event":"SaaS试用","note":"第三梯队SaaS"}]',
      '需求未建立/信息不足，无实质进展。复活条件：客户主动提出明确需求。',
      '教育行业第三梯队SaaS，无实质进展。复活概率低。'
    );

    -- 38. 51World：放弃/需求未建立
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '51World', '数字孪生/元宇宙', '中型', '', '冷接触', 'D',
      '2026-07-01', '2026-07-15', 1, '数字孪生/元宇宙公司，冷接触无后续',
      '', '已放弃', '冷，无后续接触',
      '放弃', 0, '需求未建立', '冷接触',
      0, '', '', '',
      '', '', '数字孪生行业AI协同',
      '冷接触无后续，客户未表达明确需求；数字孪生/元宇宙行业本身遇冷',
      '', '', 0, '',
      '[{"date":"2026-07-01","event":"冷接触","note":"初步接触无反馈"}]',
      '需求未建立/信息不足+行业遇冷。复活条件：行业回暖+客户有AI协作需求。',
      '数字孪生/元宇宙冷接触无后续。复活概率低(需行业回暖)。'
    );

    -- 39. 西门子：放弃/关系型线索未转化
    INSERT INTO accounts (company_name, industry, scale, region, source, tier,
      first_touch_date, last_touch_date, touch_count, needs_summary,
      assigned_to, follow_up_status, octo_status,
      customer_stage, deal_amount, deal_stage, lead_source,
      key_contacts_count, key_departments, competitors, customer_recognition,
      deployment_type, product_solutions_detail, core_painpoint, blockers,
      next_step, next_deadline, ceo_involvement, ecosystem_lock,
      key_events, lessons_learned, notes) VALUES (
      '西门子', '工业/制造', '全球工业巨头', '中国', '杨三角关系线索', 'D',
      '2026-07-01', '2026-07-15', 2, '全球工业巨头，杨三角(杨国安教授)人脉圈关系型引荐(沙龙邀请函)，非销售驱动2周内未建商务接触即流失',
      '孙方超', '已放弃', '杨三角关系沙龙邀请层面，非销售驱动，未建立有效商务接触',
      '放弃', 0, '关系型线索未转化为商务机会', '杨三角关系/沙龙邀请函',
      1, '', '', '西门子体量巨大一旦切入价值极高',
      '', '', '工业巨头AI协同需求待挖掘',
      '1.非销售驱动：线索来自学术/人脉圈(杨三角关系)是关系型邀请而非客户主动需求；2.未建立有效对接：仅群里发邀请函辉哥问"谁去讲课"后无下文，未进入实质性商务接触',
      '', '', 0, '',
      '[{"date":"2026-07-01","event":"沙龙邀请","note":"孙方超群发西门子沙龙邀请函PDF，辉哥问谁去讲课"},{"date":"2026-07-15","event":"流失","note":"2周内未建商务接触，自然流失"}]',
      '关系型线索2周内不建立商务接触就流失！西门子教训：人脉引荐≠销售机会，需在关系窗口期快速建立商务对接。体量巨大一旦切入价值极高，但需找到对的人和对的场景。',
      '杨三角(杨国安教授)关系线索，孙方超引入。沙龙邀请函层面非销售驱动，2周未建商务接触即流失。教训：关系型线索2周窗口期。复活条件：西门子中国区有明确AI协作需求通过杨三角重新搭线。'
    );

    -- Speeches种子已移除(speeches表已删除，数据迁移到ceo_events)

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

    // ===== 5家重点客户补充联系人(来自全景报告) =====

    // --- 4. 宇通客车 补充联系人(全景报告提取) ---
    insertContact.run(4, '朱光海', '设计院副院长', '研发/设计', '管理层', '', '', 1, 'AI工作推进筹备组组长，deepminer/Octo深度用户');
    insertContact.run(4, '孙宇', '数据管理科科长', '数据管理', '管理层', '', '', 0, '数据管理条线对接人');
    insertContact.run(4, '费华', '底盘车间主任', '生产制造', '管理层', '', '', 0, '生产制造条线对接人');
    insertContact.run(4, '赵国力', 'IT技术管理科科长', 'IT部', '管理层', '', '', 0, 'IT执行层，参与招标评估');
    insertContact.run(4, '闫亚州', '研发数智化科科长', '研发中心', '管理层', '', '', 0, '研发数字化对接人');
    insertContact.run(4, '姚鑫鑫(博士)', '云端产品设计主管', '云端研发', '执行层', '', '', 0, '云端产品设计');
    insertContact.run(4, '邵玉龙(博士)', '电池管理系统技术组长', '研发中心', '执行层', '', '', 0, '电池管理系统技术');
    insertContact.run(4, '李海翔', '云端研发工程师', '云端研发', '执行层', '13700789673', '', 0, '云端研发');
    insertContact.run(4, '张文海', '云端软件工程师', '云端研发', '执行层', '15638088029', '', 0, '云端软件');
    insertContact.run(4, '叶雷', '控制策略技术研究工程师', '研发中心', '执行层', '18238279229', '', 0, '控制策略技术');
    insertContact.run(4, '方浩', '车端软件工程师', '研发中心', '执行层', '13526721290', '', 0, '车端软件');
    insertContact.run(4, '韩彬', '市场部科长', '市场部', '管理层', '', '', 0, '7/10加入，关注内容营销+GEO');
    insertContact.run(4, '陶冶(陶老师)', '品牌营销', '品牌营销', '执行层', '13633805677', '', 0, '7/29线上会议对接人');
    insertContact.run(4, '李思思', '港澳团队(明略)', '客户成功', '执行层', '', '', 0, '明略方9/18述标团队成员');
    insertContact.run(4, '连永强', '技术支持(明略)', '技术部', '执行层', '', '', 0, '明略方9/18述标团队成员');

    // 宇通 W37/W38 周报
    insertReport.run(4, 'weekly', '2026-W37',
      '宇通9/11贾祥轩主动拉明略入围招标！~200万项目"AI+企业智能体建设平台"，姜平定调"即使亏本也要拿"',
      '1. 回顾历程：5/9贾祥轩官网主动联系→5/27景宏源CIO带9人高管团来访→6/1内网部署Octo两大场景跑通(车联网产品设计+会议纪要)→7月营销侧韩彬/陶冶加入→8月私有化完成超20人使用→9/7周会曾因营销线预算极低决定降级\n2. 9/11重大翻转：贾祥轩主动拉明略入围IT线CIO景宏源主导的正式招标，项目"AI+企业智能体建设平台"约200万\n3. 9/14周会定调战略级：预算≤200万+二三期各200万，姜平"即使亏本也要拿"\n4. 竞品：酷开/浙江实在/联想/腾讯WorkBuddy/阿里QoderWork 5家同台\n5. Amy推进供应商入库，标书当日发出',
      '需要姜平定调资源投入优先级(亏本也拿=最高优先级)',
      '需Amy带队郑州述标，威少方案，贾金良/叶佳/连永强/李思思团队支持',
      '客户尚未做过Octo集团级私有化部署(仅开源SaaS环境)，9/18速标时间紧',
      '9/18郑州现场述标，纯技术打分，务必展示Octo AI原生平台差异化优势');
    insertReport.run(4, 'weekly', '2026-W38',
      '宇通9/18郑州述标完成，纯技术打分，等9/25前出结果。16+联系人覆盖10条线，客户认可Octo是AI原生平台',
      '1. 9/15-17 Amy推进供应商入库\n2. 关键发现：客户未做过Octo集团级私有化(仅开源部署在SaaS环境)，集团私有化需庞大内部审批短期做不了\n3. 9/18 Amy带队郑州现场述标(Amy+李思思+贾金良+叶佳+连永强)\n4. 述标现场较轻松纯技术打分(无采购在场)，通过后才进采购谈价\n5. 客户尚未想清楚AI板块具体做什么，更在意供应商案例及内部大量数据+系统集成问题\n6. 景宏源CIO对Octo AI原生定位认可\n7. 贾祥轩持续作为内部champion全程支持',
      '',
      '',
      '等9/25结果是唯一卡点',
      '9/25前跟进景宏源获取结果信号，做好中标后24h启动交付准备');

    // --- 5. 吉利汽车 补充联系人(全景报告提取) ---
    insertContact.run(5, '刘浩(浩总)', '高层/数字化负责人', '数字化中心', '决策层', '', '', 1, '高层数字化负责人，高度重视反复追问后续动作');
    insertContact.run(5, '康执玺', '项目管理与执行', '3DM', '执行层', '', '', 0, '场景选择/优先级/落地节奏把控');
    insertContact.run(5, '李先强', '平台AI部门', '平台AI部', '执行层', '', '', 0, 'SaaS试用对接人');
    insertContact.run(5, '杨毅', '营销场景POC对接', '营销中心', '执行层', '', '', 0, '营销场景POC对接');
    insertContact.run(5, '杨曌', '商务对接', '商务部', '执行层', '', '', 0, '与威少对接商务条款');
    insertContact.run(5, '李岩(Ethan)', '商务对接', '商务部', '执行层', '', '', 0, '与威少对接商务条款');
    insertContact.run(5, '郭一鸣', '项目参与', '项目组', '执行层', '', '', 0, '项目参与');
    insertContact.run(5, 'Catherine(邱凌燕)', '营销/社媒专家(明略)', '方案部', '执行层', '', '', 0, '明略方社媒数据驱动洞察场景评估');
    insertContact.run(5, '黄楠', 'FDE团队(明略)', 'FDE', '执行层', '', '', 0, '明略方FDE团队架构讨论');
    insertContact.run(5, '李梦林', '技术(明略)', '技术部', '执行层', '', '', 0, '辉哥指定参与研发POC');

    // 吉利 W37/W38 周报
    insertReport.run(5, 'weekly', '2026-W37',
      '吉利8/31最新测算锁定908人天/390万！产品路线确认融合客户统一工作台不新增入口，POC 9月底有条件结项',
      '1. 8/14私有化部署完成超20人使用\n2. 8/23精简实施方案到v2.52(1057人天/803.4万折后)；CIO汇报deck完成(Swiss IKB风格10页)；Octo环境全部调通外网地址公布\n3. 8/31重大里程碑：最新测算锁定908人天/390万；产品路线确认融合客户现有统一工作台不新增入口；POC 9月底有条件结项\n4. 4场景持续推进：营销内容生成+HR智能助手+周例会Loop+AI Coding\n5. 6个Bot(艾娃/毕达哥拉拉/Kotter/Brooks/杨贵妃/吉利项目助手)深度参与\n6. 刘昊(CDO)持续高频互动，自写《OCTO产品第一性原理》内部推广',
      '390万/908人天报价已提交，需客户确认商务流程',
      '常晓飞继续部署支持，徐浩驻场日会，飞书插件开发需排期',
      '飞书插件集成是POC结项前提',
      '9月底POC有条件结项，推动正式合同签署');
    insertReport.run(5, 'weekly', '2026-W38',
      '吉利9/15元动力里程碑节点已过，结果待客户确认；9/22周会决策资源聚焦吉利(致远/金智降级搁置)',
      '1. 9/15元动力平台里程碑节点(覆盖~1500高管至2027.9)\n2. 9/22周会重要决策：致远互联和金智被降级搁置，资源集中到吉利等重点客户\n3. 目标10月份发布吉利PR案例，姜平已向威少传达要求，刘静负责追踪\n4. 徐浩日会持续，飞书集成方案推进中\n5. 框架协议签署中\n6. 刘昊/乔帅/陈勇铁三角持续高频互动',
      '需要客户确认元动力里程碑结果；需要刘静对接PR案例推进',
      '资源聚焦后全力确保9月底POC结项',
      '元动力结果未确认影响后续节奏',
      '确认元动力里程碑结果，9月底POC有条件结项，推动390万合同签署');

    // --- 6. 三一重工 补充联系人(全景报告提取) ---
    // 注：张名全在原数据中错挂在id=5吉利下，这里正确挂在id=6
    insertContact.run(6, '联席总裁团队', '联席总裁', '最高决策层', '决策层', '', '', 0, '口头支持AI转型，实际行动力待验证(梁在中牵头后有望突破)');
    insertContact.run(6, '王华', '流程信息化总部总监', '流程信息化总部', '管理层', '', '', 0, '技术平台负责人，700+老系统改造挑战');
    insertContact.run(6, '傅杰', '流程信息化总部AI工程部部长', 'AI工程部', '管理层', '', '', 0, '关注跨session记忆安全边界');
    insertContact.run(6, '丛洋', '流程信息化总部架构师', 'IT架构', '执行层', '', '', 0, 'IT架构设计');
    insertContact.run(6, '苏曙', '流程信息化总部算法工程师', '算法部', '执行层', '', '', 0, '算法与AI技术');
    insertContact.run(6, '张汝珊', '人力资源总部产品经理', 'HR部', '执行层', '', '', 0, 'AI产品对接，探讨龙虾配置逻辑');
    insertContact.run(6, '毛导钦', '三一重能人力资源本部总监', '三一重能HR', '管理层', '', '', 0, '重能HR负责人');
    insertContact.run(6, '刘强', '重能人资人才发展部部长', '三一重能HR', '管理层', '', '', 0, '组织发展与人才');
    insertContact.run(6, '王志奎', '重能人资人才发展高级经理', '三一重能HR', '执行层', '', '', 0, '人才发展管理');
    insertContact.run(6, '可乐', 'AI超级玩家(前阿里)', '内部布道者', '执行层', '', '', 0, '内部AI布道者，主力工具Claude Code，提出token归属问题');
    insertContact.run(6, '孟超峰', '树根互联高级产品专家', '树根互联', '执行层', '', '', 0, '工业互联网产品(外部伙伴)');
    insertContact.run(6, '刘静(Elva)', '大客户负责人(明略)', '客户成功', '管理层', '', '', 0, '8/26交流会主持，整体策略把控');
    insertContact.run(6, '叶佳', 'AI Coding(明略)', '技术部', '执行层', '', '', 0, '8/26交流会参会(OctoPush演示)');

    // 三一 W37/W38 周报
    insertReport.run(6, 'weekly', '2026-W37',
      '三一8/26首次深度交流5.5h成果显著！张名全(HR总监)明确三步走AI转型计划，龙瑶(SSC部长)主导发薪端到端试点',
      '1. 8/26深度交流会5h37min：明略刘静主持+徐浩HR一号位+辉哥11点后到场+叶佳+玉平；三一张名全/龙瑶/王华/傅杰等约11人\n2. 完整展示Octo平台+AI组织转型理论(L0-L5)+吉利/宇通案例\n3. 张名全明确三步走：①数字员工建设(个人经验→组织资产)②AI嵌入业务(端到端流程改造，龙瑶主导发薪试点)③经营体AI化转型(AI原生5万人)\n4. 张名全关键判断："脊背发凉的紧迫感，若落后未来5-10年可能被淘汰"\n5. 客户提出5项产研交流诉求：产品架构/记忆管理/Agent鉴权/Agent协作/系统集成\n6. 客户现状：700+老系统，仅几百人用AI月均Token30万，点状应用省力未省人',
      '需要威少+梦林10月安排产研交流回复5项技术议题',
      '徐浩HR线持续跟进，叶佳AI Coding支持',
      '5项技术议题暂无正式回复，计划10月吉利案例出结果后以实战数据支撑回答',
      '9月维持联系不主动推进，10月初辉哥培训待确认，准备吉利POC结果作为案例支撑');
    insertReport.run(6, 'weekly', '2026-W38',
      '三一9/2-9/14：确认10月邀辉哥做半天培训→9/17🔥重大升级梁在中(总监事长/创始人之子)亲自牵头！从50人培训→几百人广州分享',
      '1. 9/2三一提出5项产研交流诉求，明略表态10月推进\n2. 9/7周会确认9月暂缓主动推进等吉利POC结果\n3. 9/14周会更新：确认10月邀辉哥做半天培训(原定50人高管培训)\n4. 🔥9/17重大升级：梁在中(集团总监事长/创始人梁稳根之子/集团实际决策核心)亲自牵头！10月第一周邀辉哥去广州做分享，参会规模升级为各部门一把手+核心人员几百人\n5. 从"张名全HR线推动"→"集团最高层亲自牵头"，规模从50人→几百人\n6. 龙瑶已主导发薪全流程端到端试点\n7. 多语言Agent分身是三一全球化差异化亮点',
      '需要辉哥确认10月广州分享日期和材料准备方向(AI原生转型+吉利/三一案例+Octo愿景)',
      '玉平协调辉哥行程和分享材料(章鱼烧协助)；威少+梦林准备5项技术议题回复',
      '5项技术议题若10月不能给出答复，窗口期可能浪费',
      '本周确认辉哥广州分享具体日期/议程/材料需求；9月底前准备好分享材料；10月安排产研交流');

    // --- 7. 极光湾 补充联系人(全景报告提取) ---
    insertContact.run(7, '鹏飞', '研发AI专项牵头人', '研发AI', '管理层', '', '', 1, '"夹心层"上承领导要求下接工程师需求，与杭总密切配合，8/27出席');
    insertContact.run(7, '陶总', '数字化中心负责人', '数字化中心', '管理层', '', '', 0, 'AI运营官/浩思集团AI大旗负责人，要求团队80人看辉哥视频');
    insertContact.run(7, '杭渝峰(Tony/杭总)', 'CIO', 'IT部', '决策层', '', '', 0, 'CIO，公司级数据治理专项负责人，直汇赵福成');
    insertContact.run(7, '张进科(金科)', 'AI大数据团队负责人', 'AI大数据', '执行层', '', '', 0, '陶总直属偏技术脑，在极光湾Octo群');
    insertContact.run(7, '汪明月', '副院长', '研究院', '管理层', '', '', 0, '在极光湾Octo群');
    insertContact.run(7, '郝玉坤(郝总)', '研发高管', '研发部', '管理层', '', '', 0, '研发相关高管，8/27出席');
    insertContact.run(7, '郝林', '高管', '管理层', '管理层', '', '', 0, '8/27出席(职位待确认)');
    insertContact.run(7, '任杰', '研发人员', '研发部', '执行层', '', '', 0, '8/27会议中途13:12到场');
    insertContact.run(7, '孙芳', '研发人员', '研发部', '执行层', '', '', 0, '研发人员');
    insertContact.run(7, '孙建兵', '新能源电控系统开发专家', '数据治理项目组', '执行层', '', '', 0, '杭总下属数据治理项目组');
    insertContact.run(7, '李梦林/王怡琳/辛毅', '技术团队(明略)', '技术部', '执行层', '', '', 0, '9月整月长驻四期工位');

    // 极光湾 W37/W38 周报
    insertReport.run(7, 'weekly', '2026-W37',
      '极光湾8/27首次深度交流2h确认：必须私有化+7场景+尾随AIC战术+原动力9月切入口+技术负责人9月整月长驻',
      '1. 起点：赵福成看了晚点关于明略AI native组织的文章后认同理念\n2. 8/27首次深度交流(13:08-14:54)四期极客空间，明略刘静早班机+威少+技术负责人；极光湾鹏飞/陶总/杭渝峰/张进科/郝玉坤/郝林/任杰/孙芳出席\n3. 核心确认：①必须私有化部署(研发数据红线)②每人配数字分身③工作全程在Octo发生(知识留存于己)④原动力(敏态协作)为9月重点切入口⑤尾随AIC战术(AIC击穿什么就copy什么)⑥技术负责人9月整月长驻\n4. 7大场景确认：原动力/会议Agent/研发AI/数据治理/BPM/端侧模型COA-BOA/数字员工商品化\n5. 赵福成(一把手)要求40+管理层全员打卡辉哥领航班视频；陶总要求团队80人也看完',
      '需确认吉利POC结项时间线，极光湾完全依赖吉利AIC进展',
      '技术团队9月长驻四期工位做方案细化',
      '吉利POC未结项前方案无法最终定稿',
      '技术负责人驻场细化原动力方案，等吉利POC复盘后10月正式启动');
    insertReport.run(7, 'weekly', '2026-W38',
      '极光湾技术负责人9月驻场准备推进中，赵福成40+管理层打卡辉哥视频持续进行，Octo空间6用户(鹏飞+Tony)0agent待推进',
      '1. 技术团队(李梦林/王怡琳/辛毅)9月整月长驻四期工位\n2. 与数字化团队+研发AI专项组细化原动力场景方案\n3. 杭总(CIO)推进数据治理AI化专项\n4. 陈博(AIC负责人)团队co-work中，尾随吉利AIC路径\n5. 当前Octo空间6用户(含鹏飞和Tony/杭总)，0个agent待推进\n6. 明确"不做先行探索"策略——AIC击穿什么就copy什么',
      '需要吉利POC结项复盘输出，作为极光湾方案基础',
      '刘静统筹吉利-极光湾资源，威少方案复用吉利材料',
      '0个agent说明尚未进入实际使用阶段，需原动力场景上线激活',
      '完成吉利POC复盘后10月正式启动，推动首批agent上线');

    // --- 2. 南孚电池 补充联系人(全景报告提取) ---
    insertContact.run(2, '南孚CMO', 'CMO', '管理层', '决策层', '', '', 1, '二号位，前宝洁背景，辉哥已沟通认可度高');
    insertContact.run(2, '梁红莹', '总经理', '管理层', '决策层', '', '', 0, '总经理，曾拍板PR但未直接接触明略');
    insertContact.run(2, '雷佳乐', 'AI高级工程师(数字化部门)', '数字化部', '执行层', '', '', 0, '当前对接人，8/31接替离职的宋志平，偏技术背景');
    insertContact.run(2, '宋志平', '原对接人(已离职)', '数字化部', '执行层', '', '', 0, '原对接人已离职，曾用线下物流项目测试Octo');
    insertContact.run(2, '杨小天', '项目参与', '项目组', '执行层', '', '', 0, '客户架构表记录');
    insertContact.run(2, 'Nicole(徐孝敏)', '华东销售(明略)', '销售部', '执行层', '', '', 0, '合同商务侧跟进');
    insertContact.run(2, '贾彤', '场景引导(明略)', '场景方案', '执行层', '', '', 0, '产出场景引导文档');
    insertContact.run(2, '刘静(Elva)', 'PR推进(明略)', '市场部', '管理层', '', '', 0, '9/22起直接对接推进PR事项');

    // 南孚 W37/W38 周报
    insertReport.run(2, 'weekly', '2026-W37',
      '南孚9/7合同双方盖章归档！两年20万合同正式生效，部署窗口9/7-9/18，首批场景确认3C研发+600人销售知识问答',
      '1. 9/3姜平在主群催合同"紧点"\n2. 9/7合同双方盖章归档，两年20万合同正式生效\n3. 部署窗口确定9/7-9/18\n4. 首批场景确认：①3C团队产品研发(深圳)②600人销售知识问答(产品管家调用自研知识库)\n5. 客户对octic私有化也感兴趣，已同步Nicole和孔老师\n6. 回顾：6/9建区→6/17常晓飞首次现场→7/3法务审核通过→7/22姜平升级推动辉哥对接CEO/CMO→8/31对接人变更雷佳乐接替离职宋志平',
      '需要部署资源到位确保9/7-9/18窗口',
      '常晓飞驻场部署，Nicole合同跟进，贾彤场景引导',
      '',
      '9/18前完成部署，首批3C研发+销售知识问答场景上线');
    insertReport.run(2, 'weekly', '2026-W38',
      '南孚9/14收到资源清单+账户权限部署进行中，9/22刘静介入推进PR案例，姜平风险提示"预期过高年底功能补不全"',
      '1. 9/14收到南孚资源清单+账户权限，测试环境搭建中\n2. 9/14-20部署进行中，预计本周完成部署下周调试\n3. 9/22确认Octo暂不提供会议功能客户已知晓\n4. 刘静9/22起直接对接南孚推进PR事项，快速转化案例为可发布内容\n5. 10个场景识别完成：首批3C研发+销售知识问答；潜力AtoA石墨烯案例；待激活龙虾管理/L0-L3分级/Skill Hub/非技术引导/秒针MCP电商/octic会议/项目看板\n6. ⚠️姜平风险研判："南孚预期过高，年底功能都补不全"——客户愿景是替代三套协同工具(钉钉/飞书/企微)统一入口，现阶段产品能力无法全面支撑需引导聚焦可落地场景',
      '需要引导客户聚焦可落地场景(3C研发+销售问答)，不要过度承诺替代三套协同工具',
      '刘静PR推进，常晓飞部署，贾彤场景引导文档',
      '客户预期过高(替代钉飞企微)vs产品能力有差距；腾讯Hermes是竞品',
      '完成首批2场景上线调试，AtoA石墨烯案例开发，PR案例材料准备');

    // ===== 22家新客户的报告和联系人 =====

    // 18. 曼伦
    insertReport.run(18, 'weekly', '2026-W39', '曼伦S级客户on hold，信息极少待叶佳补充客户全貌，明确on hold原因后制定激活策略', 'S级评级(高付费潜力)但当前on hold，客户行业/规模/核心需求/联系人等关键信息均缺失。需叶佳补充完整信息。', '需要叶佳补充客户完整信息', '', '信息极少+on hold原因不明', 'P0叶佳补充客户完整信息；P1明确on hold原因制定激活策略；S级客户每月至少一次主动触达');
    insertContact.run(18, '叶佳', '客户对接(明略)', '客户成功', '执行层', '', '', 0, '明略方负责人');

    // 19. PPIO
    insertReport.run(19, 'weekly', '2026-W39', 'PPIO攻坚后停滞，11人+2Agent但无活跃使用，刘静需重新接触了解AI协同实际需求，探索算力+Agent平台生态合作', '边缘计算/分布式GPU云平台，11人+2Agent开通后缺乏杀手级场景。核心业务与Octo协同定位场景交叉点不清晰。潜在机会：PPIO提供算力+Octo提供Agent平台有互补可能。', '', '', '攻坚后无实质性进展；场景匹配度待验证；11人+2Agent无使用惯性', '刘静重新接触客户，探索算力+Agent生态合作可能，识别1个高价值场景做Demo激活');
    insertContact.run(19, '刘静(Elva)', '大客户经理(明略)', '客户成功', '管理层', '', '', 0, '明略方负责人');

    // 20. 联合影像
    insertReport.run(20, 'weekly', '2026-W39', '联合影像(Kickers.ai)飞书迁移策略确定(新项目Octo/老项目飞书)，使用深度极浅需推动Octopush安装+新项目落地', '医疗AI 10+人团队，对接人刘应龙/新意/青山。7/15仅3条人类消息0条bot协作。竞品在用飞书/OpenClaw/Cloud Code/CodeBuddy。潜在商机：统一模型网关(5%模型调用差价)。', '', '贾叔推动Octopush重新安装', '飞书使用惯性极大；使用深度不足；多工具并行分散注意力', '推动Octopush重新安装→发吉利分享录屏→推动产研用Octo跑新项目→模型网关商务方案');
    insertContact.run(20, '刘应龙', '客户对接人', 'AI研发', '执行层', '', '', 0, '客户对接人');
    insertContact.run(20, '新意', '客户对接人', 'AI研发', '执行层', '', '', 0, '客户对接人');
    insertContact.run(20, '青山', '客户对接人', 'AI研发', '执行层', '', '', 0, '客户对接人');
    insertContact.run(20, '贾金良(贾叔)', 'SDR(明略)', 'SDR', '执行层', '', '', 0, '明略方负责人');

    // 21. 中金公司
    insertReport.run(21, 'weekly', '2026-W39', '中金公司卉子资本市场渠道引入早期试用，跟进使用情况了解场景需求，鹏扬合同审核跑通后可复制', '金融证券行业，卉子引入早期试用阶段。公募基金合同审核场景(鹏扬)跑通后可复制到中金等同类金融客户。', '', '', '早期试用阶段场景待明确', '跟进使用情况，了解投研/证券场景需求');
    insertContact.run(21, '卉子', '资本市场渠道(明略)', '渠道部', '执行层', '', '', 0, '明略方资本市场渠道负责人');

    // 22. 华泰研究所
    insertReport.run(22, 'weekly', '2026-W39', '华泰研究所卉子引入，研报/分析场景方向早期试用，跟进使用情况', '券商研究所研报AI辅助方向，卉子引入早期试用。鹏扬合同审核跑通后可复制。', '', '', '早期试用阶段场景需求待深入了解', '跟进使用情况，明确研报场景具体需求');
    insertContact.run(22, '卉子', '资本市场渠道(明略)', '渠道部', '执行层', '', '', 0, '明略方资本市场渠道负责人');

    // 23. 鹏扬基金
    insertReport.run(23, 'weekly', '2026-W39', '🔥鹏扬基金升温中：8/18产品沟通会确认专家团+webhook方案，8/23刘静建子区，合同审核数字化需求清晰，多群webhook待验证', '对接人黄梦成(技术部)对产品理解快推动执行力强。方案确认：专家团(法务+财务+AI Bot编排)+webhook推送，SOP写在专家团指引，运行时云上2核2G虚拟机。卡点：私有化无Loop、多群webhook精准匹配待验证、商务模式未定。公募基金合同审核跑通可复制到中金/华泰。', '需要明确商务模式(SaaS按量or私有化)，注意私有化无Loop问题', '玉平完成多群webhook测试；贾叔跟进专家团试用', '多群webhook技术方案未跑通；私有化无Loop；商务模式未定', 'P0玉平完成多群webhook匹配测试→P1跟进黄梦成试用反馈→P2明确商务模式');
    insertContact.run(23, '黄梦成', '技术部', '技术部', '执行层', '', '', 1, '客户对接人，技术部对产品理解快执行力强');
    insertContact.run(23, '赵玉平', 'BD(明略)', '市场部', '执行层', '', '', 0, '明略方BD，对接卉子拉群');
    insertContact.run(23, '卉子', '资本市场渠道(明略)', '渠道部', '执行层', '', '', 0, '渠道引入');

    // 24. 卓望
    insertReport.run(24, 'weekly', '2026-W38', '卓望(中国移动子公司)SaaS接入问题已解决但后续停滞，贾彤需联系李奕诺了解停滞原因安排培训', 'Onboarding B级客户，对接人李奕诺。客户对产品感兴趣想培训+产品合作，SaaS版bot接入困难已远程解决。', '', '', '解决问题后客户未推进；央企决策链长', '贾彤联系李奕诺了解停滞原因→安排培训→明确合作模式');
    insertContact.run(24, '李奕诺', '客户对接人', '', '执行层', '', '', 0, '客户对接人');
    insertContact.run(24, '贾彤', '早期客户(明略)', '销售部', '执行层', '', '', 0, '明略方负责人');

    // 25. 祥承
    insertReport.run(25, 'weekly', '2026-W38', '祥承pending angelclaw尚未开始，等客户侧明确需求', 'pending状态，叶佳负责，信息极少尚未开始推进。', '', '', '尚未开始无信息', '等待客户侧明确需求');
    insertContact.run(25, '叶佳', '客户对接(明略)', '技术对接', '执行层', '', '', 0, '明略方负责人');

    // 26. 欢瑞世纪
    insertReport.run(26, 'weekly', '2026-W38', '欢瑞世纪51只虾仅2活跃，9月从C类降级D类，预算有限+场景空泛+飞书阻力，评估是否继续投入', '200+员工上市影视公司，私有化部署+培训完成。董秘Agent/CEO全景/录音豆三个方向停在概念阶段。若继续投入聚焦董秘Agent单场景做MVP。郭颂解决安装问题。', '', '', '预算有限；场景空泛；飞书迁移阻力大；51虾仅2活跃', '评估投入产出比→如继续聚焦董秘Agent单场景MVP');
    insertContact.run(26, '郭颂', '技术支持(明略)', '技术部', '执行层', '', '', 0, '明略方技术支持，解决安装问题');
    insertContact.run(26, '赵玉平', 'BD(明略)', '市场部', '执行层', '', '', 0, '明略方负责人');

    // 27. 青钜科技
    insertReport.run(27, 'weekly', '2026-W38', '青钜科技私有化完成但Loop未用，"部署≠使用"教训，待安排Loop培训', '咨询/工程公司，私有化已完成但Loop未使用，客户对核心功能认知不足。与我思科技同类案例。', '', '', 'Loop未用=核心功能未体验；使用深度未知', '安排Loop培训→了解使用情况→明确商务方向');
    insertContact.run(27, '郭松', '技术支持(明略)', '技术部', '执行层', '', '', 0, '明略方技术支持');
    insertContact.run(27, '赵玉平', 'BD(明略)', '市场部', '执行层', '', '', 0, '明略方负责人');

    // 28. 卓越教育
    insertReport.run(28, 'weekly', '2026-W38', '卓越教育8/17周会新增商机，建群阶段待深入了解需求', '教育行业新商机，建群阶段，需求待确认。', '', '', '新商机需求未明确', '建群后深入了解客户需求');

    // 29. 新世纪医疗
    insertReport.run(29, 'weekly', '2026-W38', '新世纪医疗8/17周会新增，AI架构转型意向待确认具体需求', '医疗健康集团AI转型意向，与卓正/健主任形成医疗行业客户群。', '', '', 'AI转型意向但具体需求场景待确认', '跟进确认AI架构转型具体需求和场景');

    // 30-39 战败/放弃客户报告
    insertReport.run(30, 'weekly', '2026-W35', '得到确认放弃：飞书+自研AI成熟，Octo无法提供飞书生态内增量价值，对接人忙于新产品', '内部深度使用飞书+自研AI体系成熟，B级Onboarding客户放弃。飞书生态锁定无法突破。', '', '', '飞书生态+自研AI强锁定', '不继续投入，等飞书Aily无法满足多Agent时再考虑');
    insertContact.run(30, '贾金良(贾叔)', 'SDR(明略)', 'SDR', '执行层', '', '', 0, '明略方负责人');

    insertReport.run(31, 'weekly', '2026-W35', '流利说放弃：内网限制严格SaaS无法顺畅使用+部署方式不统一，试用后搁置', '内网对外部工具限制多，SaaS版无法顺畅使用；客户内部SaaS vs私有化没有明确决策。复活条件：标准化企业级部署方案解决内网兼容。', '', '', '内网限制+部署不统一', '等私有化方案成熟度提升后可重新推');
    insertContact.run(31, '叶佳', '客户对接(明略)', '技术对接', '执行层', '', '', 0, '明略方负责人');

    insertReport.run(32, 'weekly', '2026-W36', '我思科技放弃：私有化部署完成但使用停滞，"部署≠使用"典型案例', '私有化完成后客户内部未真正使用，缺乏内部推动力和场景。升级需求未推进自然搁置。教训：需建立"部署后30天激活"机制。', '', '', '私有化后无场景引导和使用培训', '客户主动提出升级需求时可跟进，已有私有化基础复活门槛低');
    insertContact.run(32, '贾金良(贾叔)', 'SDR(明略)', 'SDR', '执行层', '', '', 0, '明略方负责人');

    insertReport.run(33, 'weekly', '2026-W34', '元梦灵境放弃：开通后完全沉寂无任何使用', '开通账号后完全无使用，无内部推动者无明确需求。', '', '', '开通后完全沉寂', '不投入资源，等客户主动激活');
    insertContact.run(33, '贾金良(贾叔)', 'SDR(明略)', 'SDR', '执行层', '', '', 0, '明略方负责人');

    insertReport.run(34, 'weekly', '2026-W34', '云迹科技放弃：攻坚后停滞，未找到酒店/机器人场景切入点', '机器人/酒店科技公司，攻坚后无后续进展。', '', '', '场景匹配度不足，未找到切入点', '找到酒店/机器人场景切入点时可重新接触');

    insertReport.run(35, 'weekly', '2026-W20', '北京破圈放弃：内部BU非外部客户，缺乏商务驱动力停滞(最后活跃5/9)', '明略内部BU(营销/代运营)非外部客户，推进缺乏商务驱动力，内部协调成本高。子区最后活跃5/9超4个月无消息。教训：内部BU需明确业务价值和管理层推动。', '', '', '内部BU无商务驱动力', '不继续投入，除非有新内部战略方向');
    insertContact.run(35, '孙方超', '内部引荐(明略)', '内部', '执行层', '', '', 0, '杨三角关系/沙龙邀请函引入');
    insertContact.run(35, '贾金良(贾叔)', 'SDR(明略)', 'SDR', '执行层', '', '', 0, '明略方跟进');

    insertReport.run(36, 'weekly', '2026-W34', '香港中企放弃：第三梯队SaaS试用信息极少需求不明无实质进展', '第三梯队SaaS试用后无反馈无进展，信息极少。教训：第三梯队客户不过度投入资源。', '', '', '信息极少需求不明', '不投入资源，客户主动提出明确需求时再接触');
    insertContact.run(36, '张晓(Amy)', '大客户经理(明略)', '客户成功', '执行层', '', '', 0, '明略方负责人');

    insertReport.run(37, 'weekly', '2026-W34', '海归爸爸放弃：教育行业第三梯队SaaS无实质进展需求未建立', '第三梯队SaaS试用后无反馈。', '', '', '需求未建立', '不投入资源');

    insertReport.run(38, 'weekly', '2026-W34', '51World放弃：数字孪生/元宇宙冷接触无后续，行业遇冷', '冷接触无反馈，数字孪生/元宇宙行业本身遇冷。', '', '', '冷接触无需求+行业遇冷', '不投入资源，行业回暖+客户有需求时再接触');

    insertReport.run(39, 'weekly', '2026-W30', '西门子放弃：杨三角关系线索(沙龙邀请函)非销售驱动，2周未建商务接触即流失', '7/1孙方超群发西门子沙龙邀请函，辉哥问"谁去讲课"后无下文。仅停留在沙龙邀请层面，未建立任何实质性商务接触。教训：关系型线索2周内必须建立商务对接否则流失！', '', '', '关系型引荐非客户主动需求；未建立有效对接', '通过杨三角关系搭线需找到对的人和对的场景，西门子体量巨大价值极高');
    insertContact.run(39, '孙方超', '关系引荐(明略)', '内部', '执行层', '', '', 0, '杨三角关系引入，发沙龙邀请函');
  });
  insertSampleData();

  // ===== 数据修正：严格按照KR2报告原文统一分类和数值 =====
  const fixStage = db.prepare("UPDATE accounts SET customer_stage=? WHERE company_name=?");
  const fixStageExact = db.prepare("UPDATE accounts SET customer_stage=? WHERE company_name LIKE ?");
  const fixAmt = db.prepare("UPDATE accounts SET deal_amount=? WHERE company_name=?");
  const fixName = db.prepare("UPDATE accounts SET company_name=? WHERE company_name LIKE ?");

  // 统一customer_stage严格按报告分类
  const stageMap = {
    '卓正医疗':'已签约','南孚电池':'已签约','HKIC':'已签约',
    '宇通客车':'投标中',
    '吉利汽车':'B类重点推进','三一重工':'B类重点推进','极光湾科技':'B类重点推进',
    '墨迹天气':'B类重点推进','金智教育':'B类重点推进','致远互联':'B类重点推进','普联香港':'B类重点推进',
    '中信资本':'C类跟进','混沌学园':'C类跟进','曼伦':'C类跟进','PPIO':'C类跟进',
    '联合影像':'C类跟进','中金公司':'C类跟进','华泰研究所':'C类跟进','健主任':'C类跟进','鹏扬基金':'C类跟进',
    '卓望':'D类观察','刀法咨询':'D类观察','祥承':'D类观察','欢瑞世纪':'D类观察',
    '青钜科技':'D类观察','卓越教育':'D类观察','新世纪医疗集团':'D类观察',
    'Hysan希慎':'战败','得到':'战败','方里':'战败','流利说':'战败',
    '香港中企':'战败','海归爸爸':'战败','云迹科技':'战败','51World':'战败',
    '我思科技':'战败','元梦灵境':'战败','北京破圈':'战败','西门子':'战败',
  };
  for(const [name,stage] of Object.entries(stageMap)){ fixStage.run(stage,name); }
  fixStageExact.run('战败','%云迹%');

  // 金额严格按报告原文
  fixAmt.run(500,'卓正医疗');   // 500万已回款（+200万后续写在deal_stage里）
  fixAmt.run(20,'南孚电池');    // 20万两年
  fixAmt.run(5,'HKIC');         // 5万港币
  fixAmt.run(200,'宇通客车');   // 首期≤200万（二三期各200万是预期，写在notes）
  fixAmt.run(390,'吉利汽车');   // 390万/908人天
  fixAmt.run(100,'墨迹天气');   // ~100万
  fixAmt.run(600,'普联香港');   // 客户年预算600万
  fixAmt.run(10,'健主任');      // 10万服务包
  fixAmt.run(0,'三一重工');
  fixAmt.run(0,'极光湾科技');
  fixAmt.run(0,'金智教育');
  fixAmt.run(0,'致远互联');
  fixAmt.run(0,'Hysan希慎');
  // 其余0

  // 修正公司名（去掉报告原文没有的英文名括号）
  fixName.run('HKIC','%HKIC%');
  fixName.run('云迹','%云迹%');
  fixName.run('普联香港','%普联%');
  fixName.run('方里','%方里%');
  fixName.run('联合影像','%联合影像%');


  // ===== CEO获客资料包导入（2026-09-23）=====
  // 数据来源：CEO获客数据分析报告.md(2026-09-18) + 客户跟踪表.csv(2026-08-12)
  // 严格按原文数值录入，不做任何改动

  // --- 一、CEO获客8场活动（events表）---
  const insCEOEvent = db.prepare(`INSERT INTO ceo_events (name, event_type, date, location, status, topic, wechat_followers, audience_count, registrations, activations, sql_count, key_messages, business_design, audience_profile, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  insCEOEvent.run('《晚点》头条','其他','2026-05-20','','已结束','CEO获客·吴明辉出席',198,0,80,65,4,'吴明辉(CEO)','CEO出席活动获客，配合企微活码/开通链接沉淀线索','活动受众/Octo目标客群','获客方式：企微活码扫码。指标口径：报名REG=活码加微198，留资LEADS=OCTO申请80，MQL=审核开通65，SQL=转出销售4。加微→开通33%，加微→转出2.0%。39家客户匹配：4家（卓望、宇通客车）。自报来源TOP：混沌8人/官网3人/网络3人/微信公众号3人/播客3人。转出明细：①朱江(北京仁达企业管理咨询有限公司)→李金龙(灵听工牌)②马先生(南京新街口百货商店股份有限公司)→卢悦(CDP+MA)③李端(成都爱游智学科技有限公司)→刘智行(AI短剧)④史女士(杭州海康威视数字技术股份有限公司)→赵莹。特点：流量最大（占全部活码的50%），但加微→开通转化33%，说明60%+加微后无后续动作；晚点是入口渠道而非认知来源（自报来源中「晚点」仅6人）。');
  insCEOEvent.run('AI生态峰会','峰会','2026-06-19','','已结束','CEO获客·吴明辉出席',88,0,4,3,0,'吴明辉(CEO)','CEO出席活动获客，配合企微活码/开通链接沉淀线索','活动受众/Octo目标客群','获客方式：企微活码扫码。指标口径：REG=加微88，LEADS=OCTO申请4，MQL=开通3，SQL=转出0。申请率5%，加微→开通3%。39家客户匹配：0家。特点：转化率3%。');
  insCEOEvent.run('国企EMP','其他','2026-06-28','','已结束','CEO获客·吴明辉出席',56,0,1,0,0,'吴明辉(CEO)','CEO出席活动获客，配合企微活码/开通链接沉淀线索','活动受众/Octo目标客群','获客方式：企微活码扫码。指标口径：REG=加微56，LEADS=OCTO申请1，MQL=开通0，SQL=转出0。申请率2%。39家客户匹配：0家。特点：有申请但零开通。');
  insCEOEvent.run('Octo产品发布','发布会','2026-07-01','','已结束','CEO获客·吴明辉出席',26,0,4,3,0,'吴明辉(CEO)','CEO出席活动获客，配合企微活码/开通链接沉淀线索','活动受众/Octo目标客群','获客方式：企微活码扫码。指标口径：REG=加微26，LEADS=OCTO申请4，MQL=开通3，SQL=转出0。申请率15%。39家客户匹配：0家。特点：转化率12%，小规模但精准。');
  insCEOEvent.run('CAIO峰会','峰会','2026-07-09','','已结束','CEO获客·吴明辉出席',17,0,0,0,0,'吴明辉(CEO)','CEO出席活动获客，配合企微活码/开通链接沉淀线索','活动受众/Octo目标客群','获客方式：企微活码扫码。指标口径：REG=加微17，LEADS=OCTO申请0，MQL=开通0，SQL=转出0。申请率0%。39家客户匹配：0家。特点：加微后零转化，可能是活动受众与Octo目标客群不匹配。');
  insCEOEvent.run('中欧商学院','其他','2026-07-01','','已结束','CEO获客·吴明辉出席',8,0,0,0,0,'吴明辉(CEO)','CEO出席活动获客，配合企微活码/开通链接沉淀线索','活动受众/Octo目标客群','获客方式：企微活码扫码。指标口径：REG=加微8，LEADS=OCTO申请0，MQL=开通0，SQL=转出0。申请率0%。39家客户匹配：0家。特点：加微后零转化，可能是活动受众与Octo目标客群不匹配。');
  insCEOEvent.run('外滩大会','论坛','2026-09-05','','已结束','CEO获客·吴明辉出席',1,0,0,0,0,'吴明辉(CEO)','CEO出席活动获客，配合企微活码/开通链接沉淀线索','活动受众/Octo目标客群','获客方式：企微活码扫码。指标口径：REG=加微1，LEADS=OCTO申请0，MQL=开通0，SQL=转出0。39家客户匹配：0家。特点：加微后零转化。');
  insCEOEvent.run('混沌学院','沙龙','2026-06','','已结束','CEO获客·吴明辉出席',0,0,33,31,1,'吴明辉(CEO)','CEO出席活动获客，配合企微活码/开通链接沉淀线索','活动受众/Octo目标客群','获客方式：混沌群内直接分享OCTO开通邀请链接（无活码）。指标口径：REG=加微0（无活码），LEADS=OCTO申请33，MQL=审核开通31（通过率94%，全渠道最高），SQL=转出销售1。39家客户匹配：3家（卓望、祥承、混沌学园）。特点：通过率全渠道最高（94%），用户自主意愿极强；CEO背书+混沌社群信任度高。');

  // --- 二、客户跟踪表新增2家客户（accounts表）---
  const insTrkAcct = db.prepare(`INSERT INTO accounts (company_name, industry, source, tier, assigned_to, octo_status, customer_stage, lead_source, notes) VALUES (?,?,?,?,?,?,?,?,?)`);
  insTrkAcct.run('吴师/黄江华','未知','线索','D','贾金良','OpenClaw安装使用','D类观察','线索来源','[客户跟踪表原文] 行业:未知｜D类战略储备｜来源:线索｜阶段:试用｜状态:冷｜关键场景/需求:OpenClaw安装使用｜客户侧关键联系人:吴师/黄江华｜明略侧Owner:贾金良｜备注:非重点客户;模型DeepSeek');
  insTrkAcct.run('Leo~JXQ金总','未知','线索','D','贾金良','认知阶段','D类观察','线索来源','[客户跟踪表原文] 行业:未知｜D类战略储备｜来源:线索｜阶段:认知｜状态:停滞｜客户侧关键联系人:Leo金总(JXQ)｜明略侧Owner:贾金良');

  // --- 三、客户跟踪表27家×16列原文 → account_reports（内容一字不差）---
  const insTrkReport = db.prepare(`INSERT INTO account_reports (account_id, report_type, report_period, most_important, key_work, need_decision, cross_team_needs, bottlenecks, next_important) VALUES (?,?,?,?,?,?,?,?,?)`);
  const findAcct = db.prepare(`SELECT id FROM accounts WHERE company_name=?`);

  { const a=findAcct.get('吉利汽车'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 吉利汽车｜B类落地推进中｜阶段:POC｜状态:热｜来源:已有关系(辉哥直接对接)','【行业】汽车制造\n【关键场景/需求】①AI军团(数字化中心+AI Center)②营销(AIGC广告视频素材创作)③座舱软件研发④元动力平台(集团级战略项目管理系统,覆盖约1500高管)⑤组织管理(周例会Loop/选育用留费)\n【客户痛点】①身份权限与行级数据管控②云端运行时(设备低配+信息安全)③验证系统(制造业容错率极低,辉哥反复强调为大规模推广真正瓶颈)④A2A多虾协作⑤成本治理\n【AI Native进展】集团2026年数字化预算40亿;有"百人百智"计划+自研智能体"小智";客户对AI Native有清晰认知框架(To R岗位通用Agent+To E个人使用Agent);刘浩自己写了《Octo第一性原理》;7/18辉哥向CEO淦家阅及40+高管做分享\n【OCTO使用进展和反馈】已成立项目组;三条POC并行(营销/产品洞察/研发);8.5万人9军团多品牌矩阵;私有化all-in-one约8/5完成;元动力平台立项9/15倒推底线9/30;辉哥承诺每周到场一天;商务方向约1亿咨询型项目;SaaS已开通体验;前期3人+2虾;客户侧乔帅/康之喜/李先强/杨毅等已在Octo上;云端部署(吉利云);客户基本选定飞书私有化部署\n【明略侧服务人员/Owner】威少(杨威/项目总负责人)/刘静Elva(营销+整体协调)/石小筱/邱凌燕Catherine(营销FDE)/黄楠(研发场景)/王雪琴(DAP)/叶佳(FAQ资料)\n【客户侧关键联系人】刘浩(浩总/最强内部推手)/陈勇(研究院AI负责人,KDM)/盖总(上层领导)/淦家阅(CEO)/乔帅/Jason(康之喜)/李先强/杨毅/杨曌/罗伟胤\n【竞争对手情况】飞书(已基本选定私有化部署);阿里/腾讯/字节竞品;客户已有自研"小智";Eva(吉利自有平台)','①8/5完成私有化all-in-one部署②营销POC推进(洞察→策略→脚本→视频)③研发POC场景确认(建议从CRM切入而非汽车软件开发)④9/15元动力平台里程碑⑤签框架协议(按麦肯锡逻辑定价)','当前最重点标杆客户;明略定位帮吉利做组织AI转型而非单业务线智能化;客户正在做组织融合(数字化团队与AIC融合)','①缺全职驻场PM②交付团队高端咨询+交付人才不足(Delta空缺/Echo仅营销侧)③验证系统(Verification)缺位④客户对内容准确性要求极高(品牌物料库+3D建模)⑤上下文管理(长周期项目400-500人/2600活动节点)⑥客户希望对产品路线图有影响力','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('宇通客车'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 宇通客车｜B类落地推进中｜阶段:POC｜状态:温｜来源:主动进线(官网微信)','【行业】汽车制造(商用车/客车)\n【关键场景/需求】①车联网产品页面开发(多虾协作)②会议纪要自动化(Octic录音→结构化纪要)③数据分析报告生成(虾接DeepMiner)④AIGC内容制作(视频/图文降本)⑤GEO优化\n【客户痛点】①客户内部IT权限审批严格(外部网址需层层审批)②内网网络限制多③客户正在撰写AI+转型调研报告,涉及多厂商选型评估④客户觉得LLM智能体开发平台跟Dify区别不大\n【AI Native进展】曾是管线最高质量客户(17活跃用户/30只虾/人均近2只);5/9进线→5/14开通→5/27 CIO带队9人高层拜访→6/1开DeepMiner团队账号→6/10车联网场景跑通;客户在AI转型报告中将明略列为"AI+原生组织"标杆案例;后客户转向写AI转型调研报告Octo试用暂停;目前转AIGC+GEO服务切入;客户内容生产95%外包想借AI降本\n【OCTO使用进展和反馈】本地部署完成17人30虾;三个场景跑通过(车联网页面/会议纪要/数据分析);后因客户写报告暂停;Octopush已上架Agent但卡在内网审批;7/29与品牌营销团队沟通,客户不要"再加一个供应商"要战略级革新;7/31交接Amy(米姐)跟进\n【明略侧服务人员/Owner】前期赵玉平/7/31交接张晓Amy(米姐)/叶佳(Octopush上架)\n【客户侧关键联系人】CIO(带队参访)/朱院(设计院副院长,日常用会议纪要)/陶老师(品牌营销)/技术部门代表(云端软件开发)\n【竞争对手情况】腾讯WorkBuddy/阿里QoderWork(CodeBuddy)/字节HiAgent/飞书/Dify社区版/百度DataBuilder/High Agent(竞品调研中)','①按不同价位段提供AI制作案例+报价单②约线上案例展示会③客户内部确定Demo命题做AI视频Demo④推进AIGC内容服务(秒针销售对接承接外包)','全球最大客车制造商(B2B);场景龙虾蒸馏上架Octopush收token新商业模式探索;客户有尝试连接Homers大模型','①客户正在调研竞品写报告,预计还需1-2个月②内部权限审批流程长③客户AI基础薄弱④客户要战略级革新不要加供应商⑤曾出现多虾部署同一Mac Mini记忆混乱问题','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('南孚电池'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 南孚电池｜B类落地推进中｜阶段:签约｜状态:温｜来源:已有关系(辉哥导入)','【行业】消费品/电池\n【关键场景/需求】①跨部门沟通场景(线下物流项目)②对接飞书/钉钉(在Octo中控制会议室/操作文档)③AF会录音笔功能\n【客户痛点】①客户定位偏差(想用Octo替代企微/飞书,需引导聚焦AI协作)②中层及以下对产品不太接受存在抵触③客户很少使用产品,反馈泛泛④客户内部推腾讯Hermes\n【AI Native进展】客户希望以Octo替代飞书/钉钉/企微的长期愿景(需求复杂度高);已开通SaaS体验版6人+4虾;客户决定继续SaaS测试指定线下物流项目;第一版合同已拟好经威少审核提交客户,客户要求7×24运维后法务审核完毕\n【OCTO使用进展和反馈】SaaS体验版开通;6人+4虾内部调试;腾讯公有云部署方案确认;AF录音笔问题基本解决;客户持续在对接飞书/钉钉使用龙虾控制会议室操作文档\n【明略侧服务人员/Owner】常晓飞/徐孝敏Nico(华裔销售妮蔻)/贾彤(场景引导文档)/威少(合同审核)\n【客户侧关键联系人】宋志华(对接人,AI高级工程师)/CEO+CMO(前宝洁人,辉哥认识)\n【竞争对手情况】腾讯Hermes(客户内部推广中)','①安排交流引导客户找到确定场景(避免内部摸索无结果)②Loop等新能力上线后安排专门演示③通过高层top-down推动(辉哥组织全体高管交流)④腾讯云合同启动本地化部署','合同第一年免费第二年15万运维部署费(金额小,标杆价值为主);场景从"替换钉钉/企微"改为"Octo作为统一入口对接飞书/钉钉会议"','①卡在公有云采购环节(需先与云厂商签合同才能开资源)②客户反馈被动沟通不深入③仅对接AI高级工程师缺高层对接④客户要求7×24运维服务需内部商榷','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('金智教育'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 金智教育｜B类落地推进中｜阶段:POC｜状态:热｜来源:已有关系(郭超那边)','【行业】教育科技/SaaS\n【关键场景/需求】①研发与业务两条主流程(15Bot/11员工/4群已在跑)②高校市场(南京科技职业技术学院/中国传媒大学"智能体答辩"/CCF论坛)③高校人机协作产品\n【客户痛点】①群内多Bot职责混乱②长上下文记忆丢失③网址链接失效④待办事项缺陷⑤飞书文档权限⑥Skill管理混乱⑦长任务超30min timeout⑧IM桥接断⑨飞书Token一周失效⑩移动端未上架\n【AI Native进展】客户自有IT能力强可自主探索;梳理9个业务场景挑2-3个落地;SaaS+本地部署双版本测试;分三阶段推进(①内部试用7月完成→②技术流程改造→③联合推向市场);团队约60人(产研);客户有意愿为陪跑服务付费;CCF会议主题确定Octo联合出品双logo\n【OCTO使用进展和反馈】SaaS版15+账号使用中;15个Bot/11名员工/4个群在跑研发与业务两条主流程;同步测试本地部署;客户已基于自身系统与Octo做打通场景;80-90%场景Octo可支持\n【明略侧服务人员/Owner】叶佳→交接史佳艳佳艳/邱凌燕Catherine(前期销售)/吴锡(商务战略合作)/胡曦(高校场景)/佳佳/郭颂(技术)\n【客户侧关键联系人】于总/俞京华/郭总\n【竞争对手情况】飞书/其他教育AI产品','①周会持续推进②推进CCF合作③Loop和卡片协议两大卡点需赶在客户deadline前解决④拉客户聊具体可落地场景','"精致"应为"金智教育"的误写;合作伙伴属性有助拓展教育类客户群;非典型营销场景','①金智可能抱有希望明略投资其公司的目的,合作动机不纯需警惕②SaaS版不允许商业化收费但客户更倾向SaaS③核心卡点在通讯录和权限④时间紧:9/1开学发布CourseClub,原计划8/15全员上线','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('致远互联'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 致远互联｜B类落地推进中｜阶段:试用｜状态:温｜来源:已有关系(创始人徐总来访)','【行业】企业协同办公/低代码平台\n【关键场景/需求】Loop任务编排(需求量极大)/合同治理相关场景\n【客户痛点】①开源vs商业版差异②Agent管理成本("养废")③飞书/WorkBuddy集成④操作手册\n【AI Native进展】协同办公/低代码龙头(35家一级央企客户);创始人徐总7/14带队来访"取经";定位范式互补(致远=System of Record,Octo=System of Agent);辉哥定调"代码开源随便用,赚token赚FDE";CIO李时齐已本地部署一套;客户CIO拉新群先让主要人员手机端下载\n【OCTO使用进展和反馈】私有化部署已完成;客户尚未完全试用;向致远团队快速介绍过产品(因领导临时有会缩为半小时)\n【明略侧服务人员/Owner】史佳艳佳艳(主跟)\n【客户侧关键联系人】创始人徐总/CIO李时齐/李老师\n【竞争对手情况】飞书/WorkBuddy/其他协同AI','①约客户沟通使用反馈和场景②联合PR为目标(共同发布战略合作声明互相借势)','央国企协同办公/低代码龙头;合作伙伴性质联合PR比直接收入更重要','①客户尚未完全试用②须签一页边界备忘防白嫖③开放vs封闭价值观差异+潜在同层竞争','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('HKIC'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] HKIC(hksa/hkfc/香港投资集团)｜B类落地推进中｜阶段:POC｜状态:温｜来源:资本市场(卉子/超哥)','【行业】金融\n【关键场景/需求】金融行业私有化部署/PR龙虾定制\n【客户痛点】需对接飞书和企微供应商;私有化部署需沟通海外服务器/云端保密/私有化范围/交付周期\n【AI Native进展】金融公司需私有化部署;先小批量(4-5人/35人)用私人设备做SaaS POC;定制一只PR龙虾(张晓米姐团队自行完成);进入招标阶段8/7前提交标书;小型POC(5万港币);预计两周交付一个月完成试用;POC后转私有化部署\n【OCTO使用进展和反馈】SaaS POC阶段;客户已采购POC所需硬件;争取8月初启动SaaS POC收费约10万港币;需常晓飞支持私有化技术答疑\n【明略侧服务人员/Owner】张晓Amy(米姐)/常晓飞(私有化技术答疑)\n【客户侧关键联系人】IT团队\n【竞争对手情况】飞书/企微(客户要求走采购对比过场)','①8月7日前提交标书资料②米姐约客户线上沟通私有化部署方案明确需求','香港客户;通过account团队交付;POC费+Token预充值(2-3万港币)','①卡在对接飞书和企微供应商(需走采购对比过场)②私有化部署海外服务器/数据安全等技术问题待沟通','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('Hysan希慎'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] Hysan(希慎/西盛集团)｜B类落地推进中｜阶段:POC｜状态:温｜来源:资本市场(张晓Amy)','【行业】房地产/香港\n【关键场景/需求】协同场景(从DM转回Octo因DM无法满足协同需求);涉及5-6只虾定制\n【客户痛点】客户对法务与安全要求极高\n【AI Native进展】前期曾从Octo切到DM因Token预算不可控→又转回Octo因其核心诉求是协同;SaaS POC已中标;POC费用10万港币(定制服务人工费);Token充值待定(5-10万港币起充);预计本月签约下月服务;使用海外版Octo;大概率做成demo型项目;需与F1团队沟通协助\n【OCTO使用进展和反馈】平台切换DM→Octo;周一将进行签约前最后一轮沟通确认安全与架构\n【明略侧服务人员/Owner】张晓Amy(米姐)/Catherine团队(合并交付)\n【竞争对手情况】DM(曾切换但不满足协同需求)','①签约前最后一轮沟通(确认安全与架构)②对齐具体需求走合同流程','香港客户;从DM切回Octo的案例','①整体交付成本较高难以承受②客户法务安全要求极高前期资质整合耗时长③尚未到私有化部署阶段','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('卓正医疗'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 卓正医疗｜B类落地推进中｜阶段:方案沟通｜状态:温｜来源:资本市场(张晓Amy)','【行业】医疗健康\n【关键场景/需求】医疗行业AI协作(姜平定调"该案例必须发生";打磨为可复制标杆尤其医疗板块)\n【AI Native进展】合同需交付Octo已提交可行性方案;预计8月3日当周带团队沟通私有化部署方案;姜平定调"必须发生"打磨为医疗板块可复制标杆\n【OCTO使用进展和反馈】可行性方案已提交\n【明略侧服务人员/Owner】张晓Amy(米姐)','①8月3日当周带团队沟通私有化部署方案②提前约威少时间','姜哥高度重视;医疗板块标杆;Thread中0条消息','信息较少,新建Thread但无消息','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('墨迹天气'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 墨迹天气｜B类落地推进中｜阶段:方案/报价｜状态:温｜来源:主动接触(采购发来需求文档)','【行业】互联网/气象服务\n【关键场景/需求】研发智能体赋能:①自动生成需求/技术方案/测试用例②打通简单云+GitLab③多智能体跨机器协同④最佳实践沉淀⑤研发提效量化\n【客户痛点】①智能体能力分散未与核心研发场景对齐②内部工具(简单云/GitLab)未打通③缺乏实践案例④研发提效无量化数据\n【AI Native进展】5/15接触产品侧负责人王荣涛→5/18开通SaaS→5/22佳佳线上培训→6/8/25郭师光组试用(4人4虾)→7/2尝试自行部署Octo;7/8采购发来《研发智能体赋能项目需求文档》;威少评估"Octo基础架构+定制开发";客户反馈较好继续商务;需重新细化需求报价;预计百万级规模可能涉及招标\n【OCTO使用进展和反馈】SaaS版4人4虾试用过;客户已部署开源版但未有效使用仅1个智能体运行;Loop功能上线对该项目非常有利\n【明略侧服务人员/Owner】贾彤(贾老师/前期主对接)/威少(方案报价)/朱翾蒙(销售)\n【客户侧关键联系人】王荣涛(产品侧)/郭师光(算法组较积极)/金犁(创始人,发起AI coding招标)\n【竞争对手情况】埃森哲等;客户内部已用OpenClaw(开源版)','①提供解决方案和报价②与客户技术团队深入沟通明确定制范围③杨威组织会议协调推进','金犁工作范式"有事就发标找专业机构"真给钱不薅羊毛','①缺研发背景合适人选(团队缺乏研发方向Echo/Delta)②商业化收费模式待明确③大部分功能需定制开发','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('欢瑞世纪'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 欢瑞世纪｜C类线索｜阶段:试用｜状态:冷｜来源:已有关系','【行业】影视/短剧\n【关键场景/需求】①董秘Agent(上市公司信披和业务描述问答)②老板全景视角(掌握公司所有动态和决策链条)③会议录音知识库沉淀\n【客户痛点】①文档协同缺失(赵总反复追问3次以上,产品硬伤)②团队不拥抱AI(老板支持但员工推动困难)③隐私顾虑(影视行业核心创意人员不愿上传私人知识)④龙虾所有权/知识资产归属⑤"废虾"率和ROI(51只虾仅2只活跃)⑥Token费用\n【AI Native进展】200+员工公司50+只虾仅2只活跃(老板和一名专职员工);已完成私有化部署;短剧团队有AIGC工作流;赵总是核心决策人短剧团队创始发起人;合作伙伴志斌总认为Octo不适合Mission Critical工作流\n【OCTO使用进展和反馈】本地化部署已完成;刚开始测试(2人在试);安装问题由郭颂解决;赵玉平提出三个场景(董秘Agent/老板视角/录音知识库)但公司规模小预算有限\n【明略侧服务人员/Owner】刘静Elva/赵玉平\n【客户侧关键联系人】赵总(短剧创始人/核心决策人)/小雷/微微(HR/运营)\n【竞争对手情况】飞书(迁移阻力大)/个人AI工具(Claude等)','日常保持配合即可;协调裴总将短剧团队工作流资源对接;提供PR培训','暂时搁置不投入主要精力;SaaS卖虾收token费原策略已改为私有化部署','①公司规模小预算有限(最多几十万)②场景过于空泛缺乏实际价值③员工普遍反映使用复杂④"老板想推但高管团队不支持"','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('联合影像'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 联合影像(Kickers.ai)｜C类线索｜阶段:试用｜状态:冷｜来源:已有关系(贾金良跟进)','【行业】医疗影像/AI\n【关键场景/需求】①十几人AI团队新建独立空间协作②全产研团队使用Octo协作③统一网关平台(模型购买/充值/流量消耗5%模型差价商机)\n【客户痛点】飞书使用惯性及数据迁移成本,员工存在抵触;客户使用工具较杂(openclaw/cloud code/codebuddy等)\n【AI Native进展】十几人AI团队;从飞书迁移到Octo(策略:新项目用Octo/老项目用飞书);Kickers.ai空间使用浅(7/15仅3条人类消息0条bot协作);约3人在Octo/7人在飞书;已引导获取连接文档;贾叔建议先推动内部团队使用积累经验再推广\n【OCTO使用进展和反馈】SaaS版本引导;Octopush重新安装;学习资料(吉利分享录屏剪辑脱敏)已准备\n【明略侧服务人员/Owner】贾金良\n【客户侧关键联系人】刘应龙/新意/青山\n【竞争对手情况】飞书(深度用户)','①重新安装Octopush②吉利分享录屏剪辑脱敏后发给客户③推动内部产研团队使用octo积累经验','辉哥定调:深度飞书客户不强迁,转为深度访谈飞书AI痛点反哺Octo产品','①飞书使用惯性大数据迁移成本②外部协同仍用飞书③使用深度不够未产生真正人机协同价值','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('中信资本'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 中信资本｜C类线索｜阶段:试用｜状态:停滞｜来源:已有关系(贾金良跟进)','【行业】金融/投资\n【关键场景/需求】Octopush安装;关注文档协同功能;集中1-2台Mini部署其他成员通过Octo bot分配使用\n【客户痛点】办公室装修中网络不稳定;使用量极低(<50条消息)\n【AI Native进展】客户办公室装修中预计6/15完工;7/18装修完毕网络正常;AP到了但未安装;甲叔未上线\n【OCTO使用进展和反馈】后台数据显示消息数不超过50条消耗较少;本周计划安装Octopush\n【明略侧服务人员/Owner】贾金良\n【客户侧关键联系人】杨国威','等待Octopush安装后推进','部署方式:集中1-2台Mini+成员经Octo bot分配','①网络问题(装修刚完)②甲叔未上线反馈','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('北京破圈'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 北京破圈｜D类战略储备｜阶段:认知｜状态:停滞｜来源:内部(孙方超/超哥)','【行业】营销/代运营\n【关键场景/需求】代运营业务中的选品/文案生成/日报时报制作等标准化任务/内部管理场景(财务报销/信息收集)\n【客户痛点】多角色沟通混乱风险/AI口水战浪费Token/管理惰性与交付风险/无法替代飞书客户沟通/文档协作割裂/服务业需要温度不可替代\n【AI Native进展】业务团队(Amy Gao/伟新/向东)对Octo在代运营业务中的价值存疑;认为AI适用于标准化重复性任务但不能代表决策\n【OCTO使用进展和反馈】未正式使用;5/7与Amy Gao和超哥讨论后反馈疑虑;建议小范围试点2-3个内部项目\n【明略侧服务人员/Owner】贾金良/孙方超\n【客户侧关键联系人】Amy Gao/超哥/伟新/向东\n【竞争对手情况】飞书(客户侧核心沟通工具)','孙方超组织Octo产品团队与业务破圈团队产品沟通','破圈是内部BU不是外部客户;代运营业务;最后更新5/9','业务复杂度高不建议全员推广;价值未验证','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('西门子'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 西门子｜D类战略储备｜阶段:认知｜状态:冷｜来源:渠道(孙方超转邀请函)','【行业】工业/制造\n【关键场景/需求】AI规模化落地/Agent驱动组织变革/人才管理(西门子研究院和全球人才与领导力负责人交流)\n【AI Native进展】孙方超转来正式邀请函;7/21拟闭门沙龙产业生态协同;辉哥问"谁去讲课"\n【OCTO使用进展和反馈】未开始\n【明略侧服务人员/Owner】孙方超\n【客户侧关键联系人】杨三角同学关系','确认是否推进/谁去参会','非销售驱动交流;产业生态协同性质','信息极少','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('青钜科技'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 青矩技术｜D类战略储备｜阶段:体验部署｜状态:冷｜来源:未知','【行业】咨询/工程\n【关键场景/需求】私有化部署体验\n【客户痛点】技术问题\n【AI Native进展】已完成私有化部署;未涉及费用\n【OCTO使用进展和反馈】存在技术问题由郭松处理\n【明略侧服务人员/Owner】赵玉平/郭松(技术)','建子群并同步沟通录音(待办)','体验部署型客户;无费用','信息极少','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('混沌学园'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 混沌学院｜C类线索｜阶段:认知｜状态:停滞｜来源:已有关系','【行业】教育/创新\n【AI Native进展】6/16注册Octo账号后未有进展;青山老师出国刚回约聊Octopush\n【OCTO使用进展和反馈】注册账号未使用\n【明略侧服务人员/Owner】贾金良\n【客户侧关键联系人】金鑫/青山','跟进约聊Octopush','第一梯队(攻坚中)但后续无更新','无实质进展','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('方里'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 方里｜C类线索｜阶段:认知｜状态:停滞｜来源:已有关系(贾叔)','【行业】消费品\n【AI Native进展】第一梯队攻坚中\n【OCTO使用进展和反馈】无进展信息\n【明略侧服务人员/Owner】贾金良(前期)','','5月列为第一梯队攻坚中,此后无更新','无更新','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('云迹'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 云迹｜C类线索｜阶段:认知｜状态:停滞｜来源:已有关系','【行业】机器人/酒店科技\n【AI Native进展】第一梯队攻坚中\n【OCTO使用进展和反馈】无进展信息','','5月列为第一梯队攻坚中,此后无更新','无更新','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('PPIO'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] PPIO｜C类线索｜阶段:认知｜状态:停滞｜来源:已有关系','【行业】云计算/边缘计算\n【AI Native进展】第一梯队攻坚中\n【OCTO使用进展和反馈】无进展信息','','5月第一梯队攻坚中,此后无更新','无更新','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('51World'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 51World｜C类线索｜阶段:认知｜状态:冷｜来源:已有关系','【行业】数字孪生/元宇宙\n【AI Native进展】第二梯队\n【OCTO使用进展和反馈】无实质进展','','5月第二梯队','信息极少','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('祥承'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 祥承｜C类线索｜阶段:认知｜状态:冷｜来源:已有关系','【行业】未知\n【AI Native进展】第二梯队\n【OCTO使用进展和反馈】无实质进展','','5月第二梯队','信息极少','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('香港中企'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 香港中企｜D类战略储备｜阶段:认知｜状态:冷｜来源:SaaS线索','【行业】企业服务(香港)\n【AI Native进展】第三梯队SaaS\n【OCTO使用进展和反馈】无实质进展\n【明略侧服务人员/Owner】AmyZhang','','5月第三梯队SaaS','信息极少','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('海归爸爸'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 海归爸爸｜D类战略储备｜阶段:认知｜状态:冷｜来源:SaaS线索','【行业】教育\n【AI Native进展】第三梯队SaaS\n【OCTO使用进展和反馈】无实质进展','','5月第三梯队SaaS','信息极少','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('我思科技'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 我思科技｜C类线索｜阶段:私有化部署｜状态:冷｜来源:已有关系(贾金良)','【行业】未知\n【关键场景/需求】升级体验文档和Loop引擎\n【AI Native进展】之前做过私有化部署,协助解决小问题后无进展;想升级体验文档和Loop引擎\n【OCTO使用进展和反馈】已私有化部署\n【明略侧服务人员/Owner】贾金良\n【客户侧关键联系人】方老师','已联系约近期升级','升级需求','','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('元梦灵境'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 元梦灵境｜D类战略储备｜阶段:认知｜状态:停滞｜来源:线索','【行业】未知\n【AI Native进展】6/9开通空间后仅6/9-10有消息之后无消息\n【OCTO使用进展和反馈】已沉寂\n【明略侧服务人员/Owner】贾金良\n【客户侧关键联系人】郭强','','','已沉寂','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('吴师/黄江华'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] 吴师/黄江华｜D类战略储备｜阶段:试用｜状态:冷｜来源:线索','【行业】未知\n【关键场景/需求】OpenClaw安装使用\n【AI Native进展】6/30已安装OpenClaw模型DeepSeek;7/18协助安装\n【OCTO使用进展和反馈】已安装使用\n【明略侧服务人员/Owner】贾金良\n【客户侧关键联系人】吴师/黄江华','','非重点客户;模型DeepSeek','','客户跟踪表原始数据完整保留'); }
  { const a=findAcct.get('Leo~JXQ金总'); if(a) insTrkReport.run(a.id,'weekly','客户跟踪表2026-08-12','[客户跟踪表·2026-08-12] Leo~JXQ金总｜D类战略储备｜阶段:认知｜状态:停滞｜来源:线索','【行业】未知\n【AI Native进展】6/26拉群后未有进展正在加微信;等忙完1-2周成立小组再教使用\n【明略侧服务人员/Owner】贾金良\n【客户侧关键联系人】Leo金总(JXQ)','','','等客户忙完再推进','客户跟踪表原始数据完整保留'); }


  // ===== 渠道活码列表导入（2026-09-23）=====
  // 数据来源：渠道活码列表.xlsx（微伴导出2026-09-16 15:44，10个活码），数值原样保留零改动
  const updEventNotes = db.prepare(`UPDATE ceo_events SET notes = notes || ? WHERE name = ?`);
  // 7个CEO获客活动对应的活码，追加活码原始数据
  updEventNotes.run('\n【渠道活码】名称:《晚点》头条-octo体验 | 扫码添加次数:200 | 使用成员:赵玉平 | 分组:Octo推广 | 创建时间:2026-05-08 10:20 | 创建人:赵玉平','《晚点》头条');
  updEventNotes.run('\n【渠道活码】名称:全球AI生态与创新峰会20260808 | 扫码添加次数:88 | 使用成员:赵玉平 | 分组:默认分组 | 创建时间:2026-08-07 14:18 | 创建人:赵玉平','AI生态峰会');
  updEventNotes.run('\n【渠道活码】名称:国有企业领导人员经营管理培训班（EMP） | 扫码添加次数:56 | 使用成员:赵玉平 | 分组:Octo推广 | 创建时间:2026-07-06 13:55 | 创建人:赵玉平 | 标签:国有企业领导人员经营管理培训班（EMP）','国企EMP');
  updEventNotes.run('\n【渠道活码】名称:Octo产品发布（明略公众号） | 扫码添加次数:26 | 使用成员:赵玉平 | 分组:默认分组 | 创建时间:2026-06-29 17:23 | 创建人:赵玉平','Octo产品发布');
  updEventNotes.run('\n【渠道活码】名称:CAIO峰会 | 扫码添加次数:17 | 使用成员:赵玉平 | 分组:默认分组 | 创建时间:2026-06-30 18:05 | 创建人:赵玉平','CAIO峰会');
  updEventNotes.run('\n【渠道活码】名称:中欧商学院0825 | 扫码添加次数:8 | 使用成员:赵玉平 | 分组:默认分组 | 创建时间:2026-08-21 19:03 | 创建人:赵玉平','中欧商学院');
  updEventNotes.run('\n【渠道活码】名称:外滩大会 | 扫码添加次数:1 | 使用成员:赵玉平 | 分组:默认分组 | 创建时间:2026-09-04 14:01 | 创建人:赵玉平 | 标签:外滩大会-姜哥','外滩大会');

  // 3个非CEO获客活码：下午茶（对应媒介力学下午茶线索）、CAIO联盟大会9/18-20（新活动扫码0）、跨境电商展（扫码0）
  // 下午茶活码：扫码23，追加到下午茶相关线索来源说明（leads表媒介力学·广州场线索来自此活码）
  // CAIO联盟大会和跨境电商展：扫码0，作为新活动记录
  const insCEOEvent2 = db.prepare(`INSERT INTO ceo_events (name, event_type, date, location, status, topic, wechat_followers, audience_count, registrations, activations, sql_count, key_messages, business_design, audience_profile, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insCEOEvent2.run('CAIO联盟大会918-20号','峰会','2026-09-18','','已结束','渠道活码（未关联CEO获客报告）',0,0,0,0,0,'赵玉平（活码创建人）','企微活码，扫码0次','CAIO联盟大会参会者','【渠道活码】名称:CAIO联盟大会918-20号 | 扫码添加次数:0 | 使用成员:赵玉平 | 分组:默认分组 | 创建时间:2026-09-08 11:54 | 创建人:赵玉平 | 标签:CAIO联盟大会');
  insCEOEvent2.run('AI赋能跨境电商与海外达人合作展览会','展会','2026-07-09','','已结束','渠道活码（未关联CEO获客报告）',0,0,0,0,0,'赵玉平（活码创建人）','企微活码，扫码0次','跨境电商从业者','【渠道活码】名称:AI赋能跨境电商与海外达人合作展览会 | 扫码添加次数:0 | 使用成员:赵玉平 | 分组:默认分组 | 创建时间:2026-07-09 16:43 | 创建人:赵玉平 | 标签:国有企业领导人员经营管理培训班（EMP）');

  // 下午茶活码全局备注（媒介力学·广州场等下午茶活动的企微入口）
  db.prepare(`UPDATE ceo_events SET notes = notes || ? WHERE name LIKE ?`).run('\n【渠道活码】名称:下午茶二维码 | 扫码添加次数:23 | 使用成员:赵玉平 | 分组:品牌与市场部 | 创建时间:2026-04-29 17:59 | 创建人:赵玉平 | 标签:周三营销下午茶','%下午茶%');




  // ===== 活动名称统一为活码名称（2026-09-23玉平确认：同活动码的名称）=====
  const renameToQR = db.prepare(`UPDATE ceo_events SET name = ? WHERE name = ?`);
  renameToQR.run('《晚点》头条-octo体验','《晚点》头条');
  renameToQR.run('全球AI生态与创新峰会20260808','AI生态峰会');
  renameToQR.run('国有企业领导人员经营管理培训班（EMP）','国企EMP');
  renameToQR.run('Octo产品发布（明略公众号）','Octo产品发布');
  renameToQR.run('中欧商学院0825','中欧商学院');
  // CAIO峰会、外滩大会与活码名称一致，无需改


}

export default db;
