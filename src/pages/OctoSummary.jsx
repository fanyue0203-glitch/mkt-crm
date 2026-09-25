import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setHeader, setBadge, toast } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';
import { StageBars } from '../components/DataBars.jsx';
import { TierBadge, CustomerStageTag } from '../components/Tags.jsx';

const short = (s, n = 90) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };
const money = a => a.deal_amount ? `${a.deal_amount}万` : ((a.estimated_budget || '').replace('¥', '') || '—');

const SECTION_TITLES = ['大盘概览', '重点客户', '行业洞察', '需求共性', '阻碍卡点', '竞品分析', '成功/失败模式'];
const CN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八'];

export default function OctoSummary() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'dashboard';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader('🐙 Octo 大客户复盘', <>
      <button className="btn btn-secondary" onClick={() => navigate('/octo/pipeline')}>📊 看板视图</button>
      <button className="btn btn-primary" onClick={() => navigate('/octo/account-form')}>+ 新建客户</button>
    </>);
    api('/api/octo/summary').then(d => {
      setData(d);
      const k = d.kpi || {};
      setBadge('blockers', (k.blockers || 0) + (k.pendingDecisions || 0));
    }).catch(e => setError(e));
  }, []);

  if (error) return <Err error={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <div className="sub-tabs">
        <div className={'tab' + (tab === 'dashboard' ? ' active' : '')} onClick={() => setSearchParams({ tab: 'dashboard' })}>📊 全景报告</div>
        <div className={'tab' + (tab === 'list' ? ' active' : '')} onClick={() => setSearchParams({ tab: 'list' })}>🏢 全部客户</div>
      </div>
      {tab === 'dashboard' ? <OctoDashboard d={data} /> : <OctoListTab />}
    </>
  );
}

