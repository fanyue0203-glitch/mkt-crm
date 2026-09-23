import React, { useSyncExternalStore } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getBadges, subscribeBadges } from '../api.js';

const navItemClass = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '');

export default function Sidebar() {
  const badges = useSyncExternalStore(subscribeBadges, getBadges);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>🏢 MKT-CRM</h1>
        <small>市场部 AI-Native 工作台</small>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">概览</div>
          <NavLink to="/" end className={navItemClass} data-page="dashboard">
            <span className="icon">📊</span>Dashboard
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">业务板块</div>
          <NavLink to="/ceo-events" className={navItemClass} data-page="ceo-events">
            <span className="icon">🎤</span>活动和CEO获客<span className="badge">{badges.speeches}</span>
          </NavLink>
          <NavLink to="/octo" className={navItemClass} data-page="octo-summary">
            <span className="icon">🐙</span>Octo 大客户复盘
            <span className="badge" style={badges.blockers > 0 ? {} : { display: 'none' }}>{badges.blockers}</span>
          </NavLink>
          <NavLink to="/funnel" className={navItemClass} data-page="funnel">
            <span className="icon">🔄</span>SDR 漏斗<span className="badge">{badges.leads}</span>
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">数据管理</div>
          <NavLink to="/import" className={navItemClass} data-page="import">
            <span className="icon">📥</span>数据导入
          </NavLink>
        </div>
      </nav>
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,.06)', fontSize: '10px', color: 'var(--text-muted)' }}>
        MKT-CRM v2.0 · 明略科技市场部
      </div>
    </aside>
  );
}
