import React from 'react';
import { stageColor } from '../api.js';

// renderBars：单色条形图（活动详情-行业/职级/部门/渠道分布），支持 count + pct
export function Bars({ data, color }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.count || d.pct || 0), 1);
  return (
    <div className="data-bars">
      {data.slice(0, 12).map((d, i) => {
        const val = d.count || 0;
        const pct = d.pct || 0;
        const w = Math.max((val || pct) / max * 100, 2);
        return (
          <div className="data-bar-row" key={i}>
            <div className="data-bar-label">{d.name}</div>
            <div className="data-bar"><div className="data-bar-fill" style={{ width: w + '%', background: color }}></div></div>
            <div className="data-bar-value">{val ? val + '人' : ''}{pct ? ' ' + pct + '%' : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

// renderHBars：调色板循环条形图（漏斗页-来源/产品/团队分布）
export function HBars({ items, color }) {
  if (!items || !items.length) return null;
  const max = Math.max(...items.map(i => i.count), 1);
  const palette = [color, '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#84cc16', '#ef4444'];
  return (
    <div className="data-bars">
      {items.slice(0, 12).map((i, idx) => {
        const pct = Math.max((i.count / max) * 100, 3);
        const c = palette[idx % palette.length];
        return (
          <div className="data-bar-row" key={idx}>
            <div className="data-bar-label" title={i.name}>{i.name}</div>
            <div className="data-bar"><div className="data-bar-fill" style={{ width: pct + '%', background: c }}></div></div>
            <div className="data-bar-value" style={{ color: c }}>{i.count}</div>
          </div>
        );
      })}
    </div>
  );
}

// 阶段条形图（Octo全景报告-管线阶段金额）
export function StageBars({ stages }) {
  if (!stages || !stages.length) return null;
  const max = Math.max(...stages.map(v => v.amount || v.count || 0), 1);
  return (
    <div className="data-bars">
      {stages.map((x, i) => {
        const val = x.amount || x.count || 0;
        const w = Math.max(val / max * 100, 4);
        return (
          <div className="data-bar-row" key={i}>
            <div className="data-bar-label">{x.stage}</div>
            <div className="data-bar"><div className="data-bar-fill" style={{ width: w + '%', background: stageColor(x.stage) }}></div></div>
            <div className="data-bar-value">{x.amount ? x.amount + '万' : x.count + '家'}</div>
          </div>
        );
      })}
    </div>
  );
}
