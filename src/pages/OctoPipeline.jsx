import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setHeader } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';

const PIPELINE_COLS = [
  { title: '重点推进', stages: ['B类重点推进', 'C类跟进', 'D类观察'], color: '#3b82f6' },
  { title: 'POC中', stages: ['POC中'], color: '#8b5cf6' },
  { title: '投标中', stages: ['投标中'], color: '#f59e0b' },
  { title: '交付中', stages: ['交付中'], color: '#06b6d4' },
  { title: '已签约', stages: ['已签约'], color: '#10b981' },
  { title: '战败', stages: ['战败', '放弃'], color: '#ef4444' },
];

const progressMap = { 'B类重点推进': 20, '重点推进': 20, 'C类跟进': 15, '跟进中': 15, 'D类观察': 10, '观察': 10, 'POC中': 35, '投标中': 55, '交付中': 75, '已签约': 100, '战败': 0, '放弃': 0 };

function PipelineCard({ a, colColor, onClick }) {
  const progress = progressMap[a.customer_stage] !== undefined ? progressMap[a.customer_stage] : (40 + ((a.id * 17 + 7) % 51));
  const desc = a.product_solutions_detail || a.needs_summary || a.next_step || '';
  const shortDesc = desc.length > 40 ? desc.slice(0, 40) + '...' : desc;
  return (
    <div className="pipeline-card" onClick={onClick}>
      <div className="pc-top">
        <span className={`pc-tier pc-tier-${a.tier || 'C'}`}>{a.tier || 'C'}</span>
        <span className="pc-name">{a.company_name}</span>
      </div>
      {a.industry ? <div className="pc-industry">{a.industry}</div> : <div className="pc-industry" style={{ opacity: 0 }}>&nbsp;</div>}
      {a.deal_amount ? <div className="pc-amount">{a.deal_amount}万</div> : null}
      <div className="pc-progress"><div className="pc-progress-fill" style={{ width: progress + '%', background: colColor }}></div></div>
      {shortDesc ? <div className="pc-desc">{shortDesc}</div> : null}
      {a.assigned_to ? <div className="pc-owner">👤 {a.assigned_to}</div> : null}
    </div>
  );
}

export default function OctoPipeline() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightStage = searchParams.get('stage') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const boardRef = useRef(null);

  useEffect(() => {
    setHeader('🐙 Account Pipeline · 大客户拓展看板', <>
      <button className="btn btn-secondary" onClick={() => navigate('/octo')}>← 返回复盘</button>
      <button className="btn btn-primary" onClick={() => navigate('/octo/account-form')}>+ Add Account</button>
    </>);
    api('/api/accounts?limit=200').then(d => setData(d)).catch(e => setError(e));
  }, []);

  // 高亮列滚动定位
  useEffect(() => {
    if (data && highlightStage) {
      const matchedCol = PIPELINE_COLS.find(c => c.stages.includes(highlightStage));
      if (matchedCol) {
        const t = setTimeout(() => {
          const el = document.getElementById('kanban-col-' + matchedCol.title);
          if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 100);
        return () => clearTimeout(t);
      }
    }
  }, [data, highlightStage]);

  if (error) return <Err error={error} />;
  if (!data) return <Loading />;

  const allAccounts = data.data || [];
  const activeAccounts = allAccounts.filter(a => a.customer_stage && !['战败', '放弃'].includes(a.customer_stage));
  const signedCount = allAccounts.filter(a => a.customer_stage === '已签约').length;
  const pipelineAmount = activeAccounts.reduce((s, a) => s + (a.deal_amount || 0), 0);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="stat-card" style={{ flex: 1 }}><div className="stat-value">{allAccounts.length}</div><div className="stat-label">全部客户</div></div>
        <div className="stat-card" style={{ flex: 1 }}><div className="accent-bar" style={{ background: '#10b981' }}></div><div className="stat-value" style={{ color: '#10b981' }}>{signedCount}</div><div className="stat-label">已签约</div></div>
        <div className="stat-card" style={{ flex: 1 }}><div className="accent-bar" style={{ background: 'var(--pink)' }}></div><div className="stat-value" style={{ color: 'var(--pink)' }}>{pipelineAmount}万</div><div className="stat-label">管线总额</div></div>
      </div>
      <div className="kanban-board" ref={boardRef}>
        {PIPELINE_COLS.map(col => {
          const items = allAccounts.filter(a => col.stages.includes(a.customer_stage));
          const isHighlighted = highlightStage && col.stages.includes(highlightStage);
          return (
            <div className={'kanban-column' + (isHighlighted ? ' col-highlighted' : '')} key={col.title} id={'kanban-col-' + col.title}>
              <div className="kanban-column-header" style={{ borderTopColor: col.color }}>
                <span className="kch-name">{col.title}</span>
                <span className="kch-count">{items.length}</span>
              </div>
              <div className="kanban-cards">
                {items.length
                  ? items.map(a => <PipelineCard key={a.id} a={a} colColor={col.color} onClick={() => navigate(`/octo/account/${a.id}`)} />)
                  : <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>暂无客户</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
