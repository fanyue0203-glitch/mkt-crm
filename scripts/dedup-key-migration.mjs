// 唯一键迁移：从 (phone, company_name) 改为 (phone, company_name, created_date)
// 背景：原键误杀 2 条合法的「同人同司不同时间」线索，导致 401 vs PRD 403 差 2
// 幂等：可重复执行；自动备份 DB
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'mkt-crm.db');

// 1. 备份
const bak = DB_PATH + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(DB_PATH, bak);
console.log('已备份 →', path.basename(bak));

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
const before = db.prepare('SELECT COUNT(*) c FROM marketing_campaign_leads').get().c;
console.log('迁移前条数:', before);

// 2. 重建表：唯一键加 created_date
db.exec(`
  CREATE TABLE IF NOT EXISTS marketing_campaign_leads_tmp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_date TEXT DEFAULT '',
    industry_raw TEXT DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    needs_text TEXT DEFAULT '',
    campaign_name TEXT DEFAULT '',
    registrar TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    province TEXT DEFAULT '',
    city TEXT DEFAULT '',
    industry_group TEXT DEFAULT '',
    product_interest TEXT DEFAULT '',
    source_type TEXT DEFAULT '',
    customer_type TEXT DEFAULT '',
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone, company_name, created_date)
  );
  INSERT OR IGNORE INTO marketing_campaign_leads_tmp
    (id,created_date,industry_raw,contact_name,company_name,needs_text,campaign_name,registrar,
     phone,province,city,industry_group,product_interest,source_type,customer_type,imported_at,updated_at)
  SELECT id,created_date,industry_raw,contact_name,company_name,needs_text,campaign_name,registrar,
     phone,province,city,industry_group,product_interest,source_type,customer_type,imported_at,updated_at
  FROM marketing_campaign_leads;
  DROP TABLE marketing_campaign_leads;
  ALTER TABLE marketing_campaign_leads_tmp RENAME TO marketing_campaign_leads;
  CREATE INDEX IF NOT EXISTS idx_mcl_industry_group ON marketing_campaign_leads(industry_group);
  CREATE INDEX IF NOT EXISTS idx_mcl_source_type ON marketing_campaign_leads(source_type);
  CREATE INDEX IF NOT EXISTS idx_mcl_campaign_name ON marketing_campaign_leads(campaign_name);
  CREATE INDEX IF NOT EXISTS idx_mcl_province ON marketing_campaign_leads(province);
  CREATE INDEX IF NOT EXISTS idx_mcl_created_date ON marketing_campaign_leads(created_date);
`);
console.log('表结构已更新，唯一键 = (phone, company_name, created_date)');
db.close();
