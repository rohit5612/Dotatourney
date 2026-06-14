import { useState } from "react";

export function SubstituteRequestModal({ open, match, onClose, onSubmit, busy = false }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!open || !match) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (reason.trim().length < 3) {
      setError("Please provide a reason (at least 3 characters).");
      return;
    }
    try {
      await onSubmit(reason.trim());
      setReason("");
      onClose();
    } catch (err) {
      setError(err.message || "Request failed.");
    }
  }

  return (
    <div className="player-modal" role="presentation">
      <button type="button" className="player-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="player-modal__panel" role="dialog" aria-labelledby="sub-request-title">
        <h2 id="sub-request-title" className="player-modal__title">
          Request substitute
        </h2>
        <p className="player-modal__lead">
          {match.team1} vs {match.team2}
          {match.startAt ? ` · ${new Date(match.startAt).toLocaleString()}` : ""}
        </p>
        <p className="player-modal__hint">
          Admins will assign a substitute from the approved pool. You can rescind this request until 4 hours before
          match start.
        </p>
        <form onSubmit={handleSubmit} className="player-modal__form">
          <div className="player-auth__field">
            <label htmlFor="sub-reason">Reason</label>
            <textarea
              id="sub-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why you need a substitute for this match…"
              required
              minLength={3}
            />
          </div>
          {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}
          <div className="player-modal__actions">
            <button type="button" className="player-dash__action player-dash__action--edit" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="player-dash__action player-dash__action--tournaments" disabled={busy}>
              {busy ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
