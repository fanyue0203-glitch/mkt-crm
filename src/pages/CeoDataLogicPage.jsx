import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setHeader } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';

// ===== 静态参考数据（源文档：《CEO获客取数逻辑》· 章鱼烧 2026-09-23 · 数据截止 2026-09-18）=====
// 漏斗与逐活动数据实时取自 ceo_events 表（CEO获客活动），与报告口径一致

const CORE_QUESTIONS = [
  ['🎤', 'CEO出席了哪些活动？', '8场活动全景'],
  ['📈', '每场活动获客效果如何？', '加微→申请→开通→转出，逐层转化率'],
  ['🏆', '哪个渠道ROI最高？', '渠道效果排名'],
  ['⚔️', '线上获客 vs 高管直推，哪个更有效？', '与39家大客户交叉匹配'],
  ['💤', '沉睡客户怎么激活？', '漏斗瓶颈定位'],
];

const CHAIN = ['活动出席', '扫码加微', 'OCTO申请', '审核开通', 'SDR转出销售', '匹配39家大客户'];

const DATA_SOURCES = [
  ['A', '微伴客户导出 8份Excel', '总表 + -1~-7（7个活码渠道分表：晚点199/AI峰会88/国企EMP56/产品发布26/CAIO17/中欧8/外滩1）', '微信昵称、添加时间、活码来源、公司名（部分）、自报来源', '加微 → 活动归因'],
  ['B', 'OCTO内测申请表 1份', 'Octo内测组织申请表0918.xlsx（226行×20列）', '申请人、组织名、申请时间、审核状态（通过/拒绝/待审核）、来源渠道', 'OCTO申请 → 审核开通'],
  ['C', 'SDR周报 1份·12个sheet', '明略科技SDR周报0915.xlsx', 'Octo体验sheet 124行 + 转出线索sheet 763行：姓名、公司、分配销售、需求产品、跟进状态', 'SDR转出销售'],
  ['D', '渠道活码列表 1份', '渠道活码列表.xlsx', '各渠道活码名称、创建时间、对应活动', '活码→活动映射'],
];

const REF_SOURCES = [
  ['KR2复盘报告 39家客户名单', '最终匹配层：将获客数据与39家大客户交叉，看线上漏斗覆盖了哪些大客户'],
  ['客户跟踪表（客户跟踪表.csv）', '补充客户公司名、负责人等信息'],
];

const STEPS = [
  {
    title: '环节一：活动出席 & 扫码加微', count: '数据源 A + D',
    steps: [
      ['1', '从D 渠道活码列表获取8场活动对应的活码名称和创建时间', 'D'],
      ['2', '从A 微伴导出按活码分表统计每场活动的加微人数', 'A'],
      ['3', '混沌学院无活码（直接发开通链接），不计入加微数，单独统计申请数', 'B'],
    ],
    tip: ['💡', '为什么有8份微伴导出？每个活码对应一个渠道，微伴按渠道导出客户列表。7个活码渠道 + 1份总表 = 8份文件。混沌无活码，不在微伴系统中。'],
  },
  {
    title: '环节二：OCTO申请 → 审核开通', count: '数据源 B',
    steps: [
      ['1', '从B 内测申请表取全部226行申请记录', 'B'],
      ['2', '按「来源渠道」字段分组，映射到8场活动（混沌来源标记为"混沌"）', 'B'],
      ['3', '按「审核状态」筛选：通过=开通，拒绝/待审核=未开通', 'B'],
      ['4', '统计每场活动的申请数和开通数，计算通过率', 'B'],
    ],
    tip: ['💡', '加微→申请的匹配逻辑：A（微伴）和B（申请表）通过微信昵称 ↔ 申请人名称做模糊匹配。字段不完全一致（微伴是昵称、申请表是真名），匹配率约60-70%；未匹配的按「来源渠道」字段归因。'],
  },
  {
    title: '环节三：SDR转出销售', count: '数据源 B + C',
    steps: [
      ['1', '从C SDR周报的「Octo体验」sheet取124行体验记录', 'C'],
      ['2', '从C SDR周报的「转出线索」sheet筛选Octo相关转出', 'C'],
      ['3', '通过公司名与B（申请表）交叉，确认转出的5人对应哪个活动来源', 'B + C'],
    ],
    tip: ['⚠️', '已知问题：微伴加微394人 vs SDR周报Octo体验124行，数量不对齐。SDR周报无微信昵称字段，且部分加微客户未进入SDR流程，无法1:1匹配。'],
  },
  {
    title: '环节四：匹配39家大客户', count: '数据源 A + B + C',
    steps: [
      ['1', '取KR2报告39家客户名单', 'KR2报告'],
      ['2', '在A（微伴）中按公司名匹配：找到哪些加微客户属于39家', 'A'],
      ['3', '在B（申请表）中按组织名匹配：找到哪些申请/开通属于39家', 'B'],
      ['4', '在C（SDR）中按公司名匹配：找到哪些转出线索属于39家', 'C'],
      ['5', '合并结果：14家有数据痕迹，25家完全不在线上漏斗中', 'A+B+C'],
    ],
    tip: ['🎯', '核心发现：39家大客户中25家（64%）完全不在线上漏斗里。这些客户通过高管直推/线下拜访/内部推荐获取，不经过活码/SDR渠道。'],
  },
];

