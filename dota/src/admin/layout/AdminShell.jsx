import "../../styles/admin-shell.css";

export function AdminShell({ children, darkMode }) {
  const themeClass = darkMode ? "admin-shell--dark" : "admin-shell--light";
  return (
    <div className={`admin-shell ${themeClass}`}>
      <div className="admin-shell__bg" aria-hidden="true" />
      <div className="admin-shell__overlay" aria-hidden="true" />
      <div className="admin-shell__content">{children}</div>
    </div>
  );
}
