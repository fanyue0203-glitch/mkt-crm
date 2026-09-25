import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setHeader, fmtNum } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';
import { EventStatusTag } from '../components/Tags.jsx';

export default function CeoEvents() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader('📊 CEO获客·数据分析看板', <>
      <button className="btn btn-secondary" onClick={() => navigate('/ceo-events/report')}>📊 分析报告</button>
      <button className="btn btn-secondary" onClick={() => navigate('/ceo-events/data-logic')}>📐 取数逻辑</button>
      <button className="btn btn-primary" onClick={() => navigate('/ceo-events/customers')}>👥 客户明细</button>
      <button className="btn btn-secondary" onClick={() => navigate('/ceo-events/new?type=ceo')}>+ 新建活动</button>
    </>);
    api('/api/events').then(d => setData(d)).catch(e => setError(e));
  }, []);

  if (error) return <Err error={error} />;
  if (!data) return <Loading />;

  const all = data.data || [];
  const ceo = all.filter(e => e.key_messages === '吴明辉(CEO)');
  const mkt = all.filter(e => e.key_messages !== '吴明辉(CEO)');

  // CEO获客汇总（数据源：events表CEO获客活动，口径与CEO获客数据分析报告一致）
  const tReg = ceo.reduce((s, e) => s + (e.wechat_followers || 0), 0);
  const tLeads = ceo.reduce((s, e) => s + (e.registrations || 0), 0);
  const tMql = ceo.reduce((s, e) => s + (e.activations || 0), 0);
  const tSql = ceo.reduce((s, e) => s + (e.sql_count || 0), 0);
  const tMax = Math.max(tReg, 1);

  const funnel = [['活码加微', tReg], ['OCTO申请', tLeads], ['审核开通', tMql], ['转出销售', tSql]]
    .map(([l, v]) => (
      <div className="funnel-row" key={l}>
        <span className="fl-label">{l}</span>
        <div className="fl-bar"><div className="fl-fill" style={{ width: Math.max(v / tMax * 100, 2) + '%' }}></div></div>
        <span className="fl-val">{v}</span>
      </div>
    ));

  const kpiCards = [
    { v: ceo.length, l: '🎯 CEO获客活动', c: 'var(--pink)' },
    { v: fmtNum(tReg), l: '👥 活码加微', c: 'var(--accent)' },
    { v: fmtNum(tLeads), l: '📝 OCTO申请', c: 'var(--info)' },
    { v: fmtNum(tMql), l: '✅ 审核开通', c: 'var(--success)' },
    { v: tSql, l: '📤 转出销售', c: 'var(--warning)' },
  ];

  return (
    <>
      <div className="sticky-bar">
        <div className="tabs" style={{ marginBottom: 8 }}>
          <div className="tab active">📊 数据分析看板</div>
          <div className="tab" onClick={() => navigate('/ceo-events/customers')} style={{ cursor: 'pointer' }}>👥 客户明细</div>
        </div>
        <div className="stats-grid" style={{gridTemplateColumns:'repeat(5,1fr)',gap:8,padding:'0 0 8px'}}>
          {kpiCards.map(s => (
            <div className="stat-card" key={s.l} style={{padding:'8px 4px'}}>
              <div className="accent-bar" style={{ background: s.c }}></div>
              <div className="stat-value" style={{ color: s.c, fontSize:18 }}>{s.v}</div>
              <div className="stat-label" style={{fontSize:11}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><h3>🎯 CEO获客漏斗（{ceo.length}场活动·全渠道总计）</h3></div>
          <div className="card-body">
            {funnel}
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>口径：REG=活码加微，LEADS=OCTO申请，MQL=审核开通，SQL=转出销售；混沌学院无活码直接发开通链接</div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>💡 核心洞察</h3></div>
          <div className="card-body">
            <div className="highlight-box success"><strong>渠道效果排名：</strong>🥇混沌学院(94%通过率·CEO社群信任背书) 🥈《晚点》头条(33%·流量最大198加微) 🥉Octo产品发布(12%·小规模精准)；混沌+晚点贡献96%开通量</div>
            <div className="highlight-box"><strong>活动获客≠大客户获取：</strong>39家大客户中25家(64%)来自高管直推，贡献100%签约+90%+管线；线上活动是品牌势能和信任入口</div>
            <div className="highlight-box warning"><strong>混沌模式值得复制：</strong>不走活码直接发开通链接(94%通过率)——CEO在高信任社群分享→直接引导注册，跳过加微中间环节</div>
            <div className="highlight-box insight"><strong>加微≠转化：</strong>394个活码加微中77%加微后零后续动作，建议加微后7天内SDR外呼/私信激活</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3>📊 逐活动转化对比 <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>点击行查看明细 →</span></h3></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table>
            <tr><th>活动</th><th>日期</th><th>获客方式</th><th>加微</th><th>申请</th><th>开通</th><th>转出</th><th>转化率</th></tr>
            {ceo.length ? ceo.map(e => {
              const rate = e.wechat_followers > 0
                ? ((e.activations || 0) / e.wechat_followers * 100).toFixed(0) + '%'
                : (e.registrations > 0 ? ((e.activations || 0) / e.registrations * 100).toFixed(0) + '%(申请→)' : '—');
              return (
                <tr className="clickable-row" key={e.id} onClick={() => navigate(`/ceo-events/${e.id}`)}>
                  <td><strong>{e.name}</strong></td>
                  <td>{e.date || '—'}</td>
                  <td style={{ fontSize: 12 }}>{e.wechat_followers > 0 ? '企微活码扫码' : '直接开通链接'}</td>
                  <td>{e.wechat_followers > 0 ? e.wechat_followers : '无活码'}</td>
                  <td style={{ fontWeight: 600 }}>{e.registrations || 0}</td>
                  <td style={{ fontWeight: 600, color: 'var(--success)' }}>{e.activations || 0}</td>
                  <td>{e.sql_count || 0}</td>
                  <td>{rate}</td>
                </tr>
              );
            }) : <tr><td colSpan={8}><div className="empty-state"><p>暂无CEO获客活动</p></div></td></tr>}
          </table>
        </div>
      </div>

      {mkt.length ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3>🎪 市场部活动（{mkt.length}场）<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>点击行查看明细 →</span></h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table>
              <tr><th>活动</th><th>日期</th><th>类型</th><th>报名</th><th>到场</th><th>留资</th><th>MQL</th></tr>
              {mkt.map(e => (
                <tr className="clickable-row" key={e.id} onClick={() => navigate(`/ceo-events/${e.id}`)}>
                  <td><strong>{e.name}</strong></td>
                  <td>{e.date || '—'}</td>
                  <td>{e.event_type || '—'}</td>
                  <td>{fmtNum(e.registrations)}</td>
                  <td>{fmtNum(e.audience_count)}</td>
                  <td>{e.activations || 0}</td>
                  <td>{e.mql_count || 0}</td>
                </tr>
              ))}
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}
