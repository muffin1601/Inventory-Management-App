'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AuthProvider } from '@/lib/AuthContext';
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
        requireReason: options.requireReason,
        reasonLabel: options.reasonLabel,
        reasonPlaceholder: options.reasonPlaceholder,
        reasonValue: options.initialReason || '',
        resolve: (value) => {
          setConfirmState(prev => ({ ...prev, open: false }));
          resolve(value);
        },
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState.resolve) {
      confirmState.resolve({
        confirmed: true,
        reason: confirmState.reasonValue || '',
      });
    }
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState.resolve) {
      confirmState.resolve({
        confirmed: false,
        reason: '',
      });
    }
  }, [confirmState]);

  const value = useMemo(() => ({ showToast, confirmAction }), [showToast, confirmAction]);

  return (
    <AuthProvider>
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
              
              {confirmState.requireReason && (
                <div className={styles.reasonBlock}>
                  <label className={styles.reasonLabel}>
                    {confirmState.reasonLabel || 'Reason'}
                  </label>
                  <textarea
                    className={styles.reasonInput}
                    placeholder={confirmState.reasonPlaceholder || 'Please provide a reason...'}
                    value={confirmState.reasonValue}
                    onChange={(e) => setConfirmState(prev => ({ ...prev, reasonValue: e.target.value }))}
                  />
                </div>
              )}
              
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleCancel}
                >
                  {confirmState.cancelText}
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleConfirm}
                >
                  {confirmState.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}
      </UiContext.Provider>
    </AuthProvider>
  );
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) {
    throw new Error('useUi must be used within AppProviders');
  }
  return ctx;
}
