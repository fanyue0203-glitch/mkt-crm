// ===== 市场营销活动获客 · 视觉规范 v2（白卡 + 靛蓝主色 + 六维标签）=====
// 设计参考：Octo 大客户全景报告（浅底白卡、清晰层级、彩色软标签）

export const MC_DIMS = [
  { key: 'industry_group', label: '行业', icon: '🏭', color: '#2563eb', soft: '#eff6ff', second: 'industry_raw' },
  { key: 'source_type', label: '内容来源', icon: '📣', color: '#059669', soft: '#ecfdf5', second: 'campaign_name' },
  { key: 'product_interest', label: '意向产品', icon: '🎯', color: '#7c3aed', soft: '#f5f3ff', multi: true },
  { key: 'region', label: '地域', icon: '🌏', color: '#d97706', soft: '#fffbeb', region: true, second: 'city' },
  { key: 'month', label: '获客时段', icon: '📅', color: '#db2777', soft: '#fdf2f8', month: true },
  { key: 'customer_type', label: '客户类型', icon: '🏢', color: '#0891b2', soft: '#ecfeff' },
];

const REGION_MAP = [
  ['华东', ['上海', '江苏', '浙江', '安徽', '山东', '江西', '福建']],
  ['华北', ['北京', '天津', '河北', '山西', '内蒙古']],
  ['华南', ['广东', '广西', '海南', '香港', '澳门', '深圳']],
  ['华中', ['湖北', '湖南', '河南']],
  ['西南', ['四川', '重庆', '云南', '贵州', '西藏']],
  ['东北', ['辽宁', '吉林', '黑龙江']],
  ['西北', ['陕西', '甘肃', '青海', '宁夏', '新疆']],
];

export function regionOf(province = '') {
  const p = String(province || '').replace(/省|市|壮族自治区|维吾尔自治区|回族自治区|自治区|特别行政区/g, '').trim();
  if (!p) return '未填写';
  for (const [region, list] of REGION_MAP) if (list.some(x => p.includes(x))) return region;
  return '其他';
}

export function parseMonth(s = '') {
  const m = String(s).match(/(20\d{2})\D+(\d{1,2})/);
  if (!m) return '未知';
  return `${m[1]}-${String(m[2]).padStart(2, '0')}`;
}

export function quarterOf(month = '') {
  const m = month.match(/^\d{4}-(\d{2})$/);
  if (!m) return '未知';
  return `Q${Math.ceil(+m[1] / 3)}`;
}

// 每条线索的六维标签值（数组）
export function tagValuesOf(row) {
  const out = {};
  for (const d of MC_DIMS) {
    if (d.multi) out[d.key] = String(row[d.key] || '').split('|').map(s => s.trim()).filter(Boolean);
    else if (d.region) out[d.key] = [regionOf(row.province)];
    else if (d.month) out[d.key] = [parseMonth(row.created_date)];
    else out[d.key] = [row[d.key] || '未分类'];
  }
  return out;
}

// 行业标准化展示：把 "快速消费品 - 食品和饮料" 拆成 一级 › 二级
export function splitIndustry(raw = '') {
  const s = String(raw).trim();
  const m = s.match(/^(.+?)\s*[-－—]\s*(.+)$/) || s.match(/^(.+?)[：:]\s*(.+)$/);
  if (m) return [m[1].trim(), m[2].trim()];
  return [s, ''];
}

// 从 URL 参数构造跳转
export function drillUrl(dimKey, value) {
  const p = new URLSearchParams();
  if (dimKey === 'industry_group') p.set('industry_group', value);
  else if (dimKey === 'source_type') p.set('source_type', value);
  else if (dimKey === 'product_interest') p.set('product', value);
  else if (dimKey === 'region') p.set('region', value);
  else if (dimKey === 'month') p.set('month', value);
  else if (dimKey === 'customer_type') p.set('customer_type', value);
  return '/marketing-campaign/leads?' + p.toString();
}