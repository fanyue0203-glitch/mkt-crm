import React, { useSyncExternalStore } from 'react';
import { closeModal, getModalContent, subscribeModal } from '../api.js';

export default function Modal() {
  const content = useSyncExternalStore(subscribeModal, getModalContent);

  return (
    <div
      className={'modal-overlay' + (content ? ' active' : '')}
      onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div className="modal">{content}</div>
    </div>
  );
}
