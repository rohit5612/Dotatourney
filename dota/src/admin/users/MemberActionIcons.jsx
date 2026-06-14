const iconProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function IconEye() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconKey() {
  return (
    <svg {...iconProps}>
      <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
      <path d="m21 2-9.6 9.6" />
      <circle cx="7.5" cy="15.5" r="5.5" />
    </svg>
  );
}

export function IconClipboardCheck() {
  return (
    <svg {...iconProps}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

export function IconRefresh() {
  return (
    <svg {...iconProps}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function IconUser() {
  return (
    <svg {...iconProps}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg {...iconProps}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

export function MemberIconButton({ label, onClick, variant = "default", disabled = false, children }) {
  return (
    <button
      type="button"
      className={`user-mgmt-icon-btn${variant !== "default" ? ` user-mgmt-icon-btn--${variant}` : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function MemberRowActions({ user, isSelf, isSuperadmin, onOpen, onReactivate }) {
  if (isSuperadmin || isSelf) {
    return (
      <MemberIconButton label="View member" onClick={() => onOpen(user, "overview")}>
        <IconEye />
      </MemberIconButton>
    );
  }

  if (user.status === "pending") {
    return (
      <MemberIconButton label="Review member" variant="primary" onClick={() => onOpen(user, "overview")}>
        <IconClipboardCheck />
      </MemberIconButton>
    );
  }

  if (user.status === "approved") {
    return (
      <>
        <MemberIconButton label="Manage access" onClick={() => onOpen(user, "access")}>
          <IconKey />
        </MemberIconButton>
        <MemberIconButton label="View member" onClick={() => onOpen(user, "overview")}>
          <IconEye />
        </MemberIconButton>
      </>
    );
  }

  if (user.status === "revoked" || user.status === "rejected") {
    return (
      <>
        <MemberIconButton label="Reactivate member" variant="primary" onClick={() => onReactivate(user)}>
          <IconRefresh />
        </MemberIconButton>
        <MemberIconButton label="View member" onClick={() => onOpen(user, "overview")}>
          <IconEye />
        </MemberIconButton>
      </>
    );
  }

  return null;
}
