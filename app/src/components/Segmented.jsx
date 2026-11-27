import { useLayoutEffect, useRef, useState } from 'react';
import { tap } from '../lib/haptics';

export default function Segmented({ options, value, onChange }) {
  const ref = useRef(null);
  const [thumb, setThumb] = useState({ x: 0, w: 0 });
  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-id="${value}"]`);
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value, options.length]);
  return (
    <div className="segmented" ref={ref} role="tablist">
      <span className="thumb" style={{ width: thumb.w, transform: `translateX(${thumb.x - 4}px)`, left: 4 }} />
      {options.map((o) => (
        <button
          key={o.id}
          data-id={o.id}
          role="tab"
          aria-selected={value === o.id}
          className={value === o.id ? 'on' : ''}
          onClick={() => { tap(); onChange(o.id); }}
        >
          {o.icon}
          {o.label}
          {!!o.badge && <span className="badge-dot">{o.badge}</span>}
        </button>
      ))}
    </div>
  );
}
