import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Infinity as InfinityIcon, Search, UsersRound } from 'lucide-react';
import { api } from '../api';
import { useApp, toast } from '../store/useApp';
import { errorMessage } from '../lib/errors';
import { formatDistance } from '../lib/format';
import { buy, loadPrices } from '../services/purchases';
import TopBar from '../components/TopBar';
import Avatar from '../components/Avatar';

export default function NewGroup() {
  const nav = useNavigate();
  const me = useApp((s) => s.me);
  const status = useApp((s) => s.status);
  const setStatus = useApp((s) => s.setStatus);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [people, setPeople] = useState([]);
  const [sel, setSel] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState('R$ 1,99');

  useEffect(() => {
    (async () => {
      try {
        const [convs, near] = await Promise.all([api.conversations(), api.nearby({ limit: 60 })]);
        const fromChats = convs.filter((c) => !c.is_group && c.other_id).map((c) => ({ id: c.other_id, display_name: c.title, avatar_url: c.avatar_url, hint: 'Conversaram' }));
        const seen = new Set(fromChats.map((p) => p.id));
        setPeople([...fromChats, ...near.filter((p) => !seen.has(p.id)).map((p) => ({ ...p, hint: formatDistance(p.distance_m) }))]);
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    })();
    api.myStatus().then(setStatus).catch(() => {});
    loadPrices().then((p) => setPrice(p.group));
  }, [setStatus]);

  const free = status?.is_pro && status?.pro_includes_groups;
  const credits = status?.group_credits || 0;
  const filtered = useMemo(() => people.filter((p) => !q || p.display_name?.toLowerCase().includes(q.toLowerCase())), [people, q]);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const create = async () => {
    setBusy(true);
    try {
      if (!free && credits <= 0) {
        setStatus(await buy('group', me.id));
      }
      const id = await api.createGroup(title.trim(), sel, desc.trim());
      setStatus(await api.myStatus());
      toast('Grupo criado 🎉', 'success');
      nav(`/chat/${id}`, { replace: true });
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title="Novo grupo" subtitle={`${sel.length} selecionados · sem limite de pessoas`} />
      <div className="scroll pad" style={{ paddingTop: 16, paddingBottom: 140 }}>
        <div className="col" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 14 }}>
            <div className="group-avatar lg"><UsersRound size={28} /></div>
            <input className="input grow" placeholder="Nome do grupo" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          </div>
          <input className="input" placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} />
          <div className="price-note card">
            {free ? (
              <><Crown size={18} color="#c4a6ff" /><span className="grow">Grátis no seu Pro</span><InfinityIcon size={18} /></>
            ) : credits > 0 ? (
              <><Check size={18} color="#5cffb0" /><span className="grow">Você tem {credits} crédito{credits > 1 ? 's' : ''} de grupo</span></>
            ) : (
              <><UsersRound size={18} color="#c4a6ff" /><span className="grow">Cada grupo custa <b>{price}</b> · pagamento pela Apple</span>
                <button className="btn btn-ghost btn-sm" onClick={() => nav('/pro?motivo=grupos')}>Pro: grátis</button></>
            )}
          </div>
        </div>

        <div className="section">
          <div className="search">
            <Search size={18} />
            <input placeholder="Buscar pessoas" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="list" style={{ marginTop: 12 }}>
            {filtered.map((p) => (
              <button key={p.id} className="list-item" onClick={() => toggle(p.id)}>
                <Avatar src={p.avatar_url} name={p.display_name} size={40} blur />
                <span className="txt"><b>{p.display_name}</b><small>{p.hint}</small></span>
                <span className={`radio ${sel.includes(p.id) ? 'on' : ''}`} />
              </button>
            ))}
            {!filtered.length && <div className="list-item faint">Ninguém encontrado</div>}
          </div>
        </div>
      </div>
      <div className="float-cta">
        <button className="btn btn-primary btn-block" disabled={!title.trim() || busy} onClick={create}>
          {busy ? <span className="spinner" /> : free || credits > 0 ? 'Criar grupo' : `Pagar ${price} e criar`}
        </button>
      </div>
    </div>
  );
}
