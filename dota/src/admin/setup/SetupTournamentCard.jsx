import { tournamentStatusClass, tournamentStatusLabel } from "./setupUtils.js";

function IconEdit() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SetupIconButton({ label, onClick, variant = "default", disabled = false, children }) {
  return (
    <button
      type="button"
      className={`setup-icon-btn${variant === "primary" ? " setup-icon-btn--primary" : ""}${variant === "danger" ? " setup-icon-btn--danger" : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function SetupTournamentCard({
  tournament,
  displayTitle,
  metaLine,
  isSelected,
  onSelect,
  onEdit,
  onRegistrations,
  onApprove,
  onPublish,
  onUnpublish,
  onComplete,
  onDelete,
}) {
  const isDraft = tournament.status === "draft";
  const isPast = tournament.status === "concluded";
  const canRegistrations = !isPast && (tournament.is_published || tournament.status === "approved" || tournament.status === "published");

  return (
    <article className={`setup-card${isSelected ? " setup-card--selected" : ""}`}>
      <div>
        <div className="setup-card__title-row">
          <h3 className="setup-card__title">{displayTitle || tournament.name}</h3>
          <span className={`setup-badge ${tournamentStatusClass(tournament)}`}>{tournamentStatusLabel(tournament)}</span>
          {tournament.is_published ? <span className="setup-badge setup-badge--live">Published</span> : null}
        </div>
        <p className="setup-card__meta">{metaLine}</p>
        <p className="setup-card__id">{tournament.id}</p>
      </div>
      <div className="setup-card__actions">
        <SetupIconButton label="Select tournament" onClick={() => onSelect(tournament.id)}>
          <IconTarget />
        </SetupIconButton>
        <SetupIconButton label="Edit draft" onClick={() => onEdit(tournament.id)}>
          <IconEdit />
        </SetupIconButton>
        {canRegistrations ? (
          <SetupIconButton label="Registration controls" onClick={() => onRegistrations(tournament.id)}>
            <IconUsers />
          </SetupIconButton>
        ) : null}
        {isDraft ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onApprove(tournament.id)}>
            Approve
          </button>
        ) : null}
        {tournament.status === "approved" && !tournament.is_published ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onPublish(tournament.id)}>
            Publish
          </button>
        ) : null}
        {tournament.is_published ? (
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onUnpublish(tournament.id)}>
              Unpublish
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onComplete(tournament.id)}>
              Complete
            </button>
          </>
        ) : null}
        {isDraft && !tournament.is_published ? (
          <button type="button" className="btn btn-destructive-outline btn-sm" onClick={() => onDelete(tournament)}>
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
