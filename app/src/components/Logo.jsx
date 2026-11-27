export default function Logo({ size = 25, onDoubleClick }) {
  return (
    <div className="logo" style={{ fontSize: size }} onDoubleClick={onDoubleClick} aria-label="Basher">
      <span className="grad-text">basher</span>
      <i />
    </div>
  );
}
