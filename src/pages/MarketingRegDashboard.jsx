import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';

const fmt = n => (n === undefined || n === null ? '-' : Number(n).toLocaleString());

// ===== 横向柱状榜单 =====
function RankBars({ title, sub, items, color = '#2563eb', showValid = false, unit = '人', max }) {
  const top = max || Math.max(1, ...items.map(i => i.count));
  return (
    <div className="mc-card reg-rank">
      <div className="mc-card-head">
        <div>
          <h3>{title}</h3>
          {sub && <p className="mc-sub">{sub}</p>}
        </div>
      </div>
      {(!items || !items.length) ? (
        <div className="reg-empty">暂无数据</div>
      ) : (
        <div className="reg-rank-list">
          {items.map((it, i) => (
            <div className="reg-rank-row" key={it.value}>
              <span className={`reg-rank-no ${i < 3 ? 'hot' : ''}`}>{i + 1}</span>
              <span className="reg-rank-name" title={it.value}>{it.label || it.value}</span>
              <span className="reg-rank-bar">
                <i style={{ width: `${Math.max(2, (it.count / top) * 100)}%`, background: i < 3 ? color : `${color}99` }} />
              </span>
              <b className="reg-rank-num" style={{ color }}>{fmt(it.count)}</b>
              <span className="reg-rank-unit">{unit}</span>
              {showValid && <span className="reg-rank-valid">有效 {it.valid || 0}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 极简折线/柱状（SVG，无依赖）=====
function TrendChart({ daily, snapshots, target }) {
  const [hover, setHover] = useState(null);
  if (!daily || !daily.length) return <div className="reg-empty">暂无趋势数据</div>;

  const W = 1000, H = 260, P = { l: 46, r: 16, t: 16, b: 34 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const n = daily.length;
  const maxCum = Math.max(target || 900, ...daily.map(d => d.cum));
  const x = i => P.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const yCum = v => P.t + ih - (v / maxCum) * ih;
  const maxNew = Math.max(1, ...daily.map(d => d.new));
  const bw = Math.max(4, Math.min(26, iw / n - 4));
  const yNew = v => P.t + ih - (v / maxNew) * ih * 0.62;

  const linePts = daily.map((d, i) => `${x(i)},${yCum(d.cum)}`).join(' ');
  const areaPts = `${P.l},${P.t + ih} ${linePts} ${x(n - 1)},${P.t + ih}`;
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(r => Math.round(maxCum * r));

  return (
    <div className="reg-trend-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="reg-trend-svg" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="regArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={yCum(v)} y2={yCum(v)} stroke="#e5e7eb" strokeDasharray="3 4" />
            <text x={P.l - 8} y={yCum(v) + 4} textAnchor="end" className="reg-axis">{v}</text>
          </g>
        ))}
        {daily.map((d, i) => (
          <rect key={d.date} x={x(i) - bw / 2} y={yNew(d.new)} width={bw} height={P.t + ih - yNew(d.new)}
            fill="#93c5fd" opacity={hover === i ? 1 : 0.75} rx="2"
            onMouseEnter={() => setHover(i)} />
        ))}
        <path d={areaPts} fill="url(#regArea)" />
        <polyline points={linePts} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
        {daily.map((d, i) => (
          <circle key={d.date} cx={x(i)} cy={yCum(d.cum)} r={hover === i ? 5 : 3} fill="#fff" stroke="#2563eb" strokeWidth="2"
            onMouseEnter={() => setHover(i)} />
        ))}
        {daily.map((d, i) => (
          (i % Math.ceil(n / 12) === 0 || i === n - 1) && (
            <text key={d.date} x={x(i)} y={H - 10} textAnchor="middle" className="reg-axis">{d.date.slice(5)}</text>
          )
        ))}
        {hover !== null && daily[hover] && (() => {
          const d = daily[hover];
          const bx = Math.min(W - 190, Math.max(P.l, x(hover) - 85));
          return (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={P.t + ih} stroke="#94a3b8" strokeDasharray="3 3" />
              <rect x={bx} y={P.t + 4} width={170} height={62} rx="6" fill="#0f172a" opacity="0.92" />
              <text x={bx + 10} y={P.t + 24} className="reg-tip">{d.date} 累计 {fmt(d.cum)} 人</text>
              <text x={bx + 10} y={P.t + 42} className="reg-tip">当日新增 {fmt(d.new)} 人</text>
              <text x={bx + 10} y={P.t + 58} className="reg-tip-dim">距目标差 {fmt((target || 900) - d.cum)} 人</text>
            </g>
          );
        })()}
      </svg>
      <div className="reg-legend">
        <span><i className="lg-bar" />每日新增</span>
        <span><i className="lg-line" />累计报名</span>
        <span className="lg-dim">目标 {fmt(target)} 人</span>
      </div>
    </div>
  );
}

// ===== 差值表 =====
function DiffTable({ snapshots }) {
  if (!snapshots || !snapshots.length) return <div className="reg-empty">暂无快照，等待每日同步</div>;
  const rows = [...snapshots].reverse();
  return (
    <div className="mc-table-scroll reg-diff">
      <table className="mc-otable">
        <thead>
          <tr>
            <th>日期</th><th>统计时点</th><th>累计报名</th><th>较前日</th><th>有效票</th><th>待审核</th><th>完成率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const pct = r.target ? (r.cum / r.target * 100) : 0;
            return (
              <tr key={r.date}>
                <td>{r.date}</td>
                <td>{r.statTime || '—'}</td>
                <td><b>{fmt(r.cum)}</b></td>
                <td>
                  <span className={`reg-diff-val ${r.diff > 0 ? 'up' : r.diff < 0 ? 'down' : ''}`}>
                    {r.diff > 0 ? `+${r.diff}` : r.diff}
                  </span>
                </td>
                <td>{fmt(r.valid)}</td>
                <td>{fmt(r.pending)}</td>
                <td>{pct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===== 明细表 =====
function RegList({ channels = [] }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (status) qs.set('status', status);
      if (source) qs.set('source', source);
      qs.set('limit', '300');
      const d = await api('/api/marketing-campaign/reg-list?' + qs.toString());
      setRows(d.rows || []); setTotal(d.total || 0);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [q, status, source]);

  useEffect(() => { load(); }, [status, source]);

  return (
    <div className="mc-card">
      <div className="mc-card-head">
        <div>
          <h3>报名明细</h3>
          <p className="mc-sub">共 {fmt(total)} 条 · 按报名时间倒序</p>
        </div>
        <div className="reg-filters">
          <input className="reg-input" placeholder="搜索姓名 / 公司 / 手机 / 邀约人" value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
          <select className="reg-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">全部状态</option>
            <option value="有效票">有效票</option>
            <option value="待审核">待审核</option>
          </select>
          <select className="reg-select" value={source} onChange={e => setSource(e.target.value)}>
            <option value="">全部渠道</option>
            {channels.map(c => <option key={c.label} value={c.label}>{c.label}（{c.count}）</option>)}
          </select>
          <button className="mc-btn" onClick={load}>查询</button>
        </div>
      </div>
      {err && <Err msg={err} />}
      {loading ? <Loading /> : (
        <div className="mc-table-scroll">
          <table className="mc-otable">
            <thead>
              <tr><th>报名时间</th><th>姓名</th><th>公司</th><th>行业</th><th>邀约渠道</th><th>邀约人</th><th>地区</th><th>状态</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="reg-t-dim">{String(r.time).slice(0, 16)}</td>
                  <td>{r.name}</td>
                  <td title={r.company}>{r.company}</td>
                  <td>{r.industry}</td>
                  <td>{r.source}</td>
                  <td>{r.inviter || '—'}</td>
                  <td>{r.region}</td>
                  <td><span className={`reg-badge ${r.status === '有效票' ? 'ok' : 'wait'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== 主页面 =====
export default function MarketingRegDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    setErr('');
    try {
      const d = await api('/api/marketing-campaign/reg-dashboard');
      setData(d);
    } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 300000); return () => clearInterval(t); }, [load]);

  if (err) return <Err msg={err} />;
  if (!data) return <Loading />;

  const k = data.kpi;
  const last = data.snapshots[data.snapshots.length - 1];
  const prev = data.snapshots[data.snapshots.length - 2];
  const todayDiff = last && prev ? last.cum - prev.cum : 0;
  const paceOk = (data.pace.avg7 || 0) >= k.needPerDay;

  return (
    <div className="mc-page reg-page">
      {/* 头部 */}
      <div className="reg-head">
        <div>
          <h2>{data.campaign} · 报名进度追踪</h2>
          <p className="mc-sub">
            REGISTRATION DASHBOARD ·
            统计口径 {last ? `${last.date} ${last.statTime || ''}` : '待同步'} ·
            数据源：活动行报名明细
          </p>
        </div>
        <div className="reg-countdown">
          <div className="reg-cd-num">{k.daysLeft}</div>
          <div className="reg-cd-txt">距大会开幕（天）</div>
        </div>
      </div>

      {/* 四指标卡 */}
      <div className="reg-kpis">
        <div className="reg-kpi">
          <div className="reg-kpi-label">已报名人数</div>
          <div className="reg-kpi-num">{fmt(k.total)}<span className="reg-kpi-unit">人</span></div>
          <div className="reg-kpi-foot">较上一快照 {todayDiff > 0 ? `+${todayDiff}` : todayDiff} 人</div>
        </div>
        <div className="reg-kpi">
          <div className="reg-kpi-label">已报名占比</div>
          <div className="reg-kpi-num" style={{ color: '#2563eb' }}>{k.pct}<span className="reg-kpi-unit">%</span></div>
          <div className="reg-kpi-foot">目标 {fmt(k.target)} 人</div>
        </div>
        <div className="reg-kpi">
          <div className="reg-kpi-label">待冲刺缺口</div>
          <div className="reg-kpi-num" style={{ color: '#dc2626' }}>{fmt(k.gap)}<span className="reg-kpi-unit">人</span></div>
          <div className="reg-kpi-foot">剩余 {k.daysLeft} 天 · 日均需 {fmt(k.needPerDay)} 人</div>
        </div>
        <div className="reg-kpi">
          <div className="reg-kpi-label">当前报名速度</div>
          <div className="reg-kpi-num" style={{ color: paceOk ? '#059669' : '#d97706' }}>{data.pace.avg7}<span className="reg-kpi-unit">人/天</span></div>
          <div className="reg-kpi-foot">
            {paceOk ? '✅ 已达所需速度' : `⚠️ 低于所需 ${fmt(k.needPerDay - data.pace.avg7)} 人/天`}
          </div>
        </div>
      </div>

      {/* 总进度条 */}
      <div className="mc-card reg-progress-card">
        <div className="reg-progress-top">
          <span>整体报名进度</span>
          <span className="reg-progress-meta">
            <b>{fmt(k.total)}</b> / {fmt(k.target)} 人 · 已完成 {k.pct}% · 剩余 {(100 - k.pct).toFixed(1)}%
          </span>
        </div>
        <div className="reg-progress-bar">
          <i style={{ width: `${Math.min(100, k.pct)}%` }} />
          <span className="reg-progress-mark" style={{ left: `${Math.min(100, k.pct)}%` }} />
        </div>
        <div className="reg-progress-hint">
          按当前速度（{data.pace.avg7} 人/天）推算，开幕前预计 <b>{fmt(data.pace.projected)}</b> 人，
          {data.pace.projected >= k.target ? '可达成目标' : `仍差 ${fmt(k.target - data.pace.projected)} 人`}
        </div>
      </div>

      {/* Tabs */}
      <div className="reg-tabs">
        {[['overview', '报名总览'], ['diff', '每日差值'], ['list', '报名明细']].map(([v, l]) => (
          <button key={v} className={`reg-tab ${tab === v ? 'on' : ''}`} onClick={() => setTab(v)}>{l}</button>
        ))}
        <span className="reg-tabs-spacer" />
        <span className="reg-updated">最近刷新：{new Date().toLocaleTimeString('zh-CN', { hour12: false })}</span>
      </div>

      {tab === 'overview' && (
        <>
          <div className="mc-card">
            <div className="mc-card-head">
              <div>
                <h3>报名趋势</h3>
                <p className="mc-sub">柱=每日新增 · 线=累计报名 · 悬停查看单日明细</p>
              </div>
            </div>
            <TrendChart daily={data.daily} snapshots={data.snapshots} target={k.target} />
          </div>

          <div className="reg-grid2">
            <RankBars title="邀约渠道榜" sub="按邀约人字段归类" items={data.sources} color="#2563eb" />
            <RankBars title="销售 / 员工邀约 TOP15" sub="仅统计可识别的员工邀约" items={data.staff} color="#059669" showValid />
          </div>

          <div className="reg-grid2">
            <RankBars title="区域分布（对齐海报口径）" sub="华东1 三分组合并 · 市场部公共码/未匹配单列" items={data.zones} color="#8b5cf6" />
            <RankBars title="行业 TOP10" sub="报名人填写的所在行业" items={data.industries} color="#f59e0b" />
          </div>

          <div className="mc-card">
            <div className="mc-card-head">
              <div>
                <h3>待办提醒</h3>
                <p className="mc-sub">系统按数据自动生成</p>
              </div>
            </div>
            <div className="reg-todo">
              {k.pending > 0 && (
                <div className="reg-todo-item warn">待审核 {fmt(k.pending)} 条（占 {(k.pending / k.total * 100).toFixed(0)}%），审核通过才算真实参会意向</div>
              )}
              {!paceOk && k.daysLeft > 0 && (
                <div className="reg-todo-item warn">日均需 {fmt(k.needPerDay)} 人，近7日实际 {data.pace.avg7} 人/天，缺口 {fmt(k.needPerDay - data.pace.avg7)} 人/天</div>
              )}
              {data.channelCats.find(c => c.value === '未归属' && c.pct > 20) && (
                <div className="reg-todo-item warn">
                  无渠道码自然报名 {data.channelCats.find(c => c.value === '未归属').count} 人（{data.channelCats.find(c => c.value === '未归属').pct}%），无法归因到具体销售
                </div>
              )}
              {data.channelCats.find(c => c.value === '未登记') && (
                <div className="reg-todo-item warn">
                  未登记渠道码 {data.channelCats.find(c => c.value === '未登记').count} 人，码值不在渠道码名单内，需补登记后才能归因
                </div>
              )}
              {paceOk && <div className="reg-todo-item ok">报名速度已达所需，保持当前节奏即可达成目标</div>}
            </div>
          </div>
        </>
      )}

      {tab === 'diff' && (
        <>
          <div className="mc-card">
            <div className="mc-card-head">
              <div>
                <h3>每日报名差值</h3>
                <p className="mc-sub">差值 = 当日累计报名 − 上一快照累计，用于看每天真实增量</p>
              </div>
            </div>
            <TrendChart daily={data.daily} snapshots={data.snapshots} target={k.target} />
          </div>
          <div className="mc-card">
            <div className="mc-card-head"><div><h3>每日快照明细</h3><p className="mc-sub">每日同步后自动新增一行</p></div></div>
            <DiffTable snapshots={data.snapshots} />
          </div>
        </>
      )}

      {tab === 'list' && <RegList channels={data.allChannels} />}
    </div>
  );
}