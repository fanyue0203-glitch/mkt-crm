import React from 'react';
import { leadStatusName, leadStatusColorMap, eventStatusColorMap, followUpColorMap } from '../api.js';

// 线索状态标签
export function LeadStatusTag({ s }) {
  return <span className={`tag tag-${leadStatusColorMap[s] || 'gray'}`}>{leadStatusName(s)}</span>;
}
export const StageTag = LeadStatusTag;

// 活动状态标签
export function EventStatusTag({ s }) {
  return <span className={`tag tag-${eventStatusColorMap[s] || 'gray'}`}>{s || ''}</span>;
}

// 来源标签
export function SourceTag({ s }) {
  if (!s) return <>—</>;
  return <span className="tag tag-blue">{s}</span>;
}

// 跟进状态标签
export function FollowUpTag({ s }) {
  if (!s) return <>—</>;
  return <span className={`tag tag-${followUpColorMap[s] || 'gray'}`}>{s}</span>;
}

// 客户阶段标签
export function CustomerStageTag({ s }) {
  if (!s) return null;
  return <span className={`stage-tag stage-${s}`}>{s}</span>;
}

// 等级徽章
export function TierBadge({ tier, style }) {
  return <span className={`tier-badge tier-${tier || 'C'}`} style={style}>{tier || 'C'}</span>;
}

// 商机等级标签
export function OppLevel({ level }) {
  return <span className={`opp-level opp-${level || '关注'}`}>{level || '—'}</span>;
}
