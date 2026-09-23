import React from 'react';

export function Err({ error }) {
  return (
    <div className="empty-state">
      <div className="icon">⚠️</div>
      <p>{error?.message || String(error)}</p>
    </div>
  );
}

export function Loading({ text = '⏳ 加载数据...' }) {
  return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>{text}</div>;
}
