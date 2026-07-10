import { useEffect, useState, useCallback } from 'react';

export function Toast({ message, type = 'info', onClose }: { message: string; type?: 'info' | 'error' | 'success'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgMap = { info: '#16213e', error: '#3a1a1a', success: '#1a3a1a' };
  const borderMap = { info: '#0f3460', error: '#8b0000', success: '#2a6a2a' };

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: bgMap[type], border: `1px solid ${borderMap[type]}`,
      borderRadius: 10, padding: '12px 20px', color: '#e0e0e0',
      fontSize: '0.9rem', maxWidth: 400,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      animation: 'fadeIn 0.25s ease-out',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', color: '#888', cursor: 'pointer',
        fontSize: '1.2rem', padding: 0, lineHeight: 1,
      }}>✕</button>
    </div>
  );
}

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'info' | 'error' | 'success' }[]>([]);

  const show = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, show, remove };
}