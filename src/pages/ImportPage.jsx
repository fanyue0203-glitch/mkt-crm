import React, { useEffect, useRef, useState } from 'react';
import { api, setHeader, toast } from '../api.js';
import { Err } from '../components/Common.jsx';

const IMPORT_TARGETS = [
  { value: 'speeches', label: '🎤 活动和CEO获客' },
  { value: 'accounts', label: '🐙 客户数据' },
  { value: 'leads', label: '🔄 SDR线索' },
];

export default function ImportPage() {
  const [tab, setTab] = useState('upload');
  const [target, setTarget] = useState('speeches');
  const [fields, setFields] = useState([]);
  const [dragover, setDragover] = useState(false);
  const [result, setResult] = useState(null);   // {total, success, errors, message} | {error}
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState(null);
  const [logsError, setLogsError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setHeader('📥 数据导入');
  }, []);

  // 字段说明
  useEffect(() => {
    api(`/api/import/fields/${target}`).then(f => setFields(f)).catch(() => setFields([]));
  }, [target]);

  // 导入历史
  useEffect(() => {
    if (tab === 'history' && logs === null && !logsError) {
      api('/api/import/logs').then(l => setLogs(l)).catch(e => setLogsError(e));
    }
  }, [tab]);

  async function uploadFile(file) {
    setResult(null);
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`/api/import/${target}`, { method: 'POST', body: fd }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setResult(r);
      toast(r.message);
    } catch (e) {
      setResult({ error: e.message });
      toast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  const tabs = [
    ['upload', '上传导入'],
    ['history', '导入历史'],
    ['guide', '字段说明'],
  ];

  return (
    <>
      <div className="tabs">
        {tabs.map(([k, label]) => (
          <div key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{label}</div>
        ))}
      </div>

      {tab === 'upload' && (
        <>
          <div className="form-group" style={{ maxWidth: 300, marginBottom: 20 }}>
            <label>选择导入目标</label>
            <select value={target} onChange={e => setTarget(e.target.value)}>
              {IMPORT_TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div
            className={'upload-area' + (dragover ? ' dragover' : '')}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragover(true); }}
            onDragLeave={() => setDragover(false)}
            onDrop={e => { e.preventDefault(); setDragover(false); if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]); }}
          >
            <div className="icon">📁</div>
            <p><strong>点击或拖拽文件到这里</strong></p>
            <p>支持 .xlsx / .xls / .csv，最大20MB</p>
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={inp => { if (inp.target.files.length) uploadFile(inp.target.files[0]); inp.target.value = ''; }} />
          </div>

          <div style={{ marginTop: 16 }}>
            {uploading ? <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>⏳ 导入中...</div>
              : result?.error ? (
                <div className="card" style={{ borderColor: 'var(--danger)' }}>
                  <div className="card-body" style={{ color: 'var(--danger)' }}>❌ {result.error}</div>
                </div>
              ) : result ? (
                <div className="card">
                  <div className="card-header"><h3>✅ 导入完成</h3></div>
                  <div className="card-body">
                    <div className="stats-grid">
                      {[
                        { v: result.total, l: '总行数', c: 'var(--text)' },
                        { v: result.success, l: '成功', c: 'var(--success)' },
                        { v: result.errors.length, l: '失败', c: 'var(--danger)' },
                      ].map(s => (
                        <div className="stat-card" style={{ cursor: 'default' }} key={s.l}>
                          <div className="stat-value" style={{ color: s.c }}>{s.v}</div>
                          <div className="stat-label">{s.l}</div>
                        </div>
                      ))}
                    </div>
                    {result.errors.length ? (
                      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>
                        {result.errors.slice(0, 5).map((e, i) => <div key={i}>第{e.row}行: {e.error}</div>)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
          </div>

          {fields.length ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header"><h3>字段说明</h3></div>
              <div className="card-body" style={{ padding: 0 }}>
                <table>
                  <tr><th>中文</th><th>英文</th><th>必填</th><th>备注</th></tr>
                  {fields.map(x => (
                    <tr key={x.en}>
                      <td><strong>{x.cn}</strong></td>
                      <td><code style={{ background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 3 }}>{x.en}</code></td>
                      <td>{x.required ? <span className="tag tag-red">必填</span> : ''}</td>
                      <td>{x.note || ''}</td>
                    </tr>
                  ))}
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}

      {tab === 'history' && (
        logsError ? <Err error={logsError} />
          : logs === null ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>⏳ 加载中...</div>
          : logs.length ? (
            <div className="card"><div className="table-wrap">
              <table>
                <tr><th>文件</th><th>目标</th><th>总行</th><th>成功</th><th>失败</th><th>时间</th></tr>
                {logs.map((l, i) => (
                  <tr key={i}>
                    <td>{l.filename}</td>
                    <td>{l.target_table}</td>
                    <td>{l.total_rows}</td>
                    <td style={{ color: 'var(--success)' }}>{l.success_rows}</td>
                    <td style={{ color: l.error_rows ? 'var(--danger)' : 'inherit' }}>{l.error_rows}</td>
                    <td>{l.imported_at}</td>
                  </tr>
                ))}
              </table>
            </div></div>
          ) : <div className="empty-state"><p>暂无导入记录</p></div>
      )}

      {tab === 'guide' && (
        <div className="card">
          <div className="card-body" style={{ lineHeight: 2 }}>
            <h3 style={{ marginBottom: 12 }}>数据导入指南</h3>
            <p>1. 准备Excel文件，第一行为表头（中文或英文均可）</p>
            <p>2. 选择导入目标：活动和CEO获客/客户/线索</p>
            <p>3. 上传文件，系统自动识别列名匹配字段</p>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
            <p><strong>SDR线索字段说明：</strong></p>
            <p>日期格式YYYY-MM-DD · 客户等级S/A/B/C</p>
            <p>线索状态：new(新进线)/contacted(已联系)/qualified(已转出)/opportunity(商机)/closed_won(成单)/closed_lost(无效)</p>
            <p>来源渠道：直接传中文原值（400电话/官方微信/Octo体验等）</p>
            <p>成单金额：单位万元</p>
          </div>
        </div>
      )}
    </>
  );
}
