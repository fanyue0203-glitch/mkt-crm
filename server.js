import fs from 'fs';
import express from 'express';
import multer from 'multer';
import { readFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import setMarketingCampaignRoutes from './routes-marketing-campaign.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Self-heal: vite build wipes dist/, which deletes echarts.min.js and kills all dashboard charts.
// Restore it from node_modules on demand before static serving.
app.use((req, res, next) => {
  if (req.path === '/echarts.min.js') {
    const target = join(__dirname, 'dist', 'echarts.min.js');
    const src = join(__dirname, 'node_modules', 'echarts', 'dist', 'echarts.min.js');
    try {
      if (!fs.existsSync(target) && fs.existsSync(src)) {
        fs.mkdirSync(join(__dirname, 'dist'), { recursive: true });
        fs.copyFileSync(src, target);
        console.log('[self-heal] restored dist/echarts.min.js');
      }
    } catch (e) { console.error('[self-heal] echarts restore failed:', e.message); }
  }
  next();
});

// 登录页（静态，免鉴权）
app.get('/login', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'login.html'));
});

app.use(express.static(join(__dirname, 'dist')));

// ===== API Key Auth Config =====
const API_KEYS = {
  // 千寻(admin) - 全模块权限
  'mkt-admin-qianxun-202610': { name: '千寻', modules: ['*'] },
  // 章鱼烧 - Octo大客户模块
  'mkt-octo-zhangyushao-202610': { name: '章鱼烧', modules: ['accounts', 'account_reports', 'account_contacts', 'account_timeline', 'octo_summary', 'octo_pipeline'] },
};

