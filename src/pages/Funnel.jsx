import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setHeader, toast, openModal, closeModal, fmtNum, leadStatusName } from '../api.js';
import { HBars } from '../components/DataBars.jsx';
import ChartCanvas from '../components/Charts.jsx';
import { Err, Loading } from '../components/Common.jsx';
import { LeadStatusTag, SourceTag } from '../components/Tags.jsx';

const STAGE_COLORS = { new: '#475569', contacted: '#3b82f6', qualified: '#8b5cf6', opportunity: '#f59e0b', closed_won: '#10b981', closed_lost: '#ef4444' };
const STATUS_OPTS = ['new', 'contacted', 'qualified', 'opportunity', 'closed_won', 'closed_lost'];

// ===== 线索表单弹窗 =====
function LeadFormModal({ lead, onSaved }) {
  const formRef = useRef(null);
  const l = lead || {};
  async function onSave(ev) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(formRef.current));
    body.deal_amount = +body.deal_amount || 0;
    try {
      if (l.id) {
        await api('/api/leads/' + l.id, { method: 'PUT', body });
        toast('线索更新成功');
      } else {
        await api('/api/leads', { method: 'POST', body });
        toast('线索创建成功');
      }
      closeModal(); onSaved();
    } catch (e) { toast(e.message, 'error'); }
  }
  return (
    <>
      <div className="modal-header"><h3>{l.id ? '编辑线索 #' + l.id : '新建线索'}</h3><button onClick={closeModal} style={{ fontSize: 20 }}>✕</button></div>
      <div className="modal-body"><form ref={formRef} onSubmit={onSave}>
        <div className="form-row">
          <div className="form-group"><label>公司名称 *</label><input name="company_name" required defaultValue={l.company_name || ''} /></div>
          <div className="form-group"><label>联系人</label><input name="contact_name" defaultValue={l.contact_name || ''} /></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>职位</label><input name="contact_title" defaultValue={l.contact_title || ''} /></div>
          <div className="form-group"><label>电话</label><input name="phone" defaultValue={l.phone || ''} /></div>
          <div className="form-group"><label>状态</label>
            <select name="status" defaultValue={l.status || 'new'}>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{leadStatusName(s)}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>来源渠道</label><input name="source_channel" defaultValue={l.source_channel || ''} placeholder="400电话/官方微信/Octo体验..." /></div>
          <div className="form-group"><label>来源子渠道</label><input name="source_detail" defaultValue={l.source_detail || ''} /></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>需求产品</label><input name="product" defaultValue={l.product || ''} /></div>
          <div className="form-group"><label>行业</label><input name="industry" defaultValue={l.industry || ''} /></div>
          <div className="form-group"><label>团队</label><input name="team" defaultValue={l.team || ''} /></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>分配销售</label><input name="assigned_to" defaultValue={l.assigned_to || ''} /></div>
          <div className="form-group"><label>进线日期</label><input type="date" name="inbound_date" defaultValue={l.inbound_date || ''} /></div>
          <div className="form-group"><label>转出日期</label><input type="date" name="transfer_date" defaultValue={l.transfer_date || ''} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>商机号</label><input name="opportunity_id" defaultValue={l.opportunity_id || ''} /></div>
          <div className="form-group"><label>成单金额(万)</label><input type="number" step="0.01" name="deal_amount" defaultValue={l.deal_amount || ''} /></div>
        </div>
        <div className="form-group"><label>需求描述/跟进记录</label><textarea name="requirement" rows={3} defaultValue={l.requirement || ''}></textarea></div>
        <div className="form-group"><label>丢单原因</label><input name="lost_reason" defaultValue={l.lost_reason || ''} /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={closeModal}>取消</button>
          <button type="submit" className="btn btn-primary">💾 保存</button>
        </div>
      </form></div>
    </>
  );
}

