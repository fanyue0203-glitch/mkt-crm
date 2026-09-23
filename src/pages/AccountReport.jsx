import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, setHeader, toast, openModal, closeModal } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';
import { TierBadge, CustomerStageTag } from '../components/Tags.jsx';

// ===== 报告表单弹窗 =====
function ReportFormModal({ report, accountId, onSaved }) {
  const formRef = useRef(null);
  const r = report || {};
  async function onSave(ev) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(formRef.current));
    try {
      if (r.id) {
        await api('/api/accounts/reports/' + r.id, { method: 'PUT', body });
        toast('报告更新成功');
      } else {
        await api(`/api/accounts/${accountId}/reports`, { method: 'POST', body });
        toast('报告创建成功');
      }
      closeModal(); onSaved();
    } catch (e) { toast(e.message, 'error'); }
  }
  return (
    <>
      <div className="modal-header"><h3>{r.id ? '编辑报告' : '新增报告'}</h3><button onClick={closeModal} style={{ fontSize: 20 }}>✕</button></div>
      <div className="modal-body"><form ref={formRef} onSubmit={onSave}>
        <div className="form-row">
          <div className="form-group"><label>报告类型</label>
            <select name="report_type" defaultValue={r.report_type !== 'monthly' ? 'weekly' : 'monthly'}>
              <option value="weekly">周报</option><option value="monthly">月报</option>
            </select>
          </div>
          <div className="form-group"><label>周期</label><input name="report_period" defaultValue={r.report_period || ''} placeholder="如 2026-W39 或 2026-09" /></div>
        </div>
        <div className="form-group"><label>🔴 本{r.report_type === 'monthly' ? '月' : '周'}最重要的一件事</label><textarea name="most_important" rows={2} placeholder="一件事" defaultValue={r.most_important || ''}></textarea></div>
        <div className="form-group"><label>📝 重点工作</label><textarea name="key_work" rows={4} defaultValue={r.key_work || ''}></textarea></div>
        <div className="form-group"><label>❓ 需要品鉴者决策</label><textarea name="need_decision" rows={2} defaultValue={r.need_decision || ''}></textarea></div>
        <div className="form-group"><label>🤝 跨线协同需求</label><textarea name="cross_team_needs" rows={2} defaultValue={r.cross_team_needs || ''}></textarea></div>
        <div className="form-group"><label>🚧 瓶颈/阻塞</label><textarea name="bottlenecks" rows={2} defaultValue={r.bottlenecks || ''}></textarea></div>
        <div className="form-group"><label>➡️ 下{r.report_type === 'monthly' ? '月' : '周'}最重要</label><textarea name="next_important" rows={2} defaultValue={r.next_important || ''}></textarea></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={closeModal}>取消</button>
          <button type="submit" className="btn btn-primary">💾 保存</button>
        </div>
      </form></div>
    </>
  );
}

