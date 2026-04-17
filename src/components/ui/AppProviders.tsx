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
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    requireReason: false,
    reasonLabel: 'Reason',
    reasonPlaceholder: 'Enter reason...',
    reasonValue: '',
  });

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
    return new Promise<{ confirmed: boolean; reason: string }>((resolve) => {
      setConfirmState({
        open: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        requireReason: options.requireReason || false,
        reasonLabel: options.reasonLabel || 'Reason',
        reasonPlaceholder: options.reasonPlaceholder || 'Enter reason...',
        reasonValue: options.initialReason || '',
        resolve,
      });
    });
  }, []);

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

      {confirmState.open && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <h3>{confirmState.title}</h3>
            <p>{confirmState.message}</p>
            {confirmState.requireReason ? (
              <div className={styles.reasonBlock}>
                <label className={styles.reasonLabel}>{confirmState.reasonLabel}</label>
                <textarea
                  className={styles.reasonInput}
                  rows={3}
                  value={confirmState.reasonValue || ''}
                  placeholder={confirmState.reasonPlaceholder}
                  onChange={(event) =>
                    setConfirmState((prev) => ({ ...prev, reasonValue: event.target.value }))
                  }
                />
              </div>
            ) : null}
            <div className={styles.dialogActions}>
              <button
                className={styles.secondaryBtn}
                onClick={() => {
                  confirmState.resolve?.({ confirmed: false, reason: '' });
                  setConfirmState((prev) => ({ ...prev, open: false }));
                }}
              >
                {confirmState.cancelText}
              </button>
              <button
                className={styles.primaryBtn}
                disabled={Boolean(confirmState.requireReason && !confirmState.reasonValue?.trim())}
                onClick={() => {
                  confirmState.resolve?.({
                    confirmed: true,
                    reason: confirmState.reasonValue?.trim() || '',
                  });
                  setConfirmState((prev) => ({ ...prev, open: false }));
                }}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
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
