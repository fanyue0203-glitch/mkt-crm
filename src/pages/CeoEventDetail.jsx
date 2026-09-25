import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, setHeader, fmtNum, tryParse, toast } from '../api.js';
import { Bars } from '../components/DataBars.jsx';
import { Err, Loading } from '../components/Common.jsx';
import { OppLevel } from '../components/Tags.jsx';

const TABS = [
  ['overview', '概览'],
  ['analysis', '数据分析'],
  ['leads', '线索漏斗'],
  ['signals', '信号分析'],
  ['feedback', '现场反馈'],
  ['review', '复盘总结'],
];

export default function CeoEventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [e, setE] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader('🎪 活动详情');
    api(`/api/events/${id}`).then(ev => {
      setE(ev);
      if (ev.key_messages === '吴明辉(CEO)') {
        setHeader(`🎪 ${ev.name}`, <>
          <button className="btn btn-secondary" onClick={() => navigate('/ceo-events')}>← 返回看板</button>
          <button className="btn btn-primary" onClick={() => navigate(`/ceo-events/${id}/edit`)}>编辑</button>
          <button className="btn btn-danger" onClick={() => { if (confirm('确定删除这场CEO获客活动？')) deleteEvent(id, navigate); }}>删除</button>
        </>);
      } else {
        setHeader(`🎪 ${ev.name}`, <>
          <button className="btn btn-secondary" onClick={() => navigate('/ceo-events')}>← 返回看板</button>
          <button className="btn btn-primary" onClick={() => navigate(`/ceo-events/${id}/edit`)}>编辑</button>
        </>);
      }
    }).catch(er => setError(er));
  }, [id]);

  if (error) return <Err error={error} />;
  if (!e) return <Loading />;

  // ===== CEO获客活动专用明细（二级目录）=====
  if (e.key_messages === '吴明辉(CEO)') {
    const ceoTabs = [
      ['overview', '📊 概览'],
      ['weiban', '👥 微伴客户' + (e.weibanCustomers && e.weibanCustomers.length ? '(' + e.weibanCustomers.length + ')' : '')],
      ['leads', '📋 线索明细' + (e.linkedLeads && e.linkedLeads.length ? '(' + e.linkedLeads.length + ')' : '')],
    ];
    const rate1 = e.wechat_followers > 0 ? ((e.activations || 0) / e.wechat_followers * 100).toFixed(1) + '%' : '—';
    const rate2 = e.registrations > 0 ? ((e.sql_count || 0) / e.registrations * 100).toFixed(1) + '%' : '—';
    const maxV = Math.max(e.wechat_followers, e.registrations || 0, 1);
    const sfunnel = [['活码加微', e.wechat_followers || 0], ['OCTO申请', e.registrations || 0], ['审核开通', e.activations || 0], ['转出销售', e.sql_count || 0]]
      .map(([l, v]) => (
        <div className="funnel-row" key={l}>
          <span className="fl-label">{l}</span>
          <div className="fl-bar"><div className="fl-fill" style={{ width: Math.max(v / maxV * 100, 2) + '%' }}></div></div>
          <span className="fl-val">{v}</span>
        </div>
      ));

    // 线索统计
    const linkedLeads = e.linkedLeads || [];
    const leadStats = {};
    linkedLeads.forEach(l => { leadStats[l.status] = (leadStats[l.status] || 0) + 1; });
    const leadStatusName = (s) => ({new:'新进线',contacted:'已联系',qualified:'已转出',opportunity:'商机',closed_won:'成单',closed_lost:'无效/丢单'}[s]||s);

    return (
      <>
        <div className="tabs" style={{marginBottom:16}}>
          {ceoTabs.map(([k, label]) => (
            <div key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{label}</div>
          ))}
        </div>

        {tab === 'overview' && (<>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 20 }}>
          {[
            { v: e.wechat_followers > 0 ? fmtNum(e.wechat_followers) : '无活码', l: '活码加微', c: 'var(--accent)' },
            { v: e.registrations || 0, l: 'OCTO申请', c: 'var(--info)' },
            { v: e.activations || 0, l: '审核开通', c: 'var(--success)' },
            { v: e.sql_count || 0, l: '转出销售', c: 'var(--warning)' },
            { v: rate1, l: '加微→开通', c: 'var(--pink)' },
          ].map(s => (
            <div className="stat-card" key={s.l}>
              <div className="accent-bar" style={{ background: s.c }}></div>
              <div className="stat-value" style={{ color: s.c }}>{s.v}</div>
              <div className="stat-label">{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="card"><div className="card-header"><h3>基本信息</h3></div><div className="card-body"><div className="detail-grid">
            <div><div className="detail-field"><div className="label">活动类型</div><div className="value"><span className="tag tag-blue">{e.event_type || '—'}</span></div></div></div>
            <div><div className="detail-field"><div className="label">活码创建</div><div className="value">{e.date || '—'}</div></div></div>
            <div><div className="detail-field"><div className="label">获客方式</div><div className="value">{e.wechat_followers > 0 ? '企微活码扫码' : '群内直接分享OCTO开通邀请链接'}</div></div></div>
            <div><div className="detail-field"><div className="label">主讲</div><div className="value">{e.key_messages}</div></div></div>
          </div></div></div>
          <div className="card"><div className="card-header"><h3>漏斗</h3></div><div className="card-body">{sfunnel}<div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>申请→转出：{rate2}</div></div></div>
        </div>
        {e.business_design ? <div className="card" style={{marginBottom:16}}><div className="card-header"><h3>⭐ 业务设计</h3></div><div className="card-body"><div style={{whiteSpace:'pre-wrap',lineHeight:1.8}}>{e.business_design}</div></div></div> : null}
        {e.story_line ? <div className="card" style={{marginBottom:16}}><div className="card-header"><h3>📖 故事线</h3></div><div className="card-body"><div style={{whiteSpace:'pre-wrap',lineHeight:1.8}}>{e.story_line}</div></div></div> : null}
        <div className="card"><div className="card-header"><h3>📋 获客明细与特点（报告原文）</h3></div><div className="card-body"><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{e.notes || '暂无明细'}</div></div></div>
        </>)}

        {tab === 'weiban' && (
          <>
            <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:16}}>
              {[
                {v: (e.weibanCustomers||[]).length, l:'微伴加微总数', c:'var(--accent)'},
                {v: e.wechat_followers || (e.weibanCustomers||[]).length, l:'活码记录数', c:'var(--info)'},
                {v: e.registrations || 0, l:'OCTO申请', c:'var(--success)'},
                {v: e.activations || 0, l:'审核开通', c:'var(--warning)'},
              ].map(s => (
                <div className="stat-card" key={s.l}>
                  <div className="accent-bar" style={{background:s.c}}></div>
                  <div className="stat-value" style={{color:s.c}}>{s.v}</div>
                  <div className="stat-label">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-header"><h3>👥 微伴客户明细（{(e.weibanCustomers||[]).length}人）<span style={{fontSize:12,color:'var(--text-muted)',fontWeight:400,marginLeft:8}}>企微活码扫码添加的客户</span></h3></div>
              <div className="card-body" style={{padding:0}}>
                {(e.weibanCustomers||[]).length ? (
                  <table>
                    <tr><th>#</th><th>微信昵称</th><th>添加时间</th><th>最近沟通</th><th>标签</th><th>添加渠道</th></tr>
                    {(e.weibanCustomers||[]).map((w, i) => (
                      <tr key={w.id}>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{i+1}</td>
                        <td><strong>👤 {w.nickname}</strong></td>
                        <td style={{fontSize:12}}>{w.add_time||'—'}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{w.last_chat_time&&w.last_chat_time.trim()?w.last_chat_time:'无沟通'}</td>
                        <td style={{fontSize:11}}>{w.tags?<span className="tag tag-blue">{w.tags}</span>:'—'}</td>
                        <td style={{fontSize:11,color:'var(--text-muted)'}}>{(w.add_channel||'').replace('通过渠道码','').replace('添加','').trim()}</td>
                      </tr>
                    ))}
                  </table>
                ) : <div className="empty-state" style={{padding:32}}><p>📭 该活动无活码（混沌学院走直接开通链接模式）</p></div>}
              </div>
            </div>
          </>
        )}

        {tab === 'leads' && (
          <>
            <div className="stats-grid" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:16}}>
              {[
                {v: linkedLeads.length, l:'关联线索总数', c:'var(--accent)'},
                {v: leadStats['new']||0, l:'新进线', c:'#64748b'},
                {v: leadStats['contacted']||0, l:'已联系', c:'#3b82f6'},
                {v: leadStats['qualified']||0, l:'已转出', c:'#8b5cf6'},
                {v: leadStats['closed_lost']||0, l:'无效/丢单', c:'#ef4444'},
              ].map(s => (
                <div className="stat-card" key={s.l}>
                  <div className="accent-bar" style={{background:s.c}}></div>
                  <div className="stat-value" style={{color:s.c}}>{s.v}</div>
                  <div className="stat-label">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-header"><h3>📋 线索明细（{linkedLeads.length}条）<span style={{fontSize:12,color:'var(--text-muted)',fontWeight:400,marginLeft:8}}>按来源渠道自动匹配</span></h3></div>
              <div className="card-body" style={{padding:0}}>
                {linkedLeads.length ? (
                  <table>
                    <tr><th>公司名称</th><th>联系人</th><th>职位</th><th>来源</th><th>产品</th><th>团队</th><th>分配给</th><th>进线日期</th><th>转出日期</th><th>状态</th></tr>
                    {linkedLeads.map(l => (
                      <tr key={l.id}>
                        <td><strong>{l.company_name||'—'}</strong></td>
                        <td>{l.contact_name||'—'}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{l.contact_title||'—'}</td>
                        <td style={{fontSize:12}}>{l.source_channel||'—'}</td>
                        <td style={{fontSize:12}}>{l.product||'—'}</td>
                        <td style={{fontSize:12}}>{l.team||'—'}</td>
                        <td>{l.assigned_to||<span style={{color:'var(--text-muted)'}}>未分配</span>}</td>
                        <td style={{fontSize:12}}>{l.inbound_date||'—'}</td>
                        <td style={{fontSize:12}}>{l.transfer_date||'—'}</td>
                        <td><span className={'tag '+(l.status==='qualified'?'tag-green':l.status==='closed_lost'?'tag':l.status==='contacted'?'tag-blue':'tag-yellow')}>{leadStatusName(l.status)}</span></td>
                      </tr>
                    ))}
                  </table>
                ) : <div className="empty-state" style={{padding:32}}><p>🔍 暂无关联线索</p><p style={{fontSize:12,color:'var(--text-muted)',marginTop:8}}>系统按活动名称关键词自动匹配线索来源渠道</p></div>}
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // ===== 普通活动详情（tab切换）=====
  const indDist = tryParse(e.industry_distribution);
  const jobDist = tryParse(e.job_level_distribution);
  const deptDist = tryParse(e.dept_distribution);
  const channels = tryParse(e.channel_sources);
  const prodSigs = tryParse(e.product_signals);
  const indSigs = tryParse(e.industry_signals);
  const opps = tryParse(e.key_opportunities);
  const actions = tryParse(e.action_items);
  const attRate = e.registration_count > 0 ? ((e.attendance_count || 0) / e.registration_count * 100).toFixed(1) : 0;

  const statCards = [
    { v: fmtNum(e.registration_count), l: '报名人数', c: 'var(--accent)' },
    { v: fmtNum(e.attendance_count), l: '到场人数', c: 'var(--success)' },
    { v: attRate + '%', l: '到场率', c: attRate > 50 ? 'var(--success)' : 'var(--warning)' },
    { v: e.vip_count || 0, l: 'VIP嘉宾', c: 'var(--info)' },
    { v: e.leads_count || 0, l: '留资数', c: 'var(--pink)' },
    { v: e.mql_count || 0, l: 'MQL', c: 'var(--orange)' },
  ];

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6,1fr)', marginBottom: 20 }}>
        {statCards.map(s => (
          <div className="stat-card" key={s.l}>
            <div className="accent-bar" style={{ background: s.c }}></div>
            <div className="stat-value" style={{ color: s.c }}>{s.v}</div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {TABS.map(([k, label]) => (
          <div key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{label}</div>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="card"><div className="card-header"><h3>基本信息</h3></div><div className="card-body">
            <div className="detail-grid">
              <div><div className="detail-field"><div className="label">活动类型</div><div className="value"><span className="tag tag-blue">{e.event_type || '—'}</span></div></div></div>
              <div><div className="detail-field"><div className="label">日期</div><div className="value">{e.date || ''}{e.end_date && e.end_date !== e.date ? ' ~ ' + e.end_date : ''}</div></div></div>
              <div><div className="detail-field"><div className="label">地点</div><div className="value">{e.location}</div></div></div>
              <div><div className="detail-field"><div className="label">规模</div><div className="value">{fmtNum(e.scale)} 人</div></div></div>
              <div><div className="detail-field"><div className="label">主办方</div><div className="value">{e.host}</div></div></div>
              <div><div className="detail-field"><div className="label">目标客户群</div><div className="value">{e.target_audience}</div></div></div>
            </div>
          </div></div>
          <div className="card"><div className="card-header"><h3>⭐ 业务设计（独有输入项）</h3></div><div className="card-body">
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{e.business_design || <span style={{ color: 'var(--text-muted)' }}>暂未填写。面对什么客户群？讲什么故事？Agenda是什么？</span>}</div>
            {e.product_solutions ? <div style={{ marginTop: 12 }}><div className="detail-field"><div className="label">产品/方案</div><div className="value">{e.product_solutions}</div></div></div> : null}
            {e.target_market ? <div><div className="detail-field"><div className="label">目标市场</div><div className="value">{e.target_market}</div></div></div> : null}
          </div></div>
        </div>
      )}

      {tab === 'analysis' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card"><div className="card-header"><h3>行业分布{indDist.length ? ` (${indDist.length})` : ''}</h3></div><div className="card-body">
              {indDist.length ? <Bars data={indDist} color="#3b82f6" /> : <div className="empty-state" style={{ padding: 16 }}><p>暂无行业数据</p></div>}
            </div></div>
            <div className="card"><div className="card-header"><h3>职级分布</h3></div><div className="card-body">
              {jobDist.length ? <Bars data={jobDist} color="#8b5cf6" /> : <div className="empty-state" style={{ padding: 16 }}><p>暂无职级数据</p></div>}
            </div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card"><div className="card-header"><h3>部门分布</h3></div><div className="card-body">
              {deptDist.length ? <Bars data={deptDist} color="#10b981" /> : <div className="empty-state" style={{ padding: 16 }}><p>暂无部门数据</p></div>}
            </div></div>
            <div className="card"><div className="card-header"><h3>渠道来源</h3></div><div className="card-body">
              {channels.length ? <Bars data={channels} color="#f59e0b" /> : <div className="empty-state" style={{ padding: 16 }}><p>暂无渠道数据</p></div>}
            </div></div>
          </div>
        </>
      )}

      {tab === 'leads' && (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 16 }}>
            {[
              { v: e.leads_count, l: '综合留资', c: 'var(--accent)' },
              { v: e.mql_count, l: 'MQL·线索级', c: 'var(--info)' },
              { v: e.sql_count, l: 'SQL·商机级', c: 'var(--success)' },
              { v: e.opportunity_count || 0, l: '商机', c: 'var(--warning)' },
              { v: e.estimated_ppl || '—', l: '预估PPL', c: 'var(--pink)' },
            ].map(s => (
              <div className="stat-card" key={s.l}>
                <div className="accent-bar" style={{ background: s.c }}></div>
                <div className="stat-value" style={{ color: s.c }}>{s.v}</div>
                <div className="stat-label">{s.l}</div>
              </div>
            ))}
          </div>
          {opps.length ? (
            <div className="card"><div className="card-header"><h3>🔥 重点商机/线索</h3></div><div className="card-body" style={{ padding: 0 }}>
              <table>
                <tr><th>等级</th><th>客户</th><th>行业</th><th>产品/需求</th><th>预期PPL</th><th>备注</th></tr>
                {opps.map((o, i) => (
                  <tr key={i}>
                    <td><OppLevel level={o.level} /></td>
                    <td><strong>{o.company}</strong></td>
                    <td>{o.industry}</td>
                    <td>{o.need || o.product_need}</td>
                    <td style={{ fontWeight: 600 }}>{o.ppl || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.notes}</td>
                  </tr>
                ))}
              </table>
            </div></div>
          ) : <div className="empty-state"><p>暂无重点商机数据</p></div>}
        </>
      )}

      {tab === 'signals' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card"><div className="card-header"><h3>📡 产品信号</h3></div><div className="card-body">
              {prodSigs.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {prodSigs.map((s, i) => (
                    <div className="signal-chip" key={i}>
                      <span>{s.name}</span><span className="count">{s.count || 0}</span>
                      {s.note ? <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>{s.note}</span> : null}
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state" style={{ padding: 16 }}><p>暂无产品信号</p></div>}
            </div></div>
            <div className="card"><div className="card-header"><h3>🏭 行业信号</h3></div><div className="card-body">
              {indSigs.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {indSigs.map((s, i) => (
                    <div className="signal-chip" key={i}>
                      <span>{s.name}</span><span className="count">{s.count || 0}</span>
                      {s.note ? <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>{s.note}</span> : null}
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state" style={{ padding: 16 }}><p>暂无行业信号</p></div>}
            </div></div>
          </div>
          {e.region_highlights ? (
            <div className="card"><div className="card-header"><h3>🌍 区域亮点</h3></div><div className="card-body"><div className="highlight-box success" style={{ whiteSpace: 'pre-wrap' }}>{e.region_highlights}</div></div></div>
          ) : null}
        </>
      )}

      {tab === 'feedback' && (
        <>
          {e.customer_feedback ? <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3>👥 客户在问什么</h3></div><div className="card-body"><div className="highlight-box" style={{ whiteSpace: 'pre-wrap' }}>{e.customer_feedback}</div></div></div> : null}
          {e.investor_feedback ? <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3>💰 投资人在问什么</h3></div><div className="card-body"><div className="highlight-box insight" style={{ whiteSpace: 'pre-wrap' }}>{e.investor_feedback}</div></div></div> : null}
          {e.media_feedback ? <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3>📰 媒体反馈</h3></div><div className="card-body"><div style={{ whiteSpace: 'pre-wrap' }}>{e.media_feedback}</div></div></div> : null}
          {!e.customer_feedback && !e.investor_feedback && !e.media_feedback ? <div className="empty-state"><div className="icon">💬</div><p>暂无现场反馈数据</p></div> : null}
        </>
      )}

      {tab === 'review' && (
        <>
          {e.feedback_summary ? <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3>📋 市场反馈摘要</h3></div><div className="card-body"><div className="highlight-box" style={{ whiteSpace: 'pre-wrap' }}>{e.feedback_summary}</div></div></div> : null}
          {e.structural_insights ? <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3>🧠 结构性洞察</h3></div><div className="card-body"><div className="highlight-box insight" style={{ whiteSpace: 'pre-wrap' }}>{e.structural_insights}</div></div></div> : null}
          {e.lessons_learned ? <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3>💡 经验总结</h3></div><div className="card-body"><div style={{ whiteSpace: 'pre-wrap' }}>{e.lessons_learned}</div></div></div> : null}
          {actions.length ? (
            <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3>✅ 下一步行动</h3></div><div className="card-body" style={{ padding: 0 }}>
              <table>
                <tr><th>行动</th><th>负责人</th><th>截止</th><th>详情</th></tr>
                {actions.map((a, i) => (
                  <tr key={i}><td><strong>{a.action}</strong></td><td>{a.owner}</td><td>{a.deadline}</td><td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.detail}</td></tr>
                ))}
              </table>
            </div></div>
          ) : null}
          {e.long_tail_content ? <div className="card"><div className="card-header"><h3>📢 长尾传播计划</h3></div><div className="card-body"><div style={{ whiteSpace: 'pre-wrap' }}>{e.long_tail_content}</div></div></div> : null}
          {!e.feedback_summary && !e.structural_insights && !actions.length ? <div className="empty-state"><div className="icon">📝</div><p>暂无复盘数据</p></div> : null}
        </>
      )}
    </>
  );
}

export async function deleteEvent(id, navigate) {
  try {
    await api(`/api/events/${id}`, { method: 'DELETE' });
    toast('删除成功');
    navigate('/ceo-events');
  } catch (e) { toast(e.message, 'error'); }
}
