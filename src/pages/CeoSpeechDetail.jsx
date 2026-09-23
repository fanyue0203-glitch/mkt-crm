import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, setHeader, fmtNum, toast } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';

export default function CeoSpeechDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);

  async function deleteCeoEvent(sid) {
    try {
      await api(`/api/speeches/${sid}`, { method: 'DELETE' });
      toast('删除成功');
      navigate('/ceo-events');
    } catch (e) { toast(e.message, 'error'); }
  }

  useEffect(() => {
    setHeader('🎤 演讲详情');
    api(`/api/speeches/${id}`).then(d => {
      setS(d);
      setHeader(`🎤 ${d.topic || '演讲详情'}`, <>
        <button className="btn btn-secondary" onClick={() => navigate('/ceo-events')}>← 返回</button>
        <button className="btn btn-primary" onClick={() => navigate(`/speeches/${id}/edit`)}>编辑</button>
        <button className="btn btn-danger" onClick={() => { if (confirm('确定删除这条活动记录？')) deleteCeoEvent(id); }}>删除</button>
      </>);
    }).catch(e => setError(e));
  }, [id]);

  if (error) return <Err error={error} />;
  if (!s) return <Loading />;

  const fields = [['日期', s.date], ['活动', s.event_name], ['地点', s.location], ['听众', fmtNum(s.audience_count) + '人'], ['听众画像', s.audience_profile], ['获客数', s.leads_count]];

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3>{s.topic}</h3></div>
        <div className="card-body"><div className="detail-grid">
          {fields.map(([l, v]) => (
            <div key={l}><div className="detail-field"><div className="label">{l}</div><div className="value">{v ?? ''}</div></div></div>
          ))}
        </div></div>
      </div>
      {s.business_design ? <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><h3>⭐ 业务设计</h3></div><div className="card-body"><div className="highlight-box" style={{ whiteSpace: 'pre-wrap' }}>{s.business_design}</div></div></div> : null}
      {s.story_line || s.follow_up_plan ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {s.story_line ? <div className="card"><div className="card-header"><h3>故事线</h3></div><div className="card-body"><div style={{ whiteSpace: 'pre-wrap' }}>{s.story_line}</div></div></div> : null}
          {s.follow_up_plan ? <div className="card"><div className="card-header"><h3>跟进计划</h3></div><div className="card-body"><div style={{ whiteSpace: 'pre-wrap' }}>{s.follow_up_plan}</div></div></div> : null}
        </div>
      ) : null}
    </>
  );
}
