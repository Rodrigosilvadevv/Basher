import { useState } from 'react';
import { Flag } from 'lucide-react';
import Sheet from './Sheet';
import { REPORT_REASONS } from '../config/options';
import { api } from '../api';
import { toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { SwitchRow } from './Switch';

export default function ReportSheet({ open, onClose, userId, name, onDone }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api.report(userId, reason, details, block);
      toast('Denúncia enviada. Obrigado por proteger a comunidade.', 'success');
      onClose();
      onDone?.(block);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Denunciar ${name || ''}`}>
      <div className="col" style={{ gap: 14 }}>
        <div className="list">
          {REPORT_REASONS.map((r) => (
            <button key={r.id} className="list-item" onClick={() => setReason(r.id)}>
              <span className="txt">{r.label}</span>
              <span className={`radio ${reason === r.id ? 'on' : ''}`} />
            </button>
          ))}
        </div>
        <textarea className="textarea" placeholder="Conte o que aconteceu (opcional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
        <SwitchRow title="Bloquear também" text="Vocês deixam de se ver em todo o app." on={block} onChange={setBlock} />
        <button className="btn btn-danger btn-block" disabled={!reason || busy} onClick={send}>
          {busy ? <span className="spinner" /> : <Flag size={18} />} Enviar denúncia
        </button>
        <p className="faint tiny">Denúncias de menores de idade suspendem o perfil na hora até a revisão da moderação.</p>
      </div>
    </Sheet>
  );
}
