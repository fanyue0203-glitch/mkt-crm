#!/usr/bin/env node
// 活动行报名明细（含「渠道」列）→ campaign_registrations 增量导入 + 当日快照
// 渠道码 → 中文名映射来自 scripts/campaign_channels.json
// 用法: node scripts/import_campaign_regs.mjs <xlsx路径> [--date YYYY-MM-DD] [--time HH:mm] [--target 900]
import XLSX from 'xlsx';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'mkt-crm.db'));
const CHANNELS = JSON.parse(readFileSync(join(__dirname, 'campaign_channels.json'), 'utf8'));

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const TARGET = +opt('target', 900);
const CAMPAIGN = '2026 AI营销大会';
if (!file) { console.error('缺少 xlsx 路径'); process.exit(1); }

// ===== 渠道码映射 =====
// code 大小写不敏感；label 取括号里的「区域-姓名」
const CODE_MAP = new Map();
for (const c of CHANNELS) {
  CODE_MAP.set(c.code.toLowerCase(), { code: c.code, label: c.label, cat: c.cat });
}
// 别名补充
const ALIAS = {
  mltmlt: { code: 'MLTMLT', label: 'MLT员工邀请码', cat: '内部' },
  mzxcx: { code: 'mzxcx', label: '秒针小程序', cat: '市场部' },
  mzgzh: { code: 'mzgzh', label: '秒针公众号', cat: '市场部' },
  mlweb: { code: 'mlweb', label: '明略官网', cat: '市场部' },
  mzsiyu: { code: 'mzsiyu', label: '秒针私域', cat: '市场部' },
  mzedm: { code: 'mzedm', label: '秒针EDM', cat: '市场部' },
  mzpage: { code: 'mzpage', label: '秒针官网', cat: '市场部' },
};

export function resolveChannel(raw) {
  const code = String(raw ?? '').trim();
  if (!code) return { code: '', label: '无渠道码（自然报名）', cat: '未归属' };
  const k = code.toLowerCase();
  if (ALIAS[k]) return ALIAS[k];
  if (CODE_MAP.has(k)) return CODE_MAP.get(k);
  // 模糊：去掉空格
  const k2 = k.replace(/\s/g, '');
  for (const [key, v] of CODE_MAP) if (key.replace(/\s/g, '') === k2) return v;
  return { code, label: `未登记渠道码(${code})`, cat: '未登记' };
}

