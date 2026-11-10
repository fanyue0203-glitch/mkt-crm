import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setHeader, fmtNum, leadStatusName } from '../api.js';
import { HBars } from '../components/DataBars.jsx';
import { LeadStatusTag, SourceTag } from '../components/Tags.jsx';

const STAGE_COLORS = { new: '#475569', qualified: '#8b5cf6', opportunity: '#f59e0b', closed_won: '#10b981', closed_lost: '#ef4444' };
const STATUS_OPTS = ['new', 'contacted', 'qualified', 'opportunity', 'closed_won', 'closed_lost'];

const FIELDS = [
  { key: 'company_name', label: '公司名称', type: 'text', required: true, span: 2 },
  { key: 'company_short_name', label: '企业简称', type: 'text' },
  { key: 'contact_name', label: '联系人', type: 'text', required: true },
  { key: 'contact_title', label: '职位', type: 'text' },
  { key: 'phone', label: '电话', type: 'text' },
  { key: 'status', label: '线索状态', type: 'select', options: STATUS_OPTS.map(s => ({ value: s, label: leadStatusName(s) })) },
  { key: 'source_channel', label: '来源渠道', type: 'text' },
  { key: 'source_detail', label: '来源子渠道', type: 'text' },
  { key: 'product', label: '需求产品', type: 'text' },
  { key: 'industry', label: '行业', type: 'text' },
  { key: 'team', label: '分配团队', type: 'text' },
  { key: 'assigned_to', label: '分配销售', type: 'text' },
  { key: 'inbound_date', label: '进线日期', type: 'date' },
  { key: 'transfer_date', label: '转出日期', type: 'date' },
  { key: 'opportunity_id', label: '商机号', type: 'text' },
  { key: 'opportunity_stage', label: '商机阶段', type: 'text' },
  { key: 'deal_amount', label: '成单金额(万)', type: 'number' },
  { key: 'lost_reason', label: '丢单原因', type: 'text' },
  { key: 'requirement', label: '需求描述/跟进记录', type: 'textarea', span: 2 },
];

function PageNums({ cur, total, onPage }) {
  cur = +cur; total = +total;
  const pages = [];
  const seen = new Set();
  const add = p => { if (p >= 1 && p <= total && !seen.has(p)) { seen.add(p); pages.push(p); } };
  add(1); add(total);
  for (let i = cur - 2; i <= cur + 2; i++) add(i);
  pages.sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) out.push(<span key={'e' + p} style={{ color: '#64748b', padding: '0 4px' }}>…</span>);
    out.push(<button key={p} className={'btn btn-sm ' + (p === cur ? 'btn-primary' : 'btn-secondary')} onClick={() => onPage(p)} style={{ minWidth: 30, padding: '4px 8px' }}>{p}</button>);
    prev = p;
  }
  return out;
}