// ===== 线索详情弹窗 =====
function LeadViewModal({ l, onEdit, onDelete }) {
  const fields = [
    ['公司名称', l.company_name], ['联系人', l.contact_name], ['职位', l.contact_title], ['电话', l.phone],
    ['来源渠道', l.source_channel], ['来源明细', l.source_detail], ['需求产品', l.product], ['行业', l.industry],
    ['所属团队', l.team], ['分配给', l.assigned_to], ['进线日期', l.inbound_date], ['转出日期', l.transfer_date],
    ['成单金额(万)', l.deal_amount ? l.deal_amount + '万' : ''],
  ];
  return (
    <>
      <div className="modal-header"><h3>🔍 {l.company_name || '线索详情'}</h3><button onClick={closeModal} style={{ fontSize: 20 }}>✕</button></div>
      <div className="modal-body">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <LeadStatusTag s={l.status} />
          {l.source_channel ? <span className="tag tag-cyan">{l.source_channel}</span> : null}
          {l.product ? <span className="tag tag-blue">{l.product}</span> : null}
        </div>
        <div className="detail-grid">
          {fields.map(([lb, v]) => (
            <div className="detail-field" key={lb}><div className="label">{lb}</div><div className="value">{v ?? ''}</div></div>
          ))}
        </div>
        {l.requirement ? (
          <div className="detail-field" style={{ marginTop: 12 }}>
            <div className="label">需求描述/跟进记录</div>
            <div className="value" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>{l.requirement}</div>
          </div>
        ) : null}
        {l.lost_reason ? (
          <div className="detail-field" style={{ marginTop: 8 }}><div className="label">丢单原因</div><div className="value" style={{ color: 'var(--danger)' }}>{l.lost_reason}</div></div>
        ) : null}
      </div>
      <div className="modal-footer">
        <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('确定删除？')) { closeModal(); onDelete(l.id); } }}>删除</button>
        <button className="btn btn-secondary" onClick={closeModal}>关闭</button>
        <button className="btn btn-primary" onClick={() => { closeModal(); onEdit(l.id); }}>✏️ 编辑</button>
      </div>
    </>
  );
}

// ===== 页码 =====
function PageNums({ cur, total, onPage }) {
  cur = +cur; total = +total;
  let pages = [];
  const add = p => { if (p >= 1 && p <= total && !pages.includes(p)) pages.push(p); };
  add(1); add(total);
  for (let i = cur - 2; i <= cur + 2; i++) add(i);
  pages.sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) out.push(<span key={'e' + p} style={{ color: 'var(--text-muted)', padding: '0 4px' }}>…</span>);
    out.push(
      <button key={p} className={'btn btn-sm ' + (p === cur ? 'btn-primary' : 'btn-secondary')} onClick={() => onPage(p)} style={{ minWidth: 30, padding: '4px 8px' }}>{p}</button>
    );
    prev = p;
  }
  return out;
}

