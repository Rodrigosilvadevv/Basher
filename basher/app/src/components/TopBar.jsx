import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TopBar({ title, subtitle, back = true, onBack, right, left, clear, children }) {
  const nav = useNavigate();
  return (
    <header className={`topbar ${clear ? 'clear' : ''}`}>
      {left}
      {back && !left && (
        <button className={`icon-btn ${clear ? 'glass' : ''}`} onClick={onBack || (() => nav(-1))} aria-label="Voltar">
          <ChevronLeft size={26} />
        </button>
      )}
      {children || (
        <div className="title ellipsis">
          {title}
          {subtitle && <small>{subtitle}</small>}
        </div>
      )}
      {right}
    </header>
  );
}
