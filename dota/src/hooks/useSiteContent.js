import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { normalizeOrgRoster } from "../utils/seasonContentSchema.js";

export function useSiteContent() {
  const [orgRoster, setOrgRoster] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getPublicSiteContent()
      .then((data) => {
        if (!active) return;
        setOrgRoster(normalizeOrgRoster(data?.orgRoster || {}));
      })
      .catch(() => {
        if (active) setOrgRoster(normalizeOrgRoster({}));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { orgRoster, loading };
}
