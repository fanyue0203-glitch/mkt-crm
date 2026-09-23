import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, setHeader, toast, deleteItem } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';
import { TierBadge, CustomerStageTag, FollowUpTag, EventStatusTag, SourceTag, StageTag } from '../components/Tags.jsx';

// ===== 客户列表（legacy）=====
function AccountsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [stage, setStage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader('🏢 客户列表', <button className="btn btn-primary" onClick={() => navigate('/octo/account-form')}>+ 新建客户</button>);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (tier) p.set('tier', tier);
    if (stage) p.set('customer_stage', stage);
    api('/api/accounts?' + p).then(d => setRows(d.data)).catch(e => toast(e.message, 'error'));
  }, [search, tier, stage]);

  if (error) return <Err error={error} />;

  return (
    <>
      <div className="search-bar">
        <input type="text" placeholder="搜索公司/行业/负责人..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={tier} onChange={e => setTier(e.target.value)}>
          <option value="">全部等级</option>
          <option value="S">S级</option><option value="A">A级</option><option value="B">B级</option><option value="C">C级</option><option value="D">D级</option>
        </select>
        <select value={stage} onChange={e => setStage(e.target.value)}>
          <option value="">全部阶段</option>
          <option value="已签约">已签约</option><option value="交付中">交付中</option><option value="投标中">投标中</option>
          <option value="B类重点推进">B类重点推进</option><option value="C类跟进">C类跟进</option><option value="D类观察">D类观察</option>
          <option value="战败">战败</option><option value="放弃">放弃</option>
        </select>
      </div>
      <div className="card"><div className="table-wrap">
        <table>
          <tr><th>等级</th><th>公司名称</th><th>行业</th><th>阶段</th><th>金额</th><th>负责人</th><th>卡点</th><th>操作</th></tr>
          {rows === null ? <tr><td colSpan={8}><Loading text="⏳ 加载..." /></td></tr>
            : rows.length ? rows.map(a => (
              <tr className="clickable-row" key={a.id} onClick={() => navigate(`/octo/account/${a.id}`)}>
                <td><TierBadge tier={a.tier} /></td>
                <td><strong>{a.company_name}</strong>{a.region ? <><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.region}</span></> : null}</td>
                <td>{a.industry || '—'}</td>
                <td>{a.customer_stage ? <CustomerStageTag s={a.customer_stage} /> : <FollowUpTag s={a.follow_up_status} />}</td>
                <td style={{ fontWeight: 700, color: 'var(--accent-light)' }}>{a.deal_amount ? a.deal_amount + '万' : '—'}</td>
                <td>{a.assigned_to || '—'}</td>
                <td>{a.blockers ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>⚠️</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                <td><button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); navigate(`/octo/account/${a.id}`); }}>全景档案</button></td>
              </tr>
            )) : <tr><td colSpan={8}><div className="empty-state"><p>暂无客户</p></div></td></tr>}
        </table>
      </div></div>
    </>
  );
}

// ===== 客户 360° 视图（legacy）=====
function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [a, setA] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader('🐙 客户 360° 视图');
    api(`/api/accounts/${id}`).then(d => {
      setA(d);
      setHeader(`🐙 ${d.company_name} · 360° 视图`, <>
        <button className="btn btn-secondary" onClick={() => navigate('/accounts')}>← 返回</button>
        <button className="btn btn-primary" onClick={() => navigate(`/octo/account-form/${id}`)}>编辑</button>
        <button className="btn btn-danger" onClick={() => deleteItem('accounts', id, d.company_name).then(p => { if (p) navigate(p); })}>删除</button>
      </>);
    }).catch(e => setError(e));
  }, [id]);

  if (error) return <Err error={error} />;
  if (!a) return <Loading />;

  const fields = [['行业', a.industry], ['规模', a.scale], ['地区', a.region], ['来源', a.source], ['首次触达', a.first_touch_date], ['触达次数', a.touch_count], ['Octo状态', a.octo_status], ['负责人', a.assigned_to]];

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3><TierBadge tier={a.tier} /> {a.company_name}</h3></div>
        <div className="card-body"><div className="detail-grid">
          {fields.map(([l, v]) => (
            <div key={l}><div className="detail-field"><div className="label">{l}</div><div className="value">{v ?? ''}</div></div></div>
          ))}
        </div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><h3>需求 & 预算</h3></div>
          <div className="card-body">
            <div className="detail-field"><div className="label">需求摘要</div><div className="value">{a.needs_summary}</div></div>
            <div className="detail-field"><div className="label">预估预算</div><div className="value">{a.estimated_budget}</div></div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>🤖 红拂 AI 建议</h3></div>
          <div className="card-body"><div style={{ whiteSpace: 'pre-wrap', color: a.ai_suggestion ? 'var(--text)' : 'var(--text-muted)' }}>{a.ai_suggestion || '接入红拂Agent后自动生成智能跟进建议'}</div></div>
        </div>
      </div>
      {a.events?.length ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3>🎪 参与活动 ({a.events.length})</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table>
              <tr><th>活动</th><th>日期</th><th>状态</th></tr>
              {a.events.map(e => (
                <tr className="clickable-row" key={e.id} onClick={() => navigate(`/ceo-events/${e.id}`)}>
                  <td>{e.name}</td><td>{e.date || '—'}</td><td><EventStatusTag s={e.status} /></td>
                </tr>
              ))}
            </table>
          </div>
        </div>
      ) : null}
      {a.leads?.length ? (
        <div className="card">
          <div className="card-header"><h3>🔄 SDR线索 ({a.leads.length})</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table>
              <tr><th>姓名</th><th>来源</th><th>阶段</th></tr>
              {a.leads.map(l => (
                <tr key={l.id}><td>{l.contact_name}</td><td><SourceTag s={l.source_type} /></td><td><StageTag s={l.stage} /></td></tr>
              ))}
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function Accounts({ mode }) {
  return mode === 'detail' ? <AccountDetail /> : <AccountsList />;
}