// ===== 联系人表单弹窗 =====
function ContactFormModal({ contact, accountId, onSaved }) {
  const formRef = useRef(null);
  const c = contact || {};
  async function onSave(ev) {
    ev.preventDefault();
    const fd = new FormData(formRef.current);
    const body = Object.fromEntries(fd);
    body.is_champion = fd.get('is_champion') ? 1 : 0;
    try {
      if (c.id) {
        await api('/api/accounts/contacts/' + c.id, { method: 'PUT', body });
        toast('联系人更新成功');
      } else {
        await api(`/api/accounts/${accountId}/contacts`, { method: 'POST', body });
        toast('联系人创建成功');
      }
      closeModal(); onSaved();
    } catch (e) { toast(e.message, 'error'); }
  }
  return (
    <>
      <div className="modal-header"><h3>{c.id ? '编辑联系人' : '新增联系人'}</h3><button onClick={closeModal} style={{ fontSize: 20 }}>✕</button></div>
      <div className="modal-body"><form ref={formRef} onSubmit={onSave}>
        <div className="form-row">
          <div className="form-group"><label>姓名 *</label><input name="name" required defaultValue={c.name || ''} /></div>
          <div className="form-group"><label>职位</label><input name="title" defaultValue={c.title || ''} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>部门</label><input name="department" defaultValue={c.department || ''} /></div>
          <div className="form-group"><label>角色级别</label>
            <select name="role_level" defaultValue={c.role_level || ''}>
              <option value="">请选择</option>
              {['决策层', '管理层', '执行层'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>电话</label><input name="phone" defaultValue={c.phone || ''} /></div>
          <div className="form-group"><label>邮箱</label><input name="email" defaultValue={c.email || ''} /></div>
        </div>
        <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" name="is_champion" value="1" defaultChecked={!!c.is_champion} style={{ width: 'auto' }} /> ⭐ Champion</label></div>
        <div className="form-group"><label>备注</label><textarea name="notes" rows={2} defaultValue={c.notes || ''}></textarea></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={closeModal}>取消</button>
          <button type="submit" className="btn btn-primary">💾 保存</button>
        </div>
      </form></div>
    </>
  );
}

// ===== 报告卡片 =====
function ReportCard({ r, onEdit, onDelete }) {
  const typeLabel = r.report_type === 'weekly' ? '周报' : '月报';
  const typeClass = r.report_type === 'weekly' ? 'report-type-weekly' : 'report-type-monthly';
  const field = (icon, label, val, extraClass = '') => val ? (
    <div className="report-field" key={label}>
      <div className="report-field-label">{icon} {label}</div>
      <div className={`report-field-value ${extraClass}`}>{val}</div>
    </div>
  ) : null;
  return (
    <div className="card report-card" style={{ marginBottom: 4 }}>
      <div className="card-body">
        <div className="report-meta">
          <span className="report-period">{r.report_period || '未设周期'}</span>
          <span className={`report-type-badge ${typeClass}`}>{typeLabel}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{r.created_at || ''}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => onEdit(r)}>编辑</button>
          <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('确定删除这条报告？')) onDelete(r.id); }}>删除</button>
        </div>
        {field('🔴', '本期最重要的一件事', r.most_important, 'highlight-box')}
        {field('📝', '重点工作', r.key_work)}
        {field('❓', '需要品鉴者决策', r.need_decision, 'highlight-box insight')}
        {field('🤝', '跨线协同需求', r.cross_team_needs)}
        {field('🚧', '瓶颈/阻塞', r.bottlenecks)}
        {field('➡️', '下期最重要的一件事', r.next_important)}
      </div>
    </div>
  );
}

// ===== 联系人分组卡片 =====
function ContactPersonCard({ c, onEdit, onDelete }) {
  return (
    <div className="contact-person-card">
      <div className="cpc-name">{c.name}{c.is_champion ? <span className="cpc-champion">⭐</span> : null}</div>
      <div className="cpc-title">{c.title || ''}{c.department ? ' · ' + c.department : ''}</div>
      <div className="cpc-contact">{c.phone ? c.phone : ''}{c.email ? ' · ' + c.email : ''}</div>
      {c.notes ? <div className="cpc-notes">{c.notes}</div> : null}
      <div className="cpc-actions" style={{ marginLeft: 'auto' }}>
        <button className="btn btn-sm btn-secondary" onClick={() => onEdit(c)}>编辑</button>
        <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('确定删除？')) onDelete(c.id); }}>删除</button>
      </div>
    </div>
  );
}

