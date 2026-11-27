import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, EyeOff } from 'lucide-react';
import { formatDistance } from '../lib/format';
import { positionShort } from '../config/options';
import { initials } from '../lib/format';

function ProfileCard({ p, vibe, index = 0 }) {
  const dist = formatDistance(p.distance_m);
  return (
    <Link
      to={`/u/${p.id}`}
      className={`pcard ${p.is_pro ? 'pro' : ''} ${p.has_story ? 'story' : ''}`}
      style={{ animationDelay: `${Math.min(index, 18) * 28}ms` }}
      aria-label={`${p.display_name}${p.age ? ', ' + p.age : ''}${dist ? ', ' + dist : ''}`}
    >
      {p.avatar_url ? (
        <img src={p.avatar_url} alt="" className="blurrable" loading="lazy" decoding="async" draggable={false} />
      ) : (
        <div className="pcard-empty">{initials(p.display_name)}</div>
      )}
      <div className="pcard-top">
        {vibe >= 70 && (
          <span className="badge vibe"><Sparkles />{vibe}%</span>
        )}
        {positionShort(p.sex_position) && <span className="badge glass">{positionShort(p.sex_position)}</span>}
      </div>
      <div className="pcard-info">
        <div className="pcard-name">
          {p.online && <i className="on" />}
          <b className="ellipsis">{p.display_name || 'Sem nome'}</b>
          {p.age && <span>{p.age}</span>}
        </div>
        <div className="pcard-dist num">{dist || <><EyeOff size={11} /> oculto</>}</div>
      </div>
    </Link>
  );
}

export default memo(ProfileCard);
