/** Holo profile viewport aura — rainbow edge bleed above community bg. */
export function HoloProfileViewportFx() {
  return (
    <div className="player-profile-holo-aura-frame" aria-hidden="true">
      <div className="player-profile-holo-aura-frame__spectrum" />
      <div className="player-profile-holo-aura-frame__organic" />
      <div className="player-profile-holo-aura-frame__sheen" />
    </div>
  );
}
