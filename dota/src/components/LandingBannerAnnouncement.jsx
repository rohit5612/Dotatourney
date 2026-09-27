import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineMegaphone, HiOutlineXMark } from "react-icons/hi2";
import { formatAnnouncementPostedAt, pickBannerAnnouncement } from "../lib/announcementEntries.js";
import {
  bannerAnnouncementContentClassName,
  sanitizeBannerAnnouncementHtml,
} from "../lib/sanitizeRulebookHtml.js";

export function LandingBannerAnnouncement({ tournament }) {
  const bannerSource = tournament?.banner_announcements;
  const banner = useMemo(() => pickBannerAnnouncement(bannerSource), [JSON.stringify(bannerSource ?? [])]);
  const bannerHtml = useMemo(
    () => (banner?.body ? sanitizeBannerAnnouncementHtml(banner.body) : ""),
    [banner?.body],
  );
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDismissed(false);
  }, [banner?.body, banner?.postedAt]);

  if (!mounted || !banner || dismissed) return null;

  return createPortal(
    <div className="landing-banner-overlay pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div
        key={`${banner.body}-${banner.postedAt || ""}`}
        className="landing-banner-enter w-full max-w-2xl"
      >
        <div className="landing-banner-announcement pointer-events-auto flex w-full items-center gap-3 sm:gap-4" role="status" aria-live="polite">
          <span className="landing-banner-announcement__icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11">
            <HiOutlineMegaphone className="h-5 w-5 motion-safe:animate-pulse" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 overflow-y-auto">
            <p className="landing-banner-announcement__label">Important announcement</p>
            <div
              className={`landing-banner-announcement__body ${bannerAnnouncementContentClassName}`}
              dangerouslySetInnerHTML={{ __html: bannerHtml }}
            />
            {banner.postedAt ? (
              <p className="landing-banner-announcement__date">{formatAnnouncementPostedAt(banner.postedAt)}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="landing-banner-announcement__close shrink-0"
            onClick={() => setDismissed(true)}
            aria-label="Hide announcement for this visit"
          >
            <HiOutlineXMark className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