// ===== 读表 =====
const wb = XLSX.readFile(file, { cellDates: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
if (!rows.length) { console.error('表格为空'); process.exit(1); }
const get = (r, ...names) => {
  for (const n of names) if (r[n] !== undefined && r[n] !== '') return String(r[n]).trim();
  return '';
};

function regionOf(company) {
  const c = String(company || '');
  if (/上海|沪/.test(c)) return '华东-上海';
  if (/苏州|南京|无锡|常州|江苏|南通|徐州/.test(c)) return '华东-江苏';
  if (/杭州|宁波|温州|义乌|嘉兴|浙江|绍兴|金华/.test(c)) return '华东-浙江';
  if (/安徽|合肥|山东|青岛|济南|福建|厦门|福州|江西|南昌/.test(c)) return '华东-其他';
  if (/北京/.test(c)) return '华北-北京';
  if (/天津|河北|石家庄|山西|太原|内蒙/.test(c)) return '华北-其他';
  if (/广州|深圳|东莞|佛山|珠海|中山|广东|华南/.test(c)) return '华南';
  if (/成都|重庆|四川|云南|昆明|贵州|贵阳/.test(c)) return '西南';
  if (/武汉|长沙|郑州|湖北|湖南|河南/.test(c)) return '华中';
  if (/香港|澳门/.test(c)) return '港澳';
  if (/辽宁|沈阳|大连|吉林|长春|黑龙江|哈尔滨|陕西|西安|甘肃|兰州|新疆/.test(c)) return '北方其他';
  return '未标注';
}

const upsert = db.prepare(`
INSERT INTO campaign_registrations
 (tid, order_no, contact_name, company, department, title, industry, phone, email,
  signup_time, signup_date, status, signup_method, inviter_raw, inviter_bucket, inviter_name,
  channel_code, region, need_text, updated_at)
VALUES
 (@tid, @order_no, @contact_name, @company, @department, @title, @industry, @phone, @email,
  @signup_time, @signup_date, @status, @signup_method, @inviter_raw, @inviter_bucket, @inviter_name,
  @channel_code, @region, @need_text, CURRENT_TIMESTAMP)
ON CONFLICT(tid) DO UPDATE SET
  status=excluded.status, contact_name=excluded.contact_name, company=excluded.company,
  department=excluded.department, title=excluded.title, industry=excluded.industry,
  inviter_raw=excluded.inviter_raw, inviter_bucket=excluded.inviter_bucket, inviter_name=excluded.inviter_name,
  channel_code=excluded.channel_code, region=excluded.region, need_text=excluded.need_text,
  updated_at=CURRENT_TIMESTAMP
`);

let added = 0, touched = 0, skipped = 0;
const chStat = {};
const tx = db.transaction((list) => {
  for (const r of list) {
    const tid = get(r, 'TID') || get(r, '报名编号');
    if (!tid) { skipped++; continue; }
    const signup_time = get(r, '报名时间');
    const company = get(r, '公司');
    const ch = resolveChannel(get(r, '渠道'));
    chStat[ch.label] = (chStat[ch.label] || 0) + 1;
    const existed = db.prepare('SELECT 1 FROM campaign_registrations WHERE tid=?').get(tid);
    upsert.run({
      tid,
      order_no: get(r, '订单编号'),
      contact_name: get(r, '姓名'),
      company,
      department: get(r, '部门'),
      title: get(r, '职位'),
      industry: get(r, '所在行业'),
      phone: get(r, '手机号码'),
      email: get(r, '电子邮箱'),
      signup_time,
      signup_date: signup_time.slice(0, 10).replace(/\//g, '-'),
      status: get(r, '状态'),
      signup_method: get(r, '报名方式'),
      inviter_raw: get(r, '邀约人'),
      inviter_bucket: '',   // 渠道码口径启用后，邀约人字段不再用于渠道归类
      inviter_name: '',
      channel_code: ch.code,
      region: regionOf(company),
      need_text: get(r, Object.keys(r).find(k => k.includes('最迫切需要解决')) || ''),
    });
    existed ? touched++ : added++;
  }
});
tx(rows);

const totals = db.prepare(`SELECT COUNT(*) total,
  SUM(CASE WHEN status='有效票' THEN 1 ELSE 0 END) valid,
  SUM(CASE WHEN status='待审核' THEN 1 ELSE 0 END) pending,
  MAX(signup_time) last_t FROM campaign_registrations`).get();

const statDate = opt('date', (totals.last_t || '').slice(0, 10));
const statTime = opt('time', (totals.last_t || '').slice(11, 16));
db.prepare(`INSERT INTO campaign_reg_snapshots (campaign, stat_date, stat_time, total, valid, pending, target, source)
  VALUES (?,?,?,?,?,?,?,'import')
  ON CONFLICT(campaign, stat_date) DO UPDATE SET
    stat_time=excluded.stat_time, total=excluded.total, valid=excluded.valid, pending=excluded.pending,
    target=excluded.target, source='import'`).run(
  CAMPAIGN, statDate, statTime, totals.total || 0, totals.valid || 0, totals.pending || 0, TARGET
);

console.log(JSON.stringify({
  file, added, updated: touched, skipped,
  total: totals.total, valid: totals.valid, pending: totals.pending,
  snapshot: { date: statDate, time: statTime, target: TARGET, pct: +((totals.total / TARGET) * 100).toFixed(1) },
  channelCount: Object.keys(chStat).length,
  channels: Object.entries(chStat).sort((a, b) => b[1] - a[1]),
}, null, 2));
db.close();