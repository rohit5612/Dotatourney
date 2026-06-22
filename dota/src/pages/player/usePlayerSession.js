import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPlayerToken, playerApi, setPlayerToken } from "../../lib/playerApi";

export function usePlayerSession() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkNotice, setLinkNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromLink = params.get("token");
    if (params.get("linked") === "discord" && params.get("discord_join") === "failed") {
      setLinkNotice("discord_join_failed");
    }
    if (tokenFromLink) {
      setPlayerToken(tokenFromLink);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (!getPlayerToken()) {
      navigate("/login?next=" + encodeURIComponent(window.location.pathname));
      return;
    }
    playerApi
      .me()
      .then((data) => {
        if (!data.account?.hasPassword && !window.location.pathname.startsWith("/set-password")) {
          navigate("/set-password", { replace: true });
          return;
        }
        setMe(data);
      })
      .catch((err) => {
        if (err.status === 401) {
          setPlayerToken("");
          navigate("/login");
          return;
        }
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function refreshMe() {
    const data = await playerApi.me();
    setMe(data);
    return data;
  }

  async function logout() {
    try {
      await playerApi.logout();
    } catch {
      // ignore
    }
    setPlayerToken("");
    navigate("/login");
  }

  return {
    me,
    account: me?.account,
    coinBalance: me?.coinBalance ?? 0,
    loading,
    error,
    linkNotice,
    refreshMe,
    logout,
  };
}
