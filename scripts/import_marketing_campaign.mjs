// 市场营销活动获客 线索导入脚本
// 数据源：data/marketing-campaign-leads/leads_v1_2.csv（搭子君 2026-10-27，401条去重后）
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'mkt-crm.db');
const CSV_PATH = process.argv[2] || '/home/mlclaw/.openclaw/workspace/data/marketing-campaign-leads/leads_v1_2.csv';

function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* skip */ }
      else cur += ch;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r[0] || '').trim());
}

const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '');
const table = parseCSV(raw);
const header = table[0];
const dataRows = table.slice(1);

// 表头顺序对应字段
const FIELD_ORDER = ['created_date', 'industry_raw', 'contact_name', 'company_name', 'needs_text',
  'campaign_name', 'registrar', 'phone', 'province', 'city', 'industry_group', 'product_interest',
  'source_type', 'customer_type'];

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const exists = db.prepare('SELECT COUNT(*) c FROM marketing_campaign_leads').get().c;
if (exists > 0 && !process.argv.includes('--force')) {
  console.log(`已有 ${exists} 条数据，跳过。加 --force 清空重导。`);
  process.exit(0);
}
if (process.argv.includes('--force')) {
  db.prepare('DELETE FROM marketing_campaign_leads').run();
}

const ins = db.prepare(`INSERT OR IGNORE INTO marketing_campaign_leads
  (created_date, industry_raw, contact_name, company_name, needs_text, campaign_name, registrar,
   phone, province, city, industry_group, product_interest, source_type, customer_type)
  VALUES (@created_date,@industry_raw,@contact_name,@company_name,@needs_text,@campaign_name,@registrar,
   @phone,@province,@city,@industry_group,@product_interest,@source_type,@customer_type)`);

let ok = 0, skipped = 0;
const skippedList = [];
const runAll = db.transaction(rows => {
  for (const r of rows) {
    const obj = {};
    FIELD_ORDER.forEach((f, i) => { obj[f] = (r[i] || '').trim(); });
    if (!obj.contact_name && !obj.company_name) continue;
    const res = ins.run(obj);
    if (res.changes) ok++;
    else { skipped++; skippedList.push(`${obj.company_name}|${obj.contact_name}|${obj.phone}`); }
  }
});
runAll(dataRows);

const total = db.prepare('SELECT COUNT(*) c FROM marketing_campaign_leads').get().c;
console.log(`CSV ${dataRows.length} 行 → 入库 ${ok} 条，去重跳过 ${skipped} 条，表内共 ${total} 条`);
if (skippedList.length) console.log('跳过明细:\n  ' + skippedList.join('\n  '));

console.log('\n分布：');
for (const [label, sql] of [
  ['行业_一级', 'SELECT industry_group k, COUNT(*) c FROM marketing_campaign_leads GROUP BY 1 ORDER BY 2 DESC'],
  ['内容来源类型', 'SELECT source_type k, COUNT(*) c FROM marketing_campaign_leads GROUP BY 1 ORDER BY 2 DESC'],
]) {
  console.log(label + ':');
  db.prepare(sql).all().forEach(r => console.log(`  ${r.k}: ${r.c}`));
}
// 多值产品线
const prodMap = {};
db.prepare('SELECT product_interest p FROM marketing_campaign_leads').all().forEach(r => {
  (r.p || '').split('|').filter(Boolean).forEach(k => { prodMap[k] = (prodMap[k] || 0) + 1; });
});
console.log('意向产品线(多值计数):');
Object.entries(prodMap).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));