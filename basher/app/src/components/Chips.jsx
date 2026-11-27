import { Check, Crown } from 'lucide-react';
import { tap } from '../lib/haptics';

// options: [{id,label}] ou ['texto']
export default function Chips({ options, value, onChange, multi = true, max, locked, onLocked, scroll, size }) {
  const items = options.map((o) => (typeof o === 'string' ? { id: o, label: o } : o));
  const sel = multi ? value || [] : value;
  const toggle = (id) => {
    if (locked) return onLocked?.();
    tap();
    if (!multi) return onChange(sel === id ? null : id);
    if (sel.includes(id)) onChange(sel.filter((x) => x !== id));
    else if (!max || sel.length < max) onChange([...sel, id]);
  };
  return (
    <div className={`chips ${scroll ? 'hscroll' : ''}`}>
      {items.map((o) => {
        const on = multi ? sel.includes(o.id) : sel === o.id;
        return (
          <button key={o.id} type="button" className={`chip ${on ? 'on' : ''} ${locked ? 'locked' : ''} ${size === 'sm' ? 'static' : ''}`} onClick={() => toggle(o.id)} aria-pressed={on}>
            {on && multi && <Check />}
            {o.label}
            {locked && <Crown />}
          </button>
        );
      })}
    </div>
  );
}

export function StaticChips({ items, highlight = [] }) {
  if (!items?.length) return null;
  const hl = new Set(highlight);
  return (
    <div className="chips">
      {items.map((t) => (
        <span key={t} className={`chip static ${hl.has(t) ? 'on' : ''}`}>{t}</span>
      ))}
    </div>
  );
}
