export default function Empty({ icon, title, text, action }) {
  return (
    <div className="empty rise">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