// ===== 全景报告（8大板块）=====
function OctoDashboard({ d }) {
  const navigate = useNavigate();
  const k = d.kpi || {};
  const clink = a => (
    <span onClick={() => navigate(`/octo/account/${a.id}`)} style={{ cursor: 'pointer', color: 'var(--accent-light)', fontWeight: 700 }}>{a.company_name}</span>
  );

  const signed = d.signed || [], bidding = d.bidding || [], bClass = d.bClass || [], cClass = d.cClass || [], dClass = d.dClass || [], deadAll = d.deadAll || [];
  const wonAmt = signed.reduce((s, a) => s + (a.deal_amount || 0), 0);
  const bPipe = bClass.reduce((s, a) => s + (a.deal_amount || 0), 0);
  const bidPipe = bidding.reduce((s, a) => s + (a.deal_amount || 0), 0);
  const totalPlus = wonAmt + bPipe + bidPipe;

  const [activeSec, setActiveSec] = useState(1);
  React.useEffect(() => {
    const obs = () => {
      for (let i = 1; i <= SECTION_TITLES.length; i++) {
        const el = document.getElementById(`pano-${i}`);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.top <= 140 && r.bottom > 140) { setActiveSec(i); break; }
        }
      }
    };
    window.addEventListener('scroll', obs, { passive: true });
    return () => window.removeEventListener('scroll', obs);
  }, []);
  const sectionNav = SECTION_TITLES.map((t, i) => (
    <a key={t} className={'tag ' + (activeSec === i + 1 ? 'tag-green' : 'tag-blue')} style={{ cursor: 'pointer', margin: 3, fontWeight: activeSec === i + 1 ? 700 : 400 }}
      onClick={() => document.getElementById(`pano-${i + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
      {CN_NUMS[i]} {t}
    </a>
  ));

  const statCards = (
    <div className="strategy-overview">
      <div className="overview-item"><div className="ov-value" style={{ color: 'var(--accent-light)' }}>{k.totalAccounts}</div><div className="ov-label">覆盖客户</div></div>
      <div className="overview-item"><div className="ov-value" style={{ color: 'var(--success)' }}>{signed.length || 3}</div><div className="ov-label">已签约/交付</div></div>
      <div className="overview-item"><div className="ov-value" style={{ color: 'var(--warning)' }}>{bidding.length || 1}</div><div className="ov-label">投标中</div></div>
      <div className="overview-item"><div className="ov-value" style={{ color: 'var(--accent)' }}>{bClass.length || 7}</div><div className="ov-label">B类重点</div></div>
      <div className="overview-item"><div className="ov-value" style={{ color: 'var(--pink)' }}>{totalPlus}万+</div><div className="ov-label">签约+管线</div></div>
      <div className="overview-item"><div className="ov-value" style={{ color: 'var(--danger)' }}>{deadAll.length || 12}</div><div className="ov-label">战败/放弃</div></div>
    </div>
  );

  const signedCards = signed.map(a => (
    <div className="signed-card" key={a.id} onClick={() => navigate(`/octo/account/${a.id}`)}>
      <div className="sc-top"><TierBadge tier={a.tier} /><span className="sc-name">{a.company_name}</span></div>
      <div className="sc-amount">{money(a)}</div>
      <div className="sc-owner">👤 {a.assigned_to || ''}</div>
      <div className="sc-status">{short(a.customer_recognition || a.product_solutions_detail || a.next_step || a.needs_summary, 120)}</div>
    </div>
  ));

  const yutong = bidding[0];
  const biddingCard = yutong ? (
    <div className="bidding-card" onClick={() => navigate(`/octo/account/${yutong.id}`)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <TierBadge tier={yutong.tier} />
          <span className="bc-name" style={{ marginLeft: 8 }}>{yutong.company_name}</span>
          <div className="bc-amount">≤{yutong.deal_amount || 200}万<span style={{ fontSize: 13, color: '#fca5a5', fontWeight: 400 }}> + 二三期各200万</span></div>
        </div>
        <div className="countdown">⏰ 9/25前出结果</div>
      </div>
      <div className="bc-meta">
        <div className="bc-meta-item"><div className="bc-meta-label">负责人</div><div className="bc-meta-value">{yutong.assigned_to || ''}</div></div>
        <div className="bc-meta-item"><div className="bc-meta-label">进展</div><div className="bc-meta-value">9/18郑州述标完成</div></div>
        <div className="bc-meta-item"><div className="bc-meta-label">联系人</div><div className="bc-meta-value">16+联系人 / 10条线</div></div>
        <div className="bc-meta-item"><div className="bc-meta-label">竞品</div><div className="bc-meta-value">酷开/实在/联想/腾讯/阿里</div></div>
      </div>
      <div className="highlight-box danger" style={{ marginTop: 10 }}>姜平定调「亏本也拿」；客户认可 Octo 是 AI 原生平台（非 AI 增强工具）；11月需量化提效。</div>
    </div>
  ) : null;

  const bCards = bClass.map(a => (
    <div className="bclass-card" key={a.id} onClick={() => navigate(`/octo/account/${a.id}`)}>
      <div className="bcc-top">
        <TierBadge tier={a.tier} style={{ width: 'auto', height: 'auto', padding: '1px 6px', fontSize: 10 }} />
        <span className="bcc-name">{a.company_name}</span>
        <span className="bcc-amount">{money(a)}</span>
      </div>
      <div className="bcc-owner">👤 {a.assigned_to || ''}</div>
      <div className="bcc-status">{short(a.product_solutions_detail || a.needs_summary || a.next_step, 105)}</div>
      {a.blockers ? <div className="bcc-blocker">⚠️ {short(a.blockers, 70)}</div> : null}
    </div>
  ));

  const compact = arr => arr.map(a => (
    <div className="compact-item" key={a.id} onClick={() => navigate(`/octo/account/${a.id}`)}>
      <TierBadge tier={a.tier} style={{ width: 'auto', height: 'auto', padding: '2px 6px', fontSize: 10 }} />
      <span className="ci-name">{a.company_name}</span>
      <span className="ci-status">{short(a.needs_summary || a.blockers || a.next_step || a.core_painpoint, 100)}</span>
      <span className="ci-owner">{a.assigned_to || ''}</span>
    </div>
  ));

  const byIndustry = d.byIndustry || [];
  const indMax = Math.max(...byIndustry.map(v => v.c || 0), 1);
  const indColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];
  const industryBars = byIndustry.slice(0, 10).map((x, i) => (
    <div className="data-bar-row" key={i}>
      <div className="data-bar-label">{x.industry}</div>
      <div className="data-bar"><div className="data-bar-fill" style={{ width: Math.max((x.c || 0) / indMax * 100, 3) + '%', background: indColors[i % 6] }}></div></div>
      <div className="data-bar-value">{x.c}家</div>
    </div>
  ));
  const industryInsights = [
    ['制造业', '吉利/三一/宇通/极光湾：私有化部署、大合同、长周期，是核心收入来源和标杆复制主赛道。'],
    ['医疗', '卓正/联合影像/健主任/新世纪：付费意愿强、合规要求高、私有化刚需，卓正已成可复制标杆。'],
    ['快消', '南孚/宝洁系线索：AIGC营销和企业协同替代诉求强，预算中等但决策链清晰。'],
    ['互联网', '墨迹/得到/PPIO/混沌：技术接受度高，但自研/免费生态替代强，必须先判断付费意愿。'],
  ].map(([t, desc]) => <div className="highlight-box" key={t}><strong>{t}</strong><br />{desc}</div>);

  const concerns = (d.topConcerns || []).map(c => (
    <div className="concern-item" key={c.rank}>
      <div className="ci-rank">{c.rank}</div>
      <div><div className="ci-title">{c.title}</div><div className="ci-desc">{c.desc}</div></div>
    </div>
  ));
  const demandBars = [['私有化部署', 30], ['AI Coding', 8], ['会议Agent', 7], ['HR场景', 6], ['营销AIGC', 6], ['数据治理', 5], ['AtoA协作', 5]].map(([n, c], i) => (
    <div className="data-bar-row" key={n}>
      <div className="data-bar-label">{n}</div>
      <div className="data-bar"><div className="data-bar-fill" style={{ width: c / 30 * 100 + '%', background: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'][i] }}></div></div>
      <div className="data-bar-value">{c}家+</div>
    </div>
  ));

  const blockers = (d.blockers || []).slice(0, 20);
  const blockerGroups = [
    { name: '资源卡点', desc: '跨产品线协调、交付团队、售前资源', items: blockers.filter(x => /资源|交付|售前|团队|协调|主R/.test(x.blockers || '')), color: 'red', icon: '🔴' },
    { name: '商务卡点', desc: '预算周期、合规审批、定价异议、合同边界', items: blockers.filter(x => /预算|合规|价格|费用|合同|商务|Token|保险|SOC/.test(x.blockers || '')), color: 'yellow', icon: '🟡' },
    { name: '技术卡点', desc: '集成复杂度、环境搭建、Token显示、私有化部署', items: blockers.filter(x => /技术|集成|环境|Token|部署|私有化|Loop/.test(x.blockers || '')), color: 'blue', icon: '🔵' },
  ];
  const blockersHtml = blockerGroups.map(g => (
    <div className="card" style={{ marginBottom: 12 }} key={g.name}>
      <div className="card-header"><h3>{g.icon} {g.name}</h3><span className="section-count">{g.items.length}项</span></div>
      <div className="card-body">
        {g.items.length ? g.items.map(b => (
          <div className={`action-item ${g.color}`} key={b.id} onClick={() => navigate(`/octo/account/${b.id}`)}>
            <span className="ai-company">{b.company_name}</span>
            <span className="ai-content">{short(b.blockers, 130)}</span>
            <span className="ai-owner">{b.assigned_to || ''}</span>
          </div>
        )) : <span style={{ color: 'var(--text-muted)' }}>暂无</span>}
      </div>
    </div>
  ));

  const byCompetitor = d.byCompetitor || [];
  const compMax = Math.max(...byCompetitor.map(v => v.count || 0), 1);
  const compColors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4'];
  const compBars = byCompetitor.slice(0, 12).map((x, i) => (
    <div className="data-bar-row" key={i}>
      <div className="data-bar-label">{x.name}</div>
      <div className="data-bar"><div className="data-bar-fill" style={{ width: Math.max(x.count / compMax * 100, 3) + '%', background: compColors[i % 5] }}></div></div>
      <div className="data-bar-value">{x.count}</div>
    </div>
  ));
  const compInsights = [
    ['飞书Aily/飞书生态', '最大竞争对手；生态锁定一旦建立几乎不可破，得到/方里是典型战败。'],
    ['腾讯Hermes/WorkBuddy', '大企业IM+AI入口竞争，南孚/宇通场景均出现。'],
    ['阿里QoderWork/MuleRun', 'AI Coding方向强对手，宇通/墨迹均出现。'],
    ['Dify/开源自建', '企业内部技术团队低成本替代方案，三一等制造客户会对比。'],
  ].map(([t, desc]) => <div className="highlight-box" key={t}><strong>{t}</strong><br />{desc}</div>);

  const successPatterns = [
    '高管直推/CEO关系：卓正「必须发生」、南孚CEO+CMO辉哥直通，关系质量决定成交概率。',
    '明确付费意愿+刚需场景：卓正医疗私有化、南孚替代钉飞企微、宇通CIO线招标。',
    '交付团队快速响应：私有化部署、现场安装、培训和量化提效要跟上销售节奏。',
  ].map((x, i) => <div className="lesson-item" key={i}><span className="li-num">{i + 1}</span><span>{x}</span></div>);

  const failureGroups = (d.deadGrouped || []).map(g => (
    <div className="dead-group" key={g.title}>
      <div className="dead-group-header">
        {g.icon} {g.title}
        <span className="dg-desc">{g.desc || ''}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--danger)', fontWeight: 700, fontSize: 12 }}>{g.items.length}家</span>
      </div>
      {g.items.map(it => (
        <div className="dead-item" key={it.id}>
          <span className="di-name">{it.company_name}</span>
          <span className="di-lesson">{short(it.lessons_learned || it.blockers, 100)}</span>
        </div>
      ))}
    </div>
  ));
  const coreLessons = (d.coreLessons || []).map((l, i) => <div className="lesson-item" key={i}><span className="li-num">{i + 1}</span><span>{l}</span></div>);

  const actionHtml = (d.actionItems || []).slice(0, 18).map(a => {
    const cls = a.priority === 'red' ? 'red' : a.priority === 'yellow' ? 'yellow' : 'blue';
    const label = { red: '紧急', yellow: '本周', blue: '推进' }[cls];
    return (
      <div className={`action-item ${cls}`} key={a.account_id || Math.random()} onClick={() => navigate(`/octo/account/${a.account_id}`)}>
        <span className="ai-prio">{label}</span>
        <span className="ai-company">{a.company_name}</span>
        <span className="ai-content">{short(a.content, 130)}</span>
        <span className="ai-owner">{a.owner || ''}</span>
      </div>
    );
  });

  return (
    <div className="panorama">
      <div className="card panorama-nav">
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 6 }}>快速导航</span>
            {sectionNav}
          </div>
        </div>
      </div>

      <div className="section-card" id="pano-1">
        <div className="section-header"><h3>一、大盘概览</h3><span className="section-count">KR2整体战况</span></div>
        <div className="section-body">
          {statCards}
          <div className="conclusion-box"><strong>战略定调：</strong>姜平明确「不能付费的客户不再投入时间」；宇通定调「亏本也拿」；卓正定调「必须发生」。客户分层围绕A/B/C/D进行资源配置，制造+医疗贡献100%签约和80%+管线。</div>
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-header"><h3>管线阶段金额</h3></div>
            <div className="card-body"><div className="data-bars"><StageBars stages={d.byStage || []} /></div></div>
          </div>
        </div>
      </div>

      <div className="section-card" id="pano-2">
        <div className="section-header"><h3>二、重点客户</h3><span className="section-count">重点推进 · 风险提示 · 战败名单</span></div>
        <div className="section-body">
          {(d.healthGroups || []).map(g => {
            const cnt = g.items.length;
            if (g.tier === '健康推进中') {
              return (
                <div key={g.tier} style={{ marginBottom: 16 }}>
                  <h4>🟢 重点推进客户（{cnt}家）</h4>
                  <div className="client-grid">
                    {g.items.map(a => (
                      <div className="signed-card" key={a.id} onClick={() => navigate(`/octo/account/${a.id}`)}>
                        <div className="sc-top"><TierBadge tier={a.tier} /><span className="sc-name">{a.company_name}</span></div>
                        <div className="sc-amount">{money(a)}</div>
                        <div className="sc-owner">👤 {a.assigned_to || ''}</div>
                        <div className="sc-status">{short(a.octo_status || a.next_step || a.needs_summary, 100)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            const icon = { '有风险': '🟡', '战败冻结': '🔴' }[g.tier] || '⚪';
            const label = { '有风险': '有风险客户', '战败冻结': '战败/放弃客户' }[g.tier] || g.tier;
            return (
              <div key={g.tier} style={{ marginBottom: 12 }}>
                <h4 style={{ marginBottom: 8 }}>{icon} {label}（{cnt}家）</h4>
                <div className="name-only-list">
                  {g.items.map(a => (
                    <span
                      key={a.id}
                      className="name-chip"
                      style={g.tier === '战败冻结' ? { background: 'rgba(239,68,68,.08)', color: '#f87171', borderColor: 'rgba(239,68,68,.2)' } : { background: 'rgba(245,158,11,.08)', color: '#fbbf24', borderColor: 'rgba(245,158,11,.2)' }}
                      onClick={() => navigate(`/octo/account/${a.id}`)}
                    >{a.company_name}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-card" id="pano-3">
        <div className="section-header"><h3>三、行业洞察</h3><span className="section-count">6大行业组 · Octo契合度</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>行业</th><th>客户数</th><th>已签约</th><th>代表客户</th><th>Octo契合度</th></tr>
            <tbody>
              {(d.byIndustryGroup || []).map(g => {
                const meta = {
                  '制造业': { fit: '⭐⭐⭐ 最强', reps: '吉利/三一/宇通/极光湾/南孚', note: '预算大、CEO推动、贡献80%+管线', color: 'var(--success)' },
                  '医疗健康': { fit: '⭐⭐⭐ 已验证', reps: '卓正/健主任/联合影像/新世纪', note: '卓正标杆已落地，可复制', color: 'var(--success)' },
                  '金融投资': { fit: '⭐⭐ 高价值高门槛', reps: 'HKIC/中信/鹏扬/中金/华泰', note: '合规门槛高，投研场景契合', color: 'var(--warning)' },
                  '科技互联网': { fit: '⭐⭐ 有机会竞争激烈', reps: '墨迹/PPIO/51World', note: '飞书渗透率高，易自建', color: 'var(--warning)' },
                  '教育': { fit: '⭐ 潜力中等', reps: '金智/混沌/卓越', note: '高校有潜力，付费能力有限', color: 'var(--info)' },
                  '央国企': { fit: '⭐ 长周期', reps: '致远/卓望/普联', note: '决策链极长，体量大', color: 'var(--info)' },
                }[g.grp] || {};
                return (
                  <tr key={g.grp} className="clickable-row">
                    <td><strong>{g.grp}</strong></td>
                    <td>{g.count}</td>
                    <td>{g.signed || 0}</td>
                    <td style={{ fontSize: 12 }}>{meta.reps || ''}</td>
                    <td><span style={{ color: meta.color, fontWeight: 600, fontSize: 12 }}>{meta.fit || ''}</span><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta.note || ''}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div></div>
          <div className="highlight-box success" style={{ marginTop: 12 }}><strong>行业优先级：</strong>制造+医疗是已验证最强赛道，贡献100%签约和80%+管线。</div>
        </div>
      </div>

      <div className="section-card" id="pano-4">
        <div className="section-header"><h3>四、需求共性</h3><span className="section-count">5类需求 · 价值×难度矩阵</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>需求类型</th><th>数量</th><th>占比</th><th>价值</th><th>难度</th><th>涉及客户</th></tr>
            <tbody>
              {(d.byDemand || []).map(x => {
                const meta = {
                  'AI原生组织变革': { v: '极高', vc: 'var(--success)', d: '高', dc: 'var(--danger)' },
                  '私有化部署': { v: '高', vc: 'var(--warning)', d: '中', dc: 'var(--warning)' },
                  '特定场景AI化': { v: '中高', vc: 'var(--warning)', d: '低', dc: 'var(--success)' },
                  '生态渠道合作': { v: '不确定', vc: 'var(--info)', d: '中', dc: 'var(--warning)' },
                  '试用探索': { v: '低', vc: 'var(--text-muted)', d: '高', dc: 'var(--danger)' },
                }[x.name] || {};
                return (
                  <tr key={x.name}>
                    <td><strong>{x.name}</strong></td>
                    <td style={{ fontWeight: 700 }}>{x.count}</td>
                    <td>{Math.round(x.count / 39 * 100)}%</td>
                    <td><span style={{ color: meta.vc, fontWeight: 600 }}>{meta.v || ''}</span></td>
                    <td><span style={{ color: meta.dc, fontWeight: 600 }}>{meta.d || ''}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 360 }}>{(x.clients || []).join('、')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div></div>
          <div className="highlight-box" style={{ marginTop: 12 }}><strong>关键洞察：</strong>「AI原生组织变革」占比仅21%但贡献最大营收（吉利390万/三一5万人/卓正全院/南孚替代三套）；「试用/探索」占比41%但价值最低——16家中缺乏实质推进动作。</div>
        </div>
      </div>

      <div className="section-card" id="pano-5">
        <div className="section-header"><h3>五、阻碍卡点</h3><span className="section-count">6类阻碍 · 严重度×可解决性</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>阻碍</th><th>影响</th><th>严重度</th><th>可解决</th><th>涉及客户</th></tr>
            <tbody>
              {(d.byBlocker || []).map(x => {
                const meta = {
                  '部署≠使用': { sev: '🔴系统性', sevc: 'var(--danger)', sol: '高', solc: 'var(--success)' },
                  '竞品锁定': { sev: '🔴结构性', sevc: 'var(--danger)', sol: '低', solc: 'var(--danger)' },
                  '决策链长': { sev: '🟡客观', sevc: 'var(--warning)', sol: '中', solc: 'var(--warning)' },
                  '产品技术卡点': { sev: '🟡可迭代', sevc: 'var(--warning)', sol: '高', solc: 'var(--success)' },
                  '合规硬门槛': { sev: '🔴硬门槛', sevc: 'var(--danger)', sol: '中', solc: 'var(--warning)' },
                  '关系线索衰减': { sev: '🟡可预防', sevc: 'var(--warning)', sol: '高', solc: 'var(--success)' },
                }[x.name] || {};
                return (
                  <tr key={x.name}>
                    <td><strong>{x.name}</strong></td>
                    <td style={{ fontWeight: 700 }}>{x.count}</td>
                    <td><span style={{ color: meta.sevc, fontWeight: 600, fontSize: 12 }}>{meta.sev || ''}</span></td>
                    <td><span style={{ color: meta.solc, fontWeight: 600 }}>{meta.sol || ''}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 360 }}>{(x.clients || []).join('、')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div></div>
          <div className="highlight-box danger" style={{ marginTop: 12 }}><strong>最大系统性风险：</strong>「部署≠使用」影响6家，占已部署客户40%+。</div>
        </div>
      </div>

      <div className="section-card" id="pano-6">
        <div className="section-header"><h3>六、竞品分析</h3><span className="section-count">生态入口之争</span></div>
        <div className="section-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card"><div className="card-header"><h3>竞品出现频次</h3></div><div className="card-body"><div className="data-bars">{compBars}</div></div></div>
            <div>{compInsights}</div>
          </div>
        </div>
      </div>

      <div className="section-card" id="pano-7">
        <div className="section-header"><h3>七、成功/失败模式</h3><span className="section-count">成功三条件 + 四种失败模式</span></div>
        <div className="section-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><h4>✅ 成功模式三条件</h4><div className="lessons-summary">{successPatterns}</div></div>
            <div>
              <h4>❌ 四种失败模式（数据驱动）</h4>
              {(d.byFailure || []).map(x => {
                const meta = {
                  'A': { name: 'A：部署后沉默', root: '交付完无激活职责', color: 'var(--danger)' },
                  'B': { name: 'B：竞品锁定', root: '飞书闭环不可破', color: 'var(--danger)' },
                  'C': { name: 'C：合规硬门槛', root: '资质不满足', color: 'var(--warning)' },
                  'D': { name: 'D：需求未建立', root: '关系型无实质需求', color: 'var(--warning)' },
                }[x.mode] || {};
                return (
                  <div key={x.mode} style={{ marginBottom: 10, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', borderLeft: '3px solid ' + (meta.color || 'var(--danger)') }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: meta.color, fontWeight: 700 }}>{meta.name || x.mode}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>（{meta.root || ''}）</span>
                      <span style={{ marginLeft: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
                        {x.clients.map((c, ci) => (
                          <span key={c}>
                            <span style={{ color: 'var(--danger)', cursor: 'pointer' }} onClick={() => {
                              const acc = (d.healthGroups || []).flatMap(g => g.items).find(a => a.company_name === c);
                              if (acc) navigate(`/octo/account/${acc.id}`);
                            }}>{c}</span>{ci < x.clients.length - 1 ? '、' : ''}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <h4 style={{ margin: '18px 0 10px' }}>6条核心教训</h4>
          <div className="lessons-summary">{coreLessons}</div>
          <div className="highlight-box danger" style={{ marginTop: 10 }}><strong>战败率31%真相：</strong>12家中仅2家「真失败」，其余10家「一开始就不该投重型资源」。核心：<strong>「更早更准地筛」</strong>。</div>
        </div>
      </div>
    </div>
  );
}

// ===== 全部客户列表 tab =====
function OctoListTab() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [stage, setStage] = useState('');

  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (tier) p.set('tier', tier);
    if (stage) p.set('customer_stage', stage);
    api('/api/accounts?' + p).then(d => setRows(d.data)).catch(e => toast(e.message, 'error'));
  }, [search, tier, stage]);

  return (
    <>
      <div className="sticky-bar">
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
      </div>
      <div className="card"><div className="table-wrap">
        <table>
          <tr><th>等级</th><th>客户名</th><th>行业</th><th>金额(万)</th><th>负责人</th><th>阶段</th><th>卡点</th><th>操作</th></tr>
          {rows === null ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>⏳ 加载中...</td></tr>
            : rows.length ? rows.map(a => (
              <tr className="clickable-row" key={a.id} onClick={() => navigate(`/octo/account/${a.id}`)}>
                <td><TierBadge tier={a.tier} /></td>
                <td><strong>{a.company_name}</strong></td>
                <td>{a.industry || '—'}</td>
                <td style={{ fontWeight: 700, color: 'var(--accent-light)' }}>{a.deal_amount ? a.deal_amount + '万' : '—'}</td>
                <td style={{ fontSize: 12 }}>{a.assigned_to || '—'}</td>
                <td><CustomerStageTag s={a.customer_stage} /></td>
                <td>{a.blockers ? <span style={{ color: 'var(--danger)' }}>⚠️</span> : '—'}</td>
                <td onClick={e => e.stopPropagation()}><button className="btn btn-sm btn-primary" onClick={() => navigate(`/octo/account/${a.id}`)}>全景档案</button></td>
              </tr>
            )) : <tr><td colSpan={8}><div className="empty-state"><p>无匹配结果</p></div></td></tr>}
        </table>
      </div></div>
    </>
  );
}
