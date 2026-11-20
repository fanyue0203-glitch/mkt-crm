#!/usr/bin/env node
// 2026-11-19 报名数据「人工归因清洗版」全量同步
// 输入：
//   1) 武永春 11/20 交付的 xlsx（活动行导出全量，含真实邀约人/手机/邮箱）
//   2) 搭子君 campaign_registrations_1119.csv（人工归因清洗版，1031条，含归因邀约人/归因团队/归因方式）
// 动作：以 CSV 的归因为准，用 xlsx 补齐明细字段；全量 upsert；写 11/19 17:30 快照
// 用法: node scripts/fix_regs_attribution_1119.mjs <xlsx> <csv> [--date 2026-11-19] [--time 17:30]
import XLSX from 'xlsx';
import fs from 'fs';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseCsv } from './lib-csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'mkt-crm.db'));
const CAMPAIGN = '2026 AI营销大会';
const TARGET = 900;

const args = process.argv.slice(2);
const files = args.filter(a => !a.startsWith('--'));
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
if (files.length < 2) { console.error('用法: node fix_regs_attribution_1119.mjs <xlsx> <csv>'); process.exit(1); }

// ===== 读 CSV（RFC4180，支持引号内的逗号） =====
const csvRecs = parseCsv(fs.readFileSync(files[1], 'utf8'));
if (!csvRecs.length) { console.error('CSV 为空'); process.exit(1); }
const csvMap = new Map(csvRecs.map(r => [r['TID'], r]));

// ===== 读 xlsx =====
const wb = XLSX.readFile(files[0]);
const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
const xm = new Map(raw.map(r => [String(r['TID'] || '').trim(), r]));

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
const clean = (v) => String(v ?? '').trim().replace(/^[🈚️️\s]+$/, '');

const upsert = db.prepare(`
INSERT INTO campaign_registrations
 (tid, order_no, contact_name, company, department, title, industry, phone, email,
  signup_time, signup_date, status, signup_method, inviter_raw, inviter_bucket, inviter_name,
  channel_code, region, need_text, reg_no, attr_inviter, attr_team, attr_method, ticket_type, updated_at)
VALUES
 (@tid, @order_no, @contact_name, @company, @department, @title, @industry, @phone, @email,
  @signup_time, @signup_date, @status, @signup_method, @inviter_raw, '', '',
  @channel_code, @region, @need_text, @reg_no, @attr_inviter, @attr_team, @attr_method, @ticket_type, CURRENT_TIMESTAMP)
ON CONFLICT(tid) DO UPDATE SET
  order_no=excluded.order_no, contact_name=excluded.contact_name, company=excluded.company,
  department=excluded.department, title=excluded.title, industry=excluded.industry,
  phone=excluded.phone, email=excluded.email, signup_time=excluded.signup_time, signup_date=excluded.signup_date,
  status=excluded.status, signup_method=excluded.signup_method, inviter_raw=excluded.inviter_raw,
  channel_code=excluded.channel_code, region=excluded.region, need_text=excluded.need_text,
  reg_no=excluded.reg_no, attr_inviter=excluded.attr_inviter, attr_team=excluded.attr_team,
  attr_method=excluded.attr_method, ticket_type=excluded.ticket_type, updated_at=CURRENT_TIMESTAMP
`);

const NEED_KEY = '在AI营销落地过程中，您当前最迫切需要解决的是哪个环节？';
let added = 0, touched = 0, skipped = 0, fixedInviter = 0;
const missingXlsx = [];
const tx = db.transaction(() => {
  for (const c of csvRecs) {
    const tid = c['TID'];
    if (!tid) { skipped++; continue; }
    const x = xm.get(tid) || null;
    if (!x) missingXlsx.push(tid);
    const signup_time = (c['报名时间'] || x?.['报名时间'] || '').trim();
    const company = clean(c['公司'] || x?.['公司']);
    // 邀约人：优先 xlsx 原始值（人工归因 CSV 里个别被改成渠道码/无意义符号）
    const inviterX = clean(x?.['邀约人']);
    const inviterC = clean(c['邀约人']);
    if (inviterX && inviterX !== inviterC) fixedInviter++;
    const inviter = inviterX || inviterC;
    const existed = db.prepare('SELECT 1 FROM campaign_registrations WHERE tid=?').get(tid);
    upsert.run({
      tid,
      order_no: clean(c['订单编号'] || x?.['订单编号']),
      contact_name: clean(c['姓名'] || x?.['姓名']),
      company,
      department: clean(c['部门'] || x?.['部门']),
      title: clean(c['职位'] || x?.['职位']),
      industry: clean(c['所在行业'] || x?.['所在行业']),
      phone: clean(x?.['手机号码']),
      email: clean(x?.['电子邮箱']),
      signup_time: signup_time,
      signup_date: signup_time.slice(0, 10).replace(/\//g, '-'),
      status: clean(c['状态'] || x?.['状态']) || '有效票',
      signup_method: clean(c['报名方式'] || x?.['报名方式']),
      inviter_raw: inviter,
      channel_code: clean(c['渠道'] || x?.['渠道']),
      region: regionOf(company),
      need_text: clean(x?.[NEED_KEY]),
      reg_no: clean(c['报名编号'] || x?.['报名编号']),
      attr_inviter: clean(c['归因邀约人']),
      attr_team: clean(c['归因团队']),
      attr_method: clean(c['归因方式']),
      ticket_type: clean(c['票种'] || x?.['票种']),
    });
    existed ? touched++ : added++;
  }
});
tx();

const totals = db.prepare(`SELECT COUNT(*) total,
  SUM(CASE WHEN status='有效票' THEN 1 ELSE 0 END) valid,
  SUM(CASE WHEN status='待审核' THEN 1 ELSE 0 END) pending,
  MAX(signup_time) last_t FROM campaign_registrations`).get();

const statDate = opt('date', '2026-11-19');
const statTime = opt('time', '17:30');
db.prepare(`INSERT INTO campaign_reg_snapshots (campaign, stat_date, stat_time, total, valid, pending, target, source, note)
  VALUES (?,?,?,?,?,?,?,'manual','活动行1119人工归因清洗版全量 1031条')
  ON CONFLICT(campaign, stat_date) DO UPDATE SET
    stat_time=excluded.stat_time, total=excluded.total, valid=excluded.valid, pending=excluded.pending,
    target=excluded.target, source='manual', note=excluded.note`).run(
  CAMPAIGN, statDate, statTime, totals.total || 0, totals.valid || 0, totals.pending || 0, TARGET
);

const teams = db.prepare(`SELECT COALESCE(NULLIF(attr_team,''),'市场部公共码+未匹配') z, COUNT(*) c
  FROM campaign_registrations GROUP BY 1 ORDER BY c DESC`).all();

console.log(JSON.stringify({
  csv: csvRecs.length, xlsx: raw.length, added, updated: touched, skipped,
  missingXlsx: missingXlsx.length, inviterFixedFromXlsx: fixedInviter,
  total: totals.total, valid: totals.valid, pending: totals.pending, lastSignup: totals.last_t,
  snapshot: { date: statDate, time: statTime, total: totals.total, target: TARGET, pct: +((totals.total / TARGET) * 100).toFixed(1) },
  teams,
}, null, 2));
db.close();
