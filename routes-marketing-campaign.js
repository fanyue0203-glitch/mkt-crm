// ===== 市场营销活动获客 API（/api/marketing-campaign/*）=====
// 数据源：marketing_campaign_leads（401条，搭子君 2026-10-27 交付）
// 设计原则：不新增二级标签表，二级明细全部由 collect 值实时聚合

const TAG_DIMS = [
  { key: 'industry_group', label: '行业大类', field: 'industry_group', second: 'industry_raw', color: '#3b82f6' },
  { key: 'source_type', label: '内容来源', field: 'source_type', second: 'campaign_name', color: '#10b981' },
  { key: 'product_interest', label: '意向产品线', field: 'product_interest', second: null, color: '#8b5cf6', multi: true },
  { key: 'region', label: '地域大区', field: 'province', second: 'city', color: '#f59e0b', region: true },
  { key: 'month', label: '获客时段', field: 'created_date', second: null, color: '#db2777', month: true },
  { key: 'customer_type', label: '客户类型', field: 'customer_type', second: null, color: '#0891b2' },
];

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __mcDir = dirname(fileURLToPath(import.meta.url));
const CHANNELS = JSON.parse(readFileSync(join(__mcDir, 'scripts', 'campaign_channels.json'), 'utf8'));

export default function setMarketingCampaignRoutes(app, db) {

function mclRows() {
  return db.prepare('SELECT * FROM marketing_campaign_leads').all();
}

// 月份解析：从 created_date 原值提取
function mclParseMonth(s = '', fallback = '') {
  const m = String(s).match(/(20\d{2})\D+(\d{1,2})/);
  if (!m) return fallback || '未知';
  return `${m[1]}-${String(m[2]).padStart(2, '0')}`;
}

function mclRegionOf(province = '') {
  const p = String(province || '').replace(/省|市|壮族自治区|维吾尔自治区|回族自治区|自治区|特别行政区/g, '');
  if (!p) return '未填写';
  if (['上海', '江苏', '浙江', '安徽', '山东', '江西', '福建'].some(x => p.includes(x))) return '华东';
  if (['北京', '天津', '河北', '山西', '内蒙古'].some(x => p.includes(x))) return '华北';
  if (['广东', '广西', '海南', '香港', '澳门'].some(x => p.includes(x))) return '华南';
  if (['湖北', '湖南', '河南'].some(x => p.includes(x))) return '华中';
  if (['四川', '重庆', '云南', '贵州', '西藏'].some(x => p.includes(x))) return '西南';
  if (['辽宁', '吉林', '黑龙江'].some(x => p.includes(x))) return '东北';
  if (['陕西', '甘肃', '青海', '宁夏', '新疆'].some(x => p.includes(x))) return '西北';
  return '其他';
}

// 单行 → 标签采集值（每个维度返回数组，产品线多值）
function mclTagValues(row) {
  const out = {};
  for (const d of TAG_DIMS) {
    if (d.multi) out[d.key] = String(row[d.field] || '').split('|').map(s => s.trim()).filter(Boolean);
    else if (d.region) out[d.key] = [mclRegionOf(row.province)];
    else if (d.month) out[d.key] = [mclParseMonth(row.created_date)];
    else out[d.key] = [row[d.field] || '未分类'];
  }
  return out;
}

function mclSecondValue(row, dim) {
  if (!dim.second) {
    // 产品线多值 / 月份：二级用自身
    if (dim.multi) return String(row[dim.field] || '').split('|').map(s => s.trim()).filter(Boolean)[0] || '';
    if (dim.month) return mclParseMonth(row.created_date);
    return '';
  }
  if (dim.region) return row.city || '未填写';
  return row[dim.second] || '未分类';
}

// ===== 1. 标签全景 =====
app.get('/api/marketing-campaign/overview', (req, res) => {
  try {
    const rows = mclRows();
    const total = rows.length;

    const dims = TAG_DIMS.map(d => {
      const map = new Map(); // value -> { count, children: Map }
      for (const row of rows) {
        const vals = mclTagValues(row)[d.key];
        const sec = mclSecondValue(row, d);
        for (const v of vals) {
          if (!map.has(v)) map.set(v, { value: v, count: 0, children: new Map() });
          const node = map.get(v);
          node.count++;
          if (d.second && sec) {
            node.children.set(sec, (node.children.get(sec) || 0) + 1);
          }
        }
      }
      const items = [...map.values()]
        .sort((a, b) => b.count - a.count)
        .map(n => ({
          value: n.value,
          count: n.count,
          pct: total ? +(n.count / total * 100).toFixed(1) : 0,
          children: n.children.size
            ? [...n.children.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([v, c]) => ({ value: v, count: c }))
            : null,
        }));
      return { key: d.key, label: d.label, color: d.color, distinct: items.length, items };
    });

    // 核心指标
    const months = rows.map(r => mclParseMonth(r.created_date)).filter(m => m !== '未知').sort();
    const products = {};
    const sources = {};
    for (const r of rows) {
      String(r.product_interest || '').split('|').map(s => s.trim()).filter(Boolean).forEach(p => { products[p] = (products[p] || 0) + 1; });
      sources[r.source_type || '未分类'] = (sources[r.source_type || '未分类'] || 0) + 1;
    }
    const topProduct = Object.entries(products).sort((a, b) => b[1] - a[1])[0];
    const topSource = Object.entries(sources).sort((a, b) => b[1] - a[1])[0];
    const companyCount = new Set(rows.map(r => r.company_name)).size;
    const cityCount = new Set(rows.map(r => r.city).filter(Boolean)).size;
    const provinces = new Set(rows.map(r => r.province).filter(Boolean)).size;

    res.json({
      total,
      stats: {
        total,
        company: companyCount,
        city: cityCount,
        province: provinces,
        monthSpan: months.length ? `${months[0]} ~ ${months[months.length - 1]}` : '—',
        topProduct: topProduct ? { name: topProduct[0], count: topProduct[1] } : null,
        topSource: topSource ? { name: topSource[0], count: topSource[1] } : null,
        registrars: new Set(rows.map(r => r.registrar).filter(Boolean)).size,
      },
      dims,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 2. 线索列表（服务端筛选 + 分页）=====
app.get('/api/marketing-campaign/leads', (req, res) => {
  try {
    const { industry_group, source_type, product, campaign, province, city, region, month, q, registrar, customer_type, page = 1, size = 20, sort = 'created_date', dir = 'desc' } = req.query;
    let rows = mclRows();

    if (industry_group) rows = rows.filter(r => r.industry_group === industry_group);
    if (source_type) rows = rows.filter(r => r.source_type === source_type);
    if (campaign) rows = rows.filter(r => r.campaign_name === campaign);
    if (product) rows = rows.filter(r => String(r.product_interest || '').split('|').map(s => s.trim()).includes(product));
    if (province) rows = rows.filter(r => r.province === province);
    if (city) rows = rows.filter(r => r.city === city);
    if (region) rows = rows.filter(r => mclRegionOf(r.province) === region);
    if (month) rows = rows.filter(r => mclParseMonth(r.created_date) === month);
    if (registrar) rows = rows.filter(r => r.registrar === registrar);
    if (customer_type) rows = rows.filter(r => r.customer_type === customer_type);
    if (q) {
      const s = String(q).toLowerCase();
      rows = rows.filter(r => ['company_name', 'contact_name', 'needs_text', 'campaign_name', 'phone', 'city', 'industry_raw']
        .some(k => String(r[k] || '').toLowerCase().includes(s)));
    }

    // 排序：日期用解析后的 month 排，其余字符串
    const sortDir = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (sort === 'created_date') return (mclParseMonth(a.created_date).localeCompare(mclParseMonth(b.created_date))) * sortDir || (a.id - b.id) * sortDir;
      return String(a[sort] || '').localeCompare(String(b[sort] || ''), 'zh') * sortDir;
    });

    const total = rows.length;
    const p = Math.max(1, +page), sz = Math.min(200, Math.max(1, +size));
    const data = rows.slice((p - 1) * sz, p * sz).map(r => ({ ...r, region: mclRegionOf(r.province), month: mclParseMonth(r.created_date) }));
    res.json({ total, page: p, size: sz, pages: Math.ceil(total / sz) || 1, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 3. 筛选选项 =====
app.get('/api/marketing-campaign/options', (req, res) => {
  try {
    const rows = mclRows();
    const uniq = (fn) => [...new Set(rows.flatMap(fn).filter(Boolean))].sort();
    res.json({
      industry_group: uniq(r => [r.industry_group]),
      source_type: uniq(r => [r.source_type]),
      campaign_name: uniq(r => [r.campaign_name]),
      product_interest: uniq(r => String(r.product_interest || '').split('|').map(s => s.trim())),
      province: uniq(r => [r.province]),
      city: uniq(r => [r.city]),
      registrar: uniq(r => [r.registrar]),
      customer_type: uniq(r => [r.customer_type]),
      month: uniq(r => [mclParseMonth(r.created_date)]).sort(),
      region: uniq(r => [mclRegionOf(r.province)]),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 4. 交叉分析 =====
app.get('/api/marketing-campaign/cross', (req, res) => {
  try {
    const rowDim = req.query.row || 'industry_group';
    const colDim = req.query.col || 'source_type';
    const rowDef = TAG_DIMS.find(d => d.key === rowDim);
    const colDef = TAG_DIMS.find(d => d.key === colDim);
    if (!rowDef || !colDef) return res.status(400).json({ error: '维度不存在' });

    const rows = mclRows();
    const matrix = new Map();
    const rowSums = new Map(), colSums = new Map();
    for (const r of rows) {
      for (const rv of mclTagValues(r)[rowDim]) {
        for (const cv of mclTagValues(r)[colDim]) {
          const k = rv + '\u0001' + cv;
          matrix.set(k, (matrix.get(k) || 0) + 1);
          rowSums.set(rv, (rowSums.get(rv) || 0) + 1);
          colSums.set(cv, (colSums.get(cv) || 0) + 1);
        }
      }
    }
    const rowVals = [...rowSums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
    const colVals = [...colSums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
    const cells = [];
    for (const rv of rowVals) for (const cv of colVals) cells.push({ row: rv, col: cv, count: matrix.get(rv + '\u0001' + cv) || 0 });

    // 洞察：最强的组合（计数最高且列内集中度高的3个）
    const insights = cells.filter(c => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 3).map(c => ({
      ...c,
      rowPct: +(c.count / (rowSums.get(c.row) || 1) * 100).toFixed(1),
      colPct: +(c.count / (colSums.get(c.col) || 1) * 100).toFixed(1),
    }));

    res.json({
      rowDim: { key: rowDef.key, label: rowDef.label },
      colDim: { key: colDef.key, label: colDef.label },
      rows: rowVals.map(v => ({ value: v, total: rowSums.get(v) })),
      cols: colVals.map(v => ({ value: v, total: colSums.get(v) })),
      cells, insights,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 5. 趋势 =====
app.get('/api/marketing-campaign/trend', (req, res) => {
  try {
    const rows = mclRows();
    const months = new Map(), byMonthSource = new Map();
    for (const r of rows) {
      const m = mclParseMonth(r.created_date);
      months.set(m, (months.get(m) || 0) + 1);
      const k = m + '\u0001' + (r.source_type || '未分类');
      byMonthSource.set(k, (byMonthSource.get(k) || 0) + 1);
    }
    const labels = [...months.keys()].sort();
    res.json({
      labels,
      total: labels.map(m => months.get(m)),
      bySource: Object.fromEntries([...new Set(rows.map(r => r.source_type || '未分类'))].map(s => [s, labels.map(m => byMonthSource.get(m + '\u0001' + s) || 0)])),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 6. 单条详情 =====
app.get('/api/marketing-campaign/leads/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM marketing_campaign_leads WHERE id = ?').get(+req.params.id);
  if (!row) return res.status(404).json({ error: '不存在' });
  const history = db.prepare("SELECT * FROM edit_history WHERE table_name = 'marketing_campaign_leads' AND record_id = ? ORDER BY edited_at DESC LIMIT 50").all(+req.params.id);
  res.json({ ...row, region: mclRegionOf(row.province), month: mclParseMonth(row.created_date), history });
});

// ===== 7. 编辑（标签人工修正 + 留痕）=====
app.put('/api/marketing-campaign/leads/:id', (req, res) => {
  try {
    const id = +req.params.id;
    const old = db.prepare('SELECT * FROM marketing_campaign_leads WHERE id = ?').get(id);
    if (!old) return res.status(404).json({ error: '不存在' });
    const ALLOW = ['industry_group', 'product_interest', 'source_type', 'customer_type', 'campaign_name', 'industry_raw', 'needs_text', 'province', 'city', 'registrar', 'phone', 'contact_name', 'company_name'];
    const body = {};
    for (const k of ALLOW) if (k in req.body) body[k] = req.body[k];
    if (!Object.keys(body).length) return res.status(400).json({ error: '无可更新字段' });
    const sets = Object.keys(body).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE marketing_campaign_leads SET ${sets}, updated_at = datetime('now','localtime') WHERE id = @id`).run({ ...body, id });
    // 留痕
    const ins = db.prepare('INSERT INTO edit_history (table_name, record_id, field_name, old_value, new_value, edited_by) VALUES (?,?,?,?,?,?)');
    for (const k of Object.keys(body)) {
      if (String(old[k] ?? '') !== String(body[k] ?? '')) ins.run('marketing_campaign_leads', id, k, String(old[k] ?? ''), String(body[k] ?? ''), req.body._editor || '千寻');
    }
    const updated = db.prepare('SELECT * FROM marketing_campaign_leads WHERE id = ?').get(id);
    res.json({ ok: true, data: { ...updated, region: mclRegionOf(updated.province), month: mclParseMonth(updated.created_date) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 8. 新增线索 =====
app.post('/api/marketing-campaign/leads', (req, res) => {
  try {
    const b = req.body || {};
    if (!b.contact_name || !b.company_name) return res.status(400).json({ error: '姓名和企业简称为必填' });
    const today = new Date();
    const created_date = b.created_date || `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    const row = {
      created_date,
      industry_raw: b.industry_raw || '',
      contact_name: b.contact_name,
      company_name: b.company_name,
      needs_text: b.needs_text || '',
      campaign_name: b.campaign_name || '',
      registrar: b.registrar || '',
      phone: b.phone || '',
      province: b.province || '',
      city: b.city || '',
      industry_group: b.industry_group || '',
      product_interest: b.product_interest || '',
      source_type: b.source_type || '',
      customer_type: b.customer_type || b.industry_raw || '',
    };
    const info = db.prepare(`INSERT INTO marketing_campaign_leads
      (created_date, industry_raw, contact_name, company_name, needs_text, campaign_name, registrar, phone, province, city, industry_group, product_interest, source_type, customer_type)
      VALUES (@created_date,@industry_raw,@contact_name,@company_name,@needs_text,@campaign_name,@registrar,@phone,@province,@city,@industry_group,@product_interest,@source_type,@customer_type)`).run(row);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: '该「联系方式+企业简称」已存在' });
    res.status(500).json({ error: e.message });
  }
});

// ===== v2.0 新增接口（PRD v2.0 第七节）=====
// 统一口径：R1-R8，产品线按 | 拆分后计数；未标注单列不丢弃

// 产品固定顺序（降序，颜色固定）
const MC_PRODUCTS = ['消费者洞察', '种草/DOMO', 'GEO', 'AI/大模型', '广告监测', '出海营销'];
const MC_PRODUCT_COLORS = {
  '消费者洞察': '#8b5cf6',
  '种草/DOMO': '#6366f1',
  'GEO': '#3b82f6',
  'AI/大模型': '#06b6d4',
  '广告监测': '#f59e0b',
  '出海营销': '#ec4899',
};

function mcSplitProducts(row) {
  const v = String(row.product_interest || '').trim();
  if (!v) return [];
  return [...new Set(v.split('|').map(s => s.trim()).filter(Boolean))];
}

// 全局基数（每次请求实时算，403 行代价可忽略）
function mcBase() {
  const rows = mclRows();
  let mention = 0, blank = 0, multi = 0;
  for (const r of rows) {
    const ps = mcSplitProducts(r);
    if (!ps.length) blank++;
    else { mention += ps.length; if (ps.length > 1) multi++; }
  }
  return { rows, total: rows.length, mention, blank, multi, labeled: rows.length - blank };
}

// 客户类型 55 细类 → 大类归并（PRD 附录 C）
function mcCustomerTypeGroup(t = '') {
  const s = String(t || '').trim();
  if (!s) return '未填写';
  if (s.startsWith('快速消费品')) return '快消';
  if (s.includes('服务代理商')) return '服务代理商';
  if (s.startsWith('互联网与技术')) return '互联网技术';
  if (s.includes('制药') || s.includes('药品')) return '医药';
  if (s.startsWith('零售')) return '零售';
  if (s.startsWith('休闲娱乐')) return '休闲娱乐';
  if (s.startsWith('消费电子')) return '消费电子';
  if (s.includes('汽车')) return '汽车';
  if (s.includes('教育')) return '教育服务';
  if (s.startsWith('家居装饰') || s.startsWith('家居')) return '家居';
  if (s.includes('房地产')) return '房地产';
  if (s.includes('个人')) return '个人';
  if (s.includes('餐饮')) return '餐饮';
  if (s.includes('金融')) return '金融';
  return s;
}

// ===== 10. KPI（模块 4.0）=====
app.get('/api/marketing-campaign/kpi', (req, res) => {
  try {
    const b = mcBase();
    const prodCnt = {};
    for (const p of MC_PRODUCTS) prodCnt[p] = 0;
    for (const r of b.rows) for (const p of mcSplitProducts(r)) if (p in prodCnt) prodCnt[p]++;
    const top1 = Object.entries(prodCnt).sort((a, c) => c[1] - a[1])[0];
    const industries = new Set(b.rows.map(r => r.industry_group).filter(Boolean));

    // Top8 行业覆盖线索数
    const indCnt = {};
    for (const r of b.rows) if (r.industry_group) indCnt[r.industry_group] = (indCnt[r.industry_group] || 0) + 1;
    const indSorted = Object.entries(indCnt).sort((a, c) => c[1] - a[1]);
    const topInd = indSorted[0];
    const top8 = indSorted.slice(0, 8);
    const top8Leads = top8.reduce((s, [, c]) => s + c, 0);

    res.json({
      cards: [
        { key: 'total', label: '线索总量', value: b.total, color: 'blue', action: 'all' },
        { key: 'topProduct', label: '产品需求 Top1', value: top1 ? top1[1] : 0, name: top1 ? top1[0] : '', color: 'purple', action: 'product' },
        { key: 'industries', label: '覆盖行业数', value: industries.size, sub: `Top8 覆盖 ${(top8Leads / b.total * 100).toFixed(1)}%`, color: 'cyan', action: 'tags' },
        { key: 'topIndustry', label: '行业需求 Top1', value: topInd ? topInd[1] : 0, name: topInd ? topInd[0] : '', sub: topInd ? `占全量 ${(topInd[1] / b.total * 100).toFixed(1)}%` : '', color: 'green', action: 'tags' },
      ],
      check: {
        total: b.total, labeled: b.labeled, blank: b.blank,
        mention: b.mention, multi: b.multi,
        formula: `${b.total} = ${b.labeled}(已标注) + ${b.blank}(未标注)`,
        formula2: `${b.mention} ≥ ${b.labeled}`,
        coverage: +(b.labeled / b.total * 100).toFixed(1),
      },
      meta: {
        denominator: { mention: b.mention, labeled: b.labeled, total: b.total },
        note: '测试口径 R1-R8：产品线按 | 拆分计数，未标注单列不丢弃',
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 11. 模块 A 产品需求占比 =====
app.get('/api/marketing-campaign/product-share', (req, res) => {
  try {
    const b = mcBase();
    const cnt = {};
    const rowsByProduct = {};
    for (const p of MC_PRODUCTS) { cnt[p] = 0; rowsByProduct[p] = []; }
    for (const r of b.rows) {
      for (const p of mcSplitProducts(r)) {
        if (p in cnt) { cnt[p]++; rowsByProduct[p].push(r.id); }
      }
    }
    // 行业分布数（给 tooltip 用）
    const indByProduct = {};
    for (const p of MC_PRODUCTS) {
      indByProduct[p] = new Set(b.rows.filter(r => mcSplitProducts(r).includes(p)).map(r => r.industry_group).filter(Boolean)).size;
    }

    const items = MC_PRODUCTS.map(p => ({
      product: p,
      color: MC_PRODUCT_COLORS[p],
      mention: cnt[p],
      pctMention: +(cnt[p] / b.mention * 100).toFixed(1),
      pctLead: +(cnt[p] / b.labeled * 100).toFixed(1),
      industrySpread: indByProduct[p],
    }));

    res.json({
      items,
      longTail: items.slice(4).map(i => i.product),
      meta: {
        denominator: { mention: b.mention, labeled: b.labeled },
        note: `提及占比分母=${b.mention}（多值拆分后总提及）｜线索渗透分母=${b.labeled}（有产品标注的线索）`,
        caution: '禁止以 403 为分母，否则多值线索被重复计入分母',
      },
      check: { mentionSum: items.reduce((s, i) => s + i.mention, 0) },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 12. 模块 B 行业 × 产品热力矩阵 =====
app.get('/api/marketing-campaign/matrix', (req, res) => {
  try {
    const topN = Math.max(1, Math.min(15, +(req.query.topN || 8)));
    const b = mcBase();

    const indCnt = {};
    for (const r of b.rows) if (r.industry_group) indCnt[r.industry_group] = (indCnt[r.industry_group] || 0) + 1;
    const sorted = Object.entries(indCnt).sort((a, c) => c[1] - a[1]);
    const topRows = sorted.slice(0, topN).map(([k]) => k);
    const restRows = sorted.slice(topN).map(([k]) => k);

    const cell = (rows, p) => rows.filter(r => mcSplitProducts(r).includes(p)).length;

    const groups = topRows.map(k => ({ industry: k, leads: indCnt[k], isOther: false }));
    if (restRows.length) {
      groups.push({
        industry: `其他 ${restRows.length} 类行业`,
        leads: restRows.reduce((s, [, c]) => s + c, 0),
        isOther: true,
        members: restRows,
      });
    }
    // 注：restRows 为字符串数组（map([k]) => k），此处仅存行业名

    const rows = groups.map(g => {
      const src = g.isOther ? b.rows.filter(r => restRows.includes(r.industry_group)) : b.rows.filter(r => r.industry_group === g.industry);
      const cells = {};
      for (const p of MC_PRODUCTS) cells[p] = cell(src, p);
      return { ...g, cells, rowTotal: Object.values(cells).reduce((s, v) => s + v, 0) };
    });

    const colTotals = {};
    const colMax = {};
    // 按列归一的 max 只取 Top8 行（不含第9行「其他11类」），符合 PRD 决策2
    const top8Rows = rows.filter(r => !r.isOther);
    for (const p of MC_PRODUCTS) {
      colTotals[p] = rows.reduce((s, r) => s + r.cells[p], 0);
      colMax[p] = Math.max(...top8Rows.map(r => r.cells[p]), 0);
    }
    const grandTotal = Object.values(colTotals).reduce((s, v) => s + v, 0);
    const globalMax = Math.max(...Object.values(colMax), 0);

    // 行占比 / 列占比（供 tooltip 三元组）
    const detail = {};
    for (const r of rows) {
      detail[r.industry] = {};
      for (const p of MC_PRODUCTS) {
        const v = r.cells[p];
        detail[r.industry][p] = {
          n: v,
          ofRow: r.leads ? +(v / r.leads * 100).toFixed(0) : 0,
          ofCol: colTotals[p] ? +(v / colTotals[p] * 100).toFixed(0) : 0,
        };
      }
    }

    // 自动洞察条
    let maxCell = { n: -1, industry: '', product: '' };
    for (const r of rows) for (const p of MC_PRODUCTS) if (r.cells[p] > maxCell.n) maxCell = { n: r.cells[p], industry: r.industry, product: p };
    const insight = `${maxCell.industry} × ${maxCell.product} = ${maxCell.n} 条，为全站最大单格；广告监测与出海营销需求几乎只出现在代理商体内。`;

    res.json({
      products: MC_PRODUCTS.map(p => ({ product: p, color: MC_PRODUCT_COLORS[p], max: colMax[p], total: colTotals[p] })),
      rows,
      colTotals,
      colMax,
      globalMax,
      grandTotal,
      detail,
      insight,
      meta: {
        denominator: { total: b.total, mention: b.mention, blank: b.blank },
        note: '行/列合计含多值重复计数；未标注线索不落任何格',
        colorScale: 'default=byColumn（每列独立取 max，仅Top8行）；切 global 时用 globalMax',
        colMaxScope: 'top8',
        rowTotalSum: rows.reduce((s, r) => s + r.rowTotal, 0),
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 13. 模块 C 受众 360 画像 =====
app.get('/api/marketing-campaign/persona', (req, res) => {
  try {
    const b = mcBase();
    const tally = (fn) => {
      const m = {};
      for (const r of b.rows) { const k = fn(r); if (k) m[k] = (m[k] || 0) + 1; }
      return Object.entries(m).sort((a, c) => c[1] - a[1]);
    };

    const industries = tally(r => r.industry_group);
    const customerTypes = tally(r => mcCustomerTypeGroup(r.customer_type || r.industry_raw));
    const cities = tally(r => r.city);
    const sources = tally(r => r.source_type);

    const pack = (arr, n = 5) => arr.slice(0, n).map(([value, count]) => ({
      value, count, pct: +(count / b.total * 100).toFixed(1),
    }));

    const cityTop3 = cities.slice(0, 3).reduce((s, [, c]) => s + c, 0);
    const typeTop2 = customerTypes.slice(0, 2).reduce((s, [, c]) => s + c, 0);
    const city3Pct = +(cityTop3 / b.total * 100).toFixed(1);
    const type2Pct = +(typeTop2 / b.total * 100).toFixed(1);

    const top2Ind = industries.slice(0, 2).map(([k]) => k).join('与');
    const topCity = cities.slice(0, 3).map(([k]) => k.replace(/市$/, '')).join('/');
    const topSrc = sources[0] ? sources[0][0] : '—';
    const topProd = (() => {
      const m = {};
      for (const r of b.rows) for (const p of mcSplitProducts(r)) m[p] = (m[p] || 0) + 1;
      return Object.entries(m).sort((a, c) => c[1] - a[1])[0]?.[0] || '—';
    })();

    const cityWord = city3Pct >= 40 ? `Top3 城市占 ${city3Pct}%` : `城市分布相对分散（Top3 占 ${city3Pct}%）`;
    const typeWord = type2Pct >= 40 ? `Top2 客户大类占 ${type2Pct}%` : `客户类型相对分散（Top2 占 ${type2Pct}%）`;
    const conclusion = `主力客户 = ${topCity} 的${top2Ind}；他们主要通过${topSrc}进入，最大的钱花在${topProd}。人群高度集中：${cityWord}，${typeWord}。`;

    res.json({
      dims: {
        industry: { label: '行业大类', items: pack(industries) },
        customerType: { label: '客户类型（归并大类）', items: pack(customerTypes) },
        city: { label: '地域 Top 城市', items: pack(cities) },
        source: { label: '内容来源', items: pack(sources) },
      },
      conclusion,
      meta: {
        denominator: { total: b.total },
        note: '客户类型按 PRD 附录 C 归并；结论为规则生成，不调模型',
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 14. 模块 D 内容来源 × 产品堆叠 =====
app.get('/api/marketing-campaign/source-product', (req, res) => {
  try {
    const b = mcBase();
    const SOURCE_ORDER = ['白皮书/报告下载', '官方账号', '线下活动', '其他社媒平台', '产品试用申请'];
    const srcSet = [...new Set(b.rows.map(r => r.source_type || '未分类'))];
    const order = SOURCE_ORDER.filter(s => srcSet.includes(s)).concat(srcSet.filter(s => !SOURCE_ORDER.includes(s)));

    const bars = order.map(s => {
      const rs = b.rows.filter(r => (r.source_type || '未分类') === s);
      const seg = {};
      for (const p of MC_PRODUCTS) seg[p] = rs.filter(r => mcSplitProducts(r).includes(p)).length;
      const labeledCount = rs.filter(r => mcSplitProducts(r).length > 0).length;
      return {
        source: s,
        leads: rs.length,
        labeled: labeledCount,
        blank: rs.length - labeledCount,
        segments: MC_PRODUCTS.map(p => ({ product: p, color: MC_PRODUCT_COLORS[p], count: seg[p] })),
        segTotal: Object.values(seg).reduce((a, c) => a + c, 0),
      };
    });

    const get = (s, p) => bars.find(x => x.source === s)?.segments.find(y => y.product === p)?.count || 0;
    const whitebook = bars.find(x => x.source === '白皮书/报告下载');
    const official = bars.find(x => x.source === '官方账号');
    const trial = bars.find(x => x.source === '产品试用申请');
    const offline = bars.find(x => x.source === '线下活动');
    const geoTotal = bars.reduce((s, x) => s + (x.segments.find(y => y.product === 'GEO')?.count || 0), 0);

    const insights = [
      whitebook ? `白皮书是绝对主供血：${whitebook.leads} 条里 ${get('白皮书/报告下载', '消费者洞察')} 条问消费者洞察（${Math.round(get('白皮书/报告下载', '消费者洞察') / whitebook.leads * 100)}%）。→ 想推洞察，继续押白皮书。` : '',
      official ? `官方账号是 GEO / 广告监测 / 出海营销的唯一可观供给：GEO 有 ${get('官方账号', 'GEO')}/${geoTotal || 0} 来自官方账号，这三个产品几乎不来自白皮书。→ 想推 GEO，把公众号/官网口径的内容加密度。` : '',
      trial ? `产品试用申请 ${trial.leads} 条 100% 指向种草/DOMO：试用是 DOMO 的专属漏斗。` : '',
      offline ? `线下活动（${offline.leads} 条）对产品意向贡献极小（仅 ${offline.labeled} 条有产品标注）→ 线下活动更适合做品牌触达，不适合按产品归因。` : '',
    ].filter(Boolean);

    res.json({
      products: MC_PRODUCTS.map(p => ({ product: p, color: MC_PRODUCT_COLORS[p] })),
      bars,
      insights,
      meta: {
        denominator: { total: b.total },
        note: '每根条长度=该来源总线索；分段=各产品提及数（多值可重复，段和≥条长属正常）',
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 15. 活动获客（线下活动维度总览）=====
// 按 campaign_name 聚合，每场活动一张 banner；下钻即该活动原表（复用 /leads?campaign=）
const MC_EVENT_HIGHLIGHT = {
  '2026AI·营销大会': { accent: '#7c3aed', tag: 'AI 原生', note: '2026-10-30 新进 200 条，Notion 报名表导入' },
  '2026媒介力学论坛': { accent: '#2563eb', tag: '存量', note: '2026 年 7-9 月进线' },
};

// 只统计「线下活动」来源的活动（其余为报告下载/公众号等，不属活动）
app.get('/api/marketing-campaign/events', (req, res) => {
  try {
    const rows = mclRows().filter(r => (r.source_type || '') === '线下活动' && r.campaign_name);
    const map = new Map();
    for (const r of rows) {
      const k = r.campaign_name;
      if (!map.has(k)) map.set(k, { campaign: k, leads: [], products: {}, industries: {}, months: {}, registrars: new Set() });
      const e = map.get(k);
      e.leads.push(r);
      for (const p of mcSplitProducts(r)) e.products[p] = (e.products[p] || 0) + 1;
      const ig = r.industry_group || '未分类';
      e.industries[ig] = (e.industries[ig] || 0) + 1;
      const m = mclParseMonth(r.created_date);
      if (m && m !== '未知') e.months[m] = (e.months[m] || 0) + 1;
      if (r.registrar) e.registrars.add(r.registrar);
    }
    const top = (obj, n = 3) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, count]) => ({ value, count }));
    const events = [...map.values()].map(e => {
      const hl = MC_EVENT_HIGHLIGHT[e.campaign] || {};
      const labeled = e.leads.filter(r => mcSplitProducts(r).length > 0).length;
      const sortedMonths = Object.keys(e.months).sort();
      const span = sortedMonths.length ? (sortedMonths.length === 1 ? sortedMonths[0] : `${sortedMonths[0]} ~ ${sortedMonths[sortedMonths.length - 1]}`) : '—';
      return {
        campaign: e.campaign,
        count: e.leads.length,
        labeled,
        blank: e.leads.length - labeled,
        products: top(e.products, 4),
        industryTop: top(e.industries, 3),
        monthSpan: span,
        registrars: [...e.registrars],
        sourceLabel: '线下活动',
        accent: hl.accent || '#2563eb',
        tag: hl.tag || '',
        note: hl.note || '',
      };
    }).sort((a, b) => b.count - a.count);

    res.json({
      events,
      total: rows.length,
      meta: {
        denominator: { events: events.length, leads: rows.length },
        note: '仅统计「线下活动」来源；点活动进入该活动原表（/marketing-campaign/leads?campaign=活动名）',
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// v2.0 别名：/api/campaign/* → 同一实现（PRD 第七节路径）
['kpi', 'product-share', 'matrix', 'persona', 'source-product', 'events'].forEach(name => {
  app.get(`/api/campaign/${name}`, (req, res, next) => {
    req.url = `/api/marketing-campaign/${name}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
    app._router.handle(req, res, next);
  });
});

// ===== 9. 导出 CSV =====
app.get('/api/marketing-campaign/export', (req, res) => {
  try {
    const { industry_group, source_type, product, campaign, province, region, month, q } = req.query;
    let rows = mclRows();
    if (industry_group) rows = rows.filter(r => r.industry_group === industry_group);
    if (source_type) rows = rows.filter(r => r.source_type === source_type);
    if (campaign) rows = rows.filter(r => r.campaign_name === campaign);
    if (product) rows = rows.filter(r => String(r.product_interest || '').split('|').map(s => s.trim()).includes(product));
    if (province) rows = rows.filter(r => r.province === province);
    if (region) rows = rows.filter(r => mclRegionOf(r.province) === region);
    if (month) rows = rows.filter(r => mclParseMonth(r.created_date) === month);
    if (q) { const s = String(q).toLowerCase(); rows = rows.filter(r => ['company_name', 'contact_name', 'needs_text'].some(k => String(r[k] || '').toLowerCase().includes(s))); }

    const cols = [['created_date', '创建时间'], ['industry_group', '行业_一级'], ['industry_raw', '客户所属行业'], ['contact_name', '姓名'],
      ['company_name', '企业简称'], ['needs_text', '具体合作需求'], ['campaign_name', '市场活动名称'], ['source_type', '内容来源类型'],
      ['product_interest', '意向产品线'], ['registrar', 'Leads登记人'], ['phone', '联系方式'], ['province', '省'], ['city', '市']];
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.map(c => esc(c[1])).join(',')];
    for (const r of rows) lines.push(cols.map(c => esc(r[c[0]])).join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="marketing-campaign-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + lines.join('\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// 10. 营销大会 · 报名看板（campaign_registrations + 每日快照）
// ============================================================
const REG_SOURCE_LABEL = {
  '员工邀约': '销售/员工邀约',
  '他人转介': '客户转介',
  '活动行平台': '活动行平台',
  '线上自有渠道': '线上自有渠道',
  '未标注来源': '未标注来源',
};

function regRows() {
  return db.prepare('SELECT * FROM campaign_registrations').all();
}

// 10.1 看板总数据
app.get('/api/marketing-campaign/reg-dashboard', (req, res) => {
  try {
    const target = +(req.query.target || 0) || (db.prepare(
      "SELECT target FROM campaign_reg_snapshots ORDER BY stat_date DESC LIMIT 1").get()?.target) || 900;
    const campaign = req.query.campaign || '2026 AI营销大会';
    const rows = regRows();

    const snapshots = db.prepare(
      'SELECT stat_date, stat_time, total, valid, pending, target FROM campaign_reg_snapshots WHERE campaign=? ORDER BY stat_date ASC'
    ).all(campaign);

    // ---- 总量 ----
    const total = rows.length;
    const valid = rows.filter(r => r.status === '有效票').length;
    const pending = rows.filter(r => r.status === '待审核').length;
    const last = snapshots[snapshots.length - 1] || null;
    const prev = snapshots[snapshots.length - 2] || null;

    const EVENT_DATE = '2026-11-25';
    const today = new Date();
    const evt = new Date(EVENT_DATE + 'T00:00:00+08:00');
    const daysLeft = Math.max(0, Math.ceil((evt - today) / 86400000));

    const pct = +(total / target * 100).toFixed(1);
    const gap = Math.max(0, target - total);
    const needPerDay = daysLeft > 0 ? Math.ceil(gap / daysLeft) : gap;

    // ---- 渠道码→中文名映射 ----
    const codeMap = new Map(CHANNELS.map(c => [String(c.code).toLowerCase(), c]));

    // ---- 渠道榜（按渠道码归类，显示中文名）----
    const bucketMap = new Map();
    for (const r of rows) {
      const ck = String(r.channel_code || '').trim().toLowerCase();
      let ch = ck ? codeMap.get(ck) : null;
      let key, label, cat;
      if (!ck) { key = '__none__'; label = '无渠道码（自然报名）'; cat = '未归属'; }
      else if (ch) { key = ch.label; label = ch.label; cat = ch.cat; }
      else { key = '未登记-' + r.channel_code; label = '未登记码 ' + r.channel_code; cat = '未登记'; }
      if (!bucketMap.has(key)) bucketMap.set(key, { value: key, label, cat, count: 0, valid: 0 });
      const e = bucketMap.get(key);
      e.count++;
      if (r.status === '有效票') e.valid++;
    }
    const allChannels = [...bucketMap.values()].map(x => ({ ...x, pct: +(x.count / total * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);
    const sources = allChannels;

    // ---- 渠道分类（华南/华东1/华东2/华北/渠道/营销生态/海外等）----
    const catMap = new Map();
    for (const c of allChannels) {
      const k = c.cat || '未归属';
      if (!catMap.has(k)) catMap.set(k, { value: k, count: 0, valid: 0 });
      const e = catMap.get(k); e.count += c.count; e.valid += c.valid;
    }
    const channelCats = [...catMap.values()].map(x => ({ ...x, pct: +(x.count / total * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    // ---- 销售个人榜（仅渠道码名单内的人，排除市场部/管理中心/合作方）----
    const NON_SALES_CATS = new Set(['市场部', '管理中心', '宽洁', '欧莱雅', '夜莺科技', '零壹贰叁', '破圈', '极创美奥', '金数据', '内部']);
    const staff = allChannels
      .filter(c => c.cat && !NON_SALES_CATS.has(c.cat) && c.cat !== '未归属' && c.cat !== '未登记')
      .sort((a, b) => b.count - a.count || b.valid - a.valid)
      .slice(0, 15)
      .map(c => ({ value: c.label, count: c.count, valid: c.valid, cat: c.cat }));

    // ---- 队伍榜（按渠道分类聚合的销售人均）----
    const teamMap = new Map();
    for (const c of allChannels) {
      if (!c.cat || NON_SALES_CATS.has(c.cat)) continue;
      if (!teamMap.has(c.cat)) teamMap.set(c.cat, { value: c.cat, count: 0, people: 0 });
      const e = teamMap.get(c.cat); e.count += c.count; e.people++;
    }
    const teams = [...teamMap.values()].map(x => ({ ...x, pct: +(x.count / total * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    // ---- 按区域榜 ----
    const regionMap = new Map();
    for (const r of rows) {
      const rg = r.region || '未标注';
      regionMap.set(rg, (regionMap.get(rg) || 0) + 1);
    }
    const regions = [...regionMap.entries()]
      .map(([value, count]) => ({ value, count, pct: +(count / total * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    // ---- 行业榜 ----
    const indMap = new Map();
    for (const r of rows) {
      const k = r.industry || '未标注';
      indMap.set(k, (indMap.get(k) || 0) + 1);
    }
    const industries = [...indMap.entries()]
      .map(([value, count]) => ({ value, count, pct: +(count / total * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count).slice(0, 10);

    // ---- 每日明细（含与昨日差值）----
    const byDay = new Map();
    for (const r of rows) {
      if (!r.signup_date) continue;
      if (!byDay.has(r.signup_date)) byDay.set(r.signup_date, { date: r.signup_date, new: 0, valid: 0, pending: 0 });
      const e = byDay.get(r.signup_date);
      e.new++;
      if (r.status === '有效票') e.valid++;
      if (r.status === '待审核') e.pending++;
    }
    const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

    const allDates = [...new Set([...days.map(d => d.date), ...snapshots.map(s => s.stat_date)])].sort();
    const dayMap = new Map(days.map(d => [d.date, d]));
    const snapMap = new Map(snapshots.map(s => [s.stat_date, s]));
    let cum = 0;
    const dailyNew = allDates.map(d => {
      const dd = dayMap.get(d);
      const n = dd ? dd.new : 0;
      cum += n;
      const stTime = snapMap.get(d)?.stat_time || '';
      return { date: d, new: n, cum, statTime: stTime };
    });
    // 差值 = 当日累计相对前一日累计的快照差值
    const cumList = [];
    for (const d of allDates) {
      const s = snapMap.get(d);
      if (!s) continue;
      const prevCum = cumList.length ? cumList[cumList.length - 1].cum : 0;
      cumList.push({
        date: d, cum: s.total, valid: s.valid, pending: s.pending,
        diff: s.total - prevCum, statTime: s.stat_time || '', target: s.target,
      });
    }

    // 近7日均速与预测
    const recent = dailyNew.slice(-7).filter(d => d.new > 0);
    const avg7 = recent.length ? +(recent.reduce((s, d) => s + d.new, 0) / recent.length).toFixed(1) : 0;
    const projected = Math.round(total + avg7 * daysLeft);

    res.json({
      campaign,
      kpi: { total, valid, pending, target, pct, gap, daysLeft, needPerDay, eventDate: EVENT_DATE },
      snapshots: cumList,
      daily: dailyNew,
      sources,
      allChannels,
      channelCats,
      teams,
      staff,
      regions,
      industries,
      pace: { avg7, projected, recentAvgDays: recent.length },
      meta: {
        lastSnapshot: last, prevSnapshot: prev,
        note: '数据来源：活动行报名明细导出；差值=当日累计−上一快照累计',
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 10.2 报名明细列表
app.get('/api/marketing-campaign/reg-list', (req, res) => {
  try {
    const { source, region, status, industry, q, limit = 200, offset = 0 } = req.query;
    let rows = regRows();
    if (source) rows = rows.filter(r => r.inviter_bucket === source);
    if (region) rows = rows.filter(r => r.region === region);
    if (status) rows = rows.filter(r => r.status === status);
    if (industry) rows = rows.filter(r => r.industry === industry);
    if (q) {
      const s = String(q).toLowerCase();
      rows = rows.filter(r => ['contact_name', 'company', 'phone', 'inviter_raw'].some(k => String(r[k] || '').toLowerCase().includes(s)));
    }
    const totalRows = rows.length;
    rows = rows.sort((a, b) => String(b.signup_time).localeCompare(String(a.signup_time)))
      .slice(+offset, +offset + +limit)
      .map(r => ({
        id: r.id, name: r.contact_name, company: r.company, industry: r.industry,
        status: r.status, time: r.signup_time, source: REG_SOURCE_LABEL[r.inviter_bucket] || r.inviter_bucket,
        inviter: r.inviter_name || r.inviter_raw || '', region: r.region,
      }));
    res.json({ rows, total: totalRows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 10.3 每日快照写入（供定时任务/人工补录）
app.post('/api/marketing-campaign/reg-snapshot', (req, res) => {
  try {
    const { stat_date, stat_time = '', total, valid = 0, pending = 0, target = 900, campaign = '2026 AI营销大会', note = '' } = req.body || {};
    if (!stat_date || total === undefined) return res.status(400).json({ error: 'stat_date 与 total 必填' });
    db.prepare(`INSERT INTO campaign_reg_snapshots (campaign, stat_date, stat_time, total, valid, pending, target, source, note)
      VALUES (?,?,?,?,?,?,?,'manual',?)
      ON CONFLICT(campaign, stat_date) DO UPDATE SET stat_time=excluded.stat_time, total=excluded.total,
        valid=excluded.valid, pending=excluded.pending, target=excluded.target, note=excluded.note`)
      .run(campaign, stat_date, stat_time, +total, +valid, +pending, +target, note);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

}
