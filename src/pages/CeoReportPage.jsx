import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setHeader } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';
import R from '../data/ceoReport.json';

const CN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八'];
const SECTION_TITLES = ['大盘概览', '逐活动转化', '转出明细', '39家交叉匹配', '渠道排名与洞察'];
const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(a / b * 100 >= 10 ? 0 : 1) + '%' : '—');
const short = (s, n = 90) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };

export default function CeoReportPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [accountMap, setAccountMap] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader('📊 CEO获客分析报告',
      <button className="btn btn-secondary" onClick={() => navigate('/ceo-events')}>← 返回活动看板</button>);
    Promise.all([api('/api/events'), api('/api/accounts')])
      .then(([ev, acc]) => {
        setEvents(ev.data || []);
        const m = {};
        ((acc.data || acc) || []).forEach(a => { if (a.company_name) m[a.company_name] = a.id; });
        setAccountMap(m);
      })
      .catch(e => setError(e));
  }, []);

  if (error) return <Err error={error} />;
  if (!events) return <Loading />;

  // 系统实时漏斗（口径：REG=活码加微 LEADS=OCTO申请 MQL=审核开通 SQL=转出销售）
  const ceo = events.filter(e => e.key_messages === '吴明辉(CEO)');
  const live = ceo.filter(e => (e.wechat_followers || 0) > 0);
  const tReg = ceo.reduce((s, e) => s + (e.wechat_followers || 0), 0);
  const tLeads = ceo.reduce((s, e) => s + (e.registrations || 0), 0);
  const tMql = ceo.reduce((s, e) => s + (e.activations || 0), 0);
  const tSql = ceo.reduce((s, e) => s + (e.sql_count || 0), 0);
  const liveLeads = live.reduce((s, e) => s + (e.registrations || 0), 0);
  const liveMql = live.reduce((s, e) => s + (e.activations || 0), 0);
  const sleeping = tReg - liveLeads;
  const O = R.overview;

  const sectionNav = SECTION_TITLES.map((t, i) => (
    <a key={t} className="tag tag-blue" style={{ cursor: 'pointer', margin: 3 }}
      onClick={() => document.getElementById(`cr-${i + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
      {CN_NUMS[i]} {t}
    </a>
  ));

  const funnelRows = [
    ['扫码加微', tReg, 'var(--accent)'], ['OCTO申请', tLeads, 'var(--info)'],
    ['审核开通', tMql, 'var(--success)'], ['SDR转出销售', tSql, 'var(--warning)'],
  ];
  const tMax = Math.max(...funnelRows.map(r => r[1]), 1);

  const monthMax = Math.max(...R.monthlyTrend.map(m => m.apply), 1);

  return (
    <div className="panorama">
      <div style={{ textAlign: 'center', padding: '4px 0 0' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{R.meta.provenance}</div>
        <div style={{ margin: '8px 0' }}>{sectionNav}</div>
      </div>

      {/* 一、大盘概览 */}
      <div className="section-card" id="cr-1">
        <div className="section-header"><h3>一、大盘概览</h3>
          <span className="section-count">CEO（吴明辉）{R.overview.events}场活动 · 数据截止 2026-09-18</span></div>
        <div className="section-body">
          <div className="strategy-overview">
            <div className="overview-item"><div className="ov-value" style={{ color: 'var(--accent-light)' }}>{R.overview.events}</div><div className="ov-label">CEO活动</div></div>
            <div className="overview-item"><div className="ov-value" style={{ color: 'var(--accent)' }}>{O.livecodeAdds}</div><div className="ov-label">活码加微</div></div>
            <div className="overview-item"><div className="ov-value" style={{ color: 'var(--info)' }}>{O.applyTotal}</div><div className="ov-label">OCTO申请</div></div>
            <div className="overview-item"><div className="ov-value" style={{ color: 'var(--success)' }}>{O.openTotal}</div><div className="ov-label">审核开通</div></div>
            <div className="overview-item"><div className="ov-value" style={{ color: 'var(--warning)' }}>{O.transferTotal}</div><div className="ov-label">转出销售</div></div>
            <div className="overview-item"><div className="ov-value" style={{ color: 'var(--pink)' }}>{O.matched}/{O.matched + O.unmatched}</div><div className="ov-label">大客户有痕迹</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div className="card">
              <div className="card-header"><h3>🔻 全渠道转化漏斗（系统实时）</h3></div>
              <div className="card-body">
                {funnelRows.map(([l, v, c]) => (
                  <div className="funnel-row" key={l}>
                    <span className="fl-label">{l}</span>
                    <div className="fl-bar"><div className="fl-fill" style={{ width: Math.max(v / tMax * 100, 2) + '%', background: c }}></div></div>
                    <span className="fl-val">{v} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>({pct(v, tReg)})</span></span>
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  活码渠道：{O.livecodeApply}申请/{O.livecodeOpen}开通（加微→开通 {pct(liveMql, tReg)}）· 混沌直发链接：33申请/31开通（94%通过率）
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3>📈 CEO渠道申请月度趋势（原始表抽取）</h3></div>
              <div className="card-body">
                {R.monthlyTrend.map(m => (
                  <div className="funnel-row" key={m.month}>
                    <span className="fl-label">{m.month}</span>
                    <div className="fl-bar"><div className="fl-fill" style={{ width: m.apply / monthMax * 100 + '%', background: 'var(--info)' }}></div></div>
                    <span className="fl-val" style={{ fontSize: 12 }}>{m.apply} <span style={{ color: 'var(--success)', fontWeight: 400 }}>/开{m.open}</span></span>
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  5月晚点+混沌双爆发（63申请）后持续回落；9月仅4申请 — 老渠道进入长尾，需要新活动注入流量
                </div>
              </div>
            </div>
          </div>
          <div className="highlight-box warning" style={{ marginTop: 12 }}>
            <strong>💤 沉睡客户：</strong>{tReg}加微 − {liveLeads}活码渠道申请 = <strong>{sleeping}人（{pct(sleeping, tReg)}）加微后零后续动作</strong>，是最大的待激活资产池。
          </div>
          <div className="highlight-box" style={{ marginTop: 8 }}>
            <strong>📐 口径说明（程序化抽取校验）：</strong>
            {R.meta.corrections.map((c, i) => <div key={i} style={{ fontSize: 12, marginTop: 2 }}>· {c}</div>)}
          </div>
        </div>
      </div>

      {/* 二、逐活动转化 */}
      <div className="section-card" id="cr-2">
        <div className="section-header"><h3>二、逐活动转化</h3><span className="section-count">{R.events.length}场活动 · 点击行进活动详情</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>活动</th><th>获客方式</th><th>活码创建</th><th>加微</th><th>申请</th><th>开通</th><th>转出</th><th>39家匹配</th><th>申请→开通</th><th>加微→开通</th></tr>
            <tbody>
              {R.events.map(e => {
                const sys = ceo.find(x => x.name.includes(e.name.slice(0, 4)) || e.name.includes((x.name || '').slice(0, 4)));
                return (
                  <tr className="clickable-row" key={e.name} onClick={() => sys && navigate(`/ceo-events/${sys.id}`)}>
                    <td><strong>{e.name}</strong></td>
                    <td style={{ fontSize: 11 }}>{e.method}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.code}</td>
                    <td>{e.adds || '无活码'}</td>
                    <td style={{ fontWeight: 600 }}>{e.applies}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>{e.opens}</td>
                    <td>{e.transfers}</td>
                    <td>{e.match ? <span className="tag tag-pink" style={{ cursor: 'pointer' }}>{e.match}家</span> : '—'}</td>
                    <td>{pct(e.opens, e.applies)}</td>
                    <td>{e.adds ? pct(e.opens, e.adds) : '—'}</td>
                  </tr>
                );
              })}
              <tr style={{ background: 'var(--bg-surface)', fontWeight: 700 }}>
                <td>全渠道合计</td><td>—</td><td>—</td><td>394+</td><td>122</td><td>102</td><td>5</td><td>14家</td><td>{pct(102, 122)}</td><td>{pct(102, 394)}</td>
              </tr>
            </tbody>
          </table></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 12, marginTop: 14 }}>
            {R.events.filter(e => e.applies > 0).map(e => (
              <div className="highlight-box" key={e.name} style={{ marginBottom: 0 }}>
                <strong>{e.name}</strong>{e.match_names?.length ? <span className="tag tag-pink" style={{ marginLeft: 8 }}>{e.match_names.join(' · ')}</span> : null}
                <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>{e.traits}</div>
                {e.selfReportTop?.length ? (
                  <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)' }}>
                    自报来源TOP：{e.selfReportTop.map(s => `${s.src}×${s.n}`).join('、')}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 三、转出销售明细 */}
      <div className="section-card" id="cr-3">
        <div className="section-header"><h3>三、转出销售明细</h3><span className="section-count">{R.transfers.length}人 · 晚点4 + 混沌1</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>#</th><th>活动来源</th><th>微信昵称</th><th>姓名</th><th>公司</th><th>分配销售</th><th>需求产品</th><th>39家客户</th></tr>
            <tbody>
              {R.transfers.map((t, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{t.event}</td><td>{t.nick}</td><td>{t.name}</td><td>{t.company}</td><td>{t.sales}</td><td>{t.product}</td>
                  <td>{t.match39 ? <span className="tag tag-pink">{t.match39}</span> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
          <div className="highlight-box warning" style={{ marginTop: 12 }}>
            <strong>⚠️ 瓶颈所在：</strong>102人开通 → 仅5人转出销售（{pct(tSql, tMql)}），{tMql - tSql}人开通后未进入销售管道。转出5家中1家（宇通客车）已成为投标客户——漏斗末端虽窄，但出了真大客户。
          </div>
        </div>
      </div>

      {/* 四、39家交叉匹配 */}
      <div className="section-card" id="cr-4">
        <div className="section-header"><h3>四、39家大客户 × 获客数据交叉匹配</h3>
          <span className="section-count">14家有线上痕迹（36%）· 25家高管直推（64%）</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>客户</th><th>分类</th><th>活码加微</th><th>OCTO申请</th><th>开通</th><th>转出</th><th>分配销售</th><th></th></tr>
            <tbody>
              {R.matched14.map(m => {
                const aid = accountMap[m[0]];
                return (
                  <tr className={aid ? 'clickable-row' : ''} key={m[0]} onClick={aid ? () => navigate(`/accounts/${aid}/detail`) : undefined}>
                    <td><strong>{m[0]}</strong></td>
                    <td style={{ fontSize: 12 }}>{m[1]}</td>
                    <td>{m[2] || '—'}</td><td>{m[3] || '—'}</td><td>{m[4] || '—'}</td><td>{m[5] || '—'}</td><td>{m[6] || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{aid ? 'CRM档案 →' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div></div>
          <div className="highlight-box" style={{ marginTop: 12 }}>
            <strong>未在线上漏斗中出现的25家（高管直推/线下拜访/内部推荐）：</strong>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {R.unmatched25.map(n => <span className="tag tag-gray" key={n}>{n}</span>)}
            </div>
          </div>
          <div className="highlight-box insight" style={{ marginTop: 8 }}>
            <strong>解读：</strong>线上漏斗只贡献了14家痕迹客户，其中真正推进成商机的只有宇通（投标≤200万）；南孚/吉利/三一/卓正等全部签约和高管线客户都来自高管直推。线上活动=品牌势能+长尾线索池，大客户=CEO人脉直推。
          </div>
        </div>
      </div>

      {/* 五、渠道排名与洞察 */}
      <div className="section-card" id="cr-5">
        <div className="section-header"><h3>五、渠道排名与洞察</h3><span className="section-count">效果排名 · 4条核心洞察</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>排名</th><th>渠道</th><th>核心指标</th><th>评价</th></tr>
            <tbody>
              {R.insights.ranking.map(r => (
                <tr key={r[1]}>
                  <td style={{ fontSize: 16 }}>{r[0]}</td>
                  <td><strong>{r[1]}</strong></td>
                  <td style={{ fontSize: 12 }}>{r[2]}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {R.insights.findings.map(f => (
              <div className={`highlight-box ${f.level}`} key={f.title}>
                <strong>{f.title}</strong> — {f.body}
              </div>
            ))}
          </div>
          <div className="conclusion-box" style={{ marginTop: 14 }}>
            <strong>行动建议：</strong>① 沉睡305人做一轮7天内SDR激活（外呼/企微私信）② 在杨三角、CEO圈子等高信任社群复制「混沌模式」（分享+直接开通链接）③ 减少泛行业活动投入，聚焦科技/创业社群 ④ 加微时同步收集手机号/公司名，解决A↔B匹配率只有60-70%的根源问题
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: 'var(--text-muted)' }}>
        📊 CEO获客数据分析报告 · {R.meta.generatedAt} 生成 · 数据截止 {R.meta.dataCutoff} · 数据源：{R.meta.sources.join(' / ')}
      </div>
    </div>
  );
}
