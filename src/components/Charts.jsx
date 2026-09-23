import React, { useEffect, useRef } from 'react';

// Chart.js 封装：canvas ref 方式初始化，卸载时 destroy 清理
export default function ChartCanvas({ config, height, style }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const configKey = JSON.stringify(config);

  useEffect(() => {
    if (!canvasRef.current || typeof window.Chart === 'undefined') return;
    chartRef.current = new window.Chart(canvasRef.current, config);
    return () => {
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  return (
    <div className="chart-container" style={{ height: height || 260, ...style }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
