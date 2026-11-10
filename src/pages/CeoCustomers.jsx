import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setHeader, fmtNum, toast, openModal, closeModal } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';

const STATUSES = ['待跟进', '已联系', '已沟通', '已转出', '无效'];
const STATUS_COLORS = {
  '待跟进': '#64748b', '已联系': '#3b82f6', '已沟通': '#8b5cf6',
  '已转出': '#10b981', '无效': '#ef4444'
};

function StatusTag({ s }) {
  const c = STATUS_COLORS[s] || '#64748b';
  return <span className="tag" style={{ background: c + '22', color: c, fontSize: 11 }}>{s || '待跟进'}</span>;
}

function CustomerDetailModal({ customer, events, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const formRef = React.useRef(null);
  const isLead = typeof customer.id === 'string' && customer.id.startsWith('lead_');
  const isWeiban = !isLead;

  async function onSave(ev) {
    ev.preventDefault();
    const fd = new FormData(formRef.current);
    const body = Object.fromEntries(fd);
    body.event_id = +body.event_id;
    try {
      await api('/api/ceo/weiban/' + customer.id, { method: 'PUT', body });
      toast('更新成功');
      closeModal(); onSaved();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function onDelete() {
    if (!confirm('确定删除该客户？此操作不可恢复。')) return;
    try {
      await api('/api/ceo/weiban/' + customer.id, { method: 'DELETE' });
      toast('删除成功');
      closeModal(); onDeleted();
    } catch (e) { toast(e.message, 'error'); }
  }

  const comm = customer.last_chat_time || customer.communication || '';
  const fields = [
    ['微信昵称', customer.wechat_nickname, 'wechat'],
    ['姓名', customer.contact_name, 'text'],
    ['职位', customer.contact_title || (isLead ? customer._lead?.contact_title : ''), 'text'],
    ['公司名称', customer.company_name, 'text'],
    ['电话', customer.phone || (isLead ? customer._lead?.phone : ''), 'phone'],
    ['所属活动', customer.event_name, 'tag'],
    ['来源渠道', customer.add_channel || (isLead ? customer._lead?.source_channel : ''), 'text'],
    ['添加/进线时间', customer.add_time ? String(customer.add_time).substring(0, 10) : '', 'text'],
    ['需求产品', customer.product || (isLead ? customer._lead?.product : ''), 'text'],
    ['标签', customer.tags, 'tags'],
    ['跟进状态', customer.status || (isLead ? customer.communication : '待跟进'), 'status'],
    ['分配销售', customer.customer_service || customer.assigned_to || customer.owner, 'text'],
  ];

  return (
    <>
      <div className="modal-header">
        <h3>👤 {customer.wechat_nickname || customer.contact_name || customer.company_name || '客户详情'}</h3>
        <button onClick={closeModal} style={{ fontSize: 20 }}>✕</button>
      </div>
      <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {isLead && (
          <div className="highlight-box" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 12, background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)' }}>
            ℹ️ 此客户来自SDR线索系统，信息以CRM为准
          </div>
        )}
        {editing && isWeiban ? (
          <form ref={formRef} onSubmit={onSave}>
            <div className="form-row-3">
              <div className="form-group"><label>微信昵称 *</label><input name="nickname" required defaultValue={customer.wechat_nickname || ''} /></div>
              <div className="form-group"><label>姓名</label><input name="contact_name" defaultValue={customer.contact_name || ''} placeholder="真实姓名" /></div>
              <div className="form-group"><label>职位</label><input name="contact_title" defaultValue={customer.contact_title || ''} /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>公司名称</label><input name="company_name" defaultValue={customer.company_name || ''} /></div>
              <div className="form-group"><label>电话</label><input name="phone" defaultValue={customer.phone || ''} /></div>
              <div className="form-group"><label>所属活动 *</label>
                <select name="event_id" defaultValue={customer.event_id}>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>添加时间</label><input type="date" name="add_time" defaultValue={(customer.add_time || '').substring(0, 10)} /></div>
              <div className="form-group"><label>需求产品</label><input name="product" defaultValue={customer.product || ''} placeholder="如：Octo/AIGC/CDP" /></div>
              <div className="form-group"><label>跟进状态</label>
                <select name="status" defaultValue={customer.status || '待跟进'}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>标签</label><input name="tags" defaultValue={customer.tags || ''} placeholder="如：高意向/CTO/已加微信" /></div>
              <div className="form-group"><label>分配销售/客服</label><input name="customer_service" defaultValue={customer.customer_service || customer.assigned_to || ''} /></div>
            </div>
            <div className="form-group"><label>来源明细</label><input name="source_detail" defaultValue={customer.source_detail || customer.add_channel || ''} /></div>
            <div className="form-group"><label>沟通情况/跟进记录</label><textarea name="last_chat_time" rows={3} defaultValue={comm || ''} placeholder="最近沟通时间、内容、下一步..."></textarea></div>
            <div className="form-group"><label>需求描述/备注</label><textarea name="notes" rows={3} defaultValue={customer.notes || customer.requirement || ''}></textarea></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>取消</button>
              <button type="submit" className="btn btn-primary">💾 保存</button>
            </div>
          </form>
        ) : (
          <>
            <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              {fields.map(([lb, val, type]) => (
                val || type === 'status' ? (
                  <div key={lb} className="detail-field">
                    <div className="label">{lb}</div>
                    <div className="value">
                      {type === 'tag' ? <span className="tag tag-blue" style={{ fontSize: 11 }}>{val || '—'}</span>
                        : type === 'tags' && val ? <span className="tag" style={{ background: 'rgba(59,130,246,.12)', color: '#60a5fa' }}>{val}</span>
                          : type === 'status' ? <StatusTag s={val} />
                            : type === 'phone' && val ? <a href={`tel:${val}`} style={{ color: 'var(--accent)' }}>{val}</a>
                              : val || '—'}
                    </div>
                  </div>
                ) : null
              ))}
            </div>
            {(customer.requirement || customer.notes || (isLead && customer._lead?.requirement)) ? (
              <div className="detail-field" style={{ marginTop: 16 }}>
                <div className="label">需求描述/跟进记录</div>
                <div className="value" style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  {customer.notes || customer.requirement || (isLead ? customer._lead?.requirement : '') || '—'}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      {!editing && (
        <div className="modal-footer">
          {isWeiban && <button className="btn btn-sm btn-danger" onClick={onDelete}>🗑️ 删除</button>}
          <button className="btn btn-secondary" onClick={closeModal}>关闭</button>
          {isWeiban && <button className="btn btn-primary" onClick={() => setEditing(true)}>✏️ 编辑</button>}
        </div>
      )}
    </>
  );
}

function NewCustomerModal({ events, onSaved }) {
  const formRef = React.useRef(null);
  async function onSave(ev) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(formRef.current));
    body.event_id = +body.event_id;
    try {
      await api('/api/ceo/weiban', { method: 'POST', body });
      toast('添加成功');
      closeModal(); onSaved();
    } catch (e) { toast(e.message, 'error'); }
  }
  return (
    <>
      <div className="modal-header"><h3>➕ 新增客户</h3><button onClick={closeModal} style={{ fontSize: 20 }}>✕</button></div>
      <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        <form ref={formRef} onSubmit={onSave}>
          <div className="form-row-3">
            <div className="form-group"><label>微信昵称 *</label><input name="nickname" required placeholder="客户微信昵称" /></div>
            <div className="form-group"><label>姓名</label><input name="contact_name" placeholder="真实姓名" /></div>
            <div className="form-group"><label>职位</label><input name="contact_title" placeholder="如：CTO/市场总监" /></div>
          </div>
          <div className="form-row-3">
            <div className="form-group"><label>公司名称</label><input name="company_name" /></div>
            <div className="form-group"><label>电话</label><input name="phone" /></div>
            <div className="form-group"><label>所属活动 *</label>
              <select name="event_id" required defaultValue="">
                <option value="">请选择活动</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group"><label>添加时间</label><input type="date" name="add_time" defaultValue={new Date().toISOString().substring(0, 10)} /></div>
            <div className="form-group"><label>需求产品</label><input name="product" placeholder="Octo/AIGC/CDP..." /></div>
            <div className="form-group"><label>跟进状态</label>
              <select name="status" defaultValue="待跟进">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>标签</label><input name="tags" placeholder="高意向/CTO/已加微信..." /></div>
            <div className="form-group"><label>分配销售/客服</label><input name="customer_service" defaultValue="赵玉平" /></div>
          </div>
          <div className="form-group"><label>来源渠道</label><input name="add_channel" defaultValue="手动添加" /></div>
          <div className="form-group"><label>沟通情况</label><textarea name="last_chat_time" rows={2} placeholder="沟通记录..."></textarea></div>
          <div className="form-group"><label>需求描述/备注</label><textarea name="notes" rows={3} placeholder="客户需求、背景、备注..."></textarea></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={closeModal}>取消</button>
            <button type="submit" className="btn btn-primary">💾 添加</button>
          </div>
        </form>
      </div>
    </>
  );
}

export default function CeoCustomers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allData, setAllData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState(searchParams.get('event') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState('add_time');
  const [sortDir, setSortDir] = useState('desc');
  const [colFilters, setColFilters] = useState({});

  const refresh = () => { setLoading(true); loadData(); };
  const loadData = useCallback(() => {
    // 一次加载全量
    api('/api/ceo/customers?limit=2000&page=1').then(d => { setAllData(d); setLoading(false); })
      .catch(e => { setError(e); setLoading(false); });
  }, []);

  useEffect(() => {
    setHeader('👥 CEO获客·客户明细', <>
      <button className="btn btn-secondary" onClick={() => navigate('/ceo-events')}>← 返回看板</button>
    </>);
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (eventFilter) setSearchParams({ event: eventFilter });
    else setSearchParams({});
  }, [eventFilter, setSearchParams]);

  if (error) return <Err error={error} />;

  const byEvent = allData?.byEvent || [];
  const allItems = allData?.data || [];

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function setCol(k,v){ setColFilters(p=>({...p,[k]:v})); }
  function clearAll(){ setSearch(''); setEventFilter(''); setStatusFilter(''); setColFilters({}); }

  function getStatus(r) {
    if (r.communication) return r.communication.startsWith('已转出') ? '已转出'
      : r.communication.startsWith('已联系') ? '已联系'
        : r.communication.startsWith('无效') ? '无效'
          : r.communication.startsWith('已沟通') ? '已沟通' : '待跟进';
    return r.status || '待跟进';
  }

  // 前端筛选+排序
  let items = allItems.map(r => ({ ...r, _status: getStatus(r) }));
  if (eventFilter) items = items.filter(r => String(r.event_id) === String(eventFilter));
  if (statusFilter) items = items.filter(r => r._status === statusFilter);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(r => (r.wechat_nickname||'').toLowerCase().includes(s) || (r.contact_name||'').toLowerCase().includes(s) || (r.company_name||'').toLowerCase().includes(s) || (r.phone||'').includes(s) || (r.product||'').toLowerCase().includes(s) || (r.tags||'').toLowerCase().includes(s));
  }
  for (const [k,v] of Object.entries(colFilters)) {
    if (!v) continue;
    const lv = v.toLowerCase();
    items = items.filter(r => String(r[k]||'').toLowerCase().includes(lv));
  }
  items = [...items].sort((a,b)=>{
    let va=a[sortKey],vb=b[sortKey];
    if(va==null)va='';if(vb==null)vb='';
    const cmp=String(va).localeCompare(String(vb),'zh');
    return sortDir==='asc'?cmp:-cmp;
  });

  const total = items.length;
  const activeFilters = (search?1:0)+(eventFilter?1:0)+(statusFilter?1:0)+Object.values(colFilters).filter(Boolean).length;

  const statusOpts = ['待跟进','已联系','已沟通','已转出','无效'];

  async function viewCustomer(r) {
    if (typeof r.id === 'number') {
      try { r = await api('/api/ceo/weiban/' + r.id); } catch (e) { toast(e.message, 'error'); return; }
    }
    openModal(<CustomerDetailModal customer={r} events={byEvent} onSaved={refresh} onDeleted={refresh} />);
  }
  function addNew() { openModal(<NewCustomerModal events={byEvent} onSaved={refresh} />); }

  const COLS = [
    {key:'wechat_nickname',label:'微信昵称',w:140,sortable:true,filterable:true},
    {key:'contact_name',label:'姓名',w:90,sortable:true,filterable:true},
    {key:'company_name',label:'公司',w:160,sortable:true,filterable:true},
    {key:'contact_title',label:'职位',w:100,sortable:true,filterable:true},
    {key:'phone',label:'电话',w:110,sortable:true,filterable:true},
    {key:'event_name',label:'所属活动',w:160,sortable:true,filterable:true},
    {key:'product',label:'产品',w:100,sortable:true,filterable:true},
    {key:'add_time',label:'添加时间',w:100,sortable:true,filterable:false},
    {key:'_status',label:'状态',w:80,sortable:true,filterable:false},
    {key:'customer_service',label:'分配',w:90,sortable:true,filterable:true},
  ];

  const SortIc = ({k}) => sortKey!==k ? <span style={{color:'var(--text-muted)',opacity:.3,marginLeft:3}}>↕</span> : <span style={{color:'var(--accent-light)',marginLeft:3}}>{sortDir==='asc'?'↑':'↓'}</span>;
  const renderTh = col => {
    if(!col.filterable) return <th key={col.key} style={{width:col.w,minWidth:col.w}} onClick={()=>col.sortable&&toggleSort(col.key)}>{col.label}{col.sortable&&<SortIc k={col.key}/>}</th>;
    return <th key={col.key} style={{width:col.w,minWidth:col.w}}>
      <div className="th-col"><span className="th-label" onClick={()=>col.sortable&&toggleSort(col.key)}>{col.label}<SortIc k={col.key}/></span>
      <input className="th-filter-input" placeholder="筛选..." value={colFilters[col.key]||''} onChange={e=>setCol(col.key,e.target.value)}/></div>
    </th>;
  };

  const shortName = (n) => (n||'').replace('《','').replace('》','').replace('-octo体验','').replace('20260808','').replace('0825','').replace('国有企业领导人员经营管理培训班','EMP').replace('全球AI生态与创新峰会','AI生态峰会').replace('Octo产品发布（明略公众号）','产品发布');

  return (
    <>
      <div className="ceo-cust-tabs">
        <div className="tab" onClick={() => navigate('/ceo-events')} style={{ cursor: 'pointer' }}>📊 数据分析看板</div>
        <div className="tab active">👥 客户明细</div>
      </div>
      <div className="acct-filter-bar" style={{top:'calc(var(--header-h) + 38px)'}}>
        <div className="search-bar">
          <input type="text" placeholder="🔍 搜索公司/昵称/姓名/电话/产品..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:320}}/>
          <select value={eventFilter} onChange={e=>setEventFilter(e.target.value)} style={{minWidth:160}}>
            <option value="">全部活动</option>
            {byEvent.map(ev=><option key={ev.id} value={ev.id}>{shortName(ev.name)}({ev.cnt||0})</option>)}
          </select>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">全部状态</option>
            {statusOpts.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" onClick={addNew}>+ 新增客户</button>
          {activeFilters>0 && <button className="btn btn-sm btn-secondary" onClick={clearAll}>清除({activeFilters})</button>}
          <span style={{marginLeft:'auto',fontSize:12,color:'var(--text-muted)'}}>共 {total} 条</span>
        </div>
      </div>

      {loading?<Loading/>:(
        <div className="card"><div className="leads-table-wrap">
          {items.length?(
            <table className="acct-table">
              <thead><tr className="acct-thead">{COLS.map(renderTh)}<th style={{width:60,minWidth:60}}>操作</th></tr></thead>
              <tbody>
                {items.map((r,i)=>{
                  const phone=r.phone||(r._lead?.phone||'');
                  const title=r.contact_title||(r._lead?.contact_title||'');
                  const product=r.product||(r._lead?.product||'');
                  const assigned=r.customer_service||r.assigned_to||r.owner||'';
                  return (
                    <tr key={r.id} className="clickable-row" onClick={()=>viewCustomer(r)}>
                      <td>{r.wechat_nickname?<strong>👤 {r.wechat_nickname}</strong>:<span style={{color:'var(--text-muted)'}}>—</span>}</td>
                      <td>{r.contact_name||<span style={{color:'var(--text-muted)'}}>—</span>}</td>
                      <td><strong>{r.company_name||<span style={{color:'var(--text-muted)'}}>—</span>}</strong></td>
                      <td style={{fontSize:12,color:'var(--text-secondary)'}}>{title||'—'}</td>
                      <td style={{fontSize:12}}>{phone||'—'}</td>
                      <td><span className="tag tag-blue" style={{fontSize:11}}>{shortName(r.event_name)}</span></td>
                      <td style={{fontSize:12}}>{product||'—'}</td>
                      <td style={{fontSize:12}}>{r.add_time?String(r.add_time).substring(0,10):'—'}</td>
                      <td><StatusTag s={r._status}/></td>
                      <td style={{fontSize:12}}>{assigned||<span style={{color:'var(--text-muted)'}}>—</span>}</td>
                      <td style={{whiteSpace:'nowrap'}} onClick={e=>e.stopPropagation()}>
                        <button className="btn-link" onClick={()=>viewCustomer(r)}>详情</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ):<div className="empty-state" style={{padding:32}}><p>暂无匹配客户</p></div>}
        </div></div>
      )}
    </>
  );
}
