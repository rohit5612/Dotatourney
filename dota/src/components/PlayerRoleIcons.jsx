import { memo } from "react";
import { getPlayerRoles, roleIconLabel, roleIconSrc, sortRolesByDefault } from "../utils/roleIcons.js";
import "../styles/player-role-icons.css";

export const PlayerRoleIcons = memo(function PlayerRoleIcons({ player, roles, className = "", size = "md" }) {
  const list = roles?.length ? sortRolesByDefault(roles) : getPlayerRoles(player);
  if (!list.length) {
    return <span className={`player-role-icons player-role-icons--empty ${className}`.trim()} aria-hidden>—</span>;
  }

  return (
    <div className={`player-role-icons player-role-icons--${size}${className ? ` ${className}` : ""}`} aria-label={list.map(roleIconLabel).join(", ")}>
      {list.map((role) => {
        const src = roleIconSrc(role);
        const label = roleIconLabel(role);
        if (!src) {
          return (
            <span key={role} className="player-role-icons__fallback" title={label}>
              {label.slice(0, 1)}
            </span>
          );
        }
        return (
          <span key={role} className="player-role-icons__item" title={label}>
            <img src={src} alt="" width={20} height={20} decoding="async" />
          </span>
        );
      })}
    </div>
  );
});