const FORMULAS = [
  ['加微→申请 转化率', '该活动OCTO申请数 ÷ 该活动加微数 × 100%', 'A ÷ B（按活动分组）'],
  ['申请→开通 通过率', '该活动审核通过数 ÷ 该活动申请数 × 100%', 'B内部（审核状态筛选）'],
  ['加微→开通 转化率', '该活动开通数 ÷ 该活动加微数 × 100%', 'B ÷ A'],
  ['加微→转出 转化率', '该活动SDR转出数 ÷ 该活动加微数 × 100%', 'C ÷ A'],
  ['沉睡客户数', '加微总数 − OCTO申请总数（活码渠道，不含混沌）', 'A − B = 394 − 89 = 305人'],
  ['大客户线上覆盖率', '有数据痕迹的大客户数 ÷ 39 × 100%', '匹配结果 = 14/39 = 36%'],
];

const LIMITS = [
  ['微伴 vs SDR数量不对齐', '394人加微 vs SDR周报仅124行Octo体验，无法1:1匹配', 'SDR周报无微信昵称字段；部分加微客户未进入SDR流程'],
  ['A↔B跨表匹配率约60-70%', '部分客户无法确认「加微后是否申请了OCTO」', '微伴用昵称、申请表用真名，字段不一致'],
  ['混沌无活码数据', '无法统计混沌渠道的加微数', '混沌走的是群内直发开通链接，不经过企微活码'],
  ['「自报来源」填写率低', '无法准确归因客户是「怎么知道Octo的」', '申请表中自报来源为选填项'],
  ['转出后跟进数据不全', '5人转出销售后的成交情况未追踪', 'SDR周报只记录转出动作，不追踪后续成交'],
];

const FILES = [
  ['微伴-客户列表数据导出.xlsx', '微伴总表', 'A 微伴'],
  ['微伴-客户列表数据导出-1~7.xlsx', '7个活码渠道分表', 'A 微伴'],
  ['Octo内测组织申请表0918.xlsx', '226行申请/审核数据', 'B 申请表'],
  ['明略科技SDR周报0915.xlsx', '12个sheet，体验+转出数据', 'C SDR周报'],
  ['渠道活码列表.xlsx', '活码→活动映射', 'D 活码'],
  ['客户跟踪表.csv', '客户基础信息底表', '辅助'],
  ['CEO获客数据分析报告.md', '完整分析报告（Markdown版）', '输出'],
  ['CEO获客取数逻辑.html', '取数说明书（本页蓝本）', '说明书'],
];

