import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { TeamsPanelModal } from "../teams/TeamsPanelModal.jsx";
import { readGifFileAsDataUrl } from "../../utils/readPortraitUploadFile.js";

function normalizeHostedGifPath(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    const { pathname } = new URL(value, typeof window !== "undefined" ? window.location.origin : "http://local");
    return pathname;
  } catch {
    return value.split("?")[0].split("#")[0];
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PortraitGifPickerModal({
  open,
  onClose,
  title = "Choose hosted GIF",
  description = "GIFs are served from /cards/gifs — fast and cacheable for holo cards.",
  selectedUrl = "",
  onSelect,
  canWrite = true,
}) {
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedPath = normalizeHostedGifPath(selectedUrl);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    api
      .listPortraitGifs()
      .then((data) => {
        if (!active) return;
        setGifs(Array.isArray(data?.gifs) ? data.gifs : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Could not load hosted GIFs.");
        setGifs([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  async function handleUpload(file) {
    if (!file) return;
    setUploadBusy(true);
    setError("");
    try {
      const dataUrl = await readGifFileAsDataUrl(file);
      const saved = await api.uploadPortraitGifToCatalog({ dataUrl, filename: file.name });
      const data = await api.listPortraitGifs();
      setGifs(Array.isArray(data?.gifs) ? data.gifs : []);
      onSelect?.(saved.url);
      onClose?.();
    } catch (err) {
      setError(err.message || "Could not upload GIF.");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <TeamsPanelModal open={open} onClose={onClose} title={title} description={description} size="lg">
      {canWrite ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/60 pb-4">
          <label className="btn btn-outline btn-sm cursor-pointer">
            {uploadBusy ? "Uploading…" : "Upload new GIF"}
            <input
              type="file"
              accept="image/gif"
              className="sr-only"
              disabled={uploadBusy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleUpload(file);
                event.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Adds a file to <code className="text-[0.7rem]">dota/public/cards/gifs</code> (or the server upload folder).
          </p>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Loading hosted GIFs…</p> : null}
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      {!loading && !gifs.length ? (
        <p className="text-sm text-muted-foreground">
          No hosted GIFs yet. Upload one above, or drop files into <code className="text-[0.7rem]">public/cards/gifs</code>.
        </p>
      ) : null}

      {gifs.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {gifs.map((entry) => {
            const selected = selectedPath && normalizeHostedGifPath(entry.url) === selectedPath;
            return (
              <button
                key={entry.filename}
                type="button"
                className={`player-crm__gif-picker-tile flex flex-col items-center gap-2 rounded-lg border p-2 transition hover:border-primary/60 hover:bg-background${selected ? " border-primary bg-background ring-2 ring-primary/30" : " border-border"}`}
                onClick={() => {
                  onSelect?.(entry.url);
                  onClose?.();
                }}
              >
                <span className="player-crm__gif-picker-preview">
                  <img src={entry.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </span>
                <span className="w-full truncate text-center text-[11px] leading-tight text-muted-foreground" title={entry.label}>
                  {entry.label}
                </span>
                {entry.bytes ? (
                  <span className="text-[10px] text-muted-foreground/80">{formatBytes(entry.bytes)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </TeamsPanelModal>
  );
}
