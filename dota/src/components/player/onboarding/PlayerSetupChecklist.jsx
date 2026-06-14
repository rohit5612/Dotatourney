import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildSetupTasks, setupProgress } from "../../../hooks/usePlayerOnboarding.js";
import { playerApi } from "../../../lib/playerApi";

const COLLAPSE_KEY = "bpcl-player-setup-collapsed";

function TaskIcon({ done }) {
  return (
    <span className={`player-setup__task-icon${done ? " is-done" : ""}`} aria-hidden="true">
      {done ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
    </span>
  );
}

function TaskAction({ task }) {
  if (task.done) {
    return <span className="player-setup__task-status is-done">Done</span>;
  }
  if (task.oauth) {
    return (
      <a className="player-setup__task-link" href={playerApi.oauthStartUrl(task.oauth)}>
        Link
      </a>
    );
  }
  if (task.href) {
    return (
      <Link className="player-setup__task-link" to={task.href}>
        Go
      </Link>
    );
  }
  return <span className="player-setup__task-status">Pending</span>;
}

export function PlayerSetupChecklist({ account, tournaments = [], registrations = [], compact = false }) {
  const tasks = useMemo(() => buildSetupTasks(account, tournaments, registrations), [account, tournaments, registrations]);
  const progress = useMemo(() => setupProgress(tasks), [tasks]);
  const allRequiredDone = progress.done === progress.total;

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.localStorage.getItem(COLLAPSE_KEY) === "1") return true;
    return allRequiredDone;
  });

  useEffect(() => {
    if (allRequiredDone) {
      setCollapsed(true);
      if (typeof window !== "undefined") window.localStorage.setItem(COLLAPSE_KEY, "1");
    }
  }, [allRequiredDone]);

  if (!account || allRequiredDone) {
    if (compact) return null;
    return (
      <section
        className="player-setup player-setup--complete"
        data-tour="setup-checklist"
        aria-label="Account setup complete"
      >
        <p className="player-setup__complete-msg">All required setup steps complete — you&apos;re cleared to compete.</p>
      </section>
    );
  }

  const remaining = progress.total - progress.done;

  return (
    <section className={`player-setup${collapsed ? " is-collapsed" : ""}`} data-tour="setup-checklist" aria-label="Account setup">
      <header className="player-setup__head">
        <div className="player-setup__head-copy">
          <h2 className="player-setup__title">Setup checklist</h2>
          <p className="player-setup__sub">
            {collapsed
              ? `${remaining} required step${remaining === 1 ? "" : "s"} left`
              : "Complete required steps to unlock registration. Profile details are optional — you can also fill them during sign-up."}
          </p>
        </div>
        <div className="player-setup__progress-ring" style={{ "--progress": progress.pct }} aria-hidden="true">
          <span className="player-setup__progress-label">
            {progress.done}/{progress.total}
          </span>
        </div>
        <button
          type="button"
          className="player-setup__toggle"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </header>

      {!collapsed ? (
        <ul className="player-setup__tasks">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={`player-setup__task${task.done ? " is-done" : ""}${task.required === false ? " player-setup__task--optional" : ""}`}
            >
              <TaskIcon done={task.done} />
              <div className="player-setup__task-copy">
                <span className="player-setup__task-label">
                  {task.label}
                  {task.required === false ? (
                    <span className="player-setup__task-badge">Recommended</span>
                  ) : null}
                </span>
                {task.hint ? <span className="player-setup__task-hint">{task.hint}</span> : null}
              </div>
              <TaskAction task={task} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