// 14家有线上痕迹的客户（分类 + 漏斗各环节痕迹，'—'=无记录）
const MATCHED_14 = [
  ['宇通客车', '🔴 投标', '2', '3', '3', '1'],
  ['墨迹天气', '🟡 B类', '—', '1', '1', '—'],
  ['金智教育', '🔵 C类', '—', '2', '1', '—'],
  ['致远互联', '🔵 C类', '—', '1', '1', '—'],
  ['普联香港', '🟡 B类', '—', '1', '1', '—'],
  ['混沌学园', '🔵 C类', '—', '1', '1', '—'],
  ['中金公司', '🔵 C类', '—', '—', '—', '1'],
  ['华泰研究所', '🔵 C类', '—', '—', '—', '1'],
  ['鹏扬基金', '🔵 C类', '—', '1', '1', '—'],
  ['卓望', '⚪ D类', '2', '2', '2', '—'],
  ['祥承', '⚪ D类', '—', '4', '4', '1'],
  ['新世纪医疗集团', '⚪ D类', '—', '—', '—', '1'],
  ['云迹', '❌ 放弃', '—', '—', '—', '1'],
  ['我思科技', '❌ 放弃', '—', '2', '2', '—'],
];

const UNMATCHED_25 = '吉利汽车、三一重工、南孚电池、卓正医疗、HKIC、极光湾、中信资本、曼伦、PPIO、联合影像、健主任、刀法咨询、欢瑞世纪、青钜科技、卓越教育、Hysan希慎、得到、方里、流利说、香港中企、海归爸爸、51World、元梦灵境、北京破圈、西门子';

const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(a / b * 100 >= 10 ? 0 : 1) + '%' : '—');

