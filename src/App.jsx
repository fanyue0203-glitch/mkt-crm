import React, { useEffect, useSyncExternalStore } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getHeader, subscribeHeader, setHeader } from './api.js';
import Sidebar from './components/Sidebar.jsx';
import Modal from './components/Modal.jsx';
import Toast from './components/Toast.jsx';

import Dashboard from './pages/Dashboard.jsx';
import CeoEvents from './pages/CeoEvents.jsx';
import CeoEventDetail from './pages/CeoEventDetail.jsx';
import CeoDataLogicPage from './pages/CeoDataLogicPage.jsx';
import CeoReportPage from './pages/CeoReportPage.jsx';
import EventForm from './pages/EventForm.jsx';
import CeoSpeechDetail from './pages/CeoSpeechDetail.jsx';
import CeoSpeechForm from './pages/CeoSpeechForm.jsx';
import OctoSummary from './pages/OctoSummary.jsx';
import OctoPipeline from './pages/OctoPipeline.jsx';
import AccountReport from './pages/AccountReport.jsx';
import AccountForm from './pages/AccountForm.jsx';
import Accounts from './pages/Accounts.jsx';
import Funnel from './pages/Funnel.jsx';
import ImportPage from './pages/ImportPage.jsx';
import DataLogicPage from './pages/DataLogicPage.jsx';

function Header() {
  const header = useSyncExternalStore(subscribeHeader, getHeader);
  return (
    <div className="header">
      <h2>{header.title}</h2>
      <div className="header-actions">{header.actions}</div>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  // 路由切换时重置 header，避免上一页残留
  useEffect(() => {
    setHeader('');
  }, [location.pathname, location.search]);

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <Header />
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ceo-events" element={<CeoEvents />} />
            <Route path="/ceo-events/new" element={<EventForm />} />
            <Route path="/ceo-events/:id/edit" element={<EventForm />} />
            <Route path="/ceo-events/report" element={<CeoReportPage />} />
            <Route path="/ceo-events/data-logic" element={<CeoDataLogicPage />} />
            <Route path="/ceo-events/:id" element={<CeoEventDetail />} />
            <Route path="/speeches/new" element={<CeoSpeechForm />} />
            <Route path="/speeches/:id/edit" element={<CeoSpeechForm />} />
            <Route path="/speeches/:id" element={<CeoSpeechDetail />} />
            <Route path="/octo" element={<OctoSummary />} />
            <Route path="/octo/data-logic" element={<DataLogicPage />} />
            <Route path="/octo/pipeline" element={<OctoPipeline />} />
            <Route path="/octo/account-form" element={<AccountForm />} />
            <Route path="/octo/account-form/:id" element={<AccountForm />} />
            <Route path="/octo/account/:id" element={<AccountReport />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:id/detail" element={<Accounts mode="detail" />} />
            <Route path="/funnel" element={<Funnel />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      <Modal />
      <Toast />
    </div>
  );
}
