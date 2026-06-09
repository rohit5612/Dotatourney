import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPlayerToken, playerApi, setPlayerToken } from "../../lib/playerApi";

export function usePlayerSession() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromLink = params.get("token");
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
      .then(setMe)
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

  return { me, account: me?.account, coinBalance: me?.coinBalance ?? 0, loading, error, refreshMe, logout };
}
