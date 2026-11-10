import React, { useEffect } from 'react';
import { setHeader } from '../api.js';

export default function SdrDashboard() {
  useEffect(() => {
    setHeader('📊 SDR线索漏斗指挥中心');
  }, []);

  return (
    <div style={{ height: 'calc(100vh - 130px)', width: 'calc(100% + 32px)', margin: '-16px -16px -16px -16px', overflow: 'hidden', borderRadius: '0 0 12px 12px' }}>
      <iframe
        src="/sdr-dashboard-view"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="SDR线索漏斗指挥中心"
      />
    </div>
  );
}
