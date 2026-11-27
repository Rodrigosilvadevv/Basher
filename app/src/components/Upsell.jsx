import { Crown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Upsell({ title = 'Basher Pro', text = 'Libere tudo: perfis ilimitados, filtros, modo invisível e mais.', reason }) {
  const nav = useNavigate();
  return (
    <button className="upsell rise" onClick={() => nav(`/pro${reason ? `?motivo=${reason}` : ''}`)}>
      <span className="crown"><Crown size={22} /></span>
      <span className="grow">
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <ChevronRight size={20} color="#c4a6ff" />
    </button>
  );
}

export function useProGate() {
  const nav = useNavigate();
  return (reason) => nav(`/pro?motivo=${reason}`);
}
