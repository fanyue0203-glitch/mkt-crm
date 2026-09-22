import express from 'express';
import multer from 'multer';
import { readFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// File upload config
const upload = multer({
  dest: join(__dirname, 'uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('仅支持 Excel (.xlsx/.xls) 和 CSV (.csv) 文件'));
  }
});

// ===== Helper: generic CRUD =====
function buildUpdate(table, id, body, excludeFields = ['id', 'created_at']) {
  const fields = Object.keys(body).filter(k => !excludeFields.includes(k));
  if (!fields.length) return null;
  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  const stmt = db.prepare(`UPDATE ${table} SET ${sets}, updated_at = datetime('now','localtime') WHERE id = @id`);
  return stmt.run({ ...body, id });
}

function logEdit(table, recordId, oldRow, newRow, editedBy = '') {
  const insert = db.prepare('INSERT INTO edit_history (table_name, record_id, field_name, old_value, new_value, edited_by) VALUES (?,?,?,?,?,?)');
  for (const key of Object.keys(newRow)) {
    if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;
    const oldVal = String(oldRow[key] ?? '');
    const newVal = String(newRow[key] ?? '');
    if (oldVal !== newVal) {
      insert.run(table, recordId, key, oldVal, newVal, editedBy);
    }
  }
}

// ===== Dashboard Stats =====
app.get('/api/stats', (req, res) => {
  const eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
  const eventsByStatus = db.prepare("SELECT status, COUNT(*) as c FROM events GROUP BY status").all();
  const speechCount = db.prepare('SELECT COUNT(*) as c FROM speeches').get().c;
  const totalAudience = db.prepare('SELECT COALESCE(SUM(audience_count),0) as c FROM speeches').get().c;
  const accountCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;
  const accountsByTier = db.prepare("SELECT tier, COUNT(*) as c FROM accounts GROUP BY tier").all();
  const leadCount = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const leadsByStage = db.prepare("SELECT stage, COUNT(*) as c FROM leads GROUP BY stage").all();
  const recentEvents = db.prepare("SELECT id, name, date, status, leads_count FROM events ORDER BY date DESC LIMIT 5").all();
  const recentLeads = db.prepare("SELECT id, contact_name, company, stage, source_type, created_at FROM leads ORDER BY created_at DESC LIMIT 10").all();
  res.json({
    events: { total: eventCount, byStatus: eventsByStatus },
    speeches: { total: speechCount, totalAudience },
    accounts: { total: accountCount, byTier: accountsByTier },
    leads: { total: leadCount, byStage: leadsByStage },
    recentEvents, recentLeads
  });
});

// ===== Events CRUD =====
app.get('/api/events', (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = {};
  if (status) { sql += ' AND status = @status'; params.status = status; }
  if (search) { sql += ' AND (name LIKE @s OR theme LIKE @s OR location LIKE @s)'; params.s = `%${search}%`; }
  sql += ' ORDER BY date DESC';
  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as c')).get(params).c;
  sql += ` LIMIT @limit OFFSET @offset`;
  params.limit = +limit;
  params.offset = (+page - 1) * +limit;
  const rows = db.prepare(sql).all(params);
  res.json({ data: rows, total, page: +page, limit: +limit });
});

app.get('/api/events/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '活动不存在' });
  const linkedAccounts = db.prepare(`
    SELECT ea.*, a.company_name, a.industry, a.tier
    FROM event_accounts ea JOIN accounts a ON ea.account_id = a.id
    WHERE ea.event_id = ?
  `).all(req.params.id);
  res.json({ ...row, linkedAccounts });
});