export default function Funnel() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [leads, setLeads] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    setHeader('🔄 SDR 漏斗', <>
      <button className="btn btn-secondary" onClick={() => { if (confirm('确定清空所有线索数据？清空后需重新导入。')) clearAllLeads(); }}>🗑️ 清空线索</button>
      <button className="btn btn-sm btn-primary" onClick={() => openLeadForm()}>+ 新建线索</button>
      <button className="btn btn-primary" onClick={() => navigate('/import')}>📥 导入数据</button>
    </>);
  }, []);

  useEffect(() => {
    api('/api/leads/funnel').then(d => setData(d)).catch(e => setError(e));
  }, [refreshKey]);

  // 线索池表格
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (source) params.set('source_channel', source);
    params.set('page', page); params.set('limit', 20);
    api('/api/leads?' + params).then(d => setLeads(d)).catch(e => toast(e.message, 'error'));
  }, [search, status, source, page, refreshKey]);

  if (error) return <Err error={error} />;
  if (!data) return <Loading />;

  const k = data.kpi || {};
  const mainFunnel = (data.funnel || []).filter(s => s.status !== 'closed_lost');
  const lostCount = ((data.funnel || []).find(s => s.status === 'closed_lost') || { count: 0 }).count;

  const funnelRows = mainFunnel.map((s, i) => {
    const prev = i > 0 ? mainFunnel[i - 1].count : s.count;
    return {
      ...s,
      stageRate: prev > 0 ? ((s.count / prev) * 100).toFixed(1) : '100.0',
      totalRate: k.total > 0 ? ((s.count / k.total) * 100).toFixed(1) : '0.0',
    };
  });

  const openLeadForm = async (id) => {
    let l = {};
    if (id) {
      try { l = await api('/api/leads/' + id); } catch (e) { toast(e.message, 'error'); return; }
    }
    openModal(<LeadFormModal lead={l} onSaved={refresh} />);
  };

  const viewLead = async (id) => {
    try {
      const l = await api('/api/leads/' + id);
      openModal(<LeadViewModal l={l} onEdit={openLeadForm} onDelete={deleteLead} />);
    } catch (e) { toast(e.message, 'error'); }
  };

  async function clearAllLeads() {
    try { const r = await api('/api/leads/all', { method: 'DELETE' }); toast(r.message); refresh(); } catch (e) { toast(e.message, 'error'); }
  }
  async function deleteLead(id) {
    try { await api('/api/leads/' + id, { method: 'DELETE' }); toast('删除成功'); refresh(); } catch (e) { toast(e.message, 'error'); }
  }

  const monthlyConfig = (data.monthlyTrend && data.monthlyTrend.length) ? (() => {
    const months = data.monthlyTrend.map(m => m.month);
    const totals = data.monthlyTrend.map(m => m.total);
    const transferred = data.monthlyTrend.map(m => m.transferred);
    const rates = data.monthlyTrend.map(m => m.total > 0 ? (m.transferred / m.total * 100).toFixed(1) : 0);
    return {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          { label: '进线量', data: totals, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.15)', tension: .3, fill: true, pointRadius: 4, pointBackgroundColor: '#3b82f6' },
          { label: '转出量', data: transferred, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,.15)', tension: .3, fill: true, pointRadius: 4, pointBackgroundColor: '#8b5cf6' },
          { label: '转出率%', data: rates, borderColor: '#10b981', backgroundColor: 'transparent', borderDash: [5, 5], tension: .3, pointRadius: 3, pointBackgroundColor: '#10b981', yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', usePointStyle: true, padding: 16 } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: '#64748b', precision: 0 }, grid: { color: 'rgba(51,65,85,.3)' }, title: { display: true, text: '数量', color: '#64748b' } },
          y1: { position: 'right', beginAtZero: true, max: 100, ticks: { color: '#10b981', callback: v => v + '%' }, grid: { display: false }, title: { display: true, text: '转出率', color: '#10b981' } },
          x: { ticks: { color: '#64748b' }, grid: { display: false } },
        },
      },
    };
  })() : null;

  const sourceOptions = (data.bySource || []).map(s => s.name);
  const totalPages = leads ? (Math.ceil(leads.total / leads.limit) || 1) : 1;

  const kpiCards = [
    { v: fmtNum(k.total), l: '线索总量', c: 'var(--accent)', icon: '📥' },
    { v: fmtNum(k.qualifiedCount), l: '转出线索数', c: 'var(--info)', icon: '✅' },
    { v: (k.transferRate || '0.0') + '%', l: '转出率', c: '#8b5cf6', icon: '📊' },
    { v: fmtNum(k.opportunityCount), l: '商机数', c: 'var(--warning)', icon: '💼' },
    { v: (k.totalDeal ? fmtNum(k.totalDeal) : '0') + '万', l: '成单金额', c: 'var(--success)', icon: '💰' },
  ];

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(5,1fr)' }}>
        {kpiCards.map(s => (
          <div className="stat-card animate-in" key={s.l}>
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
            {mainFunnel.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {funnelRows.map((s, i) => {
                  const topCount = funnelRows[0].count || 1;
                  const wPct = Math.max((s.count / topCount) * 100, 8);
                  const isFirst = i === 0;
                  return (
                    <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ minWidth: 72, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'right' }}>{s.name}</div>
                      <div style={{ flex: 1, position: 'relative', height: 36, background: 'var(--bg-surface)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ width: wPct + '%', height: '100%', background: `linear-gradient(90deg,${STAGE_COLORS[s.status]},${STAGE_COLORS[s.status]}cc)`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12, transition: 'width .8s cubic-bezier(.4,0,.2,1)', minWidth: 40 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.4)' }}>{s.count}</span>
                        </div>
                      </div>
                      <div style={{ minWidth: 80, fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>
                        {isFirst
                          ? <span style={{ color: STAGE_COLORS[s.status] }}>起点</span>
                          : <><span style={{ color: STAGE_COLORS[s.status], fontWeight: 600 }}>↘ {s.stageRate}%</span><br /><span style={{ fontSize: 10 }}>总占比 {s.totalRate}%</span></>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div className="empty-state" style={{ padding: 24 }}><p>暂无线索数据</p></div>}
            {lostCount ? (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--danger)' }}>❌ 无效/丢单: <strong>{lostCount}</strong> 条</div>
            ) : null}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>📡 来源渠道分布</h3></div>
          <div className="card-body">
            {data.bySource && data.bySource.length ? <HBars items={data.bySource} color="#3b82f6" /> : <div className="empty-state" style={{ padding: 24 }}><p>暂无来源数据</p></div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><h3>🏷️ 产品分布</h3></div>
          <div className="card-body">
            {data.byProduct && data.byProduct.length ? <HBars items={data.byProduct} color="#10b981" /> : <div className="empty-state" style={{ padding: 24 }}><p>暂无产品数据</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>👥 团队分配分布</h3></div>
          <div className="card-body">
            {data.byTeam && data.byTeam.length ? <HBars items={data.byTeam} color="#8b5cf6" /> : <div className="empty-state" style={{ padding: 24 }}><p>暂无团队数据</p></div>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3>📈 月度趋势（进线量 vs 转出量）</h3></div>
        <div className="card-body">
          {monthlyConfig
            ? <ChartCanvas config={monthlyConfig} height={280} />
            : <div className="empty-state" style={{ padding: 24 }}><p>暂无月度数据（需要 inbound_date 字段）</p></div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>📋 线索池</h3><button className="btn btn-sm btn-primary" onClick={() => openLeadForm()}>+ 新建线索</button></div>
        <div className="card-body" style={{ padding: 16 }}>
          {!leads ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>⏳ 加载线索...</div> : (
            <>
              <div className="search-bar" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                <input type="text" placeholder="🔍 搜索公司/联系人/产品..." value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 280 }} />
                <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
                  <option value="">全部状态</option>
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{leadStatusName(s)}</option>)}
                </select>
                <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }}>
                  <option value="">全部来源</option>
                  {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>共 {leads.total} 条 · {page}/{totalPages} 页</span>
              </div>
              <div className="table-wrap">
                <table>
                  <tr><th>公司名称</th><th>联系人</th><th>职位</th><th>电话</th><th>来源渠道</th><th>产品</th><th>行业</th><th>团队</th><th>分配给</th><th>状态</th><th>进线日期</th><th>操作</th></tr>
                  {leads.data.length ? leads.map(l => (
                    <tr className="clickable-row" key={l.id} onClick={() => viewLead(l.id)}>
                      <td><strong>{l.company_name || '—'}</strong></td>
                      <td>{l.contact_name || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{l.contact_title || '—'}</td>
                      <td style={{ fontSize: 12 }}>{l.phone || '—'}</td>
                      <td><SourceTag s={l.source_channel} /></td>
                      <td>{l.product || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{l.industry || '—'}</td>
                      <td>{l.team || '—'}</td>
                      <td>{l.assigned_to || <span style={{ color: 'var(--text-muted)' }}>未分配</span>}</td>
                      <td><LeadStatusTag s={l.status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.inbound_date || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openLeadForm(l.id)}>编辑</button>{' '}
                        <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('确定删除？')) deleteLead(l.id); }}>删除</button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={12}><div className="empty-state" style={{ padding: 24 }}><p>暂无匹配数据</p></div></td></tr>}
                </table>
              </div>
              {totalPages > 1 ? (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-sm btn-secondary" disabled={+page <= 1} style={{ opacity: +page <= 1 ? .4 : 1, cursor: +page <= 1 ? 'not-allowed' : 'pointer' }} onClick={() => setPage(p => p - 1)}>← 上页</button>
                  <PageNums cur={page} total={totalPages} onPage={setPage} />
                  <button className="btn btn-sm btn-secondary" disabled={+page >= totalPages} style={{ opacity: +page >= totalPages ? .4 : 1, cursor: +page >= totalPages ? 'not-allowed' : 'pointer' }} onClick={() => setPage(p => p + 1)}>下页 →</button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