export default function CeoDataLogicPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [accountMap, setAccountMap] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader('📐 CEO获客取数逻辑',
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

  // ===== 实时计算（口径与报告一致：REG=活码加微，LEADS=OCTO申请，MQL=审核开通，SQL=转出销售）=====
  const ceo = events.filter(e => e.key_messages === '吴明辉(CEO)');
  const livecode = ceo.filter(e => (e.wechat_followers || 0) > 0);   // 活码渠道
  const direct = ceo.filter(e => !(e.wechat_followers || 0));        // 无活码（混沌等，直发链接）
  const tReg = ceo.reduce((s, e) => s + (e.wechat_followers || 0), 0);
  const tLeads = ceo.reduce((s, e) => s + (e.registrations || 0), 0);
  const tMql = ceo.reduce((s, e) => s + (e.activations || 0), 0);
  const tSql = ceo.reduce((s, e) => s + (e.sql_count || 0), 0);
  const liveLeads = livecode.reduce((s, e) => s + (e.registrations || 0), 0);
  const liveMql = livecode.reduce((s, e) => s + (e.activations || 0), 0);
  const sleeping = tReg - liveLeads;
  const top2 = [...ceo].sort((a, b) => (b.activations || 0) - (a.activations || 0)).slice(0, 2);
  const top2Mql = top2.reduce((s, e) => s + (e.activations || 0), 0);
  const tMax = Math.max(tReg, tLeads, tMql, 1);

  const funnelRows = [
    ['活码加微', tReg], ['OCTO申请', tLeads], ['审核开通', tMql], ['SDR转出', tSql],
  ].map(([l, v]) => (
    <div className="funnel-row" key={l}>
      <span className="fl-label">{l}</span>
      <div className="fl-bar"><div className="fl-fill" style={{ width: Math.max(v / tMax * 100, 2) + '%' }}></div></div>
      <span className="fl-val">{v}</span>
    </div>
  ));

  const sorted = [...ceo].sort((a, b) => (b.wechat_followers || 0) - (a.wechat_followers || 0) || (b.registrations || 0) - (a.registrations || 0));

  return (
    <div className="panorama">
      {/* 一、报告目标与分析框架 */}
      <div className="section-card" id="cl-1">
        <div className="section-header"><h3>一、报告目标与分析框架</h3><span className="section-count">5 个核心问题 · 6 环链路</span></div>
        <div className="section-body">
          <div className="conclusion-box" style={{ marginBottom: 14 }}>
            <strong>分析框架：</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
              {CHAIN.map((c, i) => (
                <React.Fragment key={c}>
                  {i > 0 && <span style={{ color: 'var(--text-muted)' }}>→</span>}
                  <span className="tag tag-blue" style={{ fontWeight: 600 }}>{c}</span>
                </React.Fragment>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>每个环节的数据来自不同的数据源，通过昵称/公司名/手机号做跨表匹配。</div>
          </div>
          <div className="card"><div className="table-wrap"><table>
            <tr><th>报告要回答的核心问题</th><th>分析口径</th></tr>
            <tbody>
              {CORE_QUESTIONS.map((q, i) => (
                <tr key={i}><td><strong>{q[0]} {q[1]}</strong></td><td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q[2]}</td></tr>
              ))}
            </tbody>
          </table></div></div>
        </div>
      </div>

      {/* 二、数据来源 */}
      <div className="section-card" id="cl-2">
        <div className="section-header"><h3>二、数据来源</h3><span className="section-count">4 个独立数据源 + 2 项辅助参照</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>源</th><th>数据源</th><th>文件 & 内容</th><th>覆盖字段</th><th>覆盖环节</th></tr>
            <tbody>
              {DATA_SOURCES.map((s, i) => (
                <tr key={i}>
                  <td><span className="tag tag-purple" style={{ fontWeight: 700 }}>{s[0]}</span></td>
                  <td><strong>{s[1]}</strong></td>
                  <td style={{ fontSize: 12 }}>{s[2]}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s[3]}</td>
                  <td><span className="tag tag-blue" style={{ fontSize: 11 }}>{s[4]}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
          <div className="highlight-box" style={{ marginTop: 12 }}>
            <strong>辅助参照数据：</strong>
            {REF_SOURCES.map((r, i) => <div key={i} style={{ fontSize: 12, marginTop: 4 }}>· <strong>{r[0]}</strong> — {r[1]}</div>)}
          </div>
        </div>
      </div>

      {/* 三、逐环节取数逻辑 */}
      <div className="section-card" id="cl-3">
        <div className="section-header"><h3>三、逐环节取数逻辑</h3><span className="section-count">4 个环节 · 加微→申请→开通→转出→匹配</span></div>
        <div className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {STEPS.map(seg => (
            <div key={seg.title}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>🔹 {seg.title} <span className="tag tag-green" style={{ marginLeft: 8 }}>{seg.count}</span></div>
              <div className="card"><div className="table-wrap"><table>
                <tr><th>步骤</th><th>操作</th><th>数据源</th></tr>
                <tbody>
                  {seg.steps.map(st => (
                    <tr key={st[0]}>
                      <td style={{ width: 40 }}>{st[0]}</td>
                      <td style={{ fontSize: 12 }}>{st[1]}</td>
                      <td><span className="tag tag-blue" style={{ fontSize: 11 }}>{st[2]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table></div></div>
              <div className="highlight-box" style={{ marginTop: 8 }}>
                <strong>{seg.tip[0]} {seg.tip[1]}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 四、关键指标计算公式 */}
      <div className="section-card" id="cl-4">
        <div className="section-header"><h3>四、关键指标计算公式</h3><span className="section-count">6 个指标 · 跨表计算口径</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>指标</th><th>公式</th><th>数据来源</th></tr>
            <tbody>
              {FORMULAS.map((f, i) => (
                <tr key={i}>
                  <td><strong>{f[0]}</strong></td>
                  <td><span className="tag tag-green" style={{ fontSize: 11 }}>{f[1]}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f[2]}</td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
        </div>
      </div>

      {/* 五、最终漏斗结果（实时） */}
      <div className="section-card highlight-red" id="cl-5">
        <div className="section-header"><h3>五、最终漏斗结果</h3><span className="section-count">实时计算自 CEO 活动（{ceo.length}场）· 报告基准 394/122/102/5</span></div>
        <div className="section-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>全渠道转化漏斗</div>
              {funnelRows}
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                口径：REG=活码加微，LEADS=OCTO申请，MQL=审核开通，SQL=转出销售；混沌学院无活码直接发开通链接，不计入加微数
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>关键派生指标（实时）</div>
              <div className="highlight-box"><strong>沉睡客户：</strong>{tReg} 加微 − {liveLeads} 活码渠道申请 = <strong style={{ color: 'var(--warning)' }}>{sleeping} 人（{pct(sleeping, tReg)}）加微后零后续动作</strong></div>
              <div className="highlight-box"><strong>TOP2 活动开通贡献：</strong>{top2.map(e => e.name).join(' + ')} = {top2Mql}/{tMql}（{pct(top2Mql, tMql)}）</div>
              <div className="highlight-box"><strong>开通→转出转化：</strong>{tMql} 开通 → {tSql} 转出（{pct(tSql, tMql)}），{tMql - tSql} 人开通后未进入销售管道</div>
              <div className="highlight-box"><strong>活码渠道加微→开通：</strong>{liveMql}/{tReg}（{pct(liveMql, tReg)}）· 直发链接（混沌模式）申请→开通 {pct(direct.reduce((s, e) => s + (e.activations || 0), 0), direct.reduce((s, e) => s + (e.registrations || 0), 0))}</div>
            </div>
          </div>
          <div className="card" style={{ marginTop: 16 }}><div className="table-wrap"><table>
            <tr><th>活动</th><th>获客方式</th><th>加微</th><th>OCTO申请</th><th>审核开通</th><th>SDR转出</th><th>申请→开通通过率</th><th>加微→开通</th></tr>
            <tbody>
              {sorted.map(e => {
                const hasLive = (e.wechat_followers || 0) > 0;
                return (
                  <tr className="clickable-row" key={e.id} onClick={() => navigate(`/ceo-events/${e.id}`)}>
                    <td><strong>{e.name}</strong></td>
                    <td style={{ fontSize: 12 }}>{hasLive ? '企微活码扫码' : '社群直发开通链接'}</td>
                    <td>{hasLive ? e.wechat_followers : '无活码'}</td>
                    <td style={{ fontWeight: 600 }}>{e.registrations || 0}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>{e.activations || 0}</td>
                    <td>{e.sql_count || 0}</td>
                    <td>{pct(e.activations || 0, e.registrations || 0)}</td>
                    <td>{hasLive ? pct(e.activations || 0, e.wechat_followers || 0) : '—'}</td>
                  </tr>
                );
              })}
              <tr style={{ background: 'var(--bg-surface)', fontWeight: 700 }}>
                <td>全渠道合计</td><td>—</td><td>{tReg}+</td><td>{tLeads}</td><td>{tMql}</td><td>{tSql}</td>
                <td>{pct(tMql, tLeads)}</td><td>{pct(tMql, tReg)}</td>
              </tr>
            </tbody>
          </table></div></div>
          <div className="highlight-box warning" style={{ marginTop: 12 }}>
            <strong>⚠️ 源文档勘误（已在本系统修正）：</strong>《CEO获客取数逻辑》逐活动表中「AI生态峰会申请43」「国企EMP申请10」为笔误，正确值 <strong>4</strong> 和 <strong>1</strong>（与合计122申请、「其余5场仅6人开通」交叉验证一致）。另两处标题数字（96%开通量→实为94%；60%沉睡→实为77%）以本页实时计算为准。
          </div>
        </div>
      </div>

      {/* 六、核心发现 */}
      <div className="section-card" id="cl-6">
        <div className="section-header"><h3>六、核心发现</h3><span className="section-count">5 条数据驱动结论</span></div>
        <div className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="highlight-box success">
            <strong>1️⃣ 混沌+晚点贡献 94% 开通量</strong> — ({top2Mql})/{tMql} = {pct(top2Mql, tMql)}，其余6场活动合计仅6人开通。<span style={{ color: 'var(--text-muted)' }}>（源文档标题写96%，按数据实为94%）</span>
          </div>
          <div className="highlight-box success">
            <strong>2️⃣ 混沌模式ROI最高</strong> — 94%通过率（31/33），远超活码渠道加微→开通的18%（{liveMql}/{tReg}）。关键差异：跳过「加微」环节，CEO在高信任社群直接分享开通链接。
          </div>
          <div className="highlight-box insight">
            <strong>3️⃣ 64%大客户走高管直推，不在线上漏斗</strong> — 39家中25家在A/B/C三个数据源中均无记录。这些客户通过辉哥人脉、线下拜访、内部推荐获取。
          </div>
          <div className="highlight-box warning">
            <strong>4️⃣ 77%加微客户沉睡</strong> — {tReg}人加微，仅{liveLeads}人（活码渠道）提交OCTO申请，{sleeping}人（{pct(sleeping, tReg)}）加微后零后续动作。<span style={{ color: 'var(--text-muted)' }}>（源文档标题写60%，按数据实为77%）</span>
          </div>
          <div className="highlight-box danger">
            <strong>5️⃣ SDR转出是最大瓶颈</strong> — {tMql}人开通 → 仅{tSql}人转出销售（{pct(tSql, tMql)}），{tMql - tSql}人开通后未进入销售管道。
          </div>
        </div>
      </div>

      {/* 七、39家交叉匹配 */}
      <div className="section-card" id="cl-7">
        <div className="section-header"><h3>七、39家大客户 × 获客数据交叉匹配</h3><span className="section-count">14 家有线上痕迹（36%）· 25 家高管直推（64%）</span></div>
        <div className="section-body">
          <div className="highlight-box" style={{ marginBottom: 12 }}>
            <strong>匹配方法：</strong>14家 = 在A（微伴加微）/ B（申请开通）/ C（SDR转出）任一数据源有痕迹；25家 = 三个数据源均无记录（高管直推/线下拜访/内部推荐）。点击客户行可跳转 CRM 客户档案。
          </div>
          <div className="card"><div className="table-wrap"><table>
            <tr><th>客户</th><th>分类</th><th>活码加微</th><th>OCTO申请</th><th>开通</th><th>SDR转出</th><th></th></tr>
            <tbody>
              {MATCHED_14.map(m => {
                const aid = accountMap[m[0]];
                return (
                  <tr className={aid ? 'clickable-row' : ''} key={m[0]} onClick={aid ? () => navigate(`/accounts/${aid}/detail`) : undefined}>
                    <td><strong>{m[0]}</strong></td>
                    <td style={{ fontSize: 12 }}>{m[1]}</td>
                    <td>{m[2]}</td><td>{m[3]}</td><td>{m[4]}</td><td>{m[5]}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{aid ? 'CRM档案 →' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div></div>
          <div className="highlight-box" style={{ marginTop: 12 }}>
            <strong>未在线上漏斗中出现的 25 家（高管直推获取）：</strong>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {UNMATCHED_25.split('、').map(n => <span className="tag tag-gray" key={n}>{n}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* 八、已知局限 */}
      <div className="section-card" id="cl-8">
        <div className="section-header"><h3>八、已知局限 & 数据缺口</h3><span className="section-count">5 项局限 · 原因说明</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>局限</th><th>影响</th><th>原因</th></tr>
            <tbody>
              {LIMITS.map((l, i) => (
                <tr key={i}>
                  <td><strong>⚠️ {l[0]}</strong></td>
                  <td style={{ fontSize: 12 }}>{l[1]}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l[2]}</td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
        </div>
      </div>

      {/* 九、文件清单 */}
      <div className="section-card" id="cl-9">
        <div className="section-header"><h3>九、相关数据文件清单</h3><span className="section-count">底稿 27 文件 · 存档 knowledge/kr2-data-foundation/</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>文件名</th><th>内容</th><th>对应数据源</th></tr>
            <tbody>
              {FILES.map((f, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{f[0]}</td>
                  <td style={{ fontSize: 12 }}>{f[1]}</td>
                  <td><span className="tag tag-purple" style={{ fontSize: 11 }}>{f[2]}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
          <div className="highlight-box" style={{ marginTop: 12 }}>
            <strong>待补数据：</strong>394家加微的逐人明细尚未导入系统（当前为活动级汇总 + 5条转出明细），需企微后台导出表补齐后可做逐人激活跟进。
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: 'var(--text-muted)' }}>
        📐 CEO获客取数逻辑 · 蓝本：章鱼烧《CEO获客取数逻辑》2026-09-23 · 数据截止 2026-09-18 · 漏斗数据实时计算自 ceo_events 表
      </div>
    </div>
  );
}
