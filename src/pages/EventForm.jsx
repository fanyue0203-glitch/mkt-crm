import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, setHeader, toast } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';

const EVENT_TYPES = ['论坛', '展会', '参访', '峰会', '沙龙', '发布会', '路演', '其他'];
const STATUSES = ['筹备中', '进行中', '已结束', '已取消'];

export default function EventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [e, setE] = useState(id ? null : {});
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader(id ? '🎪 编辑活动' : '🎪 新建活动',
      <button className="btn btn-secondary" onClick={() => navigate('/ceo-events')}>← 返回看板</button>);
    if (id) {
      api(`/api/events/${id}`).then(ev => setE(ev)).catch(er => setError(er));
    }
  }, [id]);

  if (error) return <Err error={error} />;
  if (!e) return <Loading />;

  async function onSave(ev) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(formRef.current));
    ['scale', 'registration_count', 'attendance_count', 'vip_count', 'leads_count', 'mql_count', 'sql_count'].forEach(f => body[f] = +body[f] || 0);
    try {
      let newId = id;
      if (id) {
        await api(`/api/events/${id}`, { method: 'PUT', body });
        toast('活动更新成功');
      } else {
        const r = await api('/api/events', { method: 'POST', body });
        newId = r.id;
        toast('活动创建成功');
      }
      navigate(`/ceo-events/${newId}`);
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div className="card"><div className="card-body">
      <form ref={formRef} onSubmit={onSave}>
        <div className="form-row-3">
          <div className="form-group"><label>活动名称 *</label><input name="name" required defaultValue={e.name || ''} /></div>
          <div className="form-group"><label>活动类型</label><select name="event_type" defaultValue={e.event_type || EVENT_TYPES[0]}>{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="form-group"><label>状态</label><select name="status" defaultValue={e.status || STATUSES[0]}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>开始日期</label><input type="date" name="date" defaultValue={e.date || ''} /></div>
          <div className="form-group"><label>结束日期</label><input type="date" name="end_date" defaultValue={e.end_date || ''} /></div>
          <div className="form-group"><label>地点</label><input name="location" defaultValue={e.location || ''} /></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>预计规模</label><input type="number" name="scale" defaultValue={e.scale || ''} /></div>
          <div className="form-group"><label>预算</label><input name="budget" defaultValue={e.budget || ''} /></div>
          <div className="form-group"><label>主题</label><input name="theme" defaultValue={e.theme || ''} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>目标客户群</label><input name="target_audience" defaultValue={e.target_audience || ''} /></div>
          <div className="form-group"><label>主办方 / 承办方</label><div style={{ display: 'flex', gap: 8 }}><input name="host" placeholder="主办方" defaultValue={e.host || ''} style={{ flex: 1 }} /><input name="organizer" placeholder="承办方" defaultValue={e.organizer || ''} style={{ flex: 1 }} /></div></div>
        </div>
        <div className="form-group"><label>⭐ 业务设计（面对什么客户群？讲什么故事？Agenda是什么？）</label><textarea name="business_design" rows={4} defaultValue={e.business_design || ''}></textarea></div>
        <div className="form-row"><div className="form-group"><label>产品/方案</label><textarea name="product_solutions" rows={2} defaultValue={e.product_solutions || ''}></textarea></div><div className="form-group"><label>目标市场</label><textarea name="target_market" rows={2} defaultValue={e.target_market || ''}></textarea></div></div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
        <h3 style={{ fontSize: 14, marginBottom: 16, color: 'var(--accent-light)' }}>📊 核心数据</h3>
        <div className="form-row-3">
          <div className="form-group"><label>报名人数</label><input type="number" name="registration_count" defaultValue={e.registration_count || ''} /></div>
          <div className="form-group"><label>到场人数</label><input type="number" name="attendance_count" defaultValue={e.attendance_count || ''} /></div>
          <div className="form-group"><label>VIP人数</label><input type="number" name="vip_count" defaultValue={e.vip_count || ''} /></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>留资数</label><input type="number" name="leads_count" defaultValue={e.leads_count || ''} /></div>
          <div className="form-group"><label>MQL</label><input type="number" name="mql_count" defaultValue={e.mql_count || ''} /></div>
          <div className="form-group"><label>SQL</label><input type="number" name="sql_count" defaultValue={e.sql_count || ''} /></div>
        </div>
        <div className="form-row"><div className="form-group"><label>预估PPL</label><input name="estimated_ppl" defaultValue={e.estimated_ppl || ''} /></div><div className="form-group"><label>ROI</label><input name="roi" defaultValue={e.roi || ''} /></div></div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
        <h3 style={{ fontSize: 14, marginBottom: 16, color: 'var(--warning)' }}>💬 现场反馈</h3>
        <div className="form-group"><label>客户在问什么</label><textarea name="customer_feedback" rows={3} defaultValue={e.customer_feedback || ''}></textarea></div>
        <div className="form-group"><label>投资人在问什么</label><textarea name="investor_feedback" rows={3} defaultValue={e.investor_feedback || ''}></textarea></div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
        <h3 style={{ fontSize: 14, marginBottom: 16, color: 'var(--success)' }}>📝 复盘</h3>
        <div className="form-group"><label>市场反馈摘要</label><textarea name="feedback_summary" defaultValue={e.feedback_summary || ''}></textarea></div>
        <div className="form-group"><label>结构性洞察</label><textarea name="structural_insights" defaultValue={e.structural_insights || ''}></textarea></div>
        <div className="form-group"><label>经验总结</label><textarea name="lessons_learned" defaultValue={e.lessons_learned || ''}></textarea></div>
        <div className="form-group"><label>备注</label><textarea name="notes" defaultValue={e.notes || ''}></textarea></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/ceo-events')}>取消</button>
          <button type="submit" className="btn btn-primary">💾 保存</button>
        </div>
      </form>
    </div></div>
  );
}
