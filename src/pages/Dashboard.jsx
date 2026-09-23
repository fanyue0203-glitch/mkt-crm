import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setHeader, setBadge, fmtNum, leadStatusName } from '../api.js';
import ChartCanvas from '../components/Charts.jsx';
import { LeadStatusTag, SourceTag } from '../components/Tags.jsx';
import { Err, Loading } from '../components/Common.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader('Dashboard');
    api('/api/stats').then(d => {
      setStats(d);
      setBadge('speeches', d.speeches?.total ?? 0);
      setBadge('leads', d.leads?.total ?? 0);
      api('/api/octo/summary').then(s => {
        const blockerCount = (s.kpi?.blockers || 0) + (s.kpi?.pendingDecisions || 0);
        setBadge('blockers', blockerCount);
      }).catch(() => {});
    }).catch(e => setError(e));
  }, []);

  if (error) return <Err error={error} />;
  if (!stats) return <Loading />;

  const funnelConfig = (stats.leads.byStatus && stats.leads.byStatus.length) ? (() => {
    const so = ['new', 'contacted', 'qualified', 'opportunity', 'closed_won', 'closed_lost'];
    const sd = so.map(s => (stats.leads.byStatus.find(x => x.status === s) || { c: 0 }).c);
    return {
      type: 'bar',
      data: {
        labels: so.map(leadStatusName),
        datasets: [{ label: '线索数', data: sd, backgroundColor: ['#475569', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'], borderRadius: 6, borderSkipped: false }]
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

  const tiersConfig = (stats.accounts.byTier && stats.accounts.byTier.length) ? {
    type: 'doughnut',
    data: {
      labels: stats.accounts.byTier.map(t => t.tier + ' 级'),
      datasets: [{ data: stats.accounts.byTier.map(t => t.c), backgroundColor: stats.accounts.byTier.map(t => ({ 'S': '#ef4444', 'A': '#f97316', 'B': '#3b82f6', 'C': '#64748b' }[t.tier])), borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } }
    }
  } : null;

  return (
    <>
      <div className="hero">
        <div className="hero-title">MKT-CRM · 市场部数据指挥中心</div>
        <div className="hero-sub">明略科技 · 品牌与市场部 AI-Native 工作台 · 实时数据概览</div>
        <div className="hero-stats">
          <div className="hero-stat animate-in" onClick={() => navigate('/ceo-events')} style={{ animationDelay: '.1s' }}>
            <span className="icon">🎤</span>
            <div className="value pink">{stats.speeches.total}</div>
            <div className="label">活动和CEO获客</div>
            <div className="sub">累计触达 {fmtNum(stats.speeches.totalAudience)} 人</div>
          </div>
          <div className="hero-stat animate-in" onClick={() => navigate('/octo')} style={{ animationDelay: '.2s' }}>
            <span className="icon">🐙</span>
            <div className="value green">{stats.accounts.total}</div>
            <div className="label">Octo 大客户</div>
            <div className="sub">{stats.accounts.byTier.map(t => t.tier + ': ' + t.c).join(' · ') || '等待导入'}</div>
          </div>
          <div className="hero-stat animate-in" onClick={() => navigate('/funnel')} style={{ animationDelay: '.3s' }}>
            <span className="icon">🔄</span>
            <div className="value orange">{stats.leads.total}</div>
            <div className="label">SDR 线索</div>
            <div className="sub">{(stats.leads.byStatus || []).map(s => leadStatusName(s.status) + ' ' + s.c).join(' · ') || '等待导入'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><h3>📊 SDR 线索漏斗</h3></div>
          <div className="card-body">
            {(stats.leads.byStatus || []).length
              ? <ChartCanvas config={funnelConfig} />
              : <div className="empty-state" style={{ padding: 24 }}><p>导入线索数据后自动生成漏斗</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>🏢 客户等级分布</h3></div>
          <div className="card-body">
            {stats.accounts.byTier.length
              ? <ChartCanvas config={tiersConfig} />
              : <div className="empty-state" style={{ padding: 24 }}><p>导入客户数据后自动生成分布图</p></div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <h3>🎤 活动和CEO获客</h3>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/speeches/new')}>+ 新建</button>
          </div>
          <div className="card-body">
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 36, fontWeight: 800, background: 'var(--gradient-pink)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stats.speeches.total}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>累计场次 · 触达 {fmtNum(stats.speeches.totalAudience)} 人</div>
              <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/ceo-events')}>查看全部 →</button>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>🔥 最新线索</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            {stats.recentLeads.length ? (
              <table>
                <tr><th>姓名</th><th>公司</th><th>来源</th><th>阶段</th></tr>
                {stats.recentLeads.map((l, i) => (
                  <tr key={i}>
                    <td>{l.contact_name || '—'}</td>
                    <td>{l.company_name || '—'}</td>
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
    </>
  );
}
