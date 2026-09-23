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
  const leadsByStatus = db.prepare("SELECT status, COUNT(*) as c FROM leads GROUP BY status").all();
  const recentEvents = db.prepare("SELECT id, name, date, status, leads_count FROM events ORDER BY date DESC LIMIT 5").all();
  const recentLeads = db.prepare("SELECT id, contact_name, company_name, status, source_channel, created_at FROM leads ORDER BY created_at DESC LIMIT 10").all();
  res.json({
    events: { total: eventCount, byStatus: eventsByStatus },
    speeches: { total: speechCount, totalAudience },
    accounts: { total: accountCount, byTier: accountsByTier },
    leads: { total: leadCount, byStatus: leadsByStatus },
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
  const { tier, customer_stage, industry, search, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM accounts WHERE 1=1';
  const params = {};
  if (tier) { sql += ' AND tier = @tier'; params.tier = tier; }
  if (customer_stage) { sql += ' AND customer_stage = @customer_stage'; params.customer_stage = customer_stage; }
  if (industry) { sql += ' AND industry LIKE @industry'; params.industry = `%${industry}%`; }
  if (search) { sql += ' AND (company_name LIKE @s OR industry LIKE @s OR assigned_to LIKE @s)'; params.s = `%${search}%`; }
  sql += " ORDER BY CASE tier WHEN 'S' THEN 1 WHEN 'A' THEN 2 WHEN 'B' THEN 3 WHEN 'C' THEN 4 WHEN 'D' THEN 5 END, deal_amount DESC, updated_at DESC";
  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as c')).get(params).c;
  sql += ` LIMIT @limit OFFSET @offset`;
  params.limit = +limit;
  params.offset = (+page - 1) * +limit;
  const rows = db.prepare(sql).all(params);
  // Parse key_events JSON for each row
  rows.forEach(r => {
    try { r.key_events_parsed = JSON.parse(r.key_events || '[]'); } catch { r.key_events_parsed = []; }
  });
  res.json({ data: rows, total, page: +page, limit: +limit });
});

app.get('/api/accounts/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '客户不存在' });
  // Parse key_events
  try { row.key_events = JSON.parse(row.key_events || '[]'); } catch { row.key_events = []; }
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
  const contacts = db.prepare('SELECT * FROM account_contacts WHERE account_id = ? ORDER BY is_champion DESC, id ASC').all(req.params.id);
  const reports = db.prepare('SELECT * FROM account_reports WHERE account_id = ? ORDER BY report_period DESC, created_at DESC').all(req.params.id);
  res.json({ ...row, events, speeches, leads, contacts, reports });
});