app.post('/api/events', (req, res) => {
  const { name, date, end_date, location, scale, budget, status, theme, target_audience,
    story_lines, agenda, host, organizer, partners, business_design, notes } = req.body;
  if (!name) return res.status(400).json({ error: '活动名称不能为空' });
  const stmt = db.prepare(`INSERT INTO events (name, date, end_date, location, scale, budget, status, theme, target_audience,
    story_lines, agenda, host, organizer, partners, business_design, notes)
    VALUES (@name, @date, @end_date, @location, @scale, @budget, @status, @theme, @target_audience,
    @story_lines, @agenda, @host, @organizer, @partners, @business_design, @notes)`);
  const r = stmt.run({
    name, date: date || '', end_date: end_date || '', location: location || '',
    scale: scale || 0, budget: budget || '', status: status || '筹备中',
    theme: theme || '', target_audience: target_audience || '',
    story_lines: JSON.stringify(story_lines || []), agenda: JSON.stringify(agenda || []),
    host: host || '', organizer: organizer || '', partners: JSON.stringify(partners || []),
    business_design: business_design || '', notes: notes || ''
  });
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/events/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '活动不存在' });
  logEdit('events', +req.params.id, old, req.body, req.body._editedBy || '');
  buildUpdate('events', +req.params.id, req.body);
  res.json({ message: '更新成功' });
});

app.delete('/api/events/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== Speeches CRUD =====
app.get('/api/speeches', (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM speeches WHERE 1=1';
  const params = {};
  if (search) { sql += ' AND (topic LIKE @s OR event_name LIKE @s OR location LIKE @s)'; params.s = `%${search}%`; }
  sql += ' ORDER BY date DESC';
  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as c')).get(params).c;
  sql += ` LIMIT @limit OFFSET @offset`;
  params.limit = +limit;
  params.offset = (+page - 1) * +limit;
  const rows = db.prepare(sql).all(params);
  res.json({ data: rows, total, page: +page, limit: +limit });
});

app.get('/api/speeches/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM speeches WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '演讲不存在' });
  const touches = db.prepare(`
    SELECT st.*, a.company_name, a.industry, a.tier
    FROM speech_touches st JOIN accounts a ON st.account_id = a.id
    WHERE st.speech_id = ?
  `).all(req.params.id);
  res.json({ ...row, touches });
});

app.post('/api/speeches', (req, res) => {
  const { date, location, event_name, topic, audience_count, audience_profile,
    story_line, key_messages, business_design, feedback, follow_up_plan, notes } = req.body;
  if (!topic) return res.status(400).json({ error: '演讲主题不能为空' });
  const stmt = db.prepare(`INSERT INTO speeches (date, location, event_name, topic, audience_count, audience_profile,
    story_line, key_messages, business_design, feedback, follow_up_plan, notes)
    VALUES (@date, @location, @event_name, @topic, @audience_count, @audience_profile,
    @story_line, @key_messages, @business_design, @feedback, @follow_up_plan, @notes)`);
  const r = stmt.run({
    date: date || '', location: location || '', event_name: event_name || '',
    topic, audience_count: audience_count || 0, audience_profile: audience_profile || '',
    story_line: story_line || '', key_messages: JSON.stringify(key_messages || []),
    business_design: business_design || '', feedback: feedback || '',
    follow_up_plan: follow_up_plan || '', notes: notes || ''
  });
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/speeches/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM speeches WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '演讲不存在' });
  logEdit('speeches', +req.params.id, old, req.body, req.body._editedBy || '');
  buildUpdate('speeches', +req.params.id, req.body);
  res.json({ message: '更新成功' });
});

