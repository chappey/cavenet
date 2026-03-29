import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ToastVariant = 'default' | 'success' | 'error' | 'info';

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { border: string; background: string; text: string }> = {
  default: { border: 'rgba(255,255,255,0.12)', background: 'rgba(24,24,28,0.94)', text: '#f6f1e7' },
  success: { border: 'rgba(52, 211, 153, 0.35)', background: 'rgba(20, 55, 38, 0.96)', text: '#dcfce7' },
  error: { border: 'rgba(248, 113, 113, 0.42)', background: 'rgba(58, 20, 20, 0.96)', text: '#fee2e2' },
  info: { border: 'rgba(96, 165, 250, 0.35)', background: 'rgba(20, 30, 56, 0.96)', text: '#dbeafe' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    const durationMs = input.durationMs ?? (input.variant === 'error' ? 5000 : 3500);
    setToasts(current => [...current, { ...input, id }]);
    window.setTimeout(() => dismiss(id), durationMs);
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    toast,
    success: (title, description) => toast({ title, description, variant: 'success' }),
    error: (title, description) => toast({ title, description, variant: 'error' }),
    info: (title, description) => toast({ title, description, variant: 'info' }),
  }), [toast]);

  useEffect(() => {
    return () => setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          right: '16px',
          top: '16px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          width: 'min(360px, calc(100vw - 32px))',
        }}
      >
        {toasts.map(toastItem => {
          const styles = VARIANT_STYLES[toastItem.variant ?? 'default'];
          return (
            <div
              key={toastItem.id}
              role="status"
              onClick={() => dismiss(toastItem.id)}
              style={{
                cursor: 'pointer',
                border: `1px solid ${styles.border}`,
                background: styles.background,
                color: styles.text,
                borderRadius: '14px',
                padding: '12px 14px',
                boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: toastItem.description ? '4px' : 0 }}>{toastItem.title}</div>
              {toastItem.description && <div style={{ fontSize: '0.93rem', opacity: 0.9, lineHeight: 1.4 }}>{toastItem.description}</div>}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};
