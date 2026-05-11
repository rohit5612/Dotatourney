/**
 * Full-viewport loader for initial bootstrap or heavy transitions.
 *
 * @param {object} [props]
 * @param {string} [props.label] — Visually subdued line under the spinner
 */
export function PageLoadingSpinner({ label = "Loading…" }) {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-5 bg-background px-6 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="relative flex size-[4.5rem] shrink-0 items-center justify-center sm:size-[5rem]" aria-hidden>
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-muted border-t-primary shadow-sm motion-reduce:animate-none motion-reduce:opacity-80" />
        <img src="/bpcl.png" alt="" width={64} height={64} className="relative size-12 object-contain sm:size-14" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