function FieldInput({ field, value, onChange }) {
  const val = value ?? '';
  if (field.type === 'select') {
    return (
      <select value={val} onChange={e => onChange(field.key, e.target.value)}>
        <option value="">请选择</option>
        {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return <textarea value={val} onChange={e => onChange(field.key, e.target.value)} rows={3} style={{ width: '100%', resize: 'vertical' }} />;
  }
  return (
    <input type={field.type} value={val} onChange={e => onChange(field.key, e.target.value)}
      placeholder={field.required ? '必填' : ''} />
  );
}

function LeadModal({ lead, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(lead || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(lead || {}); }, [lead]);

  const handleChange = useCallback((key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleSave = async () => {
    if (!form.company_name && !form.contact_name) { alert('公司名称或联系人必填'); return; }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  const handleDelete = () => {
    if (!form.id) { onClose(); return; }
    if (confirm(`确定删除「${form.company_name || form.contact_name}」？`)) onDelete(form.id);
  };

  if (!lead) return null;

  return (
    <div className="modal-overlay active" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{form.id ? '✏️ 编辑线索' : '➕ 新建线索'}</h3>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>✕ 关闭</button>
        </div>
        <div className="modal-body">
          {form.id && (
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8 }}>
              ID: {form.id} · 创建: {form.created_at || '—'} · 更新: {form.updated_at || '—'}
            </div>
          )}
          <div className="drawer-form">
            {FIELDS.map(f => (
              <div key={f.key} className={'form-field' + (f.span === 2 ? ' form-field-full' : '')}>
                <label>
                  {f.label}
                  {f.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                </label>
                <FieldInput field={f} value={form[f.key]} onChange={handleChange} />
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          {form.id && <button className="btn btn-sm btn-danger" onClick={handleDelete} style={{ marginRight: 'auto' }}>🗑 删除</button>}
          <button className="btn btn-sm btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '💾 保存'}</button>
        </div>
      </div>
    </div>
  );
}

function LeadsTable({ defaultStatus, onOpenLead, refreshKey }) {
  const [allRows, setAllRows] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(defaultStatus || '');
  const [source, setSource] = useState('');
  const [product, setProduct] = useState('');
  const [team, setTeam] = useState('');
  const [sortKey, setSortKey] = useState('inbound_date');
  const [sortDir, setSortDir] = useState('desc');
  const [colFilters, setColFilters] = useState({});

  useEffect(() => {
    // 一次加载全量用于前端筛选排序（数据量可控）
    fetch('/api/leads?limit=2000&page=1').then(r => r.json()).then(d => {
      setAllRows(d.data || []);
    }).catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    if (defaultStatus !== undefined) setStatus(defaultStatus);
  }, [defaultStatus]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function setColFilter(key, val) {
    setColFilters(prev => ({ ...prev, [key]: val }));
  }

  function clearAll() {
    setSearch(''); setSource(''); setProduct(''); setTeam('');
    if (!defaultStatus) setStatus('');
    setColFilters({});
  }

  // 前端筛选
  let rows = allRows || [];
  if (defaultStatus) rows = rows.filter(l => l.status === defaultStatus);
  if (status && !defaultStatus) rows = rows.filter(l => l.status === status);
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(l => (l.company_name||'').toLowerCase().includes(s) || (l.contact_name||'').toLowerCase().includes(s) || (l.product||'').toLowerCase().includes(s) || (l.assigned_to||'').toLowerCase().includes(s));
  }
  if (source) rows = rows.filter(l => (l.source_channel||'').includes(source));
  if (product) rows = rows.filter(l => (l.product||'').toLowerCase().includes(product.toLowerCase()));
  if (team) rows = rows.filter(l => (l.team||'').includes(team));
  for (const [key, val] of Object.entries(colFilters)) {
    if (!val) continue;
    const v = val.toLowerCase();
    rows = rows.filter(l => String(l[key]||'').toLowerCase().includes(v));
  }

  // 排序
  rows = [...rows].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (va == null) va = ''; if (vb == null) vb = '';
    if (sortKey === 'deal_amount') { va = +va||0; vb = +vb||0; }
    if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
    const cmp = String(va).localeCompare(String(vb), 'zh');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const activeFilters = (search?1:0) + (!defaultStatus&&status?1:0) + (source?1:0) + (product?1:0) + (team?1:0) + Object.values(colFilters).filter(Boolean).length;

  // 来源/产品/团队去重选项
  const srcOpts = [...new Set((allRows||[]).map(l=>l.source_channel).filter(Boolean))].sort();
  const teamOpts = [...new Set((allRows||[]).map(l=>l.team).filter(Boolean))].sort();

  const LEAD_COLS = [
    { key:'company_name', label:'公司名称', w:160, sortable:true, filterable:true },
    { key:'company_short_name', label:'简称', w:80, sortable:true, filterable:true },
    { key:'contact_name', label:'联系人', w:90, sortable:true, filterable:true },
    { key:'contact_title', label:'职位', w:100, sortable:true, filterable:true },
    { key:'source_channel', label:'来源', w:120, sortable:true, filterable:true, type:'select', opts:srcOpts },
    { key:'product', label:'产品', w:100, sortable:true, filterable:true },
    { key:'industry', label:'行业', w:100, sortable:true, filterable:true },
    { key:'team', label:'团队', w:100, sortable:true, filterable:true, type:'select', opts:teamOpts },
    { key:'assigned_to', label:'分配给', w:90, sortable:true, filterable:true },
    { key:'status', label:'状态', w:90, sortable:true, filterable:false },
    { key:'inbound_date', label:'进线日期', w:100, sortable:true, filterable:false },
    { key:'transfer_date', label:'转出日期', w:100, sortable:true, filterable:false },
  ];

  const SortIc = ({k}) => sortKey!==k ? <span style={{color:'var(--text-muted)',opacity:.3,marginLeft:3}}>↕</span> : <span style={{color:'var(--accent-light)',marginLeft:3}}>{sortDir==='asc'?'↑':'↓'}</span>;

  const renderTh = (col) => {
    if (!col.filterable) {
      return <th key={col.key} style={{width:col.w,minWidth:col.w}} onClick={()=>col.sortable&&toggleSort(col.key)}>{col.label}{col.sortable&&<SortIc k={col.key}/>}</th>;
    }
    if (col.type === 'select') {
      return <th key={col.key} style={{width:col.w,minWidth:col.w}}>
        <div className="th-col">
          <span className="th-label" onClick={()=>col.sortable&&toggleSort(col.key)}>{col.label}<SortIc k={col.key}/></span>
          <select className="th-filter" value={colFilters[col.key]||''} onChange={e=>setColFilter(col.key,e.target.value)}>
            <option value="">全部</option>
            {col.opts.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </th>;
    }
    return <th key={col.key} style={{width:col.w,minWidth:col.w}}>
      <div className="th-col">
        <span className="th-label" onClick={()=>col.sortable&&toggleSort(col.key)}>{col.label}<SortIc k={col.key}/></span>
        <input className="th-filter-input" placeholder="筛选..." value={colFilters[col.key]||''} onChange={e=>setColFilter(col.key,e.target.value)}/>
      </div>
    </th>;
  };

  return (
    <div className="card-body" style={{padding:0}}>
      <div className="acct-filter-bar" style={{top:'calc(var(--header-h) + 45px)'}}>
        <div className="search-bar">
          <input type="text" placeholder="搜索公司/联系人/产品..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:260}}/>
          {!defaultStatus && (
            <select value={status} onChange={e=>setStatus(e.target.value)}>
              <option value="">全部状态</option>
              {STATUS_OPTS.map(s=><option key={s} value={s}>{leadStatusName(s)}</option>)}
            </select>
          )}
          <select value={source} onChange={e=>setSource(e.target.value)}>
            <option value="">全部来源</option>
            {srcOpts.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={team} onChange={e=>setTeam(e.target.value)}>
            <option value="">全部团队</option>
            {teamOpts.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" onClick={()=>onOpenLead(null)} style={{marginLeft:8}}>+ 新建线索</button>
          {activeFilters>0 && <button className="btn btn-sm btn-secondary" onClick={clearAll}>清除({activeFilters})</button>}
          <span style={{marginLeft:'auto',fontSize:12,color:'var(--text-muted)'}}>共 {rows.length} 条</span>
        </div>
      </div>
      <div className="leads-table-wrap">
        <table className="leads-table acct-table">
          <thead><tr className="acct-thead">{LEAD_COLS.map(renderTh)}</tr></thead>
          <tbody>
            {allRows===null?<tr><td colSpan={LEAD_COLS.length} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>⏳ 加载中...</td></tr>
              :rows.length?rows.map(l=>(
                <tr key={l.id} className="clickable-row" onClick={()=>onOpenLead(l)}>
                  <td><strong>{l.company_name||'—'}</strong></td>
                  <td style={{color:'var(--text-muted)',fontSize:12}}>{l.company_short_name||'—'}</td>
                  <td>{l.contact_name||'—'}</td>
                  <td style={{fontSize:12,color:'var(--text-muted)'}}>{l.contact_title||'—'}</td>
                  <td><SourceTag s={l.source_channel}/></td>
                  <td style={{fontSize:12}}>{l.product||'—'}</td>
                  <td style={{fontSize:12,color:'var(--text-muted)'}}>{l.industry||'—'}</td>
                  <td>{l.team||'—'}</td>
                  <td style={{fontSize:12}}>{l.assigned_to||<span style={{color:'var(--text-muted)'}}>未分配</span>}</td>
                  <td><LeadStatusTag s={l.status}/></td>
                  <td style={{fontSize:12,color:'var(--text-muted)'}}>{l.inbound_date||'—'}</td>
                  <td style={{fontSize:12,color:'var(--text-muted)'}}>{l.transfer_date||'—'}</td>
                </tr>
              )):<tr><td colSpan={LEAD_COLS.length}><div className="empty-state"><p>暂无匹配数据</p></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Funnel() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [editingLead, setEditingLead] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setHeader('🔄 线索转化漏斗', <>
      <button className="btn btn-primary" onClick={() => navigate('/import')}>📥 导入数据</button>
    </>);
    api('/api/leads/funnel').then(d => setData(d)).catch(e => setError(e));
  }, [refreshKey]);

  useEffect(() => { setRefreshKey(k => k + 1); }, [tab]);

  const handleSave = async (form) => {
    try {
      if (form.id) {
        await fetch(`/api/leads/${form.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      } else {
        await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      }
      setEditingLead(null);
      setRefreshKey(k => k + 1);
    } catch(e) { alert('保存失败: ' + e.message); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      setEditingLead(null);
      setRefreshKey(k => k + 1);
    } catch(e) { alert('删除失败: ' + e.message); }
  };

  const handleOpenLead = (lead) => {
    if (lead && lead.id) {
      fetch(`/api/leads/${lead.id}`).then(r => r.json()).then(d => setEditingLead(d)).catch(() => setEditingLead(lead));
    } else {
      setEditingLead({ status: tab === 'qualified' ? 'qualified' : 'new' });
    }
  };

  if (error) return <div className="card"><div className="card-body" style={{ color: '#ef4444' }}>加载失败</div></div>;
  if (!data) return <div className="card"><div className="card-body" style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>⏳ 加载中...</div></div>;

  const k = data.kpi || {};
  const mainFunnel = (data.funnel || []).filter(s => ['new','qualified','opportunity','closed_won'].includes(s.status));
  const lostStage = (data.funnel || []).find(s => s.status === 'closed_lost') || null;
  const funnelStages = lostStage ? [...mainFunnel, lostStage] : mainFunnel;
  const funnelRows = funnelStages.map((s, i) => {
    const prev = i > 0 ? funnelStages[i - 1].count : s.count;
    return { ...s, stageRate: prev > 0 ? ((s.count / prev) * 100).toFixed(1) : '100.0', totalRate: k.total > 0 ? ((s.count / k.total) * 100).toFixed(1) : '0.0' };
  });
  const months = data.monthlyTrend || [];
  const maxM = Math.max(...months.map(m => Math.max(m.total, m.transferred)), 1);

  const kpiCards = [
    { v: fmtNum(k.total), l: '线索总量', c: '#3b82f6', icon: '📥' },
    { v: fmtNum(k.qualifiedCount), l: '转出线索数', c: '#8b5cf6', icon: '✅' },
    { v: (k.transferRate || '0.0') + '%', l: '转出率', c: '#06b6d4', icon: '📊' },
    { v: fmtNum(k.opportunityCount), l: '商机数', c: '#f59e0b', icon: '💼' },
    { v: (k.totalDeal ? fmtNum(k.totalDeal) : '0') + '万', l: '成单金额', c: '#10b981', icon: '💰' },
  ];

  const tabs = [
    { key: 'dashboard', label: '📊 数据看板' },
    { key: 'pool', label: '📋 线索池' },
    { key: 'qualified', label: '✅ 转出线索' },
  ];

  if (tab === 'dashboard') {
    return (
      <div>
        <div className="funnel-tabs">
          {tabs.map(t => (
            <div key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>{t.label}</div>
          ))}
        </div>
        <div style={{ height: 'calc(100vh - 200px)', width: '100%', marginTop: 8, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(99,132,255,0.12)' }}>
          <iframe
            src="/funnel-view"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            title="SDR数据看板"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="funnel-tabs">
        {tabs.map(t => (
          <div key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>{t.label}</div>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="funnel-kpi-sticky">
            {kpiCards.map(s => (
              <div className="stat-card" key={s.l}>
                <div className="accent-bar" style={{ background: s.c }}></div>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div className="stat-value" style={{ color: s.c }}>{s.v}</div>
                <div className="stat-label">{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-header"><h3>🔄 转化漏斗</h3></div>
              <div className="card-body">
                {funnelStages.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {funnelRows.map((s, i) => {
                      const topCount = funnelRows[0].count || 1;
                      const wPct = Math.max((s.count / topCount) * 100, 8);
                      return (
                        <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ minWidth: 72, fontSize: 13, fontWeight: 500, color: '#94a3b8', textAlign: 'right' }}>{s.name}</div>
                          <div style={{ flex: 1, height: 36, background: '#162032', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ width: wPct + '%', height: '100%', background: `linear-gradient(90deg,${STAGE_COLORS[s.status]},${STAGE_COLORS[s.status]}cc)`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12, minWidth: 40 }}>
                              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{s.count}</span>
                            </div>
                          </div>
                          <div style={{ minWidth: 80, fontSize: 11, color: '#64748b' }}>
                            {i === 0 ? <span style={{ color: STAGE_COLORS[s.status] }}>起点</span> : <><span style={{ color: STAGE_COLORS[s.status], fontWeight: 600 }}>↘ {s.stageRate}%</span><br /><span style={{ fontSize: 10 }}>总占比 {s.totalRate}%</span></>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>暂无线索数据</div>}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3>📡 来源渠道分布</h3></div>
              <div className="card-body">{data.bySource && data.bySource.length ? <HBars items={data.bySource} color="#3b82f6" /> : <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>暂无数据</div>}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-header"><h3>🏷️ 产品分布</h3></div>
              <div className="card-body">{data.byProduct && data.byProduct.length ? <HBars items={data.byProduct} color="#10b981" /> : <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>暂无数据</div>}</div>
            </div>
            <div className="card">
              <div className="card-header"><h3>👥 团队分配分布</h3></div>
              <div className="card-body">{data.byTeam && data.byTeam.length ? <HBars items={data.byTeam} color="#8b5cf6" /> : <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>暂无数据</div>}</div>
            </div>
          </div>
          {months.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><h3>📈 月度趋势</h3></div>
              <div className="card-body">
                <svg viewBox={`0 0 ${months.length * 80} 280`} style={{ width: '100%', height: 280 }} preserveAspectRatio="xMidYMid meet">
                  {[0,1,2,3,4].map(i => <line key={i} x1="40" y1={30+i*50} x2={months.length*80-10} y2={30+i*50} stroke="rgba(51,65,85,.3)" strokeWidth="1" />)}
                  {months.map((m,i) => { const h = (m.total/maxM)*200; return <rect key={'b'+i} x={i*80+10} y={230-h} width="24" height={h} fill="rgba(59,130,246,.7)" rx="3" />; })}
                  {months.map((m,i) => { const h = (m.transferred/maxM)*200; return <rect key={'t'+i} x={i*80+38} y={230-h} width="24" height={h} fill="rgba(139,92,246,.7)" rx="3" />; })}
                  <polyline fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4,3" points={months.map((m,i) => `${i*80+36},${230-(m.total>0?(m.transferred/m.total*200):0)}`).join(' ')} />
                  {months.map((m,i) => <circle key={'c'+i} cx={i*80+36} cy={230-(m.total>0?(m.transferred/m.total*200):0)} r="3" fill="#10b981" />)}
                  {months.map((m,i) => <text key={'l'+i} x={i*80+36} y="260" textAnchor="middle" fill="#64748b" fontSize="11">{m.month.slice(5)}</text>)}
                </svg>
                <div style={{ display:'flex', gap:16, justifyContent:'center', fontSize:12, marginTop:8, color:'#94a3b8' }}>
                  <span><span style={{display:'inline-block',width:12,height:12,background:'rgba(59,130,246,.7)',borderRadius:2,marginRight:4,verticalAlign:'middle'}}></span>进线量</span>
                  <span><span style={{display:'inline-block',width:12,height:12,background:'rgba(139,92,246,.7)',borderRadius:2,marginRight:4,verticalAlign:'middle'}}></span>转出量</span>
                  <span><span style={{display:'inline-block',width:16,height:0,borderTop:'2px dashed #10b981',marginRight:4,verticalAlign:'middle'}}></span>转出率</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'pool' && (
        <div className="card">
          <LeadsTable onOpenLead={handleOpenLead} refreshKey={refreshKey} />
        </div>
      )}

      {tab === 'qualified' && (
        <div className="card">
          <LeadsTable defaultStatus="qualified" onOpenLead={handleOpenLead} refreshKey={refreshKey} />
        </div>
      )}

      <LeadModal lead={editingLead} onClose={() => setEditingLead(null)} onSave={handleSave} onDelete={handleDelete} />
    </div>
  );
}
