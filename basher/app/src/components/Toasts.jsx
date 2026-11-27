import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useApp } from '../store/useApp';

export default function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' ? <CheckCircle2 size={18} /> : t.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} color="#c4a6ff" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
