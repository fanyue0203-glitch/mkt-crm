import Database from 'better-sqlite3';
import XLSX from 'xlsx';

const db = new Database('./data/mkt-crm.db');

// 从两个CRM导出文件读取企业简称
const crmFiles = ['../crm-export-0907.xlsx', '../data/crm-leads.xlsx'];
const nameMap = new Map(); // company_name -> short_name
const phoneMap = new Map(); // phone -> short_name

for (const f of crmFiles) {
  try {
    const wb = XLSX.readFile(f);
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      const data = XLSX.utils.sheet_to_json(ws);
      for (const row of data) {
        const name = row['客户名称'] || row['公司名称'];
        const short = row['企业简称（必填）'] || row['企业简称'];
        const phone = row['手机'] || row['电话'];
        if (name && short && short !== name) {
          nameMap.set(name.trim(), short.trim());
        }
        if (phone && short) {
          const cleanPhone = String(phone).replace(/\D/g, '');
          if (cleanPhone.length >= 8) phoneMap.set(cleanPhone, short.trim());
        }
      }
    }
  } catch(e) { console.error(f, e.message); }
}

console.log('CRM导出中简称映射:', nameMap.size, '个公司名映射,', phoneMap.size, '个电话映射');
console.log('样例:');
for (const [k,v] of [...nameMap.entries()].slice(0,10)) console.log(`  ${v} ← ${k}`);

// 按公司名精确匹配更新
const allLeads = db.prepare('SELECT id, company_name, phone FROM leads').all();
const updName = db.prepare('UPDATE leads SET company_short_name = ? WHERE id = ?');
let updatedByName = 0, updatedByPhone = 0, replaced = 0;

const trx = db.transaction(() => {
  for (const l of allLeads) {
    const cname = (l.company_name || '').trim();
    const phone = String(l.phone || '').replace(/\D/g, '');
    let newShort = null;

    // 1. 公司名精确匹配CRM
    if (cname && nameMap.has(cname)) {
      newShort = nameMap.get(cname);
    }
    // 2. 电话匹配
    if (!newShort && phone.length >= 8 && phoneMap.has(phone)) {
      newShort = phoneMap.get(phone);
    }

    if (newShort) {
      const old = l.company_short_name || '';
      if (old && old !== newShort) replaced++;
      updName.run(newShort, l.id);
      if (old && old !== newShort) {
        // replaced auto-generated
      } else {
        updatedByName++;
      }
    }
  }
});
trx();

// 统计剩余空简称和填充情况
const total = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
const withShort = db.prepare("SELECT COUNT(*) as c FROM leads WHERE company_short_name != ''").get().c;
const empty = total - withShort;
console.log(`\n结果: 总${total}条 | 有简称${withShort}条 | 空${empty}条`);
console.log(`其中CRM匹配更新约 ${updatedByName + replaced} 条`);

// 看看匹配上的效果
console.log('\nCRM匹配示例:');
const samples = db.prepare("SELECT company_name, company_short_name FROM leads WHERE company_short_name != '' ORDER BY RANDOM() LIMIT 15").all();
samples.forEach(s => console.log(`  ${String(s.company_short_name).padEnd(12)} ← ${s.company_name}`));
