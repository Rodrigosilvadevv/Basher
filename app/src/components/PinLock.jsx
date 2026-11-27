import { useEffect, useState } from 'react';
import { Delete, LockKeyhole } from 'lucide-react';
import { useApp } from '../store/useApp';
import { hashPin } from '../lib/hash';
import { tap } from '../lib/haptics';
import Logo from './Logo';

// Tela de bloqueio por PIN (modo discreto). O PIN nunca sai do aparelho.
export default function PinLock({ mode = 'unlock', onDone, onCancel }) {
  const pinHash = useApp((s) => s.settings.pinHash);
  const setLocked = useApp((s) => s.setLocked);
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState(null);
  const [shake, setShake] = useState(false);
  const title = mode === 'unlock' ? 'Digite seu PIN' : first ? 'Confirme o PIN' : 'Crie um PIN de 4 dígitos';

  useEffect(() => {
    if (pin.length < 4) return;
    (async () => {
      const h = await hashPin(pin);
      if (mode === 'unlock') {
        if (h === pinHash) {
          tap('Medium');
          setLocked(false);
          onDone?.();
        } else fail();
      } else if (!first) {
        setFirst(h);
        setPin('');
      } else if (first === h) {
        onDone?.(h);
      } else {
        setFirst(null);
        fail();
      }
    })();
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  function fail() {
    tap('Heavy');
    setShake(true);
    setTimeout(() => { setShake(false); setPin(''); }, 450);
  }
  const press = (d) => { tap(); setPin((p) => (p.length < 4 ? p + d : p)); };

  return (
    <div className="pinlock">
      <Logo size={30} />
      <div className="pin-lock-icon"><LockKeyhole size={22} /></div>
      <p className="pin-title">{title}</p>
      <div className={`pin-dots ${shake ? 'shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)}>{d}</button>
        ))}
        <button className="ghost" onClick={onCancel} style={{ visibility: onCancel ? 'visible' : 'hidden' }}>Cancelar</button>
        <button onClick={() => press('0')}>0</button>
        <button className="ghost" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Apagar"><Delete size={22} /></button>
      </div>
    </div>
  );
}
