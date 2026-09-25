import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setHeader, setBadge, fmtNum, leadStatusName } from '../api.js';
import ChartCanvas from '../components/Charts.jsx';
import { LeadStatusTag, SourceTag } from '../components/Tags.jsx';
import { Err, Loading } from '../components/Common.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [octo, setOcto] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader('Dashboard');
    Promise.all([
      api('/api/stats'),
      api('/api/octo/summary').catch(() => null)
    ]).then(([s, o]) => {
      setStats(s);
      setOcto(o);
      setBadge('speeches', s.speeches?.total ?? 0);
      setBadge('leads', s.leads?.total ?? 0);
      if (o?.kpi) {
        const blockerCount = (o.kpi.blockers || 0) + (o.kpi.pendingDecisions || 0);
        setBadge('blockers', blockerCount);
      }
    }).catch(e => setError(e));
  }, []);

  if (error) return <Err error={error} />;
  if (!stats) return <Loading />;

  // 线索漏斗（去掉已联系，与Funnel页一致）
  const funnelStatuses = ['new', 'qualified', 'opportunity', 'closed_won', 'closed_lost'];
  const funnelColors = ['#475569', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'];
  const funnelConfig = (stats.leads.byStatus && stats.leads.byStatus.length) ? (() => {
    const sd = funnelStatuses.map(s => (stats.leads.byStatus.find(x => x.status === s) || { c: 0 }).c);
    return {
      type: 'bar',
      data: {
        labels: funnelStatuses.map(leadStatusName),
        datasets: [{ label: '线索数', data: sd, backgroundColor: funnelColors, borderRadius: 6, borderSkipped: false }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, color: '#64748b' }, grid: { color: 'rgba(51,65,85,.3)' } },
          x: { ticks: { color: '#64748b' }, grid: { display: false } }
        }
      }
    };
  })() : null;

  // Octo阶段分布
  const stageColorMap = { '已签约': '#10b981', '交付中': '#06b6d4', '已付费': '#10b981', '投标中': '#f59e0b', '重点推进': '#3b82f6', 'B类重点推进': '#3b82f6', 'POC中': '#8b5cf6', '跟进中': '#64748b', 'C类跟进': '#64748b', '观察中': '#475569', 'D类观察': '#475569', '战败': '#ef4444', '放弃': '#ef4444' };
  const stageLabel = { '已签约': '已签约', '交付中': '交付中', '已付费': '已付费', '投标中': '投标中', '重点推进': 'B类推进', 'B类重点推进': 'B类推进', 'POC中': 'POC中', '跟进中': 'C类跟进', 'C类跟进': 'C类跟进', '观察中': 'D类观察', 'D类观察': 'D类观察' };

  const k = octo?.kpi || {};
  const l = stats.leads;
  const qualifiedCount = (l.byStatus||[]).find(s=>s.status==='qualified')?.c||0;
  const opportunityCount = (l.byStatus||[]).find(s=>s.status==='opportunity')?.c||0;
  const wonCount = (l.byStatus||[]).find(s=>s.status==='closed_won')?.c||0;
  const transferRate = l.total > 0 ? (qualifiedCount / l.total * 100).toFixed(1) : '0.0';

  return (
    <>
      <div className="hero">
        <div className="hero-title">MKT-CRM · 市场部数据指挥中心</div>
        <div className="hero-sub">明略科技 · 品牌与市场部 AI-Native 工作台 · 实时数据概览</div>
        <div className="hero-stats">
          <div className="hero-stat animate-in" onClick={() => navigate('/ceo-events')} style={{ animationDelay: '.1s' }}>
            <span className="icon">🎤</span>
            <div className="value pink">{fmtNum(stats.ceoFunnel?.act || 0)}</div>
            <div className="label">活动获客·已开通</div>
            <div className="sub">加微{fmtNum(stats.ceoFunnel?.wechat||0)} · 转出{stats.ceoFunnel?.sql||0} · 共{stats.events.total}场{stats.ceoFunnel?.ceoEvents ? `(CEO${stats.ceoFunnel.ceoEvents}场)` : ''}</div>
          </div>
          <div className="hero-stat animate-in" onClick={() => navigate('/octo')} style={{ animationDelay: '.2s' }}>
            <span className="icon">🐙</span>
            <div className="value green">{k.totalAccounts || stats.accounts.total}</div>
            <div className="label">Octo大客户</div>
            <div className="sub">
              {k.signedCount ? `签约${k.signedCount}家(${k.wonAmount||0}万) · B类${k.bClassCount}家 · 管线${k.pipeline||0}万` : (stats.accounts.byTier.map(t => t.tier+': '+t.c).join(' · ') || '等待导入')}
            </div>
          </div>
          <div className="hero-stat animate-in" onClick={() => navigate('/funnel')} style={{ animationDelay: '.3s' }}>
            <span className="icon">🔄</span>
            <div className="value orange">{fmtNum(l.total)}</div>
            <div className="label">线索转化漏斗</div>
            <div className="sub">转出{qualifiedCount} · 商机{opportunityCount} · 转出率{transferRate}%</div>
          </div>
        </div>
      </div>

      {/* 第一行：活动获客转化 + 线索月度趋势 + Octo大客户阶段 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <h3>🎤 活动获客转化（全量）</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/ceo-events')}>查看详情 →</button>
          </div>
          <div className="card-body">
            {stats.ceoFunnel ? (
              <>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:12}}>
                  {[
                    {v: fmtNum(stats.ceoFunnel.wechat), l:'加微', c:'var(--accent)'},
                    {v: fmtNum(stats.ceoFunnel.reg), l:'申请', c:'var(--info)'},
                    {v: fmtNum(stats.ceoFunnel.act), l:'开通', c:'var(--success)'},
                    {v: stats.ceoFunnel.sql, l:'转出', c:'var(--warning)'},
                  ].map(s => (
                    <div key={s.l} style={{textAlign:'center',padding:'6px 2px',background:'var(--bg-surface)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                      <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {(() => {
                    const cf = stats.ceoFunnel;
                    const top = Math.max(cf.wechat, cf.reg, 1);
                    return [
                      {l:'活码加微', v:cf.wechat, c:'var(--accent)'},
                      {l:'OCTO申请', v:cf.reg, c:'var(--info)'},
                      {l:'审核开通', v:cf.act, c:'var(--success)'},
                      {l:'转出销售', v:cf.sql, c:'var(--warning)'},
                    ].map(r => (
                      <div key={r.l} style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{minWidth:58,fontSize:11,color:'var(--text-secondary)',textAlign:'right'}}>{r.l}</span>
                        <div style={{flex:1,height:20,background:'var(--bg-surface)',borderRadius:4,overflow:'hidden'}}>
                          <div style={{width:Math.max(r.v/top*100,3)+'%',height:'100%',background:r.c,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:6}}>
                            <span style={{fontSize:10,fontWeight:700,color:'#fff'}}>{r.v}</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                <div style={{marginTop:8,padding:'6px 8px',background:'rgba(236,72,153,.08)',border:'1px solid rgba(236,72,153,.15)',borderRadius:6,fontSize:10,color:'var(--text-secondary)',lineHeight:1.5}}>
                  🔥混沌94%开通率最高·晚点贡献64%开通量·共{stats.events.total}场活动(CEO{stats.ceoFunnel?.ceoEvents||0}场)
                </div>
              </>
            ) : <div className="empty-state" style={{padding:20}}><p>暂无数据</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>📈 线索月度趋势</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/funnel')}>查看详情 →</button>
          </div>
          <div className="card-body">
            {stats.leads?.monthlyTrend?.length ? (() => {
              const months = stats.leads.monthlyTrend;
              const maxV = Math.max(...months.map(m => Math.max(m.total, m.transferred)), 1);
              const n = months.length;
              return (
                <div>
                  <svg viewBox={`0 0 ${n*60+20} 200`} style={{ width: '100%', height: 200 }}>
                    {[0,1,2,3].map(i => <line key={i} x1="30" y1={20+i*40} x2={n*60} y2={20+i*40} stroke="rgba(51,65,85,.3)" strokeWidth="1" />)}
                    {months.map((m,i) => { const h=(m.total/maxV)*140; return <rect key={'b'+i} x={i*60+8} y={160-h} width="18" height={h} fill="rgba(59,130,246,.7)" rx="2" />; })}
                    {months.map((m,i) => { const h=(m.transferred/maxV)*140; return <rect key={'t'+i} x={i*60+30} y={160-h} width="18" height={h} fill="rgba(139,92,246,.7)" rx="2" />; })}
                    {months.map((m,i) => <text key={'l'+i} x={i*60+28} y="185" textAnchor="middle" fill="#64748b" fontSize="10">{m.month.slice(5)}</text>)}
                  </svg>
                  <div style={{ display:'flex',gap:14,justifyContent:'center',fontSize:11,marginTop:4,color:'#94a3b8' }}>
                    <span><span style={{display:'inline-block',width:10,height:10,background:'rgba(59,130,246,.7)',borderRadius:2,marginRight:4,verticalAlign:'middle'}}></span>进线量</span>
                    <span><span style={{display:'inline-block',width:10,height:10,background:'rgba(139,92,246,.7)',borderRadius:2,marginRight:4,verticalAlign:'middle'}}></span>转出量</span>
                  </div>
                </div>
              );
            })() : <div style={{textAlign:'center',color:'#64748b',padding:24}}>暂无趋势数据</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>🐙 Octo 大客户阶段分布</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/octo')}>查看详情 →</button>
          </div>
          <div className="card-body">
            {octo?.byStage?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(octo.byStage || []).filter(s => s.stage !== 'D类观察').map(s => {
                  const max = Math.max(...(octo.byStage || []).map(x => x.count), 1);
                  const wPct = Math.max(s.count / max * 100, 6);
                  const color = stageColorMap[s.stage] || '#64748b';
                  const label = stageLabel[s.stage] || s.stage;
                  return (
                    <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ minWidth: 70, fontSize: 12, fontWeight: 500, color: '#94a3b8', textAlign: 'right' }}>{label}</div>
                      <div style={{ flex: 1, height: 28, background: '#162032', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: wPct + '%', height: '100%', background: `linear-gradient(90deg,${color},${color}cc)`, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{s.count}</span>
                        </div>
                      </div>
                      <div style={{ minWidth: 60, fontSize: 11, color: '#64748b', textAlign: 'right' }}>{s.amount > 0 ? s.amount + '万' : ''}</div>
                    </div>
                  );
                })}
              </div>
            ) : <div className="empty-state" style={{ padding: 24 }}><p>暂无客户数据</p></div>}
          </div>
        </div>
      </div>

      {/* 第二行：最新线索 */}
      <div style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <h3>🔥 最新线索</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/funnel')}>查看全部 →</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {stats.recentLeads.length ? (
              <table>
                <tr><th>公司名称</th><th>简称</th><th>联系人</th><th>来源</th><th>状态</th></tr>
                {stats.recentLeads.map((l, i) => (
                  <tr key={i} style={{ cursor: 'pointer' }} onClick={() => navigate('/funnel')}>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.company_name || '—'}</td>
                    <td style={{ color:'#94a3b8', fontSize:12 }}>{l.company_short_name || '—'}</td>
                    <td>{l.contact_name || '—'}</td>
                    <td><SourceTag s={l.source_channel} /></td>
                    <td><LeadStatusTag s={l.status} /></td>
                  </tr>
                ))}
              </table>
            ) : (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="icon">🔄</div>
                <p>暂无线索</p>
                <button className="btn btn-primary" onClick={() => navigate('/import')}>📥 导入数据</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 第三行：来源/产品/团队 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header"><h3>📡 来源渠道</h3></div>
          <div className="card-body" style={{ padding: 16 }}>
            {stats.leads?.bySource?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(() => {
                  const items = stats.leads.bySource.slice(0, 8);
                  const max = Math.max(...items.map(s => s.count), 1);
                  return items.map(s => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ minWidth: 80, fontSize: 11, color: '#94a3b8', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      <div style={{ flex: 1, height: 18, background: '#162032', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: Math.max(s.count/max*100, 4) + '%', height: '100%', background: 'linear-gradient(90deg,#3b82f6,#60a5fa)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{s.count}</span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : <div style={{ textAlign:'center',color:'#64748b',padding:20 }}>暂无数据</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>🏷️ 产品分布</h3></div>
          <div className="card-body" style={{ padding: 16 }}>
            {stats.leads?.byProduct?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(() => {
                  const items = stats.leads.byProduct.slice(0, 8);
                  const max = Math.max(...items.map(s => s.count), 1);
                  return items.map(s => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ minWidth: 80, fontSize: 11, color: '#94a3b8', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      <div style={{ flex: 1, height: 18, background: '#162032', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: Math.max(s.count/max*100, 4) + '%', height: '100%', background: 'linear-gradient(90deg,#10b981,#34d399)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{s.count}</span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : <div style={{ textAlign:'center',color:'#64748b',padding:20 }}>暂无数据</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>👥 团队分配</h3></div>
          <div className="card-body" style={{ padding: 16 }}>
            {stats.leads?.byTeam?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(() => {
                  const items = stats.leads.byTeam.slice(0, 8);
                  const max = Math.max(...items.map(s => s.count), 1);
                  return items.map(s => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ minWidth: 80, fontSize: 11, color: '#94a3b8', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      <div style={{ flex: 1, height: 18, background: '#162032', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: Math.max(s.count/max*100, 4) + '%', height: '100%', background: 'linear-gradient(90deg,#8b5cf6,#a78bfa)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{s.count}</span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : <div style={{ textAlign:'center',color:'#64748b',padding:20 }}>暂无数据</div>}
          </div>
        </div>
      </div>
    </>
  );
}
