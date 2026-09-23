import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, setHeader, toast } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';

const STAGES = ['已签约', '交付中', '投标中', 'POC中', 'B类重点推进', 'C类跟进', 'D类观察', '战败', '放弃'];
const DEPLOY_TYPES = ['私有化', 'SaaS', '混合'];

export default function AccountForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [a, setA] = useState(id ? null : {});
  const [error, setError] = useState(null);

  useEffect(() => {
    setHeader(id ? '🐙 编辑客户' : '🐙 新建客户',
      <button className="btn btn-secondary" onClick={() => navigate('/octo')}>← 返回</button>);
    if (id) {
      api(`/api/accounts/${id}`).then(d => setA(d)).catch(e => setError(e));
    }
  }, [id]);

  if (error) return <Err error={error} />;
  if (!a) return <Loading />;

  async function onSave(ev) {
    ev.preventDefault();
    const fd = new FormData(formRef.current);
    const body = Object.fromEntries(fd);
    body.deal_amount = +body.deal_amount || 0;
    body.key_contacts_count = +body.key_contacts_count || 0;
    body.ceo_involvement = fd.get('ceo_involvement') ? 1 : 0;
    body.tier = body.tier || 'C';
    try {
      let newId = id;
      if (id) {
        await api(`/api/accounts/${id}`, { method: 'PUT', body });
        toast('更新成功');
      } else {
        const r = await api('/api/accounts', { method: 'POST', body });
        newId = r.id;
        toast('创建成功');
      }
      navigate(`/octo/account/${newId}`);
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div className="card"><div className="card-body">
      <form ref={formRef} onSubmit={onSave}>
        <h3 style={{ fontSize: 14, marginBottom: 16, color: 'var(--accent-light)' }}>📋 基本信息</h3>
        <div className="form-row">
          <div className="form-group"><label>公司名称 *</label><input name="company_name" required defaultValue={a.company_name || ''} /></div>
          <div className="form-group"><label>等级</label>
            <select name="tier" defaultValue={a.tier || 'C'}>{['S', 'A', 'B', 'C', 'D'].map(t => <option key={t} value={t}>{t}</option>)}</select>
          </div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>行业</label><input name="industry" defaultValue={a.industry || ''} /></div>
          <div className="form-group"><label>规模</label><input name="scale" defaultValue={a.scale || ''} /></div>
          <div className="form-group"><label>地区</label><input name="region" defaultValue={a.region || ''} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>客户阶段</label>
            <select name="customer_stage" defaultValue={a.customer_stage || ''}>
              <option value="">请选择</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label>负责人</label><input name="assigned_to" defaultValue={a.assigned_to || ''} /></div>
        </div>
        <div className="form-group"><label>需求摘要</label><textarea name="needs_summary" rows={2} defaultValue={a.needs_summary || ''}></textarea></div>
        <div className="form-group"><label>备注</label><textarea name="notes" rows={2} defaultValue={a.notes || ''}></textarea></div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
        <h3 style={{ fontSize: 14, marginBottom: 16, color: 'var(--warning)' }}>💰 商机信息</h3>
        <div className="form-row-3">
          <div className="form-group"><label>签约/预估金额(万元)</label><input type="number" step="0.1" name="deal_amount" defaultValue={a.deal_amount || ''} /></div>
          <div className="form-group"><label>商机阶段描述</label><input name="deal_stage" defaultValue={a.deal_stage || ''} placeholder="如：9/18述标完成" /></div>
          <div className="form-group"><label>部署方式</label>
            <select name="deployment_type" defaultValue={a.deployment_type || ''}>
              <option value="">请选择</option>
              {DEPLOY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label>线索来源详情</label><input name="lead_source" defaultValue={a.lead_source || ''} placeholder="如：贾祥轩5/9官网主动联系" /></div>
        <div className="form-group"><label>产品方案详情</label><textarea name="product_solutions_detail" rows={2} placeholder="具体场景和方案" defaultValue={a.product_solutions_detail || ''}></textarea></div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
        <h3 style={{ fontSize: 14, marginBottom: 16, color: 'var(--info)' }}>🏆 竞争分析</h3>
        <div className="form-group"><label>竞品信息</label><input name="competitors" defaultValue={a.competitors || ''} placeholder="如：酷开/浙江实在/联想" /></div>
        <div className="form-group"><label>客户认可点</label><textarea name="customer_recognition" rows={2} placeholder="客户认可我们什么？" defaultValue={a.customer_recognition || ''}></textarea></div>
        <div className="form-group"><label>核心痛点</label><textarea name="core_painpoint" rows={2} defaultValue={a.core_painpoint || ''}></textarea></div>
        <div className="form-group"><label>生态锁定评估</label><input name="ecosystem_lock" defaultValue={a.ecosystem_lock || ''} placeholder="如：飞书/钉钉/企微/自研等" /></div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
        <h3 style={{ fontSize: 14, marginBottom: 16, color: 'var(--success)' }}>🚀 推进信息</h3>
        <div className="form-group"><label>卡点/阻塞事项 ⚠️</label><textarea name="blockers" rows={2} placeholder="当前卡点是什么" defaultValue={a.blockers || ''}></textarea></div>
        <div className="form-row">
          <div className="form-group"><label>下一步行动</label><input name="next_step" defaultValue={a.next_step || ''} /></div>
          <div className="form-group"><label>下一步截止时间</label><input type="date" name="next_deadline" defaultValue={a.next_deadline || ''} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" name="ceo_involvement" value="1" defaultChecked={!!a.ceo_involvement} style={{ width: 'auto' }} /> 🔥 CEO/高管直推</label></div>
          <div className="form-group"><label>覆盖联系人数量</label><input type="number" name="key_contacts_count" defaultValue={a.key_contacts_count || ''} /></div>
        </div>
        <div className="form-group"><label>覆盖部门/条线</label><input name="key_departments" defaultValue={a.key_departments || ''} placeholder="如：16+联系人覆盖10条线" /></div>
        <div className="form-group"><label>经验教训（战败/停滞原因）</label><textarea name="lessons_learned" rows={2} defaultValue={a.lessons_learned || ''}></textarea></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/octo')}>取消</button>
          <button type="submit" className="btn btn-primary">💾 保存</button>
        </div>
      </form>
    </div></div>
  );
}
