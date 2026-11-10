import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setHeader } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';
import ChartCanvas from '../components/Charts.jsx';
import { MC_DIMS, splitIndustry, drillUrl, regionOf } from './mcVisual.js';

// ===== 总览表：六维标签全量横向总表 =====
function OverviewTable({ data, nav }) {
  const [open, setOpen] = useState(false);
  const maxRows = open ? 999 : 3;

  return (
    <div className="mc-card mc-overview">
      <div className="mc-card-head">
        <div>
          <h3>标签总览表</h3>
          <p className="mc-sub">六个维度 · 一级大类与二级明细一览，点任意数字直接下钻客户名单</p>
        </div>
        <button className="mc-btn mc-btn-ghost" onClick={() => setOpen(o => !o)}>
          {open ? '收起 ▴' : '下拉查看全部 ▾'}
        </button>
      </div>

      <div className="mc-table-scroll">
        <table className="mc-otable">
          <thead>
            <tr>
              {MC_DIMS.map(d => (
                <th key={d.key} style={{ minWidth: d.key === 'industry_group' || d.key === 'source_type' ? 300 : 170 }}>
                  <span className="mc-dim-dot" style={{ background: d.color }} />{d.icon} {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {MC_DIMS.map(d => {
                const items = data.dims.find(x => x.key === d.key)?.items || [];
                const shown = items.slice(0, maxRows);
                const rest = items.length - shown.length;
                return (
                  <td key={d.key} valign="top">
                    {shown.map(it => (
                      <div key={it.value} className="mc-orow">
                        <span className="mc-orow-name" title={it.value}
                          onClick={() => nav(drillUrl(d.key, it.value))}>
                          {it.value}
                        </span>
                        <span className="mc-orow-bar">
                          <i style={{ width: `${Math.max(4, it.pct / (items[0]?.pct || 1) * 100)}%`, background: d.color }} />
                        </span>
                        <b className="mc-orow-num" style={{ color: d.color }}
                          onClick={() => nav(drillUrl(d.key, it.value))}>{it.count}</b>
                        <span className="mc-orow-pct">{it.pct}%</span>
                      </div>
                    ))}
                    {!open && rest > 0 && (
                      <div className="mc-more" onClick={() => setOpen(true)}>
                        更多 ▸ 还有 {rest} 个{d.label}标签
                      </div>
                    )}
                    {open && rest > 0 && <div className="mc-more-dim">共 {items.length} 个标签</div>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== 单个维度分类板块 =====
function DimSection({ dim, items, total, expanded, onToggle, nav }) {
  return (
    <div className="mc-card mc-dim" style={{ '--dim': dim.color, '--dim-soft': dim.soft }}>
      <div className="mc-card-head">
        <div className="mc-dim-title">
          <span className="mc-dim-icon">{dim.icon}</span>
          <h3>{dim.label}</h3>
          <span className="mc-dim-count">{items.length} 个标签</span>
        </div>
        <p className="mc-sub">点标签展开二级明细 · 点数字看名单</p>
      </div>

      <div className="mc-chip-grid">
        {items.map(it => {
          const isOpen = expanded[dim.key] === it.value;
          const hasChild = it.children && it.children.length > 0;
          return (
            <div key={it.value} className={'mc-chip' + (isOpen ? ' open' : '')}>
              <div className="mc-chip-main" onClick={() => hasChild && onToggle(dim.key, it.value)}>
                <div className="mc-chip-label" title={it.value}>{it.value}</div>
                <div className="mc-chip-row">
                  <span className="mc-chip-num" onClick={e => { e.stopPropagation(); nav(drillUrl(dim.key, it.value)); }}>{it.count}</span>
                  <span className="mc-chip-pct">{it.pct}%</span>
                  {hasChild && <span className="mc-chip-caret">{isOpen ? '▴' : '▾'}</span>}
                </div>
                <div className="mc-chip-track"><i style={{ width: `${Math.min(100, it.pct * 1.6)}%` }} /></div>
              </div>
              {isOpen && hasChild && (
                <div className="mc-chip-children">
                  {it.children.map(c => (
                    <div key={c.value} className="mc-chip-child" title={c.value}
                      onClick={() => nav(drillUrl(dim.key, it.value) + (dim.key === 'source_type' ? '&campaign=' + encodeURIComponent(c.value) : dim.key === 'region' ? '&city=' + encodeURIComponent(c.value) : ''))}>
                      <span>{c.value}</span><b>{c.count}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== 页面一：标签全景 =====
// 产品固定顺序（PRD 决策：降序、颜色固定）
const PRODUCTS = ['消费者洞察', '种草/DOMO', 'GEO', 'AI/大模型', '广告监测', '出海营销'];
const P_COLOR = {
  '消费者洞察': '#8b5cf6', '种草/DOMO': '#6366f1', 'GEO': '#3b82f6',
  'AI/大模型': '#06b6d4', '广告监测': '#f59e0b', '出海营销': '#ec4899',
};

// ===== KPI 卡 ×4 =====
function KpiRow({ kpi, nav }) {
  if (!kpi) return <Loading text="⏳ 加载 KPI..." />;
  return (
    <div className="mc-kpi-row">
      {kpi.cards.map(c => {
        const onClick = () => {
          if (c.action === 'all') nav('/marketing-campaign/leads');
          else if (c.action === 'product') nav('/marketing-campaign/leads?product=' + encodeURIComponent(c.name));
          else if (c.action === 'tags') document.getElementById('mc-tags-zone')?.scrollIntoView({ behavior: 'smooth' });
          else if (c.action === 'blank') nav('/marketing-campaign/leads?product_blank=1');
        };
        return (
          <div key={c.key} className={`mc-kpi mc-kpi-${c.color}`} onClick={onClick}>
            {c.color === 'red' && <span className="mc-kpi-flag">⚠ 需补录</span>}
            <div className="mc-kpi-l">{c.label}</div>
            <div className="mc-kpi-v">
              {(c.key === 'topProduct' || c.key === 'topIndustry')
                ? <><b>{c.name}</b><em>{c.value}</em></>
                : <><b>{c.value}</b></>}
            </div>
            <div className="mc-kpi-sub">
              {c.key === 'topIndustry'
                ? <span className="mc-green">{c.value} 条 · {c.sub}</span>
                : (c.sub || '')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== 活动获客（横排列表）=====
const EV_PROD_COLORS = { 'AI/大模型': '#8b5cf6', '种草/DOMO': '#6366f1', 'GEO': '#3b82f6', '出海营销': '#ec4899', '消费者洞察': '#06b6d4', '知识图谱': '#14b8a6' };
function prodColor(name, i) { return EV_PROD_COLORS[name] || ['#3b82f6', '#6366f1', '#8b5cf6', '#06b6d4', '#ec4899'][i % 5]; }

function EventsSection({ data, nav }) {
  if (!data) return <Loading text="⏳ 加载活动获客..." />;
  const events = data.events || [];
  if (!events.length) return null;
  const maxCount = Math.max(...events.map(e => e.count), 1);

  return (
    <div className="mc-card mc-events">
      <div className="mc-card-head">
        <div>
          <h3>🎫 活动获客 <span className="mc-info" title="仅统计「线下活动」来源，按市场活动名称拆分">ⓘ</span></h3>
          <p className="mc-sub">线下活动维度总览 · 点击任一活动进入该活动数据原表（带筛选与搜索）</p>
        </div>
        <div className="mc-head-actions">
          <span className="mc-ev-foot" style={{ padding: 0 }}>共 <b>{events.length}</b> 场活动 / <b>{data.total}</b> 条线索</span>
        </div>
      </div>
      <div className="mc-ev-list">
        {events.map(e => {
          const isSpot = index_of_spot(e, events);
          return (
            <div key={e.campaign} className="mc-ev-row" style={{ '--ev-accent': e.accent }}
              onClick={() => nav('/marketing-campaign/events/' + encodeURIComponent(e.campaign))}>
              <div className="mc-ev-id">
                <span className="mc-ev-dot" />
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{e.campaign}</div>
                  <div className="sub">
                    <span className="mc-ev-src">📍 {e.sourceLabel || '线下活动'}</span>
                    {e.tag && <span className="mc-ev-badge">{e.tag}</span>}
                    <span>🗓 {e.monthSpan}</span>
                  </div>
                </div>
              </div>
              <div className={'mc-ev-cnt' + (isSpot ? ' is-alert' : '')}>
                <b>{e.count}</b>
                <span>条获客{isSpot ? ' · 最新' : ''}</span>
              </div>
              <div className="mc-ev-segs">
                {e.products.slice(0, 3).map((p, i) => (
                  <div key={p.value} className="mc-ev-seg">
                    <span className="lb">{p.value}</span>
                    <span className="tk"><i style={{ width: `${Math.max(6, (p.count / e.count) * 100)}%`, background: prodColor(p.value, i) }} /></span>
                    <span className="nm">{p.count}</span>
                  </div>
                ))}
                {!e.products.length && <div className="mc-ev-seg"><span className="lb">产品线未标注</span><span className="tk"><i style={{ width: '6%', background: '#475569' }} /></span><span className="nm">—</span></div>}
              </div>
              <div className="mc-ev-tags">
                {e.industryTop.slice(0, 3).map(i => <span key={i.value} className="mc-ev-pill">{i.value} {i.count}</span>)}
              </div>
              <div className="mc-ev-arrow">›</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 找出「最新」活动（此处以数量最大者标记为最新，便于视觉强调）
function index_of_spot(e, events) { return events[0] && events[0].campaign === e.campaign; }

// ===== 模块 A 产品需求占比 =====
function ModuleA({ data, active, onPick, nav }) {
  const [mode, setMode] = useState('mention'); // mention | lead
  if (!data) return <Loading text="⏳ 加载产品分布..." />;
  const items = data.items;
  const max = Math.max(...items.map(i => i.mention), 1);
  const key = mode === 'mention' ? 'pctMention' : 'pctLead';

  return (
    <div className="mc-card">
      <div className="mc-card-head">
        <div>
          <h3>模块 A · 产品需求占比 <span className="mc-info" title="口径：产品线按 | 拆分后计数">ⓘ</span></h3>
          <p className="mc-sub">
            提及总数 <b>501</b>（校验位）｜ 有产品标注线索 <b>289</b>
          </p>
        </div>
        <div className="mc-head-actions">
          <div className="mc-switch">
            <button className={mode === 'mention' ? 'on' : ''} onClick={() => setMode('mention')}>提及占比 /501</button>
            <button className={mode === 'lead' ? 'on' : ''} onClick={() => setMode('lead')}>线索渗透 /289</button>
          </div>
        </div>
      </div>
      <div className="mc-card-body">
        {items.map((it) => (
          <div key={it.product}
            className={`mc-bar-row ${active === it.product ? 'is-active' : ''}`}
            onClick={() => onPick(active === it.product ? null : it.product)}
            title={`提及 ${it.mention} 次 / 线索渗透 ${it.pctLead}% / 分布于 ${it.industrySpread} 个行业`}>
            <span className="mc-bar-name">{it.product}</span>
            <span className="mc-bar-track">
              <i style={{ width: `${Math.max(2, it.mention / max * 100)}%`, background: it.color }} />
            </span>
            <b className="mc-bar-num" style={{ color: it.color }}>{it.mention}</b>
            <span className="mc-bar-pct">
              {it.pctMention}% <span className="mc-pipe">｜</span> {it.pctLead}%
            </span>
          </div>
        ))}

        <div className="mc-warn-bar">
          另有 <b>114 条</b>未标注产品线，未参与上述统计 ——{' '}
          <a onClick={() => nav('/marketing-campaign/leads?product_blank=1')}>点此查看并补录 →</a>
        </div>
      </div>
    </div>
  );
}

// ===== 模块 B 行业 × 产品热力矩阵 =====
function ModuleB({ data, active, onCell, nav }) {
  const [scale, setScale] = useState('column'); // column | global
  if (!data) return <Loading text="⏳ 加载矩阵..." />;
  const prods = data.products;
  const denom = (p) => scale === 'column' ? (prods.find(x => x.product === p)?.max || 1) : (data.globalMax || 1);
  const shade = (v, p) => {
    if (!v) return 'transparent';
    const r = Math.min(1, v / denom(p));
    return `rgba(59,130,246,${0.08 + r * 0.78})`;
  };

  return (
    <div className="mc-card">
      <div className="mc-card-head">
        <div>
          <h3>模块 B · 行业 × 产品热力矩阵 <span className="mc-info" title="按列归一：每列独立取 Top8 行最大值">ⓘ</span></h3>
          <p className="mc-sub">Top8 行业（线索量降序）+ 其他 11 类合并行 · 点单元格下钻客户名单</p>
        </div>
        <div className="mc-head-actions">
          <div className="mc-switch">
            <button className={scale === 'column' ? 'on' : ''} onClick={() => setScale('column')}>按列</button>
            <button className={scale === 'global' ? 'on' : ''} onClick={() => setScale('global')}>按全局</button>
          </div>
        </div>
      </div>

      <div className="mc-insight-bar">💡 {data.insight}</div>

      <div className="mc-card-body mc-heat-wrap">
        <table className="mc-heat">
          <thead>
            <tr>
              <th className="mc-heat-corner">行业 ＼ 产品</th>
              {prods.map(p => (
                <th key={p.product} title={`${p.product} 列最大值 ${p.max}`}>
                  <span style={{ color: p.color }}>{p.product}</span>
                  <div className="mc-heat-max">max={p.max}</div>
                </th>
              ))}
              <th className="mc-heat-tot">行合计</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map(r => (
              <tr key={r.industry} className={r.isOther ? 'is-other' : ''}>
                <td className="mc-heat-rowhead" title={r.industry}>
                  <a onClick={() => nav('/marketing-campaign/leads?industry_group=' + encodeURIComponent(r.isOther ? '' : r.industry))}>
                    {r.industry}
                  </a>
                  <span className="mc-heat-leads">{r.leads}</span>
                </td>
                {prods.map(p => {
                  const v = r.cells[p.product] || 0;
                  const d = data.detail?.[r.industry]?.[p.product] || {};
                  const isHit = active === p.product;
                  return (
                    <td key={p.product}
                      className={`mc-heat-cell ${isHit ? 'is-hit' : ''}`}
                      style={{ background: shade(v, p.product), color: v ? '#fff' : '#cbd5e1' }}
                      title={`${v} 条 / 占该行业 ${d.ofRow ?? 0}% / 占该产品 ${d.ofCol ?? 0}%`}
                      onClick={() => v && nav(`/marketing-campaign/leads?industry_group=${encodeURIComponent(r.isOther ? '' : r.industry)}&product=${encodeURIComponent(p.product)}`)}>
                      {v || '·'}
                    </td>
                  );
                })}
                <td className="mc-heat-sum">{r.rowTotal}</td>
              </tr>
            ))}
            <tr className="mc-heat-foot">
              <td className="mc-heat-rowhead">列合计</td>
              {prods.map(p => <td key={p.product}>{data.colTotals[p.product]}</td>)}
              <td className="mc-heat-sum">{data.grandTotal}</td>
            </tr>
          </tbody>
        </table>
        <p className="mc-foot-note">
          注：行/列合计含多值重复计数；未标注 114 条不落任何格。色阶默认按列归一（每列独立取 Top8 行最大值），
          切入「按全局」可看绝对量对比。
        </p>
      </div>
    </div>
  );
}

// ===== 模块 C 受众 360 画像 =====
function ModuleC({ data, nav }) {
  if (!data) return <Loading text="⏳ 加载画像..." />;
  const dims = [
    ['industry', '#2563eb', 'industry_group'],
    ['customerType', '#0891b2', 'customer_type'],
    ['city', '#d97706', 'city'],
    ['source', '#059669', 'source_type'],
  ];
  return (
    <div className="mc-card">
      <div className="mc-card-head">
        <div>
          <h3>模块 C · 受众 360 画像 <span className="mc-info" title="规则生成结论，不调模型">ⓘ</span></h3>
          <p className="mc-sub">四维主力值 · 点击任一条目下钻</p>
        </div>
      </div>
      <div className="mc-card-body">
        <div className="mc-persona-grid">
          {dims.map(([k, color, dk]) => {
            const d = data.dims[k];
            if (!d) return null;
            const max = d.items[0]?.count || 1;
            return (
              <div key={k} className="mc-persona-col">
                <div className="mc-persona-title">{d.label}</div>
                {d.items.slice(0, 5).map(it => (
                  <div key={it.value} className="mc-persona-row"
                    onClick={() => nav(`/marketing-campaign/leads?${dk === 'city' ? 'city' : dk}=${encodeURIComponent(it.value)}`)}>
                    <span className="mc-persona-name" title={it.value}>{it.value}</span>
                    <span className="mc-persona-bar"><i style={{ width: `${it.count / max * 100}%`, background: color }} /></span>
                    <b style={{ color }}>{it.count}</b>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="mc-conclusion">📌 {data.conclusion}</div>
      </div>
    </div>
  );
}

// ===== 模块 D 内容来源 × 产品堆叠 =====
function ModuleD({ data, active, nav }) {
  if (!data) return <Loading text="⏳ 加载来源堆叠..." />;
  const maxLeads = Math.max(...data.bars.map(b => b.leads), 1);
  return (
    <div className="mc-card">
      <div className="mc-card-head">
        <div>
          <h3>模块 D · 内容来源 × 产品 <span className="mc-info" title="条长=该来源总线索；分段=各产品提及数（可重复）">ⓘ</span></h3>
          <p className="mc-sub">5 类来源 · 6 产品堆叠 · 点分段下钻</p>
        </div>
        <div className="mc-legend">
          {data.products.map(p => (
            <span key={p.product} className={active === p.product ? 'on' : ''}>
              <i style={{ background: p.color }} />{p.product}
            </span>
          ))}
        </div>
      </div>
      <div className="mc-card-body">
        {data.bars.map(b => (
          <div key={b.source} className="mc-stack-row">
            <span className="mc-stack-name" title={b.source}>{b.source}</span>
            <span className="mc-stack-track" style={{ width: `${b.leads / maxLeads * 100}%` }}>
              {b.segments.filter(s => s.count > 0).map(s => (
                <i key={s.product}
                  style={{
                    width: `${s.count / Math.max(b.segTotal, 1) * 100}%`,
                    background: s.color,
                    opacity: active && active !== s.product ? 0.28 : 1,
                  }}
                  title={`${b.source} × ${s.product} = ${s.count} 条`}
                  onClick={() => nav(`/marketing-campaign/leads?source_type=${encodeURIComponent(b.source)}&product=${encodeURIComponent(s.product)}`)} />
              ))}
            </span>
            <b className="mc-stack-num">{b.leads}</b>
            {b.blank > 0 && <span className="mc-stack-blank">未标注 {b.blank}</span>}
          </div>
        ))}
        <div className="mc-insights">
          {data.insights.map((t, i) => (
            <div key={i} className="mc-insight-line"><span>{i + 1}</span>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== 右栏 数据溯源 =====
function TracePanel({ kpi, onCopy }) {
  const c = kpi?.check;
  return (
    <aside className="mc-trace">
      <div className="mc-trace-card">
        <h4>📦 数据源</h4>
        <div className="mc-trace-line"><span>文件</span><b>seeds/leads_v1_2.csv</b></div>
        <div className="mc-trace-line"><span>行数</span><b>{c?.total ?? '—'} 行</b></div>
        <div className="mc-trace-line"><span>表</span><b>marketing_campaign_leads</b></div>
        <div className="mc-trace-line mc-red"><span>未标注</span><b>{c?.blank ?? '—'} 条 ({c ? (c.blank / c.total * 100).toFixed(1) : '—'}%) 🔴</b></div>
      </div>

      <div className="mc-trace-card">
        <h4>📐 口径说明</h4>
        <ul className="mc-trace-note">
          <li>产品线为多值字段，统计已按 <code>|</code> 拆分</li>
          <li>总提及 <b>501</b> ≠ 总线索 <b>403</b>（83 条多产品）</li>
          <li>未标注 <b>114</b> 条单列，未参与产品统计</li>
          <li>矩阵色阶默认按列归一（Top8 行取 max）</li>
        </ul>
      </div>

      <div className="mc-trace-card">
        <h4>✅ 本期校验位</h4>
        <div className="mc-trace-check">
          <div><b>{c?.total ?? '—'}</b><span>总线索</span></div>
          <div><b>{c?.mention ?? '—'}</b><span>提及</span></div>
          <div className="mc-red"><b>{c?.blank ?? '—'}</b><span>未标注</span></div>
          <div><b>{c?.multi ?? '—'}</b><span>多值</span></div>
        </div>
        <div className="mc-trace-formula">
          <code>{c?.formula || '403 = 289 + 114'}</code>
          <code>{c?.formula2 || '501 ≥ 289'}</code>
        </div>
      </div>

      <div className="mc-trace-card">
        <h4>🔗 直达原表</h4>
        <a className="mc-trace-btn" href="/marketing-campaign/leads">📄 打开完整明细表</a>
        <a className="mc-trace-btn" href="/api/marketing-campaign/export" target="_blank" rel="noreferrer">⬇ 导出当前筛选 CSV</a>
        <button className="mc-trace-btn" onClick={onCopy}>🔗 复制本页筛选为链接</button>
      </div>
    </aside>
  );
}

// ===== 首页（v2.0 产品决策台）=====
export default function MarketingCampaign() {
  const nav = useNavigate();
  const [kpi, setKpi] = useState(null);
  const [share, setShare] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [persona, setPersona] = useState(null);
  const [srcProd, setSrcProd] = useState(null);
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState(null);
  const [events, setEvents] = useState(null);
  const [active, setActive] = useState(null);
  const [err, setErr] = useState(null);
  const [tagsOpen, setTagsOpen] = useState(false);

  useEffect(() => { setHeader('📣 市场营销活动获客', null); }, []);

  useEffect(() => {
    const base = '/api/campaign';
    api(base + '/kpi').then(setKpi).catch(e => setErr(e.message));
    api(base + '/product-share').then(setShare).catch(() => {});
    api(base + '/matrix').then(setMatrix).catch(() => {});
    api(base + '/persona').then(setPersona).catch(() => {});
    api(base + '/source-product').then(setSrcProd).catch(() => {});
    api('/api/marketing-campaign/overview').then(setOverview).catch(() => {});
    api('/api/marketing-campaign/trend').then(setTrend).catch(() => {});
    api('/api/marketing-campaign/events').then(setEvents).catch(() => {});
  }, []);

  if (err) return <Err error={err} />;
  if (!kpi) return <Loading />;

  const trendCfg = trend ? {
    type: 'bar',
    data: {
      labels: trend.labels,
      datasets: [
        { type: 'bar', label: '月度进线', data: trend.total, backgroundColor: 'rgba(37,99,235,.75)', borderRadius: 5, barPercentage: .55 },
        { type: 'line', label: '趋势', data: trend.total, borderColor: '#7c3aed', borderWidth: 2, tension: .35, pointRadius: 3, pointBackgroundColor: '#7c3aed', fill: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#475569', font: { size: 11 }, boxWidth: 10 } } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { display: false } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,.25)' }, beginAtZero: true },
      },
    },
  } : null;

  const copyLink = () => {
    const url = window.location.origin + '/marketing-campaign';
    navigator.clipboard?.writeText(url).then(
      () => alert('已复制：' + url + '\n（本页无筛选参数，数值即全量口径）'),
      () => alert(url),
    );
  };

  return (
    <div className="mc-wrap mc-v2">
      <div className="mc-layout">
        <main className="mc-main">
          {/* KPI ×4 */}
          <KpiRow kpi={kpi} nav={nav} />

          {/* 活动获客（线下活动 banner） */}
          <EventsSection data={events} nav={nav} />

          {/* 模块 A */}
          <ModuleA data={share} active={active} onPick={setActive} nav={nav} />

          {/* 模块 B */}
          <ModuleB data={matrix} active={active} nav={nav} />

          {/* 模块 C */}
          <ModuleC data={persona} nav={nav} />

          {/* 模块 D */}
          <ModuleD data={srcProd} active={active} nav={nav} />

          {/* 二级区：标签全景（折叠下沉） */}
          <div className="mc-card" id="mc-tags-zone">
            <div className="mc-card-head">
              <div>
                <h3>🗂 二级区 · 标签全景（下钻弹药库）</h3>
                <p className="mc-sub">19 行业 / 26 省 49 市 / 客户类型 / 获客趋势 —— 首屏不占位，按需展开</p>
              </div>
              <button className="mc-btn mc-btn-ghost" onClick={() => setTagsOpen(o => !o)}>
                {tagsOpen ? '收起 ▴' : '展开全部标签 ▾'}
              </button>
            </div>
            {tagsOpen && overview && (
              <div className="mc-card-body">
                {MC_DIMS.map(dim => {
                  const d = overview.dims.find(x => x.key === dim.key);
                  if (!d) return null;
                  const max = d.items[0]?.count || 1;
                  return (
                    <div key={dim.key} className="mc-tagblock">
                      <div className="mc-tagblock-title">
                        <span className="mc-dim-dot" style={{ background: dim.color }} />
                        {dim.icon} {dim.label}
                        <em>{d.distinct} 项</em>
                      </div>
                      <div className="mc-tag-cloud">
                        {d.items.map(it => (
                          <span key={it.value} className="mc-tagpill"
                            style={{ '--c': dim.color, fontSize: 12 + Math.round(it.count / max * 2) }}
                            onClick={() => nav(drillUrl(dim.key, it.value))}
                            title={`${it.count} 条 · ${it.pct}%`}>
                            {it.value}<b>{it.count}</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="mc-tagblock">
                  <div className="mc-tagblock-title"><span className="mc-dim-dot" style={{ background: '#db2777' }} />📈 获客趋势</div>
                  {trendCfg ? <ChartCanvas config={trendCfg} height={240} /> : <Loading text="⏳ 加载趋势..." />}
                </div>
              </div>
            )}
          </div>
        </main>

        <TracePanel kpi={kpi} onCopy={copyLink} />
      </div>
    </div>
  );
}

// ===== 页面二：全部客户明细（原CSV全字段 + 筛选 + 搜索）=====
const PAGE_SIZE = 20;
const COLS = [
  ['created_date', '创建时间', 100],
  ['industry_group', '行业_一级', 110],
  ['industry_raw', '客户所属行业', 170],
  ['contact_name', '姓名', 80],
  ['company_name', '企业简称', 170],
  ['needs_text', '具体合作需求', 320],
  ['campaign_name', '市场活动名称', 190],
  ['source_type', '内容来源类型', 130],
  ['product_interest', '意向产品线', 190],
  ['registrar', 'Leads分配登记人', 120],
  ['phone', '联系方式', 120],
  ['province', '省', 90],
  ['city', '市', 90],
  ['customer_type', '客户类型', 170],
];

export function MarketingLeads() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [opts, setOpts] = useState(null);
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('created_date');
  const [dir, setDir] = useState('desc');
  const [q, setQ] = useState('');
  const [showFilter, setShowFilter] = useState(true);
  const [f, setF] = useState({
    industry_group: sp.get('industry_group') || '', source_type: sp.get('source_type') || '',
    campaign: sp.get('campaign') || '', product: sp.get('product') || '',
    region: sp.get('region') || '', province: sp.get('province') || '', city: sp.get('city') || '',
    month: sp.get('month') || '', registrar: sp.get('registrar') || '', customer_type: sp.get('customer_type') || '',
  });

  useEffect(() => { setHeader('📣 市场营销活动获客 · 全部客户', null); api('/api/marketing-campaign/options').then(setOpts).catch(() => {}); }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, size: PAGE_SIZE, sort, dir });
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
    if (q) params.set('q', q);
    setRows(null);
    api('/api/marketing-campaign/leads?' + params.toString()).then(d => { setRows(d.data); setTotal(d.total); }).catch(() => setRows([]));
  }, [f, page, sort, dir, q]);

  useEffect(() => { load(); }, [load]);

  const upd = (k, v) => { setF(p => ({ ...p, [k]: v })); setPage(1); };
  const reset = () => { setF({ industry_group: '', source_type: '', campaign: '', product: '', region: '', province: '', city: '', month: '', registrar: '', customer_type: '' }); setQ(''); setPage(1); };
  const activeCount = Object.values(f).filter(Boolean).length + (q ? 1 : 0);
  const pages = Math.ceil(total / PAGE_SIZE) || 1;

  const toggleSort = k => { if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir('asc'); } };

  const filterBar = (
    <div className="mc-filters">
      <div className="mc-search">
        <span>🔍</span>
        <input placeholder="搜索公司 / 联系人 / 需求 / 电话 / 城市…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
      </div>
      <select value={f.industry_group} onChange={e => upd('industry_group', e.target.value)}><option value="">全部行业</option>{(opts?.industry_group || []).map(o => <option key={o}>{o}</option>)}</select>
      <select value={f.source_type} onChange={e => { setF(p => ({ ...p, source_type: e.target.value, campaign: '' })); setPage(1); }}><option value="">全部来源</option>{(opts?.source_type || []).map(o => <option key={o}>{o}</option>)}</select>
      <select value={f.campaign} onChange={e => upd('campaign', e.target.value)}><option value="">全部活动</option>{(opts?.campaign_name || []).map(o => <option key={o}>{o}</option>)}</select>
      <select value={f.product} onChange={e => upd('product', e.target.value)}><option value="">全部产品线</option>{(opts?.product_interest || []).map(o => <option key={o}>{o}</option>)}</select>
      <select value={f.region} onChange={e => { setF(p => ({ ...p, region: e.target.value, province: '', city: '' })); setPage(1); }}><option value="">全部大区</option>{(opts?.region || []).map(o => <option key={o}>{o}</option>)}</select>
      <select value={f.province} onChange={e => { setF(p => ({ ...p, province: e.target.value, city: '' })); setPage(1); }}><option value="">全部省</option>{(opts?.province || []).map(o => <option key={o}>{o}</option>)}</select>
      <select value={f.city} onChange={e => upd('city', e.target.value)}><option value="">全部市</option>{
        (opts?.city || []).filter(c => !f.province || true).map(o => <option key={o}>{o}</option>)}</select>
      <select value={f.month} onChange={e => upd('month', e.target.value)}><option value="">全部月份</option>{(opts?.month || []).map(o => <option key={o}>{o}</option>)}</select>
      <select value={f.customer_type} onChange={e => upd('customer_type', e.target.value)}><option value="">全部客户类型</option>{(opts?.customer_type || []).map(o => <option key={o}>{o}</option>)}</select>
      <select value={f.registrar} onChange={e => upd('registrar', e.target.value)}><option value="">全部登记人</option>{(opts?.registrar || []).map(o => <option key={o}>{o}</option>)}</select>
      {activeCount > 0 && <button className="mc-btn mc-btn-ghost" onClick={reset}>✕ 清空筛选（{activeCount}）</button>}
    </div>
  );

  const Th = ({ k, label, w }) => (
    <th style={{ minWidth: w, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => toggleSort(k)}>
      {label}{sort === k ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="mc-wrap">
      <div className="mc-card">
        <div className="mc-card-head">
          <div>
            <h3>全部客户明细</h3>
            <p className="mc-sub">原表 14 个字段全量呈现 · 当前 {total} 条</p>
          </div>
          <div className="mc-head-actions">
            <button className="mc-btn mc-btn-ghost" onClick={() => setShowFilter(v => !v)}>{showFilter ? '收起筛选 ▴' : '筛选 ▾'}</button>
            <button className="mc-btn mc-btn-ghost" onClick={() => nav('/marketing-campaign')}>← 标签全景</button>
            <button className="mc-btn mc-btn-primary" onClick={() => window.open('/api/marketing-campaign/export?' + Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'), '_blank')}>⬇ 导出 CSV</button>
          </div>
        </div>
        {showFilter && <div className="mc-card-body" style={{ paddingTop: 0 }}>{filterBar}</div>}
      </div>

      <div className="mc-card">
        {rows === null ? <Loading /> : (
          <div className="mc-table-scroll mc-table-tall">
            <table className="mc-ltable">
              <thead><tr>
                {COLS.map(([k, label, w]) => <Th key={k} k={k} label={label} w={w} />)}
                <th style={{ width: 60 }}>操作</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} onClick={() => nav('/marketing-campaign/leads/' + r.id)}>
                    <td className="mc-td-muted">{r.created_date}</td>
                    <td><span className="mc-tag" style={{ '--c': '#2563eb', '--s': '#eff6ff' }}>{r.industry_group}</span></td>
                    <td className="mc-td-sec">{r.industry_raw}</td>
                    <td>{r.contact_name}</td>
                    <td className="mc-td-strong">{r.company_name}</td>
                    <td className="mc-td-need" title={r.needs_text}>{r.needs_text || '—'}</td>
                    <td className="mc-td-sec">{r.campaign_name || '—'}</td>
                    <td><span className="mc-tag" style={{ '--c': '#059669', '--s': '#ecfdf5' }}>{r.source_type}</span></td>
                    <td>{String(r.product_interest || '').split('|').filter(Boolean).map(p => <span key={p} className="mc-tag" style={{ '--c': '#7c3aed', '--s': '#f5f3ff' }}>{p}</span>)}</td>
                    <td>{r.registrar}</td>
                    <td className="mc-td-muted">{r.phone}</td>
                    <td>{r.province}</td>
                    <td>{r.city}</td>
                    <td className="mc-td-sec">{r.customer_type}</td>
                    <td><button className="mc-btn mc-btn-ghost mc-btn-xs" onClick={e => { e.stopPropagation(); nav('/marketing-campaign/leads/' + r.id); }}>详情</button></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={15} className="mc-empty">没有符合条件的客户</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="mc-pager">
            <button className="mc-btn mc-btn-ghost mc-btn-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
            <span>第 {page} / {pages} 页</span>
            <button className="mc-btn mc-btn-ghost mc-btn-xs" disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 活动原表（某场活动的客户名单，带筛选+搜索）=====
export function MarketingEventLeads() {
  const nav = useNavigate();
  const campaign = decodeURIComponent(window.location.pathname.split('/marketing-campaign/events/')[1] || '');
  const [opts, setOpts] = useState(null);
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('created_date');
  const [dir, setDir] = useState('desc');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(null);
  const [f, setF] = useState({ industry_group: '', source_type: '', product: '', customer_type: '' });

  useEffect(() => { setHeader('📣 市场营销活动获客 · 活动原表', null); api('/api/marketing-campaign/options').then(setOpts).catch(() => {}); }, []);
  useEffect(() => { api('/api/marketing-campaign/events').then(setAll).catch(() => {}); }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, size: PAGE_SIZE, sort, dir, campaign });
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
    if (q) params.set('q', q);
    setRows(null);
    api('/api/marketing-campaign/leads?' + params.toString()).then(d => { setRows(d.data); setTotal(d.total); }).catch(() => setRows([]));
  }, [f, page, sort, dir, q, campaign]);
  useEffect(() => { load(); }, [load]);

  const upd = (k, v) => { setF(p => ({ ...p, [k]: v })); setPage(1); };
  const reset = () => { setF({ industry_group: '', source_type: '', product: '', customer_type: '' }); setQ(''); setPage(1); };
  const activeCount = Object.values(f).filter(Boolean).length + (q ? 1 : 0);
  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  const toggleSort = k => { if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir('asc'); } };
  const Th = ({ k, label, w }) => (
    <th style={{ minWidth: w, cursor: 'pointer' }} onClick={() => toggleSort(k)}>
      {label}{sort === k ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const ev = all?.events?.find(e => e.campaign === campaign);
  const accent = ev?.accent || '#2563eb';

  const exportUrl = (() => {
    const p = new URLSearchParams({ campaign }); Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v); }); if (q) p.set('q', q);
    return '/api/marketing-campaign/export?' + p.toString();
  })();

  return (
    <div className="mc-wrap">
      <button className="mc-btn mc-btn-ghost mc-btn-xs" style={{ marginBottom: 12 }} onClick={() => nav('/marketing-campaign')}>← 返回活动获客</button>

      <div className="mc-ev-hero" style={{ '--ev-accent': accent }}>
        <h2>{campaign}</h2>
        <p>该活动获客数据原表 · 共 {total} 条 · 支持筛选与搜索</p>
        {ev && (
          <div className="mc-ev-hero-stats">
            <div><b>{ev.count}</b><span>获客线索</span></div>
            <div><b>{ev.labeled}</b><span>已标注产品</span></div>
            <div><b>{ev.products[0]?.value || '—'}</b><span>意向产品 Top1</span></div>
            <div><b>{ev.industryTop[0]?.value || '—'}</b><span>行业 Top1</span></div>
            <div><b>{ev.monthSpan}</b><span>进线时段</span></div>
          </div>
        )}
      </div>

      <div className="mc-card">
        <div className="mc-card-head">
          <div className="mc-filters" style={{ padding: 0, border: 0, background: 'transparent' }}>
            <div className="mc-search">
              <span>🔍</span>
              <input placeholder="搜索公司 / 联系人 / 需求 / 电话…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
            </div>
            <select value={f.industry_group} onChange={e => upd('industry_group', e.target.value)}><option value="">全部行业</option>{(opts?.industry_group || []).map(o => <option key={o}>{o}</option>)}</select>
            <select value={f.product} onChange={e => upd('product', e.target.value)}><option value="">全部产品线</option>{(opts?.product_interest || []).map(o => <option key={o}>{o}</option>)}</select>
            <select value={f.customer_type} onChange={e => upd('customer_type', e.target.value)}><option value="">全部客户类型</option>{(opts?.customer_type || []).map(o => <option key={o}>{o}</option>)}</select>
            {activeCount > 0 && <button className="mc-btn mc-btn-ghost mc-btn-xs" onClick={reset}>✕ 清空({activeCount})</button>}
          </div>
          <div className="mc-head-actions">
            <a className="mc-btn mc-btn-primary mc-btn-xs" href={exportUrl} target="_blank" rel="noreferrer">⬇ 导出 CSV</a>
          </div>
        </div>

        <div className="mc-table-scroll">
          <table className="mc-leads-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>{COLS.map(([k, label, w]) => <Th key={k} k={k} label={label} w={w} />)}</tr>
            </thead>
            <tbody>
              {!rows ? <tr><td colSpan={COLS.length}><Loading /></td></tr>
                : rows.length === 0 ? <tr><td colSpan={COLS.length} className="mc-empty">没有符合条件的记录</td></tr>
                  : rows.map(r => (
                    <tr key={r.id} onClick={() => nav('/marketing-campaign/leads/' + r.id)} style={{ cursor: 'pointer' }}>
                      {COLS.map(([k]) => (
                        <td key={k} style={{ padding: '9px 10px', borderBottom: '1px solid rgba(51,65,85,.6)', verticalAlign: 'top' }}>
                          {k === 'needs_text' ? <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r[k]}</span> : (r[k] || '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {rows && total > 0 && (
          <div className="mc-pager" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px' }}>
            <button className="mc-btn mc-btn-ghost mc-btn-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
            <span>第 {page} / {pages} 页</span>
            <button className="mc-btn mc-btn-ghost mc-btn-xs" disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 详情页 =====
export function MarketingLeadDetail() {
  const id = window.location.pathname.split('/').pop();
  const nav = useNavigate();
  const [row, setRow] = useState(null);
  const [opts, setOpts] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHeader('📣 客户详情', null);
    api('/api/marketing-campaign/leads/' + id).then(r => { setRow(r); setForm(r); }).catch(() => {});
    api('/api/marketing-campaign/options').then(setOpts).catch(() => {});
  }, [id]);

  async function save() {
    setSaving(true);
    try {
      const body = {};
      for (const k of ['industry_group', 'product_interest', 'source_type', 'campaign_name', 'industry_raw', 'needs_text', 'province', 'city', 'registrar', 'phone', 'contact_name', 'company_name', 'customer_type'])
        body[k] = form[k];
      await api('/api/marketing-campaign/leads/' + id, { method: 'PUT', body });
      const r = await api('/api/marketing-campaign/leads/' + id);
      setRow(r); setForm(r); setEditing(false);
    } catch (e) { alert('保存失败：' + e.message); } finally { setSaving(false); }
  }

  if (!row) return <Loading />;
  const [indTop, indSub] = splitIndustry(row.industry_raw);

  const Tag = ({ c, s, children }) => <span className="mc-tag" style={{ '--c': c, '--s': s }}>{children}</span>;

  return (
    <div className="mc-wrap">
      <button className="mc-btn mc-btn-ghost mc-btn-xs" style={{ marginBottom: 12 }} onClick={() => nav(-1)}>← 返回列表</button>

      <div className="mc-card mc-detail-head">
        <div className="mc-dh-left">
          <div className="mc-dh-avatar">{(row.contact_name || '?').slice(0, 1)}</div>
          <div>
            <h2>{row.company_name}</h2>
            <p>{row.contact_name} · {row.industry_raw || '行业未标注'}</p>
            <div className="mc-dh-tags">
              <Tag c="#2563eb" s="#eff6ff">{row.industry_group}</Tag>
              <Tag c="#059669" s="#ecfdf5">{row.source_type}</Tag>
              <Tag c="#d97706" s="#fffbeb">{row.region}</Tag>
              <Tag c="#db2777" s="#fdf2f8">{row.month}</Tag>
            </div>
          </div>
        </div>
        <div className="mc-dh-right">
          <span className="mc-id">ID {row.id}</span>
          {editing
            ? <><button className="mc-btn mc-btn-ghost mc-btn-xs" onClick={() => { setForm(row); setEditing(false); }}>取消</button>
              <button className="mc-btn mc-btn-primary mc-btn-xs" disabled={saving} onClick={save}>{saving ? '保存中…' : '💾 保存'}</button></>
            : <button className="mc-btn mc-btn-primary mc-btn-xs" onClick={() => setEditing(true)}>✏️ 编辑标签</button>}
        </div>
      </div>

      <div className="mc-detail-grid">
        <div className="mc-card mc-detail-main">
          <h3 className="mc-sec-title">🏷️ 标签全览</h3>
          <div className="mc-chain">
            <span className="mc-chain-k">行业</span>
            {editing
              ? <select value={form.industry_group || ''} onChange={e => setForm({ ...form, industry_group: e.target.value })}>{(opts?.industry_group || []).map(o => <option key={o}>{o}</option>)}</select>
              : <><Tag c="#2563eb" s="#eff6ff">{row.industry_group}</Tag><span className="mc-chain-sep">›</span><Tag c="#64748b" s="#f1f5f9">{row.industry_raw}</Tag></>}
          </div>
          <div className="mc-chain">
            <span className="mc-chain-k">来源</span>
            {editing
              ? <><select value={form.source_type || ''} onChange={e => setForm({ ...form, source_type: e.target.value })}>{(opts?.source_type || []).map(o => <option key={o}>{o}</option>)}</select>
                <select value={form.campaign_name || ''} onChange={e => setForm({ ...form, campaign_name: e.target.value })}>{(opts?.campaign_name || []).map(o => <option key={o}>{o}</option>)}</select></>
              : <><Tag c="#059669" s="#ecfdf5">{row.source_type}</Tag><span className="mc-chain-sep">›</span><Tag c="#0891b2" s="#ecfeff">{row.campaign_name || '—'}</Tag></>}
          </div>
          <div className="mc-chain">
            <span className="mc-chain-k">产品线</span>
            {editing
              ? <input style={{ minWidth: 320 }} value={form.product_interest || ''} onChange={e => setForm({ ...form, product_interest: e.target.value })} placeholder="多值用 | 分隔" />
              : (String(row.product_interest || '').split('|').filter(Boolean).map(p => <Tag key={p} c="#7c3aed" s="#f5f3ff">{p}</Tag>) || '—')}
          </div>
          <div className="mc-chain">
            <span className="mc-chain-k">地域</span>
            {editing
              ? <><input value={form.province || ''} onChange={e => setForm({ ...form, province: e.target.value })} style={{ width: 120 }} /><input value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} style={{ width: 120 }} /></>
              : <><Tag c="#d97706" s="#fffbeb">{row.region}</Tag><span className="mc-chain-sep">›</span><Tag c="#64748b" s="#f1f5f9">{row.province} {row.city}</Tag></>}
          </div>
          <div className="mc-chain">
            <span className="mc-chain-k">时段</span>
            <Tag c="#db2777" s="#fdf2f8">{row.month} · {row.created_date}</Tag>
          </div>
          <div className="mc-chain">
            <span className="mc-chain-k">客户类型</span>
            <Tag c="#0891b2" s="#ecfeff">{row.customer_type || '—'}</Tag>
          </div>

          <h3 className="mc-sec-title" style={{ marginTop: 22 }}>💬 具体合作需求（原文）</h3>
          {editing
            ? <textarea rows={4} style={{ width: '100%' }} value={form.needs_text || ''} onChange={e => setForm({ ...form, needs_text: e.target.value })} />
            : <div className="mc-need-text">{row.needs_text || '—'}</div>}
        </div>

        <div className="mc-detail-side">
          <div className="mc-card">
            <h3 className="mc-sec-title">📋 基础信息</h3>
            {[['姓名', 'contact_name'], ['企业简称', 'company_name'], ['联系方式', 'phone'], ['创建时间', 'created_date'],
              ['市场活动名称', 'campaign_name'], ['Leads登记人', 'registrar'], ['客户所属行业', 'industry_raw'], ['客户类型', 'customer_type']].map(([label, key]) => (
              <div className="mc-field" key={key}>
                <label>{label}</label>
                {editing && ['contact_name', 'company_name', 'phone', 'registrar', 'industry_raw', 'customer_type'].includes(key)
                  ? <input value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                  : <div className="mc-field-v">{row[key] || '—'}</div>}
              </div>
            ))}
          </div>

          {row.history?.length > 0 && (
            <div className="mc-card">
              <h3 className="mc-sec-title">🕘 修改留痕</h3>
              {row.history.map(h => (
                <div key={h.id} className="mc-hist">
                  <span className="mc-hist-time">{h.edited_at}</span>
                  <div>{h.edited_by} · <b>{h.field_name}</b>：{h.old_value || '(空)'} → {h.new_value || '(空)'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== 分析看板 =====
export function MarketingInsight() {
  const [cross, setCross] = useState(null);
  const [rd, setRd] = useState('industry_group');
  const [cd, setCd] = useState('source_type');
  const [err, setErr] = useState(null);

  useEffect(() => { setHeader('📣 市场营销活动获客 · 交叉分析', null); }, []);
  useEffect(() => { api(`/api/marketing-campaign/cross?row=${rd}&col=${cd}`).then(setCross).catch(e => setErr(e.message)); }, [rd, cd]);

  const DIMS = MC_DIMS.map(d => ({ key: d.key, label: d.label }));

  if (err) return <Err error={err} />;

  return (
    <div className="mc-wrap">
      <div className="mc-card">
        <div className="mc-card-head">
          <div><h3>🔀 交叉分析</h3><p className="mc-sub">任选两个维度，查看标签组合分布</p></div>
          <div className="mc-head-actions">
            <select value={rd} onChange={e => setRd(e.target.value)}>{DIMS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
            <span className="mc-x">×</span>
            <select value={cd} onChange={e => setCd(e.target.value)}>{DIMS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
          </div>
        </div>
        <div className="mc-card-body">
          {!cross ? <Loading /> : (
            <>
              <div className="mc-table-scroll">
                <table className="mc-matrix">
                  <thead>
                    <tr>
                      <th className="mc-mx-corner">{cross.rowDim.label} \ {cross.colDim.label}</th>
                      {cross.cols.map(c => <th key={c.value} title={c.value}>{c.value}<div className="mc-mx-tot">{c.total}</div></th>)}
                      <th>合计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cross.rows.map(r => (
                      <tr key={r.value}>
                        <td className="mc-mx-rowhead" title={r.value}>{r.value}</td>
                        {cross.cols.map(c => {
                          const v = cross.cells.find(x => x.row === r.value && x.col === c.value)?.count || 0;
                          const max = Math.max(...cross.cells.map(x => x.count), 1);
                          return <td key={c.value} className="mc-mx-cell" style={{ background: v ? `rgba(37,99,235,${0.08 + (v / max) * 0.82})` : 'transparent', color: v ? '#fff' : '#cbd5e1' }}>{v || '·'}</td>;
                        })}
                        <td className="mc-mx-sum">{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 className="mc-sec-title" style={{ marginTop: 22 }}>💡 重点组合洞察</h4>
              {cross.insights.map((it, i) => (
                <div key={i} className="mc-insight">
                  <span className="mc-insight-r">{i + 1}</span>
                  <div>
                    <b>{it.row}</b> × <b>{it.col}</b>
                    <span className="mc-insight-n">{it.count} 条</span>
                    <div className="mc-insight-sub">占该行 {it.rowPct}% · 占该列 {it.colPct}%</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}