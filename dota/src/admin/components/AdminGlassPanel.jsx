export function AdminGlassPanel({ children, className = "", subtle = false }) {
  return (
    <div className={`admin-glass-panel p-4 ${subtle ? "admin-glass-panel--subtle" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
