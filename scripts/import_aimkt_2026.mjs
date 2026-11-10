// 2026AI·营销大会 报名线索导入
// 数据源：seeds/AImarketing_2026_signup.xlsx（2026-10-30 武永春同步，200条）
// 字段映射：姓名/邮箱/手机/公司/部门/职位/行业 → marketing_campaign_leads
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'mkt-crm.db');
const JSON_PATH = '/tmp/aimkt.json';

const CAMPAIGN = '2026AI·营销大会';
const CREATED_DATE = '2026年10月30日';
const SOURCE_TYPE = '线下活动';
const REGISTRAR = '武永春';

// 行业原值 → 行业大类（新口径扩展，覆盖新活动出现的行业）
const INDUSTRY_GROUP = {
  '广告代理商': '广告代理商',
  '互联网与技术': '互联网/科技',
  '软件': '互联网/科技',
  '平台方': '互联网/科技',
  '食品与饮料': '食品饮料',
  '金融服务': '金融',
  '投资机构': '金融',
  '教育服务': '教育',
  '学校': '教育',
  '医药大健康': '医药健康',
  '媒体': '媒体',
  '消费电子': '家用电子',
  '零售': '零售电商',
  '汽车': '汽车',
  '休闲娱乐（酒店、旅游、体育、娱乐）': '休闲娱乐',
  '餐饮': '餐饮',
  '化妆品和高级美容': '美妆个护',
  '时装及配饰': '鞋服配饰',
  '家居装饰和建材': '家居建材',
  '房地产': '房地产',
  '其他': '其他',
};

// 需求选项 → 意向产品线
const NEED_PRODUCT = [
  ['品牌在AI搜索和种草平台上存在感越来越弱', 'GEO', '种草/DOMO'],
  ['内容需求爆发式增长，现有团队产能和成本都扛不住', '种草/DOMO'],
  ['想让AI真正跑进营销业务，但缺行业方法论和落地专家', 'AI/大模型'],
  ['AI能力散在各个人和工具里，团队协同和业务流程串不起来', 'AI/大模型'],
  ['品牌出海需要达人矩阵和本地化内容', '出海营销', '种草/DOMO'],
];

function mapProductInterest(needs = '') {
  const set = new Set();
  for (const [kw, ...prods] of NEED_PRODUCT) if (needs.includes(kw)) prods.forEach(p => set.add(p));
  return [...set].join('|');
}

const raw = JSON.parse((await import('fs')).readFileSync(JSON_PATH, 'utf8'));
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const del = db.prepare('DELETE FROM marketing_campaign_leads WHERE campaign_name = ?');
const removed = del.run(CAMPAIGN).changes;

const ins = db.prepare(`INSERT OR IGNORE INTO marketing_campaign_leads
  (created_date, industry_raw, contact_name, company_name, needs_text, campaign_name, registrar,
   phone, province, city, industry_group, product_interest, source_type, customer_type)
  VALUES (@created_date,@industry_raw,@contact_name,@company_name,@needs_text,@campaign_name,@registrar,
   @phone,@province,@city,@industry_group,@product_interest,@source_type,@customer_type)`);

let ok = 0, skipped = 0, blankInd = 0;
const runAll = db.transaction(rows => {
  for (const r of rows) {
    const obj = {
      created_date: CREATED_DATE,
      industry_raw: r.industry_raw,
      contact_name: r.contact_name,
      company_name: r.company,
      needs_text: r.needs,
      campaign_name: CAMPAIGN,
      registrar: REGISTRAR,
      phone: r.phone,
      province: '',
      city: '',
      industry_group: INDUSTRY_GROUP[r.industry_raw] || '其他',
      product_interest: mapProductInterest(r.needs),
      source_type: SOURCE_TYPE,
      customer_type: r.industry_raw || '未填写',
    };
    if (!obj.industry_raw) blankInd++;
    const res = ins.run(obj);
    if (res.changes) ok++; else skipped++;
  }
});
runAll(raw);

const total = db.prepare('SELECT COUNT(*) c FROM marketing_campaign_leads').get().c;
console.log(`活动【${CAMPAIGN}】清空旧 ${removed} 条 → 入库 ${ok} 条，去重跳过 ${skipped} 条，表内共 ${total} 条`);
console.log('行业大类 TOP:');
db.prepare(`SELECT industry_group k, COUNT(*) c FROM marketing_campaign_leads WHERE campaign_name=? GROUP BY 1 ORDER BY 2 DESC`).all(CAMPAIGN).forEach(r => console.log(`  ${r.k}: ${r.c}`));
const pm = {};
db.prepare('SELECT product_interest p FROM marketing_campaign_leads WHERE campaign_name=?').all(CAMPAIGN).forEach(r => (r.p || '').split('|').filter(Boolean).forEach(k => pm[k] = (pm[k] || 0) + 1));
console.log('意向产品线(多值):', JSON.stringify(pm));