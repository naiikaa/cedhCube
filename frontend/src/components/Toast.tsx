import { useEffect, useState, useCallback } from 'react';
import { CircleCheck, CircleX, Info, X } from 'lucide-react';

type ToastType = 'info' | 'error' | 'success';

const ICONS = { info: Info, success: CircleCheck, error: CircleX };

export function Toast({ message, type = 'info', onClose }: { message: string; type?: ToastType; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const Icon = ICONS[type];

  return (
    <div className={`toast ${type}`} role="status">
      <Icon aria-hidden="true" />
      <span style={{ flex: 1 }}>{message}</span>
      <button type="button" className="icon-btn bare" onClick={onClose} aria-label="Dismiss">
        <X />
      </button>
    </div>
  );
}

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: ToastType }[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, show, remove };
}