app.post('/api/accounts', (req, res) => {
  const fields = ['company_name','industry','scale','region','source','tier','first_touch_date','last_touch_date',
    'needs_summary','estimated_budget','octo_status','assigned_to','follow_up_status','notes',
    'customer_stage','deal_amount','deal_stage','lead_source','key_contacts_count','key_departments',
    'competitors','customer_recognition','deployment_type','product_solutions_detail','core_painpoint',
    'blockers','next_step','next_deadline','ceo_involvement','ecosystem_lock','lessons_learned'];
  const body = { ...req.body };
  body.deal_amount = +body.deal_amount || 0;
  body.key_contacts_count = +body.key_contacts_count || 0;
  body.ceo_involvement = body.ceo_involvement ? 1 : 0;
  body.tier = body.tier || 'C';
  if (!body.company_name) return res.status(400).json({ error: '公司名称不能为空' });
  const cols = fields.filter(f => body[f] !== undefined && body[f] !== null);
  const placeholders = cols.map(f => `@${f}`).join(', ');
  const stmt = db.prepare(`INSERT INTO accounts (${cols.join(', ')}) VALUES (${placeholders})`);
  const r = stmt.run(body);
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

// ===== Account Reports (周报/月报) =====
app.get('/api/accounts/:id/reports', (req, res) => {
  const rows = db.prepare('SELECT * FROM account_reports WHERE account_id = ? ORDER BY report_period DESC, created_at DESC').all(req.params.id);
  res.json(rows);
});

app.post('/api/accounts/:id/reports', (req, res) => {
  const { report_type, report_period, most_important, key_work, need_decision, cross_team_needs, bottlenecks, next_important } = req.body;
  const stmt = db.prepare(`INSERT INTO account_reports (account_id, report_type, report_period, most_important, key_work, need_decision, cross_team_needs, bottlenecks, next_important, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const r = stmt.run(req.params.id, report_type || 'weekly', report_period || '', most_important || '', key_work || '', need_decision || '', cross_team_needs || '', bottlenecks || '', next_important || '', req.body.created_by || '');
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/accounts/reports/:reportId', (req, res) => {
  const old = db.prepare('SELECT * FROM account_reports WHERE id = ?').get(req.params.reportId);
  if (!old) return res.status(404).json({ error: '报告不存在' });
  const allowed = ['report_type', 'report_period', 'most_important', 'key_work', 'need_decision', 'cross_team_needs', 'bottlenecks', 'next_important'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.json({ message: '无更新' });
  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE account_reports SET ${sets}, updated_at = datetime('now','localtime') WHERE id = @id`).run({ ...req.body, id: +req.params.reportId });
  res.json({ message: '更新成功' });
});

app.delete('/api/accounts/reports/:reportId', (req, res) => {
  db.prepare('DELETE FROM account_reports WHERE id = ?').run(req.params.reportId);
  res.json({ message: '删除成功' });
});

// ===== Account Contacts (联系人) =====
app.get('/api/accounts/:id/contacts', (req, res) => {
  const rows = db.prepare('SELECT * FROM account_contacts WHERE account_id = ? ORDER BY is_champion DESC, id ASC').all(req.params.id);
  res.json(rows);
});

app.post('/api/accounts/:id/contacts', (req, res) => {
  const { name, title, department, role_level, phone, email, is_champion, notes } = req.body;
  if (!name) return res.status(400).json({ error: '联系人姓名不能为空' });
  const stmt = db.prepare(`INSERT INTO account_contacts (account_id, name, title, department, role_level, phone, email, is_champion, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const r = stmt.run(req.params.id, name, title || '', department || '', role_level || '', phone || '', email || '', is_champion ? 1 : 0, notes || '');
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/accounts/contacts/:contactId', (req, res) => {
  const old = db.prepare('SELECT * FROM account_contacts WHERE id = ?').get(req.params.contactId);
  if (!old) return res.status(404).json({ error: '联系人不存在' });
  const allowed = ['name', 'title', 'department', 'role_level', 'phone', 'email', 'is_champion', 'notes'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.json({ message: '无更新' });
  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  const body = { ...req.body, id: +req.params.contactId };
  if (body.is_champion !== undefined) body.is_champion = body.is_champion ? 1 : 0;
  db.prepare(`UPDATE account_contacts SET ${sets} WHERE id = @id`).run(body);
  res.json({ message: '更新成功' });
});

app.delete('/api/accounts/contacts/:contactId', (req, res) => {
  db.prepare('DELETE FROM account_contacts WHERE id = ?').run(req.params.contactId);
  res.json({ message: '删除成功' });
});

// ===== Octo Summary (大客户全景报告) =====
const accountCols = 'id, company_name, tier, industry, scale, deal_amount, customer_stage, assigned_to, blockers, next_step, next_deadline, ceo_involvement, ecosystem_lock, lessons_learned, customer_recognition, competitors, core_painpoint, key_contacts_count';

app.get('/api/octo/summary', (req, res) => {
  const totalAccounts = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;

  // KPI counts
  const signedCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage IN ('已签约','交付中')").get().c;
  const biddingCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage = '投标中'").get().c;
  const bClassCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage = 'B类重点推进'").get().c;
  const cClassCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage = 'C类跟进'").get().c;
  const dClassCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage = 'D类观察'").get().c;
  const deadCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage IN ('战败','放弃')").get().c;

  const pipelineResult = db.prepare(`SELECT COALESCE(SUM(deal_amount),0) as total FROM accounts WHERE customer_stage NOT IN ('战败','放弃','D类观察','') AND customer_stage IS NOT NULL`).get();
  const pipeline = Math.round(pipelineResult.total * 10) / 10;

  const wonResult = db.prepare(`SELECT COALESCE(SUM(deal_amount),0) as total FROM accounts WHERE customer_stage IN ('已签约','交付中')`).get();
  const wonAmount = Math.round(wonResult.total * 10) / 10;

  const deadRate = totalAccounts > 0 ? Math.round(deadCount / totalAccounts * 100) : 0;

  // By stage distribution
  const byStage = db.prepare(`
    SELECT customer_stage as stage, COUNT(*) as count, COALESCE(SUM(deal_amount),0) as amount
    FROM accounts WHERE customer_stage != '' GROUP BY customer_stage
    ORDER BY CASE customer_stage
      WHEN '已签约' THEN 1 WHEN '交付中' THEN 2 WHEN '投标中' THEN 3
      WHEN 'B类重点推进' THEN 4 WHEN 'POC中' THEN 5 WHEN 'C类跟进' THEN 6
      WHEN 'D类观察' THEN 7 WHEN '战败' THEN 8 WHEN '放弃' THEN 9 ELSE 10 END
  `).all();

  // By industry
  const byIndustry = db.prepare("SELECT industry, COUNT(*) as c FROM accounts WHERE industry != '' GROUP BY industry ORDER BY c DESC").all();

  // Competitor frequency
  const allCompetitors = db.prepare("SELECT competitors FROM accounts WHERE competitors != ''").all();
  const compMap = {};
  allCompetitors.forEach(r => {
    const comps = r.competitors.split(/[/、,，]/).map(s => s.trim()).filter(Boolean);
    comps.forEach(c => { compMap[c] = (compMap[c] || 0) + 1; });
  });
  const byCompetitor = Object.entries(compMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Active pipeline list
  const pipelineList = db.prepare(`
    SELECT id, company_name, tier, industry, deal_amount, customer_stage, assigned_to, next_step, next_deadline, blockers
    FROM accounts WHERE customer_stage NOT IN ('战败','放弃','D类观察') AND customer_stage IS NOT NULL AND customer_stage != ''
    ORDER BY CASE tier WHEN 'S' THEN 1 WHEN 'A' THEN 2 WHEN 'B' THEN 3 WHEN 'C' THEN 4 ELSE 5 END, deal_amount DESC
  `).all();

  const recentUpdates = db.prepare(`
    SELECT id, company_name, tier, customer_stage, deal_amount, assigned_to, updated_at
    FROM accounts ORDER BY updated_at DESC LIMIT 10
  `).all();

  const upcomingDeadlines = db.prepare(`
    SELECT id, company_name, tier, next_step, next_deadline, customer_stage
    FROM accounts WHERE next_deadline != '' AND next_deadline IS NOT NULL
      AND customer_stage NOT IN ('战败','放弃','已签约','D类观察')
    ORDER BY next_deadline ASC
  `).all();

  const blockersList = db.prepare(`
    SELECT id, company_name, tier, blockers, customer_stage, assigned_to
    FROM accounts WHERE blockers != '' AND blockers IS NOT NULL
    ORDER BY CASE tier WHEN 'S' THEN 1 WHEN 'A' THEN 2 WHEN 'B' THEN 3 ELSE 4 END
  `).all();

  const ceoReferrals = db.prepare(`
    SELECT id, company_name, tier, customer_stage, deal_amount, assigned_to
    FROM accounts WHERE ceo_involvement = 1
    ORDER BY CASE tier WHEN 'S' THEN 1 WHEN 'A' THEN 2 WHEN 'B' THEN 3 ELSE 5 END, deal_amount DESC
  `).all();

  const lessons = db.prepare(`
    SELECT id, company_name, lessons_learned, customer_stage, ecosystem_lock
    FROM accounts WHERE customer_stage IN ('战败','放弃') AND lessons_learned != ''
  `).all();

  const pendingDecisions = db.prepare(`
    SELECT r.id, r.account_id, r.report_type, r.report_period, r.need_decision, r.created_at, a.company_name, a.tier
    FROM account_reports r JOIN accounts a ON r.account_id = a.id
    WHERE r.need_decision != '' AND r.need_decision IS NOT NULL
    ORDER BY r.created_at DESC
  `).all();

  // ===== Grouped customers for panoramic report =====
  const signed = db.prepare(`SELECT ${accountCols} FROM accounts WHERE customer_stage IN ('已签约','交付中') ORDER BY deal_amount DESC`).all();
  const bidding = db.prepare(`SELECT ${accountCols} FROM accounts WHERE customer_stage = '投标中' ORDER BY deal_amount DESC`).all();
  const bClass = db.prepare(`SELECT ${accountCols} FROM accounts WHERE customer_stage = 'B类重点推进' ORDER BY deal_amount DESC`).all();
  const cClass = db.prepare(`SELECT ${accountCols} FROM accounts WHERE customer_stage = 'C类跟进' ORDER BY CASE tier WHEN 'S' THEN 1 WHEN 'A' THEN 2 WHEN 'B' THEN 3 ELSE 4 END, deal_amount DESC`).all();
  const dClass = db.prepare(`SELECT ${accountCols} FROM accounts WHERE customer_stage = 'D类观察' ORDER BY updated_at DESC`).all();
  const deadAll = db.prepare(`SELECT ${accountCols} FROM accounts WHERE customer_stage IN ('战败','放弃') ORDER BY company_name`).all();

  // Group dead by reason category based on ecosystem_lock + blockers + lessons
  const deadGroups = [
    {
      key: 'ecosystem', icon: '🔒', title: '生态锁定',
      desc: '客户已有成熟内部AI/协同体系，Octo无法提供增量价值',
      match: (a) => /飞书|生态锁定|内网|自研AI/.test((a.ecosystem_lock||'') + (a.blockers||'') + (a.lessons_learned||'')) && !/部署≠使用|沉寂/.test(a.lessons_learned||'')
    },
    {
      key: 'compliance', icon: '📋', title: '合规门槛',
      desc: '香港/国际客户合规资质、费用封顶、保险等硬性要求',
      match: (a) => /SOC2|合规|专业责任险|Token.*不封顶|ISO27001/.test((a.blockers||'') + (a.lessons_learned||'') + (a.ecosystem_lock||''))
    },
    {
      key: 'deployed', icon: '💤', title: '「部署≠使用」',
      desc: '部署/开通后客户内部未真正用起来，缺乏场景引导和推动力',
      match: (a) => /部署≠使用|私有化完成|沉寂|部署后|未真正使用|停滞.*场景|开通后.*沉寂/.test((a.lessons_learned||'') + (a.blockers||''))
    },
    {
      key: 'nodemand', icon: '📞', title: '需求未建立',
      desc: '冷接触/试用后无明确需求，信息不足，未形成有效商机',
      match: (a) => /需求未建立|无明确需求|未提出明确|信息不足|冷接触|行业遇冷|无实质进展/.test((a.lessons_learned||'') + (a.blockers||''))
    },
    {
      key: 'relation', icon: '⏰', title: '关系型流失',
      desc: '人脉/学术引荐而非销售驱动，窗口期内未建立商务对接',
      match: (a) => /关系型|人脉|杨三角|非销售驱动|商务接触/.test((a.lessons_learned||'') + (a.blockers||''))
    }
  ];
  const deadGrouped = [];
  const assigned = new Set();
  deadGroups.forEach(g => {
    const items = deadAll.filter(a => !assigned.has(a.id) && g.match(a));
    items.forEach(a => assigned.add(a.id));
    if (items.length) deadGrouped.push({ ...g, items });
  });
  // leftovers
  const rest = deadAll.filter(a => !assigned.has(a.id));
  if (rest.length) deadGrouped.push({ key: 'other', icon: '❓', title: '其他原因', desc: '其他战败/放弃原因', items: rest });

  // Core lessons (curated)
  const coreLessons = [
    '「部署≠使用」是系统性问题，影响6家(占已部署40%+)，需建立「部署后30天激活」机制',
    '飞书生态锁定一旦建立几乎不可破（得到/方里/联合影像/欢瑞/吉利都受影响），必须先评「生态锁定度」再定级',
    '香港/国际客户合规是硬门槛（SOC2/专业责任险/Token封顶方案），需前置解决',
    '关系型线索2周内不建立商务接触就流失（西门子教训），人脉引荐≠销售机会',
    'A级Onboarding≠高转化（方里教训），需先评生态锁定度再投入重型资源',
    '12家战败中仅2家「真失败」，其余10家「一开始就不该投重型资源」→更早更准地筛选'
  ];

  // Top concerns
  const topConcerns = [
    { rank: 1, title: '私有化部署能力', desc: '大客户（制造/医疗/金融）几乎全部要求私有化部署，是准入门槛' },
    { rank: 2, title: '与飞书/钉钉差异共存', desc: '客户已有钉飞企微，需明确「协同工具vs Agent平台」差异定位和共存方案' },
    { rank: 3, title: '非技术人员上手难度', desc: '业务人员能否低门槛创建/使用Agent，决定全员推广成败' },
    { rank: 4, title: '费用/ROI可见度', desc: 'Token不封顶、云主机费用、提效量化是客户决策核心顾虑' },
    { rank: 5, title: 'Agent协作场景落地(AtoA)', desc: '从1v1助手到多Agent协作(AtoA)的标杆场景是差异化竞争力' }
  ];

  // Action items: aggregate blockers + next_step + pendingDecisions
  // Tag urgency: red = 紧急/卡点 (has blockers in bidding/B类), yellow = 本周/本月硬时点, blue = 常规
  const actionItems = [];
  // From blockers: all active accounts
  blockersList.forEach(b => {
    let priority = 'blue';
    if (b.customer_stage === '投标中') priority = 'red';
    else if (b.customer_stage === 'B类重点推进' || (b.next_deadline && b.next_deadline.includes('9月'))) priority = 'yellow';
    actionItems.push({
      account_id: b.id, company_name: b.company_name, tier: b.tier,
      type: 'blocker', priority, content: b.blockers, owner: b.assigned_to, stage: b.customer_stage
    });
  });
  // From pending decisions
  pendingDecisions.forEach(p => {
    actionItems.push({
      account_id: p.account_id, company_name: p.company_name, tier: p.tier,
      type: 'decision', priority: 'yellow', content: p.need_decision, owner: '', stage: '', period: p.report_period
    });
  });
  // Sort: red first, then yellow, then blue
  const pOrder = { red: 0, yellow: 1, blue: 2 };
  actionItems.sort((a, b) => pOrder[a.priority] - pOrder[b.priority]);

  // CEO funnel data (static, from report)
  const ceoFunnel = {
    events: 8, wechat: 394, applied: 122, activated: 102, converted: 5,
    execReferralCount: ceoReferrals.length, execReferralPct: totalAccounts > 0 ? Math.round(ceoReferrals.length / totalAccounts * 100) : 0,
    note: '8场活动→394加微→122申请→102开通→5转出(1%)；但39家中' + ceoReferrals.length + '家来自高管直推，贡献100%签约+90%+管线'
  };

  // Strategic quotes
  const quotes = [
    { who: '姜平', text: '不能付费的客户不再投入时间', date: '9/7' },
    { who: '姜平', text: '亏本也拿（宇通）', date: '9月' },
    { who: '姜平', text: '卓正必须发生', date: '9月' },
    { who: '辉哥', text: '代码开源随便用，赚Token+FDE（致远）', date: '9月' }
  ];

  res.json({
    kpi: { totalAccounts, signedCount, biddingCount, bClassCount, cClassCount, dClassCount, pipeline, wonAmount, deadCount, deadRate, pendingDecisions: pendingDecisions.length, blockers: blockersList.length, ceoReferrals: ceoReferrals.length },
    byStage, byIndustry, byCompetitor,
    pipeline: pipelineList, recentUpdates, upcomingDeadlines,
    blockers: blockersList, ceoReferrals, lessons, pendingDecisions,
    // New panoramic groups
    signed, bidding, bClass, cClass, dClass,
    deadGrouped, deadAll,
    coreLessons, topConcerns, actionItems, ceoFunnel, quotes
  });
});

// ===== Octo Pipeline (管线金额汇总) =====
app.get('/api/octo/pipeline', (req, res) => {
  const stages = ['跟进中','POC中','重点推进','投标中','交付中','已签约'];
  const byStage = stages.map(stage => {
    const row = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(deal_amount),0) as amount FROM accounts WHERE customer_stage = ?`).get(stage);
    return { stage, count: row.count, amount: Math.round(row.amount * 10) / 10 };
  });
  const total = db.prepare(`SELECT COALESCE(SUM(deal_amount),0) as t FROM accounts WHERE customer_stage NOT IN ('战败','放弃','')`).get().t;
  const won = db.prepare(`SELECT COALESCE(SUM(deal_amount),0) as t FROM accounts WHERE customer_stage IN ('已签约','交付中')`).get().t;
  res.json({
    byStage,
    totalPipeline: Math.round(total * 10) / 10,
    wonAmount: Math.round(won * 10) / 10
  });
});

