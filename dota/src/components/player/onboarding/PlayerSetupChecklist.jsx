import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildSetupTasks,
  coreSetupTasks,
  nextSetupTasks,
  setupProgress,
} from "../../../hooks/usePlayerOnboarding.js";
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

function TaskStatus({ task }) {
  if (task.done) {
    return <span className="player-setup__task-status is-done">Done</span>;
  }
  return (
    <span className="player-setup__task-chevron" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </span>
  );
}

function TaskRow({ task, as: Tag = "div", ...props }) {
  const className = `player-setup__task${task.done ? " is-done" : ""}${!task.done && (task.href || task.oauth) ? " player-setup__task--action" : ""}${task.tier === "next" ? " player-setup__task--optional" : ""}`;

  return (
    <Tag className={className} {...props}>
      <TaskIcon done={task.done} />
      <div className="player-setup__task-copy">
        <span className="player-setup__task-label">
          {task.label}
          {task.tier === "next" && !task.done ? (
            <span className="player-setup__task-badge">Recommended</span>
          ) : null}
        </span>
        {task.hint ? <span className="player-setup__task-hint">{task.hint}</span> : null}
      </div>
      <TaskStatus task={task} />
    </Tag>
  );
}

function SetupTaskItem({ task }) {
  if (task.done) {
    return (
      <li className="player-setup__tasks-item">
        <TaskRow task={task} />
      </li>
    );
  }

  if (task.oauth) {
    return (
      <li className="player-setup__tasks-item">
        <TaskRow as="a" task={task} href={playerApi.oauthStartUrl(task.oauth)} />
      </li>
    );
  }

  if (task.href) {
    return (
      <li className="player-setup__tasks-item">
        <TaskRow as={Link} task={task} to={task.href} />
      </li>
    );
  }

  return (
    <li className="player-setup__tasks-item">
      <TaskRow task={task} />
    </li>
  );
}

function SetupNextStepsModal({ open, tasks, onClose }) {
  const incomplete = tasks.filter((task) => !task.done).length;

  if (!open) return null;

  return (
    <div className="player-modal" role="presentation">
      <button type="button" className="player-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="player-modal__panel player-modal__panel--wide" role="dialog" aria-labelledby="setup-next-title">
        <h2 id="setup-next-title" className="player-modal__title">
          Next steps
        </h2>
        <p className="player-modal__lead">
          Your account is linked — finish these when you&apos;re ready to compete.
        </p>
        {incomplete ? (
          <p className="player-modal__hint">
            {incomplete} recommended step{incomplete === 1 ? "" : "s"} remaining.
          </p>
        ) : (
          <p className="player-modal__hint">All recommended steps complete.</p>
        )}
        <ul className="player-setup__tasks player-setup__tasks--modal">
          {tasks.map((task) => (
            <SetupTaskItem key={task.id} task={task} />
          ))}
        </ul>
        <div className="player-modal__actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlayerSetupChecklist({ account, tournaments = [], registrations = [], compact = false }) {
  const tasks = useMemo(() => buildSetupTasks(account, tournaments, registrations), [account, tournaments, registrations]);
  const coreTasks = useMemo(() => coreSetupTasks(tasks), [tasks]);
  const nextTasks = useMemo(() => nextSetupTasks(tasks), [tasks]);
  const coreProgress = useMemo(() => setupProgress(tasks, { tier: "core" }), [tasks]);
  const coreComplete = coreProgress.done === coreProgress.total;
  const incompleteNext = useMemo(() => nextTasks.filter((task) => !task.done).length, [nextTasks]);
  const allNextDone = incompleteNext === 0;

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.localStorage.getItem(COLLAPSE_KEY) === "1") return true;
    return coreComplete;
  });
  const [nextModalOpen, setNextModalOpen] = useState(false);

  useEffect(() => {
    if (coreComplete) {
      setCollapsed(true);
      if (typeof window !== "undefined") window.localStorage.setItem(COLLAPSE_KEY, "1");
    }
  }, [coreComplete]);

  if (!account) return null;

  if (coreComplete) {
    if (compact) return null;
    return (
      <>
        <section
          className="player-setup player-setup--complete"
          data-tour="setup-checklist"
          aria-label="Account setup complete"
        >
          <p className="player-setup__complete-msg">
            Email, Steam, and Discord linked — you&apos;re cleared to register.
          </p>
          {nextTasks.length ? (
            <button
              type="button"
              className="player-setup__next-btn"
              onClick={() => setNextModalOpen(true)}
            >
              {allNextDone ? "View next steps" : `Next steps (${incompleteNext} remaining)`}
            </button>
          ) : null}
        </section>
        <SetupNextStepsModal open={nextModalOpen} tasks={nextTasks} onClose={() => setNextModalOpen(false)} />
      </>
    );
  }

  const remaining = coreProgress.total - coreProgress.done;

  return (
    <>
      <section className={`player-setup${collapsed ? " is-collapsed" : ""}`} data-tour="setup-checklist" aria-label="Account setup">
        <header className="player-setup__head">
          <div className="player-setup__head-copy">
            <h2 className="player-setup__title">Setup checklist</h2>
            <p className="player-setup__sub">
              {collapsed
                ? `${remaining} required step${remaining === 1 ? "" : "s"} left`
                : "Verify email and link Steam + Discord to unlock registration."}
            </p>
          </div>
          <div className="player-setup__progress-ring" style={{ "--progress": coreProgress.pct }} aria-hidden="true">
            <span className="player-setup__progress-label">
              {coreProgress.done}/{coreProgress.total}
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
            {coreTasks.map((task) => (
              <SetupTaskItem key={task.id} task={task} />
            ))}
          </ul>
        ) : null}
      </section>
      <SetupNextStepsModal open={nextModalOpen} tasks={nextTasks} onClose={() => setNextModalOpen(false)} />
    </>
  );
}
