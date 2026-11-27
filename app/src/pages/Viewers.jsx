import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Crown } from 'lucide-react';
import { api } from '../api';
import { timeAgo } from '../lib/format';
import TopBar from '../components/TopBar';
import Avatar from '../components/Avatar';
import Empty from '../components/Empty';

export default function Viewers() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.myViewers().then(setData).catch(() => setData({ count: 0, viewers: [] })); }, []);
  return (
    <div className="screen">
      <TopBar title="Quem me viu" subtitle="Últimos 30 dias" />
      <div className="scroll pad" style={{ paddingTop: 16, paddingBottom: 40 }}>
        {!data ? null : !data.count ? (
          <Empty icon={<Eye />} title="Nenhuma visita ainda" text="Capriche nas fotos e na bio, e poste no Agora para aparecer mais." />
        ) : data.locked ? (
          <div className="col" style={{ gap: 20 }}>
            <div className="viewers-locked">
              {data.viewers.slice(0, 9).map((v, i) => (
                <div key={i} className="vl-cell"><Avatar src={v.avatar_url} size={86} /><span>{timeAgo(v.viewed_at)}</span></div>
              ))}
            </div>
            <div className="pro-hero compact">
              <h2><span className="num">{data.count}</span> {data.count === 1 ? 'pessoa viu' : 'pessoas viram'} seu perfil</h2>
              <p className="muted">Assine o Pro para ver quem são e puxar assunto.</p>
              <button className="btn btn-primary" onClick={() => nav('/pro?motivo=visitas')}><Crown size={17} /> Ver quem foi</button>
            </div>
          </div>
        ) : (
          <div className="list">
            {data.viewers.map((v) => (
              <button key={v.id} className="list-item" onClick={() => nav(`/u/${v.id}`)}>
                <Avatar src={v.avatar_url} name={v.display_name} size={44} blur />
                <span className="txt"><b>{v.display_name}</b><small>há {timeAgo(v.viewed_at)}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
