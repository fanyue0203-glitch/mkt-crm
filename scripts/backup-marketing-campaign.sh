#!/bin/bash
# 市场营销活动获客 数据备份（每日）
set -e
BACKUP_DIR=/home/mlclaw/.openclaw/workspace/mkt-crm/backups
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d)
cd /home/mlclaw/.openclaw/workspace/mkt-crm
sqlite3 data/mkt-crm.db ".backup '$BACKUP_DIR/mkt-crm-$STAMP.db'" 2>/dev/null || \
  node -e "const D=require('better-sqlite3');new D('data/mkt-crm.db').backup('$BACKUP_DIR/mkt-crm-$STAMP.db').then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})"
node -e "
const D=require('better-sqlite3');
const db=new D('data/mkt-crm.db',{readonly:true});
const rows=db.prepare('SELECT * FROM marketing_campaign_leads').all();
const cols=['created_date','industry_group','industry_raw','contact_name','company_name','needs_text','campaign_name','source_type','product_interest','registrar','phone','province','city'];
const esc=v=>'\"'+String(v??'').replace(/\"/g,'\"\"')+'\"';
const out=[cols.join(',')].concat(rows.map(r=>cols.map(c=>esc(r[c])).join(',')));
require('fs').writeFileSync('$BACKUP_DIR/marketing-campaign-leads-$STAMP.csv','\uFEFF'+out.join('\n'));
console.log('backup rows:',rows.length);
"
find "$BACKUP_DIR" -name "mkt-crm-*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name "marketing-campaign-leads-*.csv" -mtime +30 -delete
