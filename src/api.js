// ===== API 请求层 + 工具函数（从原 public/index.html 完整迁移）=====

const API = '';

export async function api(path, opts = {}) {
  const url = API + path;
  const config = { headers: { 'Content-Type': 'application/json' }, ...opts };
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) config.body = JSON.stringify(config.body);
  if (config.body instanceof FormData) delete config.headers['Content-Type'];
  const res = await fetch(url, config);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

// XSS 转义（React JSX 默认自动转义，此函数保留供字符串场景使用）
export function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

export function fmtNum(n) {
  if (!n || n === 0) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return n.toLocaleString();
  return n;
}

export function tryParse(s) {
  try { return JSON.parse(s) || []; } catch { return []; }
}

// ===== 状态名称/颜色映射 =====
export function leadStatusName(s) {
  return { new: '新进线', contacted: '已联系', qualified: '已转出', opportunity: '商机', closed_won: '成单', closed_lost: '无效/丢单' }[s] || s;
}
export const leadStatusColorMap = { new: 'gray', contacted: 'blue', qualified: 'purple', opportunity: 'yellow', closed_won: 'green', closed_lost: 'red' };
export const eventStatusColorMap = { '筹备中': 'blue', '进行中': 'yellow', '已结束': 'green', '已取消': 'gray' };
export const followUpColorMap = { '待跟进': 'yellow', '跟进中': 'blue', '已完成': 'green', '已放弃': 'gray' };

export function stageColor(s) {
  return { '已签约': '#10b981', '交付中': '#06b6d4', '投标中': '#f59e0b', 'POC中': '#8b5cf6', '重点推进': '#3b82f6', 'B类重点推进': '#3b82f6', '跟进中': '#64748b', 'C类跟进': '#64748b', '观察': '#64748b', 'D类观察': '#64748b', '战败': '#ef4444', '放弃': '#ef4444' }[s] || '#64748b';
}

// 通用删除（带确认）
export async function deleteItem(t, id, name) {
  if (!confirm(`确定删除「${name}」？`)) return;
  try {
    await api(`/api/${t}/${id}`, { method: 'DELETE' });
    toast('删除成功');
    return t === 'leads' ? '/funnel' : t === 'accounts' ? '/octo' : null;
  } catch (e) { toast(e.message, 'error'); }
}

// ===== Toast 通知（模块级 store，Toast.jsx 订阅渲染）=====
let _toasts = [];
let _toastSeq = 0;
const _toastListeners = new Set();

export function toast(msg, type = 'success') {
  const id = ++_toastSeq;
  _toasts = [..._toasts, { id, msg, type }];
  _toastListeners.forEach(l => l());
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id);
    _toastListeners.forEach(l => l());
  }, 3000);
}
export function subscribeToasts(fn) { _toastListeners.add(fn); return () => _toastListeners.delete(fn); }
export function getToasts() { return _toasts; }

// ===== Modal（模块级 store，Modal.jsx 订阅渲染）=====
let _modalContent = null;
const _modalListeners = new Set();

export function openModal(node) {
  _modalContent = node;
  _modalListeners.forEach(l => l());
}
export function closeModal() {
  _modalContent = null;
  _modalListeners.forEach(l => l());
}
export function subscribeModal(fn) { _modalListeners.add(fn); return () => _modalListeners.delete(fn); }
export function getModalContent() { return _modalContent; }

// ===== 侧边栏 Badge store =====
const _badges = { speeches: 0, leads: 0, blockers: 0 };
const _badgeListeners = new Set();

export function setBadge(name, value) {
  _badges[name] = value;
  _badgeListeners.forEach(l => l());
}
export function subscribeBadges(fn) { _badgeListeners.add(fn); return () => _badgeListeners.delete(fn); }
export function getBadges() { return _badges; }

// Dashboard/各页数据加载后统一更新 badge
export function updateBadges(stats) {
  if (stats) {
    setBadge('speeches', stats.speeches?.total ?? 0);
    setBadge('leads', stats.leads?.total ?? 0);
  }
  api('/api/octo/summary').then(d => {
    const blockerCount = (d.kpi?.blockers || 0) + (d.kpi?.pendingDecisions || 0);
    setBadge('blockers', blockerCount);
  }).catch(() => {});
}

// ===== Page Header store（页面标题 + header 右侧操作按钮）=====
let _header = { title: 'Dashboard', actions: null };
const _headerListeners = new Set();

export function setHeader(title, actions = null) {
  _header = { title, actions };
  _headerListeners.forEach(l => l());
}
export function subscribeHeader(fn) { _headerListeners.add(fn); return () => _headerListeners.delete(fn); }
export function getHeader() { return _header; }
