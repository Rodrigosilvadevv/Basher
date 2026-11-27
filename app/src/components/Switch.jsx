import { Crown } from 'lucide-react';
import { tap } from '../lib/haptics';

export function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} className={`switch ${on ? 'on' : ''}`}
      onClick={() => { tap(); onChange(!on); }} />
  );
}

export function SwitchRow({ title, text, on, onChange, pro, icon }) {
  return (
    <div className="switch-row">
      {icon}
      <div className="txt">
        <b>{title} {pro && <Crown size={13} color="#c4a6ff" style={{ verticalAlign: -1 }} />}</b>
        {text && <small>{text}</small>}
      </div>
      <Switch on={on} onChange={onChange} label={title} />
    </div>
  );
}
