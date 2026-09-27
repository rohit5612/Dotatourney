import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { normalizeOrgRoster } from "../utils/seasonContentSchema.js";
import {
  normalizeVersionChangeLog,
  normalizeVersionHistory,
  normalizeWebsiteVersion,
} from "../utils/websiteVersionSchema.js";

export function useSiteContent() {
  const [orgRoster, setOrgRoster] = useState(null);
  const [websiteVersion, setWebsiteVersion] = useState(null);
  const [versionHistory, setVersionHistory] = useState(null);
  const [versionChangeLog, setVersionChangeLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getPublicSiteContent()
      .then((data) => {
        if (!active) return;
        setOrgRoster(normalizeOrgRoster(data?.orgRoster || {}));
        setWebsiteVersion(normalizeWebsiteVersion(data?.websiteVersion));
        setVersionHistory(normalizeVersionHistory(data?.versionHistory || {}));
        setVersionChangeLog(normalizeVersionChangeLog(data?.versionChangeLog || {}));
      })
      .catch(() => {
        if (active) {
          setOrgRoster(normalizeOrgRoster({}));
          setWebsiteVersion(normalizeWebsiteVersion(null));
          setVersionHistory(normalizeVersionHistory({}));
          setVersionChangeLog(normalizeVersionChangeLog({}));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { orgRoster, websiteVersion, versionHistory, versionChangeLog, loading };
}
