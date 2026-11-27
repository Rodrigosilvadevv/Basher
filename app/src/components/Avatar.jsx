import { initials } from '../lib/format';

export default function Avatar({ src, name, size = 44, online, ring, seen, blur, className = '' }) {
  return (
    <div
      className={`avatar ${ring ? 'ring' : ''} ${seen ? 'seen' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className={blur ? 'blurrable' : ''} loading="lazy" decoding="async" draggable={false} />
      ) : (
        <div className="initials" style={{ fontSize: size * 0.36 }}>{initials(name)}</div>
      )}
      {online && <span className="dot" />}
    </div>
  );
}