// ===== Leads CRUD =====
app.get('/api/leads', (req, res) => {
  const { status, source_channel, search, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM leads WHERE 1=1';
  const params = {};
  if (status) { sql += ' AND status = @status'; params.status = status; }
  if (source_channel) { sql += ' AND source_channel = @source_channel'; params.source_channel = source_channel; }
  if (search) { sql += ' AND (contact_name LIKE @s OR company_name LIKE @s OR product LIKE @s)'; params.s = `%${search}%`; }
  sql += ' ORDER BY created_at DESC';
  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as c')).get(params).c;
  sql += ` LIMIT @limit OFFSET @offset`;
  params.limit = +limit;
  params.offset = (+page - 1) * +limit;
  const rows = db.prepare(sql).all(params);
  res.json({ data: rows, total, page: +page, limit: +limit });
});

app.get('/api/leads/funnel', (req, res) => {
  const statuses = ['new', 'contacted', 'qualified', 'opportunity', 'closed_won', 'closed_lost'];
  const statusNames = { new: '新进线', contacted: '已联系', qualified: '已转出', opportunity: '商机', closed_won: '成单', closed_lost: '无效/丢单' };
  const funnel = statuses.map(s => {
    const c = db.prepare('SELECT COUNT(*) as c FROM leads WHERE status = ?').get(s).c;
    return { status: s, name: statusNames[s], count: c };
  });
  const total = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const qualifiedCount = funnel.find(s => s.status === 'qualified')?.count || 0;
  const opportunityCount = funnel.find(s => s.status === 'opportunity')?.count || 0;
  const wonCount = funnel.find(s => s.status === 'closed_won')?.count || 0;
  const totalDeal = db.prepare("SELECT COALESCE(SUM(deal_amount),0) as c FROM leads WHERE status = 'closed_won'").get().c;
  const transferRate = total > 0 ? (qualifiedCount / total * 100).toFixed(1) : '0.0';
  const bySource = db.prepare(`SELECT source_channel as name, COUNT(*) as count FROM leads WHERE source_channel != '' GROUP BY source_channel ORDER BY count DESC`).all();
  const byProduct = db.prepare(`SELECT product as name, COUNT(*) as count FROM leads WHERE product != '' GROUP BY product ORDER BY count DESC LIMIT 10`).all();
  const byTeam = db.prepare(`SELECT team as name, COUNT(*) as count FROM leads WHERE team != '' GROUP BY team ORDER BY count DESC`).all();
  const monthlyTrend = db.prepare(`
    SELECT strftime('%Y-%m', inbound_date) as month,
           COUNT(*) as total,
           SUM(CASE WHEN status IN ('qualified','opportunity','closed_won') THEN 1 ELSE 0 END) as transferred
    FROM leads WHERE inbound_date != '' AND inbound_date IS NOT NULL
    GROUP BY month ORDER BY month
  `).all();
  const recentLeads = db.prepare(`SELECT id, company_name, contact_name, source_channel, product, assigned_to, status, inbound_date
    FROM leads ORDER BY created_at DESC LIMIT 20`).all();
  res.json({
    funnel,
    kpi: { total, qualifiedCount, opportunityCount, wonCount, totalDeal, transferRate },
    bySource, byProduct, byTeam, monthlyTrend, recentLeads
  });
});

app.get('/api/leads/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '线索不存在' });
  res.json(row);
});

