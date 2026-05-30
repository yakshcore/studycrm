'use client';
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: number; message: string; type: ToastType; }
interface ToastCtx { toast: (message: string, type?: ToastType) => void; }
const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const COLOR: Record<ToastType, string> = {
    success: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
    error:   'bg-red-500/15 border-red-500/25 text-red-400',
    warning: 'bg-amber-500/15 border-amber-500/25 text-amber-400',
    info:    'bg-indigo-500/15 border-indigo-500/25 text-indigo-400',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border pointer-events-auto animate-toast-in max-w-xs ${COLOR[t.type]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
