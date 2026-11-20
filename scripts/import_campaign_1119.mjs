#!/usr/bin/env node
// 2026 AI营销大会 · 归因版全量重建（1119）
// 输入：campaign_registrations_1119.csv（16列，UTF-8 BOM）
// 口径：TID 唯一键；归因团队为空=归市场部公共码，不计团队榜
// 用法：node scripts/import_campaign_1119.mjs <csv路径> [--snap-date 2026-11-19] [--snap-time 17:30] [--target 900] [--dry]
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const TARGET = +opt('target', 900);
const CAMPAIGN = '2026 AI营销大会';
if (!file) { console.error('缺少 CSV 路径'); process.exit(1); }

function parseCSV(t) {
  t = t.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const rows = parseCSV(readFileSync(file, 'utf8'));
const hdr = rows[0].map(h => h.trim());
const data = rows.slice(1).filter(r => r.length > 1 && String(r[0] || '').trim());
const I = n => hdr.indexOf(n);
const col = (r, n) => String(r[I(n)] ?? '').trim();

const db = new Database(join(__dirname, '..', 'data', 'mkt-crm.db'));
db.pragma('journal_mode=WAL');

const ins = db.prepare(`
INSERT INTO campaign_registrations
 (tid, reg_no, contact_name, company, department, title, industry, status,
  signup_time, signup_date, signup_method, inviter_raw, channel_code,
  attr_inviter, attr_team, attr_method, ticket_type, region, imported_at, updated_at)
VALUES
 (@tid, @reg_no, @contact_name, @company, @department, @title, @industry, @status,
  @signup_time, @signup_date, @signup_method, @inviter_raw, @channel_code,
  @attr_inviter, @attr_team, @attr_method, @ticket_type, @region, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(tid) DO UPDATE SET
  reg_no=excluded.reg_no, contact_name=excluded.contact_name, company=excluded.company,
  department=excluded.department, title=excluded.title, industry=excluded.industry, status=excluded.status,
  signup_time=excluded.signup_time, signup_date=excluded.signup_date, signup_method=excluded.signup_method,
  inviter_raw=excluded.inviter_raw, channel_code=excluded.channel_code,
  attr_inviter=excluded.attr_inviter, attr_team=excluded.attr_team, attr_method=excluded.attr_method,
  ticket_type=excluded.ticket_type, region=excluded.region, updated_at=CURRENT_TIMESTAMP
`);

let added = 0, updated = 0, skipped = 0;
const teamStat = {}, wayStat = {};
const tx = db.transaction(list => {
  for (const r of list) {
    const tid = col(r, 'TID');
    if (!tid) { skipped++; continue; }
    const st = col(r, '报名时间');
    const team = col(r, '归因团队');
    teamStat[team || '(市场部公共码)'] = (teamStat[team || '(市场部公共码)'] || 0) + 1;
    const way = col(r, '归因方式');
    wayStat[way || '(空)'] = (wayStat[way || '(空)'] || 0) + 1;
    const existed = db.prepare('SELECT 1 FROM campaign_registrations WHERE tid=?').get(tid);
    ins.run({
      tid,
      reg_no: col(r, '报名编号'),
      contact_name: col(r, '姓名'),
      company: col(r, '公司'),
      department: col(r, '部门'),
      title: col(r, '职位'),
      industry: col(r, '所在行业'),
      status: col(r, '状态') || '有效票',
      signup_time: st,
      signup_date: st.slice(0, 10),
      signup_method: col(r, '报名方式'),
      inviter_raw: col(r, '邀约人'),
      channel_code: col(r, '渠道'),
      attr_inviter: col(r, '归因邀约人'),
      attr_team: team,
      attr_method: way,
      ticket_type: col(r, '票种'),
      region: '',
    });
    existed ? updated++ : added++;
  }
});
tx(data);

const totals = db.prepare(`SELECT COUNT(*) total,
  SUM(CASE WHEN status='有效票' THEN 1 ELSE 0 END) valid,
  SUM(CASE WHEN status='待审核' THEN 1 ELSE 0 END) pending,
  MAX(signup_time) last_t FROM campaign_registrations`).get();

const snapDate = opt('snap-date', '2026-11-19');
const snapTime = opt('snap-time', '17:30');
if (!DRY) {
  db.prepare(`INSERT INTO campaign_reg_snapshots (campaign, stat_date, stat_time, total, valid, pending, target, source, note)
    VALUES (?,?,?,?,?,?,?,'import','活动行1119归因版全量 1031条')
    ON CONFLICT(campaign, stat_date) DO UPDATE SET
      stat_time=excluded.stat_time, total=excluded.total, valid=excluded.valid,
      pending=excluded.pending, target=excluded.target, source='import', note=excluded.note`)
    .run(CAMPAIGN, snapDate, snapTime, totals.total || 0, totals.valid || 0,
      totals.pending || 0, TARGET);
}

const clean = /[\s\-_.·・\/|]/g;
const norm = s => String(s || '').replace(clean, '').toLowerCase();
const CK = new Set(db.prepare("SELECT DISTINCT channel_code FROM campaign_registrations WHERE channel_code!=''").all().map(r => norm(r.channel_code)));
const attrRows = db.prepare("SELECT attr_inviter, attr_method FROM campaign_registrations WHERE attr_team!='' AND attr_inviter!=''").all();
let matchedCode = 0;
for (const r of attrRows) if (CK.has(norm(r.attr_inviter))) matchedCode++;
const staffCoverage = attrRows.length ? +(matchedCode / attrRows.length * 100).toFixed(1) : 0;

console.log(JSON.stringify({
  file, dry: DRY, rows: data.length, added, updated, skipped,
  totals: { total: totals.total, valid: totals.valid, pending: totals.pending, last_t: totals.last_t },
  snapshot: { date: snapDate, time: snapTime, target: TARGET, pct: +((totals.total / TARGET) * 100).toFixed(1) },
  teamStat: Object.entries(teamStat).sort((a, b) => b[1] - a[1]),
  salesTotal: Object.entries(teamStat).filter(([k]) => k && k !== '(市场部公共码)').reduce((s, [, v]) => s + v, 0),
  wayStat,
  staffCodeMatchPct: staffCoverage,
}, null, 2));
db.close();