app.post('/api/leads', (req, res) => {
  const { company_name, contact_name, contact_title, phone, source_channel, source_detail,
    status, product, industry, team, assigned_to, inbound_date, transfer_date,
    opportunity_id, opportunity_stage, deal_amount, lost_reason, requirement, account_id } = req.body;
  if (!company_name && !contact_name) return res.status(400).json({ error: '客户名称或联系人不能为空' });
  const stmt = db.prepare(`INSERT INTO leads (company_name, contact_name, contact_title, phone, source_channel, source_detail,
    status, product, industry, team, assigned_to, inbound_date, transfer_date,
    opportunity_id, opportunity_stage, deal_amount, lost_reason, requirement, account_id)
    VALUES (@company_name, @contact_name, @contact_title, @phone, @source_channel, @source_detail,
    @status, @product, @industry, @team, @assigned_to, @inbound_date, @transfer_date,
    @opportunity_id, @opportunity_stage, @deal_amount, @lost_reason, @requirement, @account_id)`);
  const r = stmt.run({
    company_name: company_name || '', contact_name: contact_name || '',
    contact_title: contact_title || '', phone: phone || '',
    source_channel: source_channel || '', source_detail: source_detail || '',
    status: status || 'new', product: product || '', industry: industry || '',
    team: team || '', assigned_to: assigned_to || '',
    inbound_date: inbound_date || '', transfer_date: transfer_date || '',
    opportunity_id: opportunity_id || '', opportunity_stage: opportunity_stage || '',
    deal_amount: +deal_amount || 0, lost_reason: lost_reason || '',
    requirement: requirement || '', account_id: account_id || null
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

// 清空全部线索（千寻重灌用）—— 必须在 :id 路由之前
app.delete('/api/leads/all', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  db.prepare('DELETE FROM leads').run();
  res.json({ message: `已清空 ${count} 条线索`, deleted: count });
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
      leads: { '客户名称': 'company_name', '联系人': 'contact_name', '职位': 'contact_title', '电话': 'phone', '来源渠道': 'source_channel', '来源子渠道': 'source_detail', '线索状态': 'status', '需求产品': 'product', '行业': 'industry', '分配区域/团队': 'team', '团队': 'team', '分配销售': 'assigned_to', '进线日期': 'inbound_date', '转出日期': 'transfer_date', '商机号': 'opportunity_id', '商机阶段': 'opportunity_stage', '成单金额': 'deal_amount', '丢单原因': 'lost_reason', '需求描述/跟进记录': 'requirement', '需求描述': 'requirement', '跟进记录': 'requirement', '备注': 'requirement' }
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
      const requiredField = { events: 'name', speeches: 'topic', accounts: 'company_name', leads: 'company_name' }[table];
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
      { cn: '客户名称', en: 'company_name', required: true },
      { cn: '联系人', en: 'contact_name', required: true },
      { cn: '职位', en: 'contact_title' }, { cn: '电话', en: 'phone' },
      { cn: '来源渠道', en: 'source_channel', note: '400电话/官方微信/Octo体验/Octo·晚点头条/下午茶活动/EMP培训班/活动/其他' },
      { cn: '来源子渠道', en: 'source_detail' },
      { cn: '线索状态', en: 'status', note: 'new/contacted/qualified/opportunity/closed_won/closed_lost' },
      { cn: '需求产品', en: 'product' }, { cn: '行业', en: 'industry' },
      { cn: '分配区域/团队', en: 'team' }, { cn: '分配销售', en: 'assigned_to' },
      { cn: '进线日期', en: 'inbound_date', note: 'YYYY-MM-DD' },
      { cn: '转出日期', en: 'transfer_date', note: 'YYYY-MM-DD' },
      { cn: '商机号', en: 'opportunity_id' }, { cn: '商机阶段', en: 'opportunity_stage' },
      { cn: '成单金额', en: 'deal_amount', note: '万元' },
      { cn: '丢单原因', en: 'lost_reason' },
      { cn: '需求描述/跟进记录', en: 'requirement' }
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