// 路由到模块的映射
const ROUTE_MODULE_MAP = [
  { pattern: /^\/api\/accounts\/\d+\/timeline/, module: 'account_timeline' },
  { pattern: /^\/api\/accounts\/\d+\/events/, module: 'accounts' },
  { pattern: /^\/api\/accounts\/\d+\/key-events/, module: 'accounts' },
  { pattern: /^\/api\/accounts\/\d+\/reports/, module: 'account_reports' },
  { pattern: /^\/api\/accounts\/\d+\/contacts/, module: 'account_contacts' },
  { pattern: /^\/api\/accounts\/reports/, module: 'account_reports' },
  { pattern: /^\/api\/accounts\/contacts/, module: 'account_contacts' },
  { pattern: /^\/api\/accounts\/timeline/, module: 'account_timeline' },
  { pattern: /^\/api\/accounts/, module: 'accounts' },
  { pattern: /^\/api\/octo\/summary/, module: 'octo_summary' },
  { pattern: /^\/api\/octo\/pipeline/, module: 'octo_pipeline' },
  { pattern: /^\/api\/leads/, module: 'leads' },
  { pattern: /^\/api\/ceo/, module: 'ceo_events' },
  { pattern: /^\/api\/events/, module: 'ceo_events' },
  { pattern: /^\/api\/speeches/, module: 'ceo_events' },
  { pattern: /^\/api\/stats/, module: 'stats' },
  { pattern: /^\/api\/sdr\//, module: 'stats' },
  { pattern: /^\/api\/marketing-campaign\//, module: 'marketing_campaign_leads' },
  { pattern: /^\/api\/import/, module: 'import' },
];

function getRouteModule(path) {
  for (const r of ROUTE_MODULE_MAP) {
    if (r.pattern.test(path)) return r.module;
  }
  return 'unknown';
}


// ===== [登录鉴权 2026-11-09] 零新增依赖：scrypt 哈希 + 内存会话 + 签名 Cookie =====
// ⚠️ 单实例前提：会话存内存 Map，服务重启后全员需重新登录（预期行为，非 bug）。
//   如将来多实例部署，需把 SESSIONS 换成 Redis/DB。
// 环境变量：
//   MKT_AUTH_PASS_HASH  - scrypt 哈希，格式 "saltHex:hashHex"（明文只私发对接人，永不入库入git）
//   MKT_SESSION_SECRET  - 会话签名密钥，随机串（可由 IT 生成）
//   MKT_COOKIE_SECURE   - "1" 时 Cookie 加 Secure（生产 HTTPS 环境必须为 1）
import crypto from 'crypto';

const AUTH_PASS_HASH = process.env.MKT_AUTH_PASS_HASH || '';
const SESSION_SECRET = process.env.MKT_SESSION_SECRET || '';
const COOKIE_SECURE = process.env.MKT_COOKIE_SECURE === '1';
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 7 天
const SESSIONS = new Map(); // sid -> { created, last }

function scryptHash(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function verifyPassword(password) {
  if (!AUTH_PASS_HASH) return false;
  const [saltHex, hashHex] = AUTH_PASS_HASH.split(':');
  if (!saltHex || !hashHex) return false;
  const calc = scryptHash(password, saltHex);
  const a = Buffer.from(calc, 'hex'), b = Buffer.from(hashHex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function signSid(sid) {
  const mac = crypto.createHmac('sha256', SESSION_SECRET || 'dev-insecure').update(sid).digest('hex');
  return sid + '.' + mac;
}
function unsignSid(signed) {
  if (!signed || signed.indexOf('.') < 0) return null;
  const i = signed.lastIndexOf('.');
  const sid = signed.slice(0, i), mac = signed.slice(i + 1);
  const expect = crypto.createHmac('sha256', SESSION_SECRET || 'dev-insecure').update(sid).digest('hex');
  if (mac.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  return sid;
}
function parseCookies(req) {
  const out = {};
  const raw = req.headers['cookie'] || '';
  raw.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function getSession(req) {
  const signed = parseCookies(req).mkt_sid;
  const sid = unsignSid(signed);
  if (!sid) return null;
  const s = SESSIONS.get(sid);
  if (!s) return null;
  if (Date.now() - s.created > SESSION_TTL_MS) { SESSIONS.delete(sid); return null; }
  s.last = Date.now();
  return { sid, ...s };
}
function setSessionCookie(res, sid) {
  const parts = [
    'mkt_sid=' + encodeURIComponent(signSid(sid)),
    'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + Math.floor(SESSION_TTL_MS / 1000),
  ];
  if (COOKIE_SECURE) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}
function clearSessionCookie(res) {
  const parts = ['mkt_sid=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (COOKIE_SECURE) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

// 登录限流：同 IP 每分钟 <= 5 次
const LOGIN_WINDOW_MS = 60 * 1000, LOGIN_MAX = 5;
const loginHits = new Map(); // ip -> [ts,...]
function loginRateLimited(ip) {
  const now = Date.now();
  const arr = (loginHits.get(ip) || []).filter(t => now - t < LOGIN_WINDOW_MS);
  loginHits.set(ip, arr);
  return arr.length >= LOGIN_MAX;
}
function recordLoginHit(ip) {
  const now = Date.now();
  const arr = (loginHits.get(ip) || []).filter(t => now - t < LOGIN_WINDOW_MS);
  arr.push(now);
  loginHits.set(ip, arr);
}

// 豁免路径：登录相关 + 健康检查（静态资源在 authMiddleware 之前已放行）
function isAuthExempt(path) {
  return path === '/api/login' || path === '/api/logout' || path === '/api/health' || path === '/healthz';
}

// ===== 健康检查（CI deploy 脚本 curl --fail 探测，必须存在且不查库）=====
const HEALTH_PAYLOAD = { ok: true, service: 'mkt-crm' };
app.get('/api/health', (req, res) => res.json(HEALTH_PAYLOAD));
app.get('/healthz', (req, res) => res.json(HEALTH_PAYLOAD));

// ===== API 守卫：会话 或 X-API-Key，二者皆无 -> 401（全方法覆盖） =====
function authMiddleware(req, res, next) {
  const p = req.path;
  if (req.method === 'OPTIONS') return next();
  if (isAuthExempt(p)) return next();

  // 1) 有效会话放行（浏览器登录后）
  const sess = getSession(req);
  if (sess) { req.apiClient = 'session'; return next(); }

  // 2) X-API-Key 放行（机器人/脚本写入）
  const key = req.headers['x-api-key'];
  if (key && API_KEYS[key]) {
    const client = API_KEYS[key];
    if (req.method === 'DELETE' && !client.modules.includes('*')) {
      return res.status(403).json({ error: `权限不足：${client.name}无删除权限，仅管理员可删除数据` });
    }
    const module = getRouteModule(p);
    if (!client.modules.includes('*') && !client.modules.includes(module)) {
      return res.status(403).json({ error: `权限不足：${client.name}无${module}模块的写入权限` });
    }
    req.apiClient = client.name;
    return next();
  }

  // 3) 都没有 -> 401
  return res.status(401).json({ error: '未授权：请先登录，或提供有效 X-API-Key' });
}

// ===== 登录 / 登出 =====
app.post('/api/login', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (loginRateLimited(ip)) {
    return res.status(429).json({ error: '尝试过于频繁，请稍后再试' });
  }
  const password = (req.body && (req.body.password || req.body.pass)) || '';
  if (!AUTH_PASS_HASH) {
    return res.status(503).json({ error: '服务端未配置登录口令（MKT_AUTH_PASS_HASH 缺失）' });
  }
  if (!password || !verifyPassword(password)) {
    recordLoginHit(ip);
    console.warn('[auth] 登录失败 ip=' + ip);
    return res.status(401).json({ error: '口令错误' });
  }
  const sid = crypto.randomBytes(32).toString('hex');
  SESSIONS.set(sid, { created: Date.now(), last: Date.now() });
  setSessionCookie(res, sid);
  console.log('[auth] 登录成功 ip=' + ip + ' 活跃会话数=' + SESSIONS.size);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const sess = getSession(req);
  if (sess) SESSIONS.delete(sess.sid);
  clearSessionCookie(res);
  res.json({ ok: true });
});

// 会话状态查询（前端判断是否已登录）
app.get('/api/session', (req, res) => {
  const sess = getSession(req);
  res.json({ authenticated: !!sess });
});

app.use(authMiddleware);

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
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

// ===== Helper: 市场营销活动获客标签派生 =====
function normalizeDate(raw = '') {
  const s = String(raw || '').trim();
  const m = s.match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return { year: 2026, month: 0, day: 0, iso: s, quarter: '', monthLabel: '' };
  const year = +m[1];
  const month = +m[2];
  const day = +m[3];
  return {
    year, month, day,
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    quarter: `Q${Math.ceil(month / 3)}`,
    monthLabel: `${month}月`
  };
}

function getRegion(province = '') {
  const p = String(province || '').replace(/省|市|壮族自治区|维吾尔自治区|回族自治区|自治区|特别行政区/g, '');
  if (['上海','江苏','浙江','安徽','山东','江西','福建'].some(x => p.includes(x))) return '华东';
  if (['北京','天津','河北','山西','内蒙古'].some(x => p.includes(x))) return '华北';
  if (['广东','广西','海南','香港','澳门'].some(x => p.includes(x))) return '华南';
  if (['湖北','湖南','河南'].some(x => p.includes(x))) return '华中';
  if (['四川','重庆','云南','贵州','西藏'].some(x => p.includes(x))) return '西南';
  if (['辽宁','吉林','黑龙江'].some(x => p.includes(x))) return '东北';
  if (['陕西','甘肃','青海','宁夏','新疆'].some(x => p.includes(x))) return '西北';
  return '其他';
}

function splitProducts(v = '') {
  return String(v || '').split('|').map(x => x.trim()).filter(Boolean);
}

const PRODUCT_KEYWORDS = {
  '消费者洞察': ['洞察','舆情','社媒监测','趋势','趋势分析','口碑','声量','消费者'],
  '种草/DOMO': ['种草','DOMO','经纪人','达人','达人营销','KOL'],
  'GEO': ['GEO','搜索优化','AI搜索'],
  'AI/大模型': ['大模型','AIGC','AI营销','AI工具','AI'],
  '广告监测': ['广告监测','户外监测','OOH','投放监测'],
  '出海营销': ['出海','海外','跨境','国际','global']
};

function deriveProductInterest(needsText = '') {
  const text = String(needsText || '');
  const hits = [];
  for (const [product, words] of Object.entries(PRODUCT_KEYWORDS)) {
    if (words.some(w => text.toLowerCase().includes(w.toLowerCase()))) hits.push(product);
  }
  return hits.join('|');
}

function normalizeSourceType(campaign = '', sourceType = '') {
  const s = String(sourceType || '').trim();
  if (['白皮书/报告下载','官方账号','线下活动','其他社媒平台','产品试用申请'].includes(s)) return s;
  const c = String(campaign || '');
  if (/报告|白皮书|合集|吃喝玩乐|户外营销|快手美妆|社交媒体营销趋势/.test(c)) return '白皮书/报告下载';
  if (/公众号|官网|菜单栏|企微/.test(c)) return '官方账号';
  if (/论坛|展会|线下|媒介力学/.test(c)) return '线下活动';
  if (/小红书|私域|社媒/.test(c)) return '其他社媒平台';
  if (/试用|内测|DOMO经纪人/.test(c)) return '产品试用申请';
  return '官方账号';
}

function mapMarketingCampaignRow(row) {
  const get = (...keys) => {
    for (const k of keys) if (row[k] !== undefined && row[k] !== null) return String(row[k]).trim();
    return '';
  };
  const industryRaw = get('客户所属行业（必填）', 'industry_raw');
  const needsText = get('具体合作需求（必填）', 'needs_text');
  const campaignName = get('市场活动名称', 'campaign_name');
  return {
    created_date: get('创建时间', 'created_date'),
    industry_raw: industryRaw,
    contact_name: get('姓名（必填）', 'contact_name'),
    company_name: get('企业简称（必填）', 'company_name'),
    needs_text: needsText,
    campaign_name: campaignName,
    registrar: get('Leads分配登记人（必填）(人员)', 'registrar'),
    phone: get('联系方式（必填）', 'phone'),
    province: get('省', 'province'),
    city: get('市', 'city'),
    industry_group: get('行业_一级', 'industry_group'),
    product_interest: get('意向产品线', 'product_interest') || deriveProductInterest(needsText),
    source_type: normalizeSourceType(campaignName, get('内容来源类型', 'source_type')),
    customer_type: get('客户类型', 'customer_type') || industryRaw
  };
}

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
  // 全部活动整体获客数据（不区分CEO/市场）
  const allEventCount = db.prepare('SELECT COUNT(*) as c FROM ceo_events').get().c;
  const allEventsByStatus = db.prepare("SELECT status, COUNT(*) as c FROM ceo_events GROUP BY status").all();
  const totalAudienceAll = db.prepare("SELECT COALESCE(SUM(audience_count),0) as c FROM ceo_events").get().c;
  const allFunnel = db.prepare(`SELECT
      COALESCE(SUM(wechat_followers),0) as wechat,
      COALESCE(SUM(registrations),0) as reg,
      COALESCE(SUM(activations),0) as act,
      COALESCE(SUM(sql_count),0) as sql,
      COALESCE(SUM(mql_count),0) as mql
    FROM ceo_events`).get();

  // CEO出场活动单独统计
  const ceoEventCount = db.prepare("SELECT COUNT(*) as c FROM ceo_events WHERE key_messages='吴明辉(CEO)'").get().c;
  const ceoFunnel = db.prepare(`SELECT
      COALESCE(SUM(wechat_followers),0) as wechat,
      COALESCE(SUM(registrations),0) as reg,
      COALESCE(SUM(activations),0) as act,
      COALESCE(SUM(sql_count),0) as sql
    FROM ceo_events WHERE key_messages='吴明辉(CEO)'`).get();
  const ceoEventList = db.prepare(`SELECT id, name, date, wechat_followers, registrations, activations, sql_count
    FROM ceo_events WHERE key_messages='吴明辉(CEO)' ORDER BY date DESC LIMIT 8`).all();

  const accountCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;
  const accountsByTier = db.prepare("SELECT tier, COUNT(*) as c FROM accounts GROUP BY tier").all();
  const leadCount = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const leadsByStatus = db.prepare("SELECT status, COUNT(*) as c FROM leads GROUP BY status").all();
  const recentEvents = db.prepare("SELECT id, name, date, status, sql_count as leads_count FROM ceo_events ORDER BY date DESC LIMIT 5").all();
  const recentLeads = db.prepare("SELECT id, contact_name, company_name, company_short_name, status, source_channel, created_at FROM leads ORDER BY created_at DESC LIMIT 10").all();
  const monthlyTrend = db.prepare(`
    SELECT strftime('%Y-%m', inbound_date) as month,
           COUNT(*) as total,
           SUM(CASE WHEN status IN ('qualified','opportunity','closed_won') THEN 1 ELSE 0 END) as transferred
    FROM leads WHERE inbound_date != '' AND inbound_date IS NOT NULL
    GROUP BY month ORDER BY month
  `).all();
  res.json({
    events: { total: allEventCount, byStatus: allEventsByStatus },
    speeches: { total: ceoEventCount, totalAudience: totalAudienceAll, totalWechat: allFunnel.wechat, totalRegs: allFunnel.reg, totalActivations: allFunnel.act, totalSQL: allFunnel.sql },
    ceoFunnel: { wechat: allFunnel.wechat, reg: allFunnel.reg, act: allFunnel.act, sql: allFunnel.sql, events: ceoEventList, ceoEvents: ceoEventCount, ceoAct: ceoFunnel.act, ceoSql: ceoFunnel.sql },
    accounts: { total: accountCount, byTier: accountsByTier },
    leads: { total: leadCount, byStatus: leadsByStatus, monthlyTrend },
    recentEvents, recentLeads
  });
});

// ===== CEO获客客户明细（微伴客户）=====
app.get('/api/ceo/customers', (req, res) => {
  const { event_id, page = 1, limit = 50, search } = req.query;
  let sql = `SELECT w.id, w.nickname as wechat_nickname, w.contact_name, w.contact_title,
    w.company_name, w.phone, w.product, w.tags, w.status, w.add_time, w.last_chat_time,
    w.customer_service as owner, w.assigned_to, w.requirement, w.notes, w.add_channel as source_detail,
    w.event_id, e.name as event_name, 'weiban' as source
    FROM ceo_event_weiban w JOIN ceo_events e ON w.event_id = e.id WHERE 1=1`;
  const params = {};
  if (event_id) { sql += ' AND w.event_id = @event_id'; params.event_id = +event_id; }
  if (search) { sql += ' AND (w.nickname LIKE @s OR w.contact_name LIKE @s OR w.company_name LIKE @s OR w.tags LIKE @s OR w.phone LIKE @s OR w.product LIKE @s)'; params.s = '%' + search + '%'; }
  sql += ' ORDER BY w.add_time DESC';
  const total = db.prepare(sql.replace(/SELECT w\.id[\s\S]*?FROM/, 'SELECT COUNT(*) as c FROM')).get(params).c;
  sql += ' LIMIT @limit OFFSET @offset';
  params.limit = +limit; params.offset = (+page - 1) * +limit;
  const rows = db.prepare(sql).all(params);
  const byEvent = db.prepare(`SELECT e.id, e.name, e.wechat_followers, e.registrations, e.activations, e.sql_count,
    COUNT(w.id) as cnt
    FROM ceo_events e LEFT JOIN ceo_event_weiban w ON e.id = w.event_id
    WHERE e.key_messages='吴明辉(CEO)' GROUP BY e.id ORDER BY e.date DESC`).all();
  res.json({ data: rows, total, page: +page, limit: +limit, byEvent });
});

// ===== 单条微伴客户CRUD =====
app.get('/api/ceo/weiban/:id', (req, res) => {
  const row = db.prepare(`SELECT w.*, e.name as event_name FROM ceo_event_weiban w 
    JOIN ceo_events e ON w.event_id = e.id WHERE w.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: '客户不存在' });
  res.json(row);
});

app.post('/api/ceo/weiban', (req, res) => {
  const { event_id, nickname, contact_name, contact_title, company_name, phone, product, tags, add_time, last_chat_time, status, assigned_to, requirement, source_detail, notes, customer_service } = req.body;
  if (!nickname && !contact_name && !company_name) return res.status(400).json({ error: '请填写微信昵称/姓名/公司名称（至少一项）' });
  if (!event_id) return res.status(400).json({ error: '请选择所属活动' });
  const stmt = db.prepare(`INSERT INTO ceo_event_weiban (event_id, nickname, customer_service, rating, tags, status, add_time, last_chat_time, add_channel, phone, contact_title, company_name, product, requirement, assigned_to, source_detail, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const r = stmt.run(event_id, nickname||'', customer_service||'', '', tags||'', status||'待跟进', add_time||'', last_chat_time||'', '手动添加',
    phone||'', contact_title||'', company_name||'', product||'', requirement||'', assigned_to||'', source_detail||'', notes||'');
  res.json({ id: r.lastInsertRowid, message: '添加成功' });
});

app.put('/api/ceo/weiban/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM ceo_event_weiban WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '客户不存在' });
  const allowed = ['event_id','nickname','contact_title','company_name','phone','tags','add_time','last_chat_time','customer_service','status','product','requirement','assigned_to','source_detail','notes','rating'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.json({ message: '无更新' });
  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE ceo_event_weiban SET ${sets} WHERE id = @id`).run({ ...req.body, id: +req.params.id });
  res.json({ message: '更新成功' });
});

app.delete('/api/ceo/weiban/:id', (req, res) => {
  const r = db.prepare('DELETE FROM ceo_event_weiban WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: '客户不存在' });
  res.json({ message: '删除成功' });
});

// ===== Events CRUD (now using ceo_events) =====
app.get('/api/events', (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM ceo_events WHERE 1=1';
  const params = {};
  if (status) { sql += ' AND status = @status'; params.status = status; }
  if (search) { sql += ' AND (name LIKE @s OR topic LIKE @s OR location LIKE @s)'; params.s = `%${search}%`; }
  sql += ' ORDER BY date DESC';
  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as c')).get(params).c;
  sql += ` LIMIT @limit OFFSET @offset`;
  params.limit = +limit;
  params.offset = (+page - 1) * +limit;
  const rows = db.prepare(sql).all(params);
  res.json({ data: rows, total, page: +page, limit: +limit });
});

app.get('/api/events/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM ceo_events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '活动不存在' });
  const linkedAccounts = db.prepare(`
    SELECT ea.*, a.company_name, a.industry, a.tier
    FROM ceo_event_attendees ea JOIN accounts a ON ea.account_id = a.id
    WHERE ea.event_id = ?
  `).all(req.params.id);
  // CEO获客活动：匹配关联线索（按source_channel关键词）+ 微伴客户明细
  let linkedLeads = [];
  let weibanCustomers = [];
  if (row.key_messages === '吴明辉(CEO)') {
    const name = (row.name || '');
    // 关键词映射规则
    const patterns = [];
    if (/晚点/.test(name)) patterns.push('Octo·晚点头条', '晚点');
    if (/混沌/.test(name)) patterns.push('混沌');
    if (/全球AI|生态.*创新|创新峰会/.test(name)) patterns.push('全球AI生态与创新峰会');
    if (/EMP|培训班|国有企业领导/.test(name)) patterns.push('EMP培训班');
    if (/Octo.*发布|产品发布.*公众号|明略公众号/.test(name)) patterns.push('明略公众号', '公众号-明略');
    if (/中欧|商学院/.test(name)) patterns.push('中欧商学院');
    if (/CAIO/.test(name)) patterns.push('CAIO');
    if (/外滩/.test(name)) patterns.push('外滩');
    if (patterns.length) {
      const where = patterns.map(() => 'source_channel LIKE ?').join(' OR ');
      const params = patterns.map(p => '%' + p + '%');
      linkedLeads = db.prepare(`SELECT id, company_name, company_short_name, contact_name, contact_title, phone, source_channel, source_detail, status, product, industry, team, assigned_to, inbound_date, transfer_date, requirement FROM leads WHERE (${where}) ORDER BY inbound_date DESC`).all(...params);
    }
    weibanCustomers = db.prepare(`SELECT id, nickname, customer_service, rating, tags, status, add_time, last_chat_time, add_channel FROM ceo_event_weiban WHERE event_id = ? ORDER BY add_time DESC`).all(req.params.id);
  }
  res.json({ ...row, linkedAccounts, linkedLeads, weibanCustomers });
});

app.post('/api/events', (req, res) => {
  const { name, date, end_date, location, status, topic, audience_count, audience_profile,
    business_design, story_line, key_messages, wechat_followers, registrations, activations,
    mql_count, sql_count, notes } = req.body;
  if (!name) return res.status(400).json({ error: '活动名称不能为空' });
  const stmt = db.prepare(`INSERT INTO ceo_events (name, date, end_date, location, status, topic, audience_count, audience_profile,
    business_design, story_line, key_messages, wechat_followers, registrations, activations,
    mql_count, sql_count, notes)
    VALUES (@name, @date, @end_date, @location, @status, @topic, @audience_count, @audience_profile,
    @business_design, @story_line, @key_messages, @wechat_followers, @registrations, @activations,
    @mql_count, @sql_count, @notes)`);
  const r = stmt.run({
    name, date: date || '', end_date: end_date || '', location: location || '',
    status: status || '筹备中', topic: topic || '', audience_count: audience_count || 0,
    audience_profile: audience_profile || '', business_design: business_design || '',
    story_line: story_line || '', key_messages: key_messages || '',
    wechat_followers: wechat_followers || 0, registrations: registrations || 0,
    activations: activations || 0, mql_count: mql_count || 0, sql_count: sql_count || 0,
    notes: notes || ''
  });
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/events/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM ceo_events WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '活动不存在' });
  logEdit('ceo_events', +req.params.id, old, req.body, req.body._editedBy || '');
  buildUpdate('ceo_events', +req.params.id, req.body);
  res.json({ message: '更新成功' });
});

app.delete('/api/events/:id', (req, res) => {
  db.prepare('DELETE FROM ceo_events WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ===== Speeches/CEO获客 CRUD (now using ceo_events) =====
app.get('/api/speeches', (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM ceo_events WHERE 1=1';
  const params = {};
  if (search) { sql += ' AND (topic LIKE @s OR name LIKE @s OR location LIKE @s)'; params.s = `%${search}%`; }
  sql += ' ORDER BY date DESC';
  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as c')).get(params).c;
  sql += ` LIMIT @limit OFFSET @offset`;
  params.limit = +limit;
  params.offset = (+page - 1) * +limit;
  const rows = db.prepare(sql).all(params);
  res.json({ data: rows, total, page: +page, limit: +limit });
});

app.get('/api/speeches/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM ceo_events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '活动不存在' });
  const touches = db.prepare(`
    SELECT ea.*, a.company_name, a.industry, a.tier
    FROM ceo_event_attendees ea JOIN accounts a ON ea.account_id = a.id
    WHERE ea.event_id = ?
  `).all(req.params.id);
  res.json({ ...row, touches });
});

app.post('/api/speeches', (req, res) => {
  const { name, date, location, topic, event_type, audience_count, audience_profile,
    story_line, key_messages, business_design, wechat_followers, registrations, activations,
    mql_count, sql_count, notes } = req.body;
  if (!name && !topic) return res.status(400).json({ error: '活动名称或主题不能为空' });
  const stmt = db.prepare(`INSERT INTO ceo_events (name, date, location, topic, event_type, audience_count, audience_profile,
    story_line, key_messages, business_design, wechat_followers, registrations, activations,
    mql_count, sql_count, notes)
    VALUES (@name, @date, @location, @topic, @event_type, @audience_count, @audience_profile,
    @story_line, @key_messages, @business_design, @wechat_followers, @registrations, @activations,
    @mql_count, @sql_count, @notes)`);
  const r = stmt.run({
    name: name || topic || '', date: date || '', location: location || '',
    topic: topic || '', event_type: event_type || '演讲',
    audience_count: audience_count || 0, audience_profile: audience_profile || '',
    story_line: story_line || '', key_messages: key_messages || '',
    business_design: business_design || '', wechat_followers: wechat_followers || 0,
    registrations: registrations || 0, activations: activations || 0,
    mql_count: mql_count || 0, sql_count: sql_count || 0, notes: notes || ''
  });
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/speeches/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM ceo_events WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '活动不存在' });
  logEdit('ceo_events', +req.params.id, old, req.body, req.body._editedBy || '');
  buildUpdate('ceo_events', +req.params.id, req.body);
  res.json({ message: '更新成功' });
});

app.delete('/api/speeches/:id', (req, res) => {
  db.prepare('DELETE FROM ceo_events WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// Speech/CEO获客 stats
app.get('/api/speeches/stats/overview', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM ceo_events').get().c;
  const totalAudience = db.prepare('SELECT COALESCE(SUM(audience_count),0) as c FROM ceo_events').get().c;
  const totalLeads = db.prepare('SELECT COALESCE(SUM(registrations),0) as c FROM ceo_events').get().c;
  const uniqueAccounts = db.prepare('SELECT COUNT(DISTINCT account_id) as c FROM ceo_event_attendees').get().c;
  const byIndustry = db.prepare(`
    SELECT a.industry, COUNT(*) as c
    FROM ceo_event_attendees ea JOIN accounts a ON ea.account_id = a.id
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
    SELECT e.id, e.name, e.date, e.status, ea.follow_up_status, ea.notes as feedback
    FROM ceo_event_attendees ea JOIN ceo_events e ON ea.event_id = e.id
    WHERE ea.account_id = ? ORDER BY e.date DESC
  `).all(req.params.id);
  const speeches = db.prepare(`
    SELECT e.id, e.topic, e.date, e.name as event_name, ea.response_level, ea.follow_up_status
    FROM ceo_event_attendees ea JOIN ceo_events e ON ea.event_id = e.id
    WHERE ea.account_id = ? ORDER BY e.date DESC
  `).all(req.params.id);
  const leads = db.prepare('SELECT * FROM leads WHERE account_id = ? ORDER BY created_at DESC').all(req.params.id);
  const contacts = db.prepare('SELECT * FROM account_contacts WHERE account_id = ? ORDER BY is_key_contact DESC, is_champion DESC, id ASC').all(req.params.id);
  const reports = db.prepare('SELECT * FROM account_reports WHERE account_id = ? ORDER BY report_period DESC, created_at DESC').all(req.params.id);
  const timeline = db.prepare('SELECT * FROM account_timeline WHERE account_id = ? ORDER BY event_date DESC, created_at DESC').all(req.params.id);
  res.json({ ...row, events, speeches, leads, contacts, reports, timeline });
});

// accounts表所有可写字段（除id/created_at/updated_at）
const ACCOUNT_WRITABLE_FIELDS = ['company_name','industry','scale','region','source','tier','first_touch_date','last_touch_date',
  'touch_count','needs_summary','estimated_budget','octo_status','assigned_to','follow_up_status','ai_suggestion','notes',
  'customer_stage','deal_amount','deal_stage','lead_source','key_contacts_count','key_departments',
  'competitors','customer_recognition','deployment_type','product_solutions_detail','core_painpoint',
  'blockers','next_step','next_deadline','key_events','ceo_involvement','ecosystem_lock','lessons_learned',
  'source_coverage','health_tier','industry_group','demand_type','blocker_type','failure_mode','created_by'];

app.post('/api/accounts', (req, res) => {
  const body = { ...req.body };
  body.deal_amount = +body.deal_amount || 0;
  body.key_contacts_count = +body.key_contacts_count || 0;
  body.touch_count = +body.touch_count || 0;
  body.ceo_involvement = body.ceo_involvement ? 1 : 0;
  body.tier = body.tier || 'C';
  if (!body.company_name) return res.status(400).json({ error: '公司名称不能为空' });
  // key_events如果传的是数组/对象，自动JSON序列化
  if (body.key_events !== undefined && typeof body.key_events !== 'string') {
    body.key_events = JSON.stringify(body.key_events);
  }
  if (body.source_coverage !== undefined && typeof body.source_coverage !== 'string') {
    body.source_coverage = JSON.stringify(body.source_coverage);
  }
  const cols = ACCOUNT_WRITABLE_FIELDS.filter(f => body[f] !== undefined && body[f] !== null);
  const placeholders = cols.map(f => `@${f}`).join(', ');
  const stmt = db.prepare(`INSERT INTO accounts (${cols.join(', ')}) VALUES (${placeholders})`);
  const r = stmt.run(body);
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/accounts/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: '客户不存在' });
  const body = { ...req.body };
  // 数字字段转换
  if (body.deal_amount !== undefined) body.deal_amount = +body.deal_amount || 0;
  if (body.key_contacts_count !== undefined) body.key_contacts_count = +body.key_contacts_count || 0;
  if (body.touch_count !== undefined) body.touch_count = +body.touch_count || 0;
  if (body.ceo_involvement !== undefined) body.ceo_involvement = body.ceo_involvement ? 1 : 0;
  // JSON字段自动序列化
  if (body.key_events !== undefined && typeof body.key_events !== 'string') {
    body.key_events = JSON.stringify(body.key_events);
  }
  if (body.source_coverage !== undefined && typeof body.source_coverage !== 'string') {
    body.source_coverage = JSON.stringify(body.source_coverage);
  }
  // notes更新时自动追加来源标注（如果传了_source标签）
  logEdit('accounts', +req.params.id, old, body, req.apiClient || '');
  buildUpdate('accounts', +req.params.id, body, ['id', 'created_at', '_editedBy', '_source']);
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

app.get('/api/accounts/reports/:reportId', (req, res) => {
  const row = db.prepare('SELECT * FROM account_reports WHERE id = ?').get(req.params.reportId);
  if (!row) return res.status(404).json({ error: '报告不存在' });
  res.json(row);
});

app.post('/api/accounts/:id/reports', (req, res) => {
  const { report_type, report_period, most_important, key_work, need_decision, cross_team_needs, bottlenecks, next_important } = req.body;
  const clientName = req.apiClient || req.body.created_by || '';
  const stmt = db.prepare(`INSERT INTO account_reports (account_id, report_type, report_period, most_important, key_work, need_decision, cross_team_needs, bottlenecks, next_important, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const r = stmt.run(req.params.id, report_type || 'weekly', report_period || '', most_important || '', key_work || '', need_decision || '', cross_team_needs || '', bottlenecks || '', next_important || '', clientName);
  logEdit('account_reports', r.lastInsertRowid, {}, req.body, clientName);
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/accounts/reports/:reportId', (req, res) => {
  const old = db.prepare('SELECT * FROM account_reports WHERE id = ?').get(req.params.reportId);
  if (!old) return res.status(404).json({ error: '报告不存在' });
  const allowed = ['report_type', 'report_period', 'most_important', 'key_work', 'need_decision', 'cross_team_needs', 'bottlenecks', 'next_important'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.json({ message: '无更新' });
  logEdit('account_reports', +req.params.reportId, old, req.body, req.apiClient || '');
  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE account_reports SET ${sets}, updated_at = datetime('now','localtime') WHERE id = @id`).run({ ...req.body, id: +req.params.reportId });
  res.json({ message: '更新成功' });
});

app.delete('/api/accounts/reports/:reportId', (req, res) => {
  const r = db.prepare('DELETE FROM account_reports WHERE id = ?').run(req.params.reportId);
  if (!r.changes) return res.status(404).json({ error: '报告不存在' });
  res.json({ message: '删除成功' });
});

// ===== Account Contacts (联系人) =====
const CONTACT_WRITABLE_FIELDS = ['name','title','department','role_level','phone','email','wechat','is_champion','is_key_contact','decision_level','relationship_status','notes'];

app.get('/api/accounts/:id/contacts', (req, res) => {
  const rows = db.prepare('SELECT * FROM account_contacts WHERE account_id = ? ORDER BY is_key_contact DESC, is_champion DESC, id ASC').all(req.params.id);
  res.json(rows);
});

app.get('/api/accounts/contacts/:contactId', (req, res) => {
  const row = db.prepare('SELECT * FROM account_contacts WHERE id = ?').get(req.params.contactId);
  if (!row) return res.status(404).json({ error: '联系人不存在' });
  res.json(row);
});

app.post('/api/accounts/:id/contacts', (req, res) => {
  const body = { ...req.body };
  if (!body.name) return res.status(400).json({ error: '联系人姓名不能为空' });
  body.is_champion = body.is_champion ? 1 : 0;
  body.is_key_contact = body.is_key_contact || body.is_champion ? 1 : 0;
  const cols = CONTACT_WRITABLE_FIELDS.filter(f => body[f] !== undefined && body[f] !== null);
  const placeholders = cols.map(() => '?').join(', ');
  const vals = cols.map(f => body[f]);
  const stmt = db.prepare(`INSERT INTO account_contacts (account_id, ${cols.join(', ')}) VALUES (?, ${placeholders})`);
  const r = stmt.run(req.params.id, ...vals);
  logEdit('account_contacts', r.lastInsertRowid, {}, body, req.apiClient || '');
  res.json({ id: r.lastInsertRowid, message: '创建成功' });
});

app.put('/api/accounts/contacts/:contactId', (req, res) => {
  const old = db.prepare('SELECT * FROM account_contacts WHERE id = ?').get(req.params.contactId);
  if (!old) return res.status(404).json({ error: '联系人不存在' });
  const body = { ...req.body, id: +req.params.contactId };
  if (body.is_champion !== undefined) body.is_champion = body.is_champion ? 1 : 0;
  if (body.is_key_contact !== undefined) body.is_key_contact = body.is_key_contact ? 1 : 0;
  const fields = Object.keys(body).filter(k => CONTACT_WRITABLE_FIELDS.includes(k));
  if (!fields.length) return res.json({ message: '无更新' });
  logEdit('account_contacts', +req.params.contactId, old, body, req.apiClient || '');
  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE account_contacts SET ${sets}, updated_at = datetime('now','localtime') WHERE id = @id`).run(body);
  res.json({ message: '更新成功' });
});

app.delete('/api/accounts/contacts/:contactId', (req, res) => {
  const r = db.prepare('DELETE FROM account_contacts WHERE id = ?').run(req.params.contactId);
  if (!r.changes) return res.status(404).json({ error: '联系人不存在' });
  res.json({ message: '删除成功' });
});

// ===== Key Events (关键事件 - 追加到key_events JSON) =====
app.get('/api/accounts/:id/key-events', (req, res) => {
  const row = db.prepare('SELECT key_events FROM accounts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '客户不存在' });
  let events = [];
  try { events = JSON.parse(row.key_events || '[]'); } catch { events = []; }
  res.json(events);
});

app.post('/api/accounts/:id/key-events', (req, res) => {
  const row = db.prepare('SELECT key_events FROM accounts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '客户不存在' });
  let events = [];
  try { events = JSON.parse(row.key_events || '[]'); } catch { events = []; }
  const { date, event, note } = req.body;
  if (!event) return res.status(400).json({ error: '事件名称不能为空' });
  events.push({ date: date || new Date().toISOString().slice(0,10), event, note: note || '' });
  events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const newEventsJson = JSON.stringify(events);
  logEdit('accounts', +req.params.id, { key_events: row.key_events }, { key_events: newEventsJson }, req.apiClient || '');
  db.prepare('UPDATE accounts SET key_events = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
    .run(newEventsJson, req.params.id);
  res.json({ message: '追加成功', total: events.length });
});

// ===== Account Timeline (推进时间线) =====
app.get('/api/accounts/:id/timeline', (req, res) => {
  const rows = db.prepare('SELECT * FROM account_timeline WHERE account_id = ? ORDER BY event_date DESC, created_at DESC').all(req.params.id);
  res.json(rows);
});

app.post('/api/accounts/:id/timeline', (req, res) => {
  const { event_date, event_type, title, content, participants, next_action, next_action_date, source } = req.body;
  if (!title && !content) return res.status(400).json({ error: '标题或内容至少填一项' });
  const clientName = req.apiClient || '';
  const stmt = db.prepare(`INSERT INTO account_timeline (account_id, event_date, event_type, title, content, participants, next_action, next_action_date, source, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const r = stmt.run(
    req.params.id,
    event_date || new Date().toISOString().slice(0,10),
    event_type || '跟进',
    title || '',
    content || '',
    participants || '',
    next_action || '',
    next_action_date || '',
    source || '',
    clientName
  );
  logEdit('account_timeline', r.lastInsertRowid, {}, req.body, clientName);
  res.json({ id: r.lastInsertRowid, message: '记录成功' });
});

app.put('/api/accounts/timeline/:timelineId', (req, res) => {
  const old = db.prepare('SELECT * FROM account_timeline WHERE id = ?').get(req.params.timelineId);
  if (!old) return res.status(404).json({ error: '记录不存在' });
  const allowed = ['event_date','event_type','title','content','participants','next_action','next_action_date','source'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.json({ message: '无更新' });
  logEdit('account_timeline', +req.params.timelineId, old, req.body, req.apiClient || '');
  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE account_timeline SET ${sets} WHERE id = @id`).run({ ...req.body, id: +req.params.timelineId });
  res.json({ message: '更新成功' });
});

app.delete('/api/accounts/timeline/:timelineId', (req, res) => {
  const r = db.prepare('DELETE FROM account_timeline WHERE id = ?').run(req.params.timelineId);
  if (!r.changes) return res.status(404).json({ error: '记录不存在' });
  res.json({ message: '删除成功' });
});

// ===== Octo Summary (大客户全景报告) =====
const accountCols = 'id, company_name, tier, industry, scale, deal_amount, customer_stage, assigned_to, blockers, next_step, next_deadline, ceo_involvement, ecosystem_lock, lessons_learned, customer_recognition, competitors, core_painpoint, key_contacts_count';

app.get('/api/octo/summary', (req, res) => {
  const totalAccounts = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;

  // KPI counts
  const signedCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage IN ('已签约','交付中','已付费')").get().c;
  const biddingCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage = '投标中'").get().c;
  const bClassCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage IN ('B类重点推进','重点推进','POC中')").get().c;
  const cClassCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage IN ('C类跟进','跟进中')").get().c;
  const dClassCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage IN ('观察中','D类观察')").get().c;
  const deadCount = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE customer_stage IN ('战败','放弃')").get().c;

  const pipelineResult = db.prepare(`SELECT COALESCE(SUM(deal_amount),0) as total FROM accounts WHERE customer_stage NOT IN ('战败','放弃','观察中','') AND customer_stage IS NOT NULL`).get();
  const pipeline = Math.round(pipelineResult.total * 10) / 10;

  const wonResult = db.prepare(`SELECT COALESCE(SUM(deal_amount),0) as total FROM accounts WHERE customer_stage IN ('已签约','交付中','已付费')`).get();
  const wonAmount = Math.round(wonResult.total * 10) / 10;

  const deadRate = totalAccounts > 0 ? Math.round(deadCount / totalAccounts * 100) : 0;

  // By stage distribution
  const byStage = db.prepare(`
    SELECT customer_stage as stage, COUNT(*) as count, COALESCE(SUM(deal_amount),0) as amount
    FROM accounts WHERE customer_stage != '' GROUP BY customer_stage
    ORDER BY CASE customer_stage
      WHEN '已签约' THEN 1 WHEN '交付中' THEN 2 WHEN '已付费' THEN 3 WHEN '投标中' THEN 4
      WHEN 'B类重点推进' THEN 5 WHEN '重点推进' THEN 6 WHEN 'POC中' THEN 7
      WHEN 'C类跟进' THEN 8 WHEN '跟进中' THEN 9
      WHEN '观察中' THEN 10 WHEN 'D类观察' THEN 11 WHEN '战败' THEN 12 WHEN '放弃' THEN 13 ELSE 14 END
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
    FROM accounts WHERE customer_stage NOT IN ('战败','放弃','观察中','D类观察') AND customer_stage IS NOT NULL AND customer_stage != ''
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

  // ===== 全景维度聚合（按取数逻辑从标注字段真实计算）=====
  const P39 = "company_name NOT IN ('吴师/黄江华','Leo~JXQ金总')"; // 39家口径
  const byHealth = db.prepare(`SELECT health_tier as tier, COUNT(*) as count FROM accounts WHERE health_tier != '' AND ${P39} GROUP BY health_tier`).all();
  const byIndustryGroup = db.prepare(`SELECT industry_group as grp, COUNT(*) as count, SUM(CASE WHEN customer_stage IN ('已签约','交付中') THEN 1 ELSE 0 END) as signed FROM accounts WHERE industry_group != '' AND ${P39} GROUP BY industry_group ORDER BY count DESC`).all();
  // 需求5类/卡点6类/失败模式是逗号分隔多值，用JS聚合
  const allTags = db.prepare(`SELECT company_name, demand_type, blocker_type, failure_mode, customer_stage, deal_amount, health_tier, industry_group FROM accounts WHERE ${P39}`).all();
  const demandCount = {}, blockerCount = {}, failureCount = {};
  const demandClients = {}, blockerClients = {}, failureClients = {};
  allTags.forEach(a => {
    (a.demand_type || '').split(',').filter(Boolean).forEach(t => {
      demandCount[t] = (demandCount[t] || 0) + 1;
      (demandClients[t] = demandClients[t] || []).push(a.company_name);
    });
    (a.blocker_type || '').split(',').filter(Boolean).forEach(t => {
      blockerCount[t] = (blockerCount[t] || 0) + 1;
      (blockerClients[t] = blockerClients[t] || []).push(a.company_name);
    });
    if (a.failure_mode) {
      failureCount[a.failure_mode] = (failureCount[a.failure_mode] || 0) + 1;
      (failureClients[a.failure_mode] = failureClients[a.failure_mode] || []).push(a.company_name);
    }
  });
  const byDemand = Object.entries(demandCount).map(([name, count]) => ({ name, count, clients: demandClients[name] })).sort((a, b) => b.count - a.count);
  const byBlocker = Object.entries(blockerCount).map(([name, count]) => ({ name, count, clients: blockerClients[name] })).sort((a, b) => b.count - a.count);
  const byFailure = Object.entries(failureCount).map(([mode, count]) => ({ mode, count, clients: failureClients[mode] }));
  // 健康度分组客户列表（板块二用）
  const healthGroups = ['健康推进中', '有风险', '战败冻结'].map(t => ({
    tier: t,
    items: db.prepare(`SELECT ${accountCols} FROM accounts WHERE health_tier = ? ORDER BY deal_amount DESC`).all(t)
  }));

  // Strategic quotes
  const quotes = [
    { who: '姜平', text: '不能付费的客户不再投入时间', date: '9/7' },
    { who: '姜平', text: '亏本也拿（宇通）', date: '9月' },
    { who: '姜平', text: '卓正必须发生', date: '9月' },
    { who: '辉哥', text: '代码开源随便用，赚Token+FDE（致远）', date: '9月' }
  ];

  res.json({
    kpi: { totalAccounts, signedCount, biddingCount, bClassCount, cClassCount, dClassCount, pipeline, wonAmount, deadCount, deadRate, pendingDecisions: pendingDecisions.length, blockers: blockersList.length },
    byStage, byIndustry, byCompetitor,
    pipeline: pipelineList, recentUpdates, upcomingDeadlines,
    blockers: blockersList, lessons, pendingDecisions,
    // New panoramic groups
    signed, bidding, bClass, cClass, dClass,
    deadGrouped, deadAll,
    coreLessons, topConcerns, actionItems, quotes,
    // 全景维度
    byHealth, byIndustryGroup, byDemand, byBlocker, byFailure, healthGroups
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
  const sourceOptions = db.prepare("SELECT DISTINCT source_channel FROM leads WHERE source_channel != '' ORDER BY source_channel").all().map(r => r.source_channel);
  res.json({ data: rows, total, page: +page, limit: +limit, sourceOptions });
});

app.get('/api/leads/funnel', (req, res) => {
  const statuses = ['new', 'contacted', 'qualified', 'opportunity', 'closed_won', 'closed_lost'];
  const statusNames = { new: '新进线', contacted: '已联系', qualified: '已转出', opportunity: '商机', closed_won: '成单', closed_lost: '无效/丢单' };
  // 转出统一口径：status='transferred'（历史数据里 qualified/已转出 已归一）
  const funnel = statuses.map(s => {
    const realStatus = s === 'qualified' ? 'transferred' : s;
    const c = db.prepare('SELECT COUNT(*) as c FROM leads WHERE status = ?').get(realStatus).c;
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
  // 月度趋势：1-9月用 sdr_monthly_stats 核实基线，10月起用 leads 实时算
  // 进线按 inbound_date，转出按 transfer_date（兼容 qualified/transferred/已转出 多套状态）
  const baselineMonths = db.prepare(`SELECT month, inbound, valid, transferred, claimed FROM sdr_monthly_stats WHERE month < '2026-10' ORDER BY month`).all();
  const liveInbound = db.prepare(`
    SELECT strftime('%Y-%m', inbound_date) as month,
           COUNT(*) as total,
           SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid
    FROM leads WHERE inbound_date != '' AND inbound_date IS NOT NULL
      AND inbound_date >= '2026-10-01'
    GROUP BY month ORDER BY month
  `).all();
  const liveTransfer = db.prepare(`
    SELECT substr(transfer_date,1,7) as month, COUNT(*) as cnt
    FROM leads WHERE transfer_date != '' AND transfer_date IS NOT NULL
      AND transfer_date >= '2026-10-01'
    GROUP BY month ORDER BY month
  `).all();
  const liveTransferMap = {};
  liveTransfer.forEach(t => { liveTransferMap[t.month] = t.cnt; });
  const liveMonthSet = new Set(liveInbound.map(m => m.month));
  liveTransfer.forEach(t => { if (!liveMonthSet.has(t.month)) { liveInbound.push({ month: t.month, total: 0, valid: 0 }); liveMonthSet.add(t.month); } });
  liveInbound.sort((a, b) => a.month.localeCompare(b.month));
  const monthlyTrend = [
    ...baselineMonths.map(m => ({ month: m.month, total: m.inbound, valid: m.valid, transferred: m.transferred, claimed: m.claimed })),
    ...liveInbound.map(m => ({ month: m.month, total: m.total, valid: m.valid || 0, transferred: liveTransferMap[m.month] || 0, claimed: liveTransferMap[m.month] || 0 }))
  ];
  const recentLeads = db.prepare(`SELECT id, company_name, company_short_name, contact_name, source_channel, product, assigned_to, status, inbound_date, transfer_date
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
  const { company_name, company_short_name, contact_name, contact_title, phone, source_channel, source_detail,
    status, product, industry, team, assigned_to, inbound_date, transfer_date,
    opportunity_id, opportunity_stage, deal_amount, lost_reason, requirement, account_id } = req.body;
  if (!company_name && !contact_name) return res.status(400).json({ error: '客户名称或联系人不能为空' });
  const stmt = db.prepare(`INSERT INTO leads (company_name, company_short_name, contact_name, contact_title, phone, source_channel, source_detail,
    status, product, industry, team, assigned_to, inbound_date, transfer_date,
    opportunity_id, opportunity_stage, deal_amount, lost_reason, requirement, account_id)
    VALUES (@company_name, @company_short_name, @contact_name, @contact_title, @phone, @source_channel, @source_detail,
    @status, @product, @industry, @team, @assigned_to, @inbound_date, @transfer_date,
    @opportunity_id, @opportunity_stage, @deal_amount, @lost_reason, @requirement, @account_id)`);
  const r = stmt.run({
    company_name: company_name || '', company_short_name: company_short_name || '', contact_name: contact_name || '',
    contact_title: contact_title || '', phone: phone || '',
    source_channel: source_channel || '', source_detail: source_detail || '',
    status: status || 'new', product: product || '', industry: industry || '',
    team: team || '', assigned_to: assigned_to || '',
    inbound_date: inbound_date || '', transfer_date: transfer_date || '',
    opportunity_id: opportunity_id || '', opportunity_stage: opportunity_stage || '',
    deal_amount: +deal_amount || 0, lost_reason: lost_reason || '',
    requirement: requirement || '', account_id: account_id || null
  });

  // 自动更新月度统计
  try {
    if (inbound_date && inbound_date.length >= 7) {
      const m = inbound_date.substring(0, 7);
      const existM = db.prepare('SELECT id FROM sdr_monthly_stats WHERE month = ?').get(m);
      if (existM) {
        db.prepare(`UPDATE sdr_monthly_stats SET inbound = inbound + 1, valid = valid + 1, updated_at=datetime('now','localtime') WHERE month = ?`).run(m);
        // 如果状态是已转出，也+1转出
        if (['qualified','opportunity','closed_won'].includes(status)) {
          db.prepare(`UPDATE sdr_monthly_stats SET transferred = transferred + 1, claimed = claimed + 1 WHERE month = ?`).run(m);
        }
      }
    }
  } catch(e) { /* 计数失败不影响主流程 */ }

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
    const validTables = ['ceo_events', 'speeches', 'accounts', 'leads'];
    const tableAlias = { 'events': 'ceo_events', 'speeches': 'ceo_events' };
    const actualTable = tableAlias[table] || table;
    if (!validTables.includes(actualTable)) return res.status(400).json({ error: '不支持的导入目标' });
    if (!req.file) return res.status(400).json({ error: '请上传文件' });

    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    if (!rows.length) return res.status(400).json({ error: '文件为空' });

    // Column mapping config
    const columnMaps = {
      ceo_events: { '活动名称': 'name', '日期': 'date', '截止日期': 'end_date', '地点': 'location', '主题': 'topic', '类型': 'event_type', '状态': 'status', '听众人数': 'audience_count', '听众画像': 'audience_profile', '业务设计': 'business_design', '故事线': 'story_line', '加微数': 'wechat_followers', '申请数': 'registrations', '开通数': 'activations', 'MQL': 'mql_count', 'SQL': 'sql_count', '备注': 'notes' },
      speeches: { '活动名称': 'name', '日期': 'date', '地点': 'location', '演讲主题': 'topic', '听众人数': 'audience_count', '听众画像': 'audience_profile', '故事线': 'story_line', '业务设计': 'business_design', '备注': 'notes' },
      accounts: { '公司名称': 'company_name', '行业': 'industry', '规模': 'scale', '地区': 'region', '来源': 'source', '等级': 'tier', '首次触达日期': 'first_touch_date', '需求摘要': 'needs_summary', '预估预算': 'estimated_budget', 'Octo状态': 'octo_status', '负责人': 'assigned_to', '备注': 'notes' },
      leads: { '客户名称': 'company_name', '企业简称': 'company_short_name', '公司简称': 'company_short_name', '联系人': 'contact_name', '职位': 'contact_title', '电话': 'phone', '来源渠道': 'source_channel', '来源子渠道': 'source_detail', '线索状态': 'status', '需求产品': 'product', '行业': 'industry', '分配区域/团队': 'team', '团队': 'team', '分配销售': 'assigned_to', '进线日期': 'inbound_date', '转出日期': 'transfer_date', '商机号': 'opportunity_id', '商机阶段': 'opportunity_stage', '成单金额': 'deal_amount', '丢单原因': 'lost_reason', '需求描述/跟进记录': 'requirement', '需求描述': 'requirement', '跟进记录': 'requirement', '备注': 'requirement' }
    };

    const cmap = columnMaps[actualTable] || columnMaps[table];
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
      const requiredField = { ceo_events: 'name', speeches: 'name', accounts: 'company_name', leads: 'company_name' }[actualTable];
      if (!mapped[requiredField]) throw new Error(`缺少必填字段: ${requiredField}`);

      // Build INSERT
      const fields = Object.keys(mapped).filter(k => mapped[k] !== '' && mapped[k] !== undefined);
      const placeholders = fields.map(f => `@${f}`).join(', ');
      const sql = `INSERT INTO ${actualTable} (${fields.join(', ')}) VALUES (${placeholders})`;
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

// ===== SDR Dashboard 聚合API =====
app.get('/api/sdr/dashboard', (req, res) => {
  // 1. 月度趋势：优先用sdr_monthly_stats基线表，leads表数据补充增量
  const monthlyBase = db.prepare('SELECT * FROM sdr_monthly_stats ORDER BY month').all();
  
  // 从leads表聚合增量（2026-10 起）：进线按 inbound_date，转出按 transfer_date
  // 转出口径统一：status 含 qualified/transferred/已转出 或 有 transfer_date
  const leadsMonthly = db.prepare(`
    SELECT strftime('%Y-%m', inbound_date) as month,
           COUNT(*) as leads_inbound,
           SUM(CASE WHEN is_claimed = 1 THEN 1 ELSE 0 END) as leads_claimed
    FROM leads WHERE inbound_date != '' AND inbound_date IS NOT NULL
      AND inbound_date >= '2026-10-01'
    GROUP BY month ORDER BY month
  `).all();

  // 转出：按 transfer_date 归属月份（含跨月延迟转出）
  const transferMonthly = db.prepare(`
    SELECT substr(transfer_date,1,7) as month, COUNT(*) as cnt
    FROM leads WHERE transfer_date != '' AND transfer_date IS NOT NULL
      AND transfer_date >= '2026-10-01'
    GROUP BY month ORDER BY month
  `).all();
  const transferMap = {};
  transferMonthly.forEach(t => { transferMap[t.month] = t.cnt; });
  leadsMonthly.forEach(m => { m.leads_transferred = transferMap[m.month] || 0; });
  // transfer 有但 inbound 月份没有的，也要补一个月份条目
  transferMonthly.forEach(t => {
    if (!leadsMonthly.find(m => m.month === t.month)) {
      leadsMonthly.push({ month: t.month, leads_inbound: 0, leads_transferred: t.cnt, leads_claimed: 0 });
    }
  });
  leadsMonthly.sort((a, b) => a.month.localeCompare(b.month));
  
  // 合并：基线表已有月份用基线，10月及以后从leads实时算
  const leadsMonthMap = {};
  leadsMonthly.forEach(m => { leadsMonthMap[m.month] = m; });
  
  const monthly = monthlyBase.map(m => {
    const transferRate = m.inbound > 0 ? +(m.transferred / m.inbound * 100).toFixed(1) : 0;
    const validRate = m.inbound > 0 ? +(m.valid / m.inbound * 100).toFixed(1) : 0;
    const monthNum = parseInt(m.month.split('-')[1]);
    return {
      label: m.month,
      month: monthNum + '月',
      进线: m.inbound, 转出: m.transferred, 认领: m.claimed,
      转出率: transferRate, year: parseInt(m.month.split('-')[0])
    };
  });
  
  // 添加leads表中有但基线表没有的月份（如10月+）
  const baseMonths = new Set(monthlyBase.map(m => m.month));
  leadsMonthly.forEach(lm => {
    if (!baseMonths.has(lm.month)) {
      const transferRate = lm.leads_inbound > 0 ? +(lm.leads_transferred / lm.leads_inbound * 100).toFixed(1) : 0;
      const monthNum = parseInt(lm.month.split('-')[1]);
      monthly.push({
        label: lm.month, month: monthNum + '月',
        进线: lm.leads_inbound,
        转出: lm.leads_transferred, 认领: lm.leads_claimed,
        转出率: transferRate, year: parseInt(lm.month.split('-')[0])
      });
    }
  });

  // 2. KPI汇总（用基线+leads增量）
  const kpiBase = monthlyBase.reduce((acc, m) => {
    acc.inbound += m.inbound; acc.valid += m.valid;
    acc.transferred += m.transferred; acc.claimed += m.claimed;
    acc.deals += m.deals; acc.won += m.won;
    return acc;
  }, {inbound:0,valid:0,transferred:0,claimed:0,deals:0,won:0});
  
  // 加leads增量（10月+）
  const leadsExtra = leadsMonthly.reduce((acc, m) => {
    acc.inbound += m.leads_inbound;
    acc.transferred += m.leads_transferred;
    acc.claimed += m.leads_claimed;
    return acc;
  }, {inbound:0,transferred:0,claimed:0});
  
  const kpi = {
    total_inbound: kpiBase.inbound + leadsExtra.inbound,
    total_transferred: kpiBase.transferred + leadsExtra.transferred,
    total_claimed: kpiBase.claimed + leadsExtra.claimed,
    total_deals: kpiBase.deals,
    total_won: kpiBase.won,
    conversion_rate: (kpiBase.inbound + leadsExtra.inbound) > 0 ? +((kpiBase.transferred + leadsExtra.transferred) / (kpiBase.inbound + leadsExtra.inbound) * 100).toFixed(1) : 0,
    claim_rate: (kpiBase.transferred + leadsExtra.transferred) > 0 ? +((kpiBase.claimed + leadsExtra.claimed) / (kpiBase.transferred + leadsExtra.transferred) * 100).toFixed(1) : 0,
  };

  // 3. CRM漏斗（去掉有效线索）
  const funnelTotal = kpi.total_inbound;
  const crmFunnel = [
    {name:'进线线索',value:funnelTotal,pct:100,color:'#3b82f6'},
    {name:'转出线索',value:kpi.total_transferred,pct:funnelTotal>0?+(kpi.total_transferred/funnelTotal*100).toFixed(1):0,color:'#8b5cf6'},
    {name:'已认领',value:kpi.total_claimed,pct:funnelTotal>0?+(kpi.total_claimed/funnelTotal*100).toFixed(1):0,color:'#10b981'},
    {name:'创建商机',value:kpi.total_deals,pct:funnelTotal>0?+(kpi.total_deals/funnelTotal*100).toFixed(2):0,color:'#f59e0b'},
    {name:'成单',value:kpi.total_won,pct:0,color:'#ec4899'},
  ];

  // 4. 渠道分布：关键词模糊归一化，不重复叠加
  const channelRows = db.prepare(`SELECT source_channel as name, COUNT(*) as count FROM leads WHERE source_channel != '' AND source_channel IS NOT NULL GROUP BY source_channel ORDER BY count DESC`).all();
  const channels = {};
  function mapChannel(raw) {
    const k = raw.trim();
    if (/微信|官微/.test(k)) return '官方微信';
    if (/400/.test(k)) return '400电话';
    if (/官网/.test(k)) return '官网';
    if (/公众号/.test(k)) return '公众号';
    if (/Octo.*体验|Octo渠道/.test(k)) return 'Octo体验';
    if (/晚点头条/.test(k)) return 'Octo·晚点头条';
    if (/EMP|培训班|国有企业领导/.test(k)) return 'EMP培训班';
    if (/混沌/.test(k)) return '混沌学园';
    if (/活动|大会|峰会|论坛|沙龙|下午茶|媒介力学|全球AI|生态.*创新|中欧|商学院|WRC|演讲|展会|展会活动/.test(k)) return '线下活动/大会';
    if (/爱投|广点通|广告投放|投放代运营/.test(k)) return '广告投放/爱投';
    if (/人脉|推荐|转介|引荐/.test(k)) return '人脉/推荐';
    if (/视频号/.test(k)) return '视频号';
    if (/其他|未知|待确认/.test(k)) return '其他/待确认';
    return k;
  }
  channelRows.forEach(r => {
    const key = mapChannel(r.name);
    channels[key] = (channels[key] || 0) + r.count;
  });
  // 只取TOP12渠道，其余归为"其他"
  const sortedCh = Object.entries(channels).sort((a,b) => b[1]-a[1]);
  const channelsFinal = {};
  let otherSum = 0;
  sortedCh.forEach(([k,v], i) => {
    if (i < 12) channelsFinal[k] = v;
    else otherSum += v;
  });
  if (otherSum > 0) channelsFinal['其他'] = (channelsFinal['其他']||0) + otherSum;

  // 5. 产品分布（转出线索qualified+），关键词模糊归一化
  const productRows = db.prepare(`SELECT product as name, COUNT(*) as count FROM leads WHERE product != '' AND product IS NOT NULL AND status IN ('qualified','opportunity','closed_won') GROUP BY product ORDER BY count DESC`).all();
  const products = {};
  function mapProduct(raw) {
    const p = raw.trim();
    // 按优先级匹配（更具体的规则放前面）
    if (/灵听|工牌|会话智能|语音质检/.test(p)) return '灵听工牌/会话智能';
    if (/GEO|SEO|搜索优化|搜索占位/.test(p)) return 'GEO';
    if (/魔方|Social (Grow|Studio|X)|社媒|social/i.test(p)) return '魔方Pro/Social';
    if (/知识图谱|悦点|CDC|数据治理|数据标注/.test(p)) return '知识图谱';
    if (/广告监测|AdMonitor|AdEff|Media Studio|CPM|秒针广告|户外监测|广告投放|Admonitor/.test(p)) return '广告监测/投放';
    if (/DeepMiner|Deepminer|deepminer|明胜品智|营食|盟食|愚公|摄像头|明店|明奇|电话分流/.test(p)) return 'DeepMiner/明胜品智';
    if (/Dify|dify|Agent|智能体|Octo\/企业AI|OCTO|AI平台|AI搭建|Octo/.test(p)) return 'Dify/Agent/Octo';
    if (/CDP|DMP|MA|SCRM|微伴|企微聚合/.test(p)) return 'CDP+MA/DMP';
    if (/AIGC|AI内容|AI数字人|短视频|Adeff|DOMO|多谋|妙啊/.test(p)) return 'AIGC/DOMO';
    if (/AI营销|营销服务|营销增长|营销全案|营销矩阵|营销智能|全域运营|KOS|KOL/.test(p)) return 'AI营销/营销服务';
    if (/微伴|SCRM/.test(p)) return '微伴助手';
    if (/调研|报告|Media Studio|消费趋势|数据分析|舆情/.test(p)) return '调研/舆情/数据分析';
    if (/MixReach|MMM|营销混合/.test(p)) return 'MixReach/MMM';
    return '其他';
  }
  productRows.forEach(r => {
    const mapped = mapProduct(r.name);
    products[mapped] = (products[mapped] || 0) + r.count;
  });
  // 排序并取TOP10
  const sortedProd = Object.entries(products).sort((a,b) => b[1]-a[1]);
  const productsFinal = {};
  let prodOther = 0;
  sortedProd.forEach(([k,v], i) => {
    if (i < 10) productsFinal[k] = v;
    else prodOther += v;
  });
  if (prodOther > 0) productsFinal['其他'] = (productsFinal['其他']||0) + prodOther;

  // 6. 团队分布，关键词模糊归一化
  const teamRows = db.prepare(`SELECT team as name, COUNT(*) as count FROM leads WHERE team != '' AND team IS NOT NULL GROUP BY team ORDER BY count DESC`).all();
  const teams = {};
  function mapTeam(raw) {
    const t = raw.trim();
    if (/华东1|华东一/.test(t)) return '华东一区';
    if (/华东2|华东二/.test(t)) return '华东二区';
    if (/华南/.test(t)) return '华南';
    if (/华北/.test(t)) return '华北';
    if (/渠道/.test(t)) return '渠道';
    if (/营销生态|效能|齐冬博/.test(t)) return '营销生态/效能';
    if (/会话智能|灵听|李金龙|神盾/.test(t)) return '会话智能';
    if (/港澳/.test(t)) return '港澳';
    if (/明胜品智|夜莺|伍晓聪|悦点|尤旸|知识图谱/.test(t)) return '明胜品智/悦点';
    if (/海外/.test(t)) return '海外';
    if (/全国/.test(t)) return '全国线索池';
    return t;
  }
  teamRows.forEach(r => {
    const mapped = mapTeam(r.name);
    teams[mapped] = (teams[mapped] || 0) + r.count;
  });
  // TOP10团队
  const sortedTeam = Object.entries(teams).sort((a,b) => b[1]-a[1]);
  const teamsFinal = {};
  let teamOther = 0;
  sortedTeam.forEach(([k,v], i) => {
    if (i < 10) teamsFinal[k] = v;
    else teamOther += v;
  });
  if (teamOther > 0) teamsFinal['其他'] = (teamsFinal['其他']||0) + teamOther;

  // 7. 销售承接Top10（全部转出线索口径，非仅最近20条）
  const salesRows = db.prepare(`
    SELECT assigned_to as name, COUNT(*) as count FROM leads
    WHERE status IN ('qualified','opportunity','closed_won','transferred','已转出')
      AND assigned_to IS NOT NULL AND assigned_to != ''
    GROUP BY assigned_to ORDER BY count DESC LIMIT 10`).all();
  const salesTop = {};
  salesRows.forEach(r => { salesTop[r.name] = r.count; });

  // 8. 最近转出线索（从leads表查，优先有transfer_date的qualified+）
  let recentLeads = db.prepare(`SELECT transfer_date as date, company_name as company, product, source_channel as source, assigned_to as sales, team as dept, status
    FROM leads WHERE status IN ('qualified','opportunity','closed_won') AND transfer_date != ''
    ORDER BY transfer_date DESC, created_at DESC LIMIT 20`).all();
  
  // 如果leads表中转出线索不足20条，补充基线最近线索
  if (recentLeads.length < 20) {
    const baseRecent = [
      {date:"2026-09-30",company:"无限极有限公司",product:"魔方Pro",source:"官方微信",sales:"李君贤",dept:"华南",status:"已转出"},
      {date:"2026-09-30",company:"通辽市双舟食品有限公司",product:"灵听工牌/会话智能",source:"400电话",sales:"李金龙",dept:"会话智能",status:"已转出"},
      {date:"2026-09-29",company:"华侨银行OCBC",product:"魔方Pro",source:"官方微信",sales:"K姐（海外市场）",dept:"海外",status:"已转出"},
      {date:"2026-09-29",company:"华硕电脑有限公司",product:"灵听工牌/会话智能",source:"官方微信",sales:"李金龙",dept:"会话智能",status:"已转出"},
      {date:"2026-09-29",company:"杭州京川品牌管理有限公司",product:"灵听工牌/会话智能",source:"官方微信",sales:"李金龙",dept:"会话智能",status:"已转出"},
      {date:"2026-09-29",company:"新大洲本田摩托有限公司",product:"GEO",source:"官方微信",sales:"张弦",dept:"华东1区",status:"已转出"},
      {date:"2026-09-29",company:"山西汉茗唐品牌文化有限公司",product:"AI营销/营销服务",source:"400电话",sales:"于颖",dept:"华北",status:"已转出"},
      {date:"2026-09-29",company:"上海元纬信息技术有限公司",product:"GEO",source:"官方微信",sales:"张弦",dept:"华东1区",status:"已转出"},
      {date:"2026-09-29",company:"深圳市力驰多汽车技术服务有限公司",product:"微伴助手",source:"400电话",sales:"伍晓聪",dept:"夜莺线",status:"已转出"},
      {date:"2026-09-28",company:"深圳市豪恩汽车电子装备股份有限公司",product:"Octo/企业AI",source:"官方微信",sales:"王佼佼",dept:"华东1区",status:"已转出"},
      {date:"2026-09-25",company:"北京值得买科技股份有限公司",product:"广告监测",source:"400电话",sales:"齐冬博",dept:"营销生态",status:"已转出"},
      {date:"2026-09-25",company:"北京辰光融信技术有限公司",product:"GEO",source:"400电话",sales:"白新明",dept:"华北",status:"已转出"},
      {date:"2026-09-25",company:"北京车网科技发展有限公司",product:"知识图谱",source:"400电话",sales:"尤旸",dept:"悦点科技",status:"已转出"},
      {date:"2026-09-25",company:"深圳市英菲克电子有限公司",product:"AI营销/营销服务",source:"明略官网",sales:"李超",dept:"华南",status:"已转出"},
      {date:"2026-09-25",company:"旺火创科科技有限公司",product:"灵听工牌/会话智能",source:"其他渠道",sales:"李金龙",dept:"会话智能",status:"已转出"},
      {date:"2026-09-25",company:"杭州蜜鹞新媒体科技有限公司",product:"GEO",source:"其他",sales:"Stanley(谈仁君)",dept:"华东2区",status:"已转出"},
      {date:"2026-09-25",company:"深圳市微蓝医疗科技有限公司",product:"微伴助手",source:"大鹏渠道转介",sales:"伍晓聪",dept:"夜莺线",status:"已转出"},
      {date:"2026-09-25",company:"湖南省基层医疗科技有限公司",product:"其他",source:"400电话",sales:"伍晓聪",dept:"夜莺线",status:"已转出"},
      {date:"2026-09-25",company:"上海信天通信有限公司",product:"GEO",source:"明略公众号",sales:"张弦",dept:"华东1区",status:"已转出"},
      {date:"2026-09-25",company:"河南泰丰生物科技有限公司",product:"广告监测",source:"400电话",sales:"Stanley(谈仁君)",dept:"华东2区",status:"已转出"},
    ];
    const existingDates = new Set(recentLeads.map(r => r.date + r.company));
    for (const r of baseRecent) {
      if (recentLeads.length >= 20) break;
      if (!existingDates.has(r.date + r.company)) recentLeads.push(r);
    }
  }

  // 数据截止日期
  const latestMonth = monthly.length > 0 ? monthly[monthly.length - 1] : null;
  const dataDate = latestMonth ? latestMonth.label + '（实时）' : '2026-09-30';

  res.json({
    kpis: kpi,
    monthly,
    channels: channelsFinal,
    products: productsFinal,
    teams: teamsFinal,
    crmFunnel,
    salesTop,
    recentLeads,
    dataDate
  });
});

// ===== SDR月度统计CRUD（千寻录完线索后自动更新）=====
app.post('/api/sdr/monthly', (req, res) => {
  const { month, inbound, valid, transferred, claimed, deals, won } = req.body;
  if (!month) return res.status(400).json({error:'月份不能为空'});
  const existing = db.prepare('SELECT id FROM sdr_monthly_stats WHERE month = ?').get(month);
  if (existing) {
    db.prepare(`UPDATE sdr_monthly_stats SET inbound=@inbound, valid=@valid, transferred=@transferred, claimed=@claimed, deals=@deals, won=@won, updated_at=datetime('now','localtime') WHERE month=@month`)
      .run({month, inbound:inbound||0, valid:valid||0, transferred:transferred||0, claimed:claimed||0, deals:deals||0, won:won||0});
  } else {
    db.prepare(`INSERT INTO sdr_monthly_stats (month, inbound, valid, transferred, claimed, deals, won) VALUES (@month, @inbound, @valid, @transferred, @claimed, @deals, @won)`)
      .run({month, inbound:inbound||0, valid:valid||0, transferred:transferred||0, claimed:claimed||0, deals:deals||0, won:won||0});
  }
  res.json({message:'月度统计已更新', month});
});

// 录线索后自动递增当月inbound计数器
app.post('/api/sdr/count-inbound', (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({error:'月份不能为空'});
  const m = month.substring(0,7); // YYYY-MM
  const existing = db.prepare('SELECT id FROM sdr_monthly_stats WHERE month = ?').get(m);
  if (existing) {
    db.prepare(`UPDATE sdr_monthly_stats SET inbound = inbound + 1, valid = valid + 1, updated_at=datetime('now','localtime') WHERE month = ?`).run(m);
  } else {
    db.prepare(`INSERT INTO sdr_monthly_stats (month, inbound, valid, transferred, claimed) VALUES (?, 1, 1, 0, 0)`).run(m);
  }
  res.json({message:'进线计数+1', month:m});
});

app.post('/api/sdr/count-transfer', (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({error:'月份不能为空'});
  const m = month.substring(0,7);
  const existing = db.prepare('SELECT id FROM sdr_monthly_stats WHERE month = ?').get(m);
  if (existing) {
    db.prepare(`UPDATE sdr_monthly_stats SET transferred = transferred + 1, claimed = claimed + 1, updated_at=datetime('now','localtime') WHERE month = ?`).run(m);
  } else {
    db.prepare(`INSERT INTO sdr_monthly_stats (month, inbound, valid, transferred, claimed) VALUES (?, 0, 0, 1, 1)`).run(m);
  }
  res.json({message:'转出计数+1', month:m});
});

// ===== 市场营销活动获客板块路由 =====
setMarketingCampaignRoutes(app, db);

// ===== SDR Dashboard 看板页面（iframe嵌入用，线索转化→数据看板tab）=====
// /funnel-view: serve the source-of-truth dashboard file at project root
// (dist/ is wiped by vite build; keep the real file outside dist)
app.get('/funnel-view', (req, res) => {
  res.sendFile(join(__dirname, 'sdr-dashboard.html'));
});

// SDR看板单独路由
app.get('/sdr-dashboard-view', (req, res) => {
  res.sendFile(join(__dirname, 'sdr-dashboard.html'));
});

// ===== SPA fallback（必须在 API 路由之后）=====
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) res.sendFile(join(__dirname, 'dist', 'index.html'));
  else res.status(404).json({ error: 'Not found' });
});

// ===== Start Server =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MKT-CRM 工作台运行在 http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api/stats`);
});
