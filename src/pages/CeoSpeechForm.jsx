import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, setHeader, toast } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';

export default function CeoSpeechForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [s, setS] = useState(id ? null : {});
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader(id ? '🎤 编辑演讲' : '🎤 新建演讲',
      <button className="btn btn-secondary" onClick={() => navigate('/ceo-events')}>← 返回</button>);
    if (id) {
      api(`/api/speeches/${id}`).then(d => setS(d)).catch(e => setError(e));
    }
  }, [id]);

  if (error) return <Err error={error} />;
  if (!s) return <Loading />;

  async function onSave(ev) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(formRef.current));
    body.audience_count = +body.audience_count || 0;
    body.leads_count = +body.leads_count || 0;
    try {
      let newId = id;
      if (id) {
        await api(`/api/speeches/${id}`, { method: 'PUT', body });
        toast('更新成功');
      } else {
        const r = await api('/api/speeches', { method: 'POST', body });
        newId = r.id;
        toast('创建成功');
      }
      navigate(`/speeches/${newId}`);
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div className="card"><div className="card-body">
      <form ref={formRef} onSubmit={onSave}>
        <div className="form-group"><label>活动主题 *</label><input name="topic" required defaultValue={s.topic || ''} /></div>
        <div className="form-row-3">
          <div className="form-group"><label>日期</label><input type="date" name="date" defaultValue={s.date || ''} /></div>
          <div className="form-group"><label>地点</label><input name="location" defaultValue={s.location || ''} /></div>
          <div className="form-group"><label>所属活动</label><input name="event_name" defaultValue={s.event_name || ''} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>听众人数</label><input type="number" name="audience_count" defaultValue={s.audience_count || ''} /></div>
          <div className="form-group"><label>听众画像</label><input name="audience_profile" defaultValue={s.audience_profile || ''} /></div>
        </div>
        <div className="form-group"><label>⭐ 业务设计</label><textarea name="business_design" rows={3} defaultValue={s.business_design || ''}></textarea></div>
        <div className="form-group"><label>故事线</label><textarea name="story_line" defaultValue={s.story_line || ''}></textarea></div>
        <div className="form-row">
          <div className="form-group"><label>反馈</label><textarea name="feedback" defaultValue={s.feedback || ''}></textarea></div>
          <div className="form-group"><label>跟进计划</label><textarea name="follow_up_plan" defaultValue={s.follow_up_plan || ''}></textarea></div>
        </div>
        <div className="form-group"><label>获客数</label><input type="number" name="leads_count" defaultValue={s.leads_count || 0} /></div>
        <div className="form-group"><label>备注</label><textarea name="notes" defaultValue={s.notes || ''}></textarea></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/ceo-events')}>取消</button>
          <button type="submit" className="btn btn-primary">💾 保存</button>
        </div>
      </form>
    </div></div>
  );
}
