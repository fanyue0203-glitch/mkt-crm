import React, { useSyncExternalStore } from 'react';
import { getToasts, subscribeToasts } from '../api.js';

export default function Toast() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}