export default function AccountReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [a, setA] = useState(null);
  const [tab, setTab] = useState('profile');
  const [error, setError] = useState(null);

  const load = () => {
    api(`/api/accounts/${id}`).then(d => {
      setA(d);
      setHeader(`🐙 ${d.company_name} · 全景档案`, headerActions(d));
    }).catch(e => setError(e));
  };

  const headerActions = (acc) => (
    <>
      <button className="btn btn-secondary" onClick={() => navigate('/octo')}>← 返回</button>
      <button className="btn btn-primary" onClick={() => navigate(`/octo/account-form/${id}`)}>编辑客户</button>
    </>
  );

  useEffect(() => { load(); }, [id]);

  const openReportForm = (report) => openModal(<ReportFormModal report={report} accountId={a.id} onSaved={load} />);
  const openContactForm = (contact) => openModal(<ContactFormModal contact={contact} accountId={a.id} onSaved={load} />);
  const deleteReport = async (rid) => {
    try { await api('/api/accounts/reports/' + rid, { method: 'DELETE' }); toast('删除成功'); load(); } catch (e) { toast(e.message, 'error'); }
  };
  const deleteContact = async (cid) => {
    try { await api('/api/accounts/contacts/' + cid, { method: 'DELETE' }); toast('删除成功'); load(); } catch (e) { toast(e.message, 'error'); }
  };

  // header 操作随 tab 变化（hook 必须在早退 return 之前）
  useEffect(() => {
    if (!a) return;
    const extra = tab === 'reports'
      ? <button className="btn btn-primary" onClick={() => openReportForm(null)}>+ 新增报告</button>
      : tab === 'contacts'
        ? <button className="btn btn-primary" onClick={() => openContactForm(null)}>+ 新增联系人</button>
        : null;
    setHeader(`🐙 ${a.company_name} · 全景档案`, <>
      <button className="btn btn-secondary" onClick={() => navigate('/octo')}>← 返回</button>
      {extra}
    </>);
  }, [tab, a]);

  if (error) return <Err error={error} />;
  if (!a) return <Loading />;

  const reports = a.reports || [];
  const contacts = a.contacts || [];

  // ===== 客户档案 tab =====
  const renderProfile = () => {
    const events = (a.key_events || []).slice().sort((x, y) => (x.date || '').localeCompare(y.date || ''));
    const infoFields = [
      ['行业', a.industry], ['规模', a.scale], ['地区', a.region], ['线索来源', a.lead_source || a.source],
      ['部署方式', a.deployment_type], ['负责人', a.assigned_to],
      ['覆盖联系人', a.key_contacts_count ? a.key_contacts_count + '人' : ''], ['覆盖部门', a.key_departments],
    ];
    return (
      <>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3>📌 客户概况</h3></div>
          <div className="card-body">
            <div className="info-grid">
              {infoFields.map(([l, v]) => v ? <div className="detail-field" key={l}><div className="label">{l}</div><div className="value">{v}</div></div> : null)}
            </div>
            {a.deal_stage ? <div className="detail-field" style={{ marginTop: 12 }}><div className="label">商机阶段</div><div className="value" style={{ fontWeight: 600, color: 'var(--warning)' }}>{a.deal_stage}</div></div> : null}
          </div>
        </div>

        <SourceCoverageCard cov={a.source_coverage} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="card"><div className="card-header"><h3>🎯 核心痛点</h3></div><div className="card-body"><div className="highlight-box danger" style={{ whiteSpace: 'pre-wrap' }}>{a.core_painpoint || <span style={{ color: 'var(--text-muted)' }}>暂无记录</span>}</div></div></div>
          <div className="card"><div className="card-header"><h3>💚 客户认可点</h3></div><div className="card-body"><div className="highlight-box success" style={{ whiteSpace: 'pre-wrap' }}>{a.customer_recognition || <span style={{ color: 'var(--text-muted)' }}>暂无记录</span>}</div></div></div>
        </div>

        {a.product_solutions_detail ? (
          <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3>🛠️ 产品方案详情</h3></div><div className="card-body"><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{a.product_solutions_detail}</div></div></div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="card">
            <div className="card-header"><h3>⚔️ 竞品信息</h3></div>
            <div className="card-body">
              {a.competitors ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {a.competitors.split(/[/、,，]/).filter(Boolean).map((c, i) => <span className="tag tag-red" key={i}>{c.trim()}</span>)}
                </div>
              ) : <span style={{ color: 'var(--text-muted)' }}>暂无记录</span>}
            </div>
          </div>
          <div className="card"><div className="card-header"><h3>🔗 生态锁定评估</h3></div><div className="card-body"><div style={{ fontSize: 13, lineHeight: 1.7 }}>{a.ecosystem_lock || <span style={{ color: 'var(--text-muted)' }}>暂无评估</span>}</div></div></div>
        </div>

        {a.blockers ? (
          <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3 style={{ color: 'var(--danger)' }}>🚨 卡点/阻塞事项</h3></div><div className="card-body"><div className="highlight-box danger" style={{ whiteSpace: 'pre-wrap', borderLeftColor: 'var(--danger)' }}>{a.blockers}</div></div></div>
        ) : null}

        {a.next_step ? (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h3>➡️ 下一步行动 {a.next_deadline ? <span className="tag tag-yellow" style={{ marginLeft: 8 }}>截止 {a.next_deadline}</span> : null}</h3></div>
            <div className="card-body"><div className="highlight-box" style={{ whiteSpace: 'pre-wrap' }}>{a.next_step}</div></div>
          </div>
        ) : null}

        {events.length ? (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h3>🕐 关键事件时间线</h3></div>
            <div className="card-body">
              <div className="vertical-timeline">
                {events.map((ev, i) => (
                  <div className="vt-item" key={i}>
                    <div className="vt-dot"></div>
                    <div className="vt-date">{ev.date || ''}</div>
                    <div className="vt-event">{ev.event || ''}</div>
                    {ev.note ? <div className="vt-note">{ev.note}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {a.lessons_learned ? (
          <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3>💡 经验教训</h3></div><div className="card-body"><div className="lesson-card" style={{ marginBottom: 0 }}><div className="lc-content">{a.lessons_learned}</div></div></div></div>
        ) : null}

        {a.notes ? (
          <div className="card"><div className="card-header"><h3>📝 备注</h3></div><div className="card-body"><div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{a.notes}</div></div></div>
        ) : null}
      </>
    );
  };

  // ===== 推进周报 tab =====
  const renderReports = () => (
    <>
      <div style={{ marginBottom: 16 }}><button className="btn btn-primary" onClick={() => openReportForm(null)}>+ 新增周报/月报</button></div>
      {!reports.length ? (
        <div className="empty-state"><div className="icon">📝</div><p>暂无推进报告</p><button className="btn btn-primary" onClick={() => openReportForm(null)}>+ 写第一条报告</button></div>
      ) : (
        <div className="timeline">
          {reports.map(r => <ReportCard key={r.id} r={r} onEdit={openReportForm} onDelete={deleteReport} />)}
        </div>
      )}
    </>
  );

  // ===== 联系人 tab =====
  const renderContacts = () => {
    const groups = [
      { key: '决策层', icon: '👑', cls: 'cg-decision' },
      { key: '管理层', icon: '💼', cls: 'cg-management' },
      { key: '执行层', icon: '⚙️', cls: 'cg-execution' },
    ];
    const ungrouped = contacts.filter(c => !c.role_level);
    return (
      <>
        <div style={{ marginBottom: 16 }}><button className="btn btn-primary" onClick={() => openContactForm(null)}>+ 新增联系人</button></div>
        {!contacts.length ? (
          <div className="card"><div className="empty-state"><p>暂无联系人</p></div></div>
        ) : (
          <>
            {groups.map(g => {
              const list = contacts.filter(c => c.role_level === g.key);
              if (!list.length) return null;
              return (
                <div className="contact-group" key={g.key}>
                  <div className={`contact-group-header ${g.cls}`}>{g.icon} {g.key} ({list.length}人)</div>
                  <div className="contact-group-body">
                    {list.map(c => <ContactPersonCard key={c.id} c={c} onEdit={openContactForm} onDelete={deleteContact} />)}
                  </div>
                </div>
              );
            })}
            {ungrouped.length ? (
              <div className="contact-group">
                <div className="contact-group-header" style={{ background: 'rgba(100,116,139,.1)', borderLeft: '3px solid var(--text-muted)', color: 'var(--text-muted)' }}>📋 未分级 ({ungrouped.length}人)</div>
                <div className="contact-group-body">
                  {ungrouped.map(c => <ContactPersonCard key={c.id} c={c} onEdit={openContactForm} onDelete={deleteContact} />)}
                </div>
              </div>
            ) : null}
          </>
        )}
      </>
    );
  };

  return (
    <>
      <div className="account-hero">
        <div className="account-hero-top">
          <TierBadge tier={a.tier} style={{ width: 48, height: 48, fontSize: 20, borderRadius: 10 }} />
          <div>
            <div className="account-hero-name">{a.company_name}</div>
            <div className="account-hero-tags">
              {a.customer_stage ? <CustomerStageTag s={a.customer_stage} /> : null}
              {a.industry ? <span className="tag tag-blue">{a.industry}</span> : null}
              {a.region ? <span className="tag tag-gray">{a.region}</span> : null}
              {a.deployment_type ? <span className="tag tag-cyan">{a.deployment_type}</span> : null}
              {a.ceo_involvement ? <span className="champion-tag">🔥 高管直推</span> : null}
            </div>
          </div>
          <div className="account-hero-amount">
            <div className="amount-label">{a.customer_stage === '已签约' || a.customer_stage === '交付中' ? '已签约金额' : '预估金额'}</div>
            <div className={'amount-hero' + (a.customer_stage === '已签约' || a.customer_stage === '交付中' ? ' green' : '')}>{a.deal_amount ? a.deal_amount + '万' : '—'}</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <div className={'tab' + (tab === 'profile' ? ' active' : '')} onClick={() => setTab('profile')}>📋 客户档案</div>
        <div className={'tab' + (tab === 'reports' ? ' active' : '')} onClick={() => setTab('reports')}>📝 推进周报 ({reports.length})</div>
        <div className={'tab' + (tab === 'contacts' ? ' active' : '')} onClick={() => setTab('contacts')}>👥 联系人 ({contacts.length})</div>
      </div>

      {tab === 'profile' ? renderProfile() : tab === 'reports' ? renderReports() : renderContacts()}
    </>
  );
}


// ===== 数据源覆盖卡片（KR2取数逻辑：5源+CEO获客漏斗）=====
const SOURCE_META = {
  graph_v3: { label: '① 图谱v3', desc: '大客户拓展图谱（14家基础池）' },
  onboarding: { label: '② Onboarding', desc: 'Onboarding跟踪表（15家，优先级S/A/B）' },
  org_chart: { label: '③ 架构表', desc: '客户组织架构表（仅4家：吉利/金智/宇通/南孚）' },
  chat_scan: { label: '④ 消息扫描', desc: '子区消息扫描486条（实际沟通原话）' },
  weekly_meeting: { label: '⑤ 周会纪要', desc: '3期周会（8/31、9/7、9/14，姜平决策）' },
  ceo_funnel: { label: 'CEO获客漏斗', desc: '微伴×内测申请表交叉匹配' },
};
function SourceCoverageCard({ cov }) {
  let c = {};
  try { c = typeof cov === 'string' ? JSON.parse(cov || '{}') : (cov || {}); } catch (e) { c = {}; }
  if (!Object.keys(c).length) return null;
  const keys = Object.keys(SOURCE_META).filter(k => c[k]);
  if (!keys.length) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header"><h3>📐 数据源覆盖（取数逻辑）</h3><span className="section-count">{keys.length}/6 源</span></div>
      <div className="card-body">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: c.note ? 10 : 0 }}>
          {Object.entries(SOURCE_META).map(([k, m]) => (
            <span key={k} className={'tag ' + (c[k] ? 'tag-green' : 'tag-gray')} style={{ fontSize: 11 }} title={m.desc}>
              {c[k] ? '✓' : '×'} {m.label}
            </span>
          ))}
        </div>
        {c.note ? <div className="highlight-box" style={{ fontSize: 12 }}>📌 {c.note}</div> : null}
      </div>
    </div>
  );
}
