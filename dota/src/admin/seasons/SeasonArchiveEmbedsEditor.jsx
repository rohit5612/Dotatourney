import { createEmptyArchiveEmbed } from "../../utils/seasonContentSchema.js";

function Field({ label, children }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function inputClassName() {
  return "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
}

export function SeasonArchiveEmbedsEditor({ value, onChange, disabled = false }) {
  const embeds = Array.isArray(value) ? value : [];

  function updateEmbed(index, patch) {
    onChange(embeds.map((embed, i) => (i === index ? { ...embed, ...patch } : embed)));
  }

  function removeEmbed(index) {
    onChange(embeds.filter((_, i) => i !== index));
  }

  function addEmbed() {
    onChange([...embeds, createEmptyArchiveEmbed()]);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Shown on the landing page and tournament hub when the tournament is not live. Use YouTube watch or live URLs.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
          disabled={disabled}
          onClick={addEmbed}
        >
          Add embed
        </button>
      </div>
      {!embeds.length ? (
        <p className="text-sm text-muted-foreground">No archive embeds yet.</p>
      ) : (
        embeds.map((embed, index) => (
          <div key={embed.id || index} className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-2">
            <Field label="Label">
              <input
                className={inputClassName()}
                value={embed.label || ""}
                disabled={disabled}
                onChange={(e) => updateEmbed(index, { label: e.target.value })}
                placeholder="Season 1 Grand Finals"
              />
            </Field>
            <Field label="YouTube URL">
              <input
                className={inputClassName()}
                value={embed.youtubeUrl || ""}
                disabled={disabled}
                onChange={(e) => updateEmbed(index, { youtubeUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
              />
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="button"
                className="text-xs text-destructive hover:underline"
                disabled={disabled}
                onClick={() => removeEmbed(index)}
              >
                Remove
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