app.delete('/api/speeches/:id', (req, res) => {
  db.prepare('DELETE FROM speeches WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// Speech stats
app.get('/api/speeches/stats/overview', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM speeches').get().c;
  const totalAudience = db.prepare('SELECT COALESCE(SUM(audience_count),0) as c FROM speeches').get().c;
  const totalLeads = db.prepare('SELECT COALESCE(SUM(leads_count),0) as c FROM speeches').get().c;
  const uniqueAccounts = db.prepare('SELECT COUNT(DISTINCT account_id) as c FROM speech_touches').get().c;
  const byIndustry = db.prepare(`
    SELECT a.industry, COUNT(*) as c
    FROM speech_touches st JOIN accounts a ON st.account_id = a.id
    WHERE a.industry != ''
    GROUP BY a.industry ORDER BY c DESC
  `).all();
  res.json({ total, totalAudience, totalLeads, uniqueAccounts, byIndustry });
});

// ===== Accounts CRUD =====
app.get('/api/accounts', (req, res) => {
  const { tier, search, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM accounts WHERE 1=1';
  const params = {};
  if (tier) { sql += ' AND tier = @tier'; params.tier = tier; }
  if (search) { sql += ' AND (company_name LIKE @s OR industry LIKE @s OR region LIKE @s)'; params.s = `%${search}%`; }
  sql += ' ORDER BY tier ASC, updated_at DESC';
  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as c')).get(params).c;
  sql += ` LIMIT @limit OFFSET @offset`;
  params.limit = +limit;
  params.offset = (+page - 1) * +limit;
  const rows = db.prepare(sql).all(params);
  res.json({ data: rows, total, page: +page, limit: +limit });
});

app.get('/api/accounts/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '客户不存在' });
  const events = db.prepare(`
    SELECT e.id, e.name, e.date, e.status, ea.attendance_status, ea.feedback
    FROM event_accounts ea JOIN events e ON ea.event_id = e.id
    WHERE ea.account_id = ? ORDER BY e.date DESC
  `).all(req.params.id);
  const speeches = db.prepare(`
    SELECT s.id, s.topic, s.date, s.event_name, st.response_level, st.follow_up_status
    FROM speech_touches st JOIN speeches s ON st.speech_id = s.id
    WHERE st.account_id = ? ORDER BY s.date DESC
  `).all(req.params.id);
  const leads = db.prepare('SELECT * FROM leads WHERE account_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...row, events, speeches, leads });
});

app.post('/api/accounts', (req, res) => {
  const { company_name, industry, scale, region, source, tier, first_touch_date,
    needs_summary, estimated_budget, octo_status, assigned_to, notes } = req.body;
  if (!company_name) return res.status(400).json({ error: '公司名称不能为空' });
  const stmt = db.prepare(`INSERT INTO accounts (company_name, industry, scale, region, source, tier,
    first_touch_date, needs_summary, estimated_budget, octo_status, assigned_to, notes)
    VALUES (@company_name, @industry, @scale, @region, @source, @tier,
    @first_touch_date, @needs_summary, @estimated_budget, @octo_status, @assigned_to, @notes)`);
  const r = stmt.run({
    company_name, industry: industry || '', scale: scale || '', region: region || '',
    source: source || '', tier: tier || 'C', first_touch_date: first_touch_date || '',
    needs_summary: needs_summary || '', estimated_budget: estimated_budget || '',
    octo_status: octo_status || '', assigned_to: assigned_to || '', notes: notes || ''
  });
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/accounts/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '客户不存在' });
  logEdit('accounts', +req.params.id, old, req.body, req.body._editedBy || '');
  buildUpdate('accounts', +req.params.id, req.body);
  res.json({ message: '更新成功' });
});

app.delete('/api/accounts/:id', (req, res) => {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== Leads CRUD =====
app.get('/api/leads', (req, res) => {
  const { stage, source_type, search, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM leads WHERE 1=1';
  const params = {};
  if (stage) { sql += ' AND stage = @stage'; params.stage = stage; }
  if (source_type) { sql += ' AND source_type = @source_type'; params.source_type = source_type; }
  if (search) { sql += ' AND (contact_name LIKE @s OR company LIKE @s)'; params.s = `%${search}%`; }
  sql += ' ORDER BY created_at DESC';
  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as c')).get(params).c;
  sql += ` LIMIT @limit OFFSET @offset`;
  params.limit = +limit;
  params.offset = (+page - 1) * +limit;
  const rows = db.prepare(sql).all(params);
  res.json({ data: rows, total, page: +page, limit: +limit });
});

app.get('/api/leads/funnel', (req, res) => {
  const stages = ['raw', 'mql', 'sql', 'opportunity', 'won', 'lost'];
  const stageNames = { raw: '原始线索', mql: 'MQL', sql: 'SQL', opportunity: '商机', won: '成交', lost: '流失' };
  const funnel = stages.map(s => {
    const c = db.prepare('SELECT COUNT(*) as c FROM leads WHERE stage = ?').get(s).c;
    return { stage: s, name: stageNames[s], count: c };
  });
  const bySource = db.prepare(`SELECT source_type, COUNT(*) as c FROM leads WHERE source_type != '' GROUP BY source_type`).all();
  res.json({ funnel, bySource });
});

app.post('/api/leads', (req, res) => {
  const { contact_name, contact_title, company, phone, email, source_type,
    source_id, source_name, account_id, stage, assigned_to, notes } = req.body;
  const stmt = db.prepare(`INSERT INTO leads (contact_name, contact_title, company, phone, email,
    source_type, source_id, source_name, account_id, stage, assigned_to, notes)
    VALUES (@contact_name, @contact_title, @company, @phone, @email,
    @source_type, @source_id, @source_name, @account_id, @stage, @assigned_to, @notes)`);
  const r = stmt.run({
    contact_name: contact_name || '', contact_title: contact_title || '',
    company: company || '', phone: phone || '', email: email || '',
    source_type: source_type || '', source_id: source_id || null,
    source_name: source_name || '', account_id: account_id || null,
    stage: stage || 'raw', assigned_to: assigned_to || '', notes: notes || ''
  });
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/leads/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '线索不存在' });
  logEdit('leads', +req.params.id, old, req.body, req.body._editedBy || '');
  buildUpdate('leads', +req.params.id, req.body);
  res.json({ message: '更新成功' });
});

app.delete('/api/leads/:id', (req, res) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== Data Import =====
app.post('/api/import/:table', upload.single('file'), async (req, res) => {
  try {
    const { table } = req.params;
    const validTables = ['events', 'speeches', 'accounts', 'leads'];
    if (!validTables.includes(table)) return res.status(400).json({ error: '不支持的导入目标' });
    if (!req.file) return res.status(400).json({ error: '请上传文件' });

    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    if (!rows.length) return res.status(400).json({ error: '文件为空' });

    // Column mapping config
    const columnMaps = {
      events: { '活动名称': 'name', '日期': 'date', '截止日期': 'end_date', '地点': 'location', '规模': 'scale', '预算': 'budget', '状态': 'status', '主题': 'theme', '目标客户群': 'target_audience', '业务设计': 'business_design', '主办方': 'host', '承办方': 'organizer', '备注': 'notes' },
      speeches: { '日期': 'date', '地点': 'location', '活动名称': 'event_name', '演讲主题': 'topic', '听众人数': 'audience_count', '听众画像': 'audience_profile', '故事线': 'story_line', '业务设计': 'business_design', '反馈': 'feedback', '跟进计划': 'follow_up_plan', '备注': 'notes' },
      accounts: { '公司名称': 'company_name', '行业': 'industry', '规模': 'scale', '地区': 'region', '来源': 'source', '等级': 'tier', '首次触达日期': 'first_touch_date', '需求摘要': 'needs_summary', '预估预算': 'estimated_budget', 'Octo状态': 'octo_status', '负责人': 'assigned_to', '备注': 'notes' },
      leads: { '姓名': 'contact_name', '职位': 'contact_title', '公司': 'company', '手机': 'phone', '邮箱': 'email', '来源类型': 'source_type', '来源名称': 'source_name', '阶段': 'stage', '负责人': 'assigned_to', '备注': 'notes' }
    };

    const cmap = columnMaps[table];
    let successCount = 0;
    const errors = [];

    const insertRow = db.transaction((row) => {
      const mapped = {};
      // Try both Chinese and English column names
      for (const [cn, en] of Object.entries(cmap)) {
        mapped[en] = row[cn] ?? row[en] ?? '';
      }
      // Also accept any English column name directly
      for (const key of Object.keys(row)) {
        if (!mapped[key] && Object.values(cmap).includes(key)) {
          mapped[key] = row[key];
        }
      }

      // Validate required field
      const requiredField = { events: 'name', speeches: 'topic', accounts: 'company_name', leads: 'contact_name' }[table];
      if (!mapped[requiredField]) throw new Error(`缺少必填字段: ${requiredField}`);

      // Build INSERT
      const fields = Object.keys(mapped).filter(k => mapped[k] !== '' && mapped[k] !== undefined);
      const placeholders = fields.map(f => `@${f}`).join(', ');
      const sql = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`;
      db.prepare(sql).run(mapped);
    });

    for (let i = 0; i < rows.length; i++) {
      try {
        insertRow(rows[i]);
        successCount++;
      } catch (e) {
        errors.push({ row: i + 2, error: e.message });
      }
    }

    // Log import
    db.prepare(`INSERT INTO import_logs (filename, target_table, total_rows, success_rows, error_rows, errors, imported_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      req.file.originalname, table, rows.length, successCount, errors.length, JSON.stringify(errors), req.body.imported_by || ''
    );

    res.json({
      message: `导入完成：${successCount}/${rows.length} 条成功`,
      total: rows.length, success: successCount, errors
    });
  } catch (e) {
    res.status(500).json({ error: '导入失败: ' + e.message });
  }
});

// Import field mapping info
app.get('/api/import/fields/:table', (req, res) => {
  const { table } = req.params;
  const fieldMaps = {
    events: [
      { cn: '活动名称', en: 'name', required: true },
      { cn: '日期', en: 'date' }, { cn: '截止日期', en: 'end_date' },
      { cn: '地点', en: 'location' }, { cn: '规模', en: 'scale' },
      { cn: '预算', en: 'budget' }, { cn: '状态', en: 'status', note: '筹备中/进行中/已结束/已取消' },
      { cn: '主题', en: 'theme' }, { cn: '目标客户群', en: 'target_audience' },
      { cn: '业务设计', en: 'business_design' }, { cn: '主办方', en: 'host' },
      { cn: '承办方', en: 'organizer' }, { cn: '备注', en: 'notes' }
    ],
    speeches: [
      { cn: '演讲主题', en: 'topic', required: true },
      { cn: '日期', en: 'date' }, { cn: '地点', en: 'location' },
      { cn: '活动名称', en: 'event_name' }, { cn: '听众人数', en: 'audience_count' },
      { cn: '听众画像', en: 'audience_profile' }, { cn: '故事线', en: 'story_line' },
      { cn: '业务设计', en: 'business_design' }, { cn: '反馈', en: 'feedback' },
      { cn: '跟进计划', en: 'follow_up_plan' }, { cn: '备注', en: 'notes' }
    ],
    accounts: [
      { cn: '公司名称', en: 'company_name', required: true },
      { cn: '行业', en: 'industry' }, { cn: '规模', en: 'scale' },
      { cn: '地区', en: 'region' }, { cn: '来源', en: 'source' },
      { cn: '等级', en: 'tier', note: 'S/A/B/C' },
      { cn: '首次触达日期', en: 'first_touch_date' },
      { cn: '需求摘要', en: 'needs_summary' }, { cn: '预估预算', en: 'estimated_budget' },
      { cn: 'Octo状态', en: 'octo_status' }, { cn: '负责人', en: 'assigned_to' },
      { cn: '备注', en: 'notes' }
    ],
    leads: [
      { cn: '姓名', en: 'contact_name', required: true },
      { cn: '职位', en: 'contact_title' }, { cn: '公司', en: 'company' },
      { cn: '手机', en: 'phone' }, { cn: '邮箱', en: 'email' },
      { cn: '来源类型', en: 'source_type', note: 'event/speech/inbound/outbound/referral' },
      { cn: '来源名称', en: 'source_name' },
      { cn: '阶段', en: 'stage', note: 'raw/mql/sql/opportunity/won/lost' },
      { cn: '负责人', en: 'assigned_to' }, { cn: '备注', en: 'notes' }
    ]
  };
  res.json(fieldMaps[table] || []);
});

// Import logs
app.get('/api/import/logs', (req, res) => {
  const rows = db.prepare('SELECT * FROM import_logs ORDER BY imported_at DESC LIMIT 20').all();
  res.json(rows);
});

// ===== Edit History =====
app.get('/api/history/:table/:id', (req, res) => {
  const rows = db.prepare('SELECT * FROM edit_history WHERE table_name = ? AND record_id = ? ORDER BY edited_at DESC LIMIT 50')
    .all(req.params.table, +req.params.id);
  res.json(rows);
});

// ===== Start Server =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MKT-CRM 工作台运行在 http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api/stats`);
});
