"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import styles from './UiOverlays.module.css';

type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonValue?: string;
  resolve?: (value: { confirmed: boolean; reason: string }) => void;
};

type UiContextType = {
  showToast: (message: string, type?: ToastType) => void;
  confirmAction: (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    requireReason?: boolean;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    initialReason?: string;
  }) => Promise<{ confirmed: boolean; reason: string }>;
};

const UiContext = createContext<UiContextType | null>(null);

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = makeId('toast');
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2600);
  }, []);

  const confirmAction = useCallback((options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    requireReason?: boolean;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    initialReason?: string;
  }) => {
    const defaultReason = options.requireReason
      ? options.initialReason?.trim() || `${options.confirmText || 'Confirmed'} via toast`
      : '';

    showToast(`${options.title} confirmed.`, 'info');

    return Promise.resolve({ confirmed: true, reason: defaultReason });
  }, [showToast]);

  const value = useMemo(() => ({ showToast, confirmAction }), [showToast, confirmAction]);

  return (
    <UiContext.Provider value={value}>
      {children}

      <div className={styles.toastStack}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
            {toast.message}
          </div>
        ))}
      </div>

    </UiContext.Provider>
  );
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) {
    throw new Error('useUi must be used within AppProviders');
  }
  return ctx;
}
