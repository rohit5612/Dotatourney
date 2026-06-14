import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { BpcCoin } from "../../components/coins/BpcCoin.jsx";
import { playerApi } from "../../lib/playerApi";
import "../../styles/player-wallet.css";

export function PlayerWalletPage() {
  const { coinBalance } = useOutletContext();
  const [data, setData] = useState({ balance: coinBalance, ledger: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    playerApi
      .coins({ limit: 100 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="player-dash__wallet-page">
      <header className="player-dash__hero player-dash__hero--compact">
        <div className="player-dash__hero-main">
          <div className="player-dash__hero-copy">
            <p className="player-dash__hero-eyebrow">Wallet</p>
            <h1 className="player-dash__hero-title">BPC coin transactions</h1>
            <div className="player-wallet__balance">
              <span className="player-dash__stat-label">Current balance</span>
              <BpcCoin amount={data.balance ?? coinBalance} size="md" />
            </div>
          </div>
        </div>
        <Link to="/dashboard/settings" className="player-dash__action player-dash__action--edit">
          Profile settings
        </Link>
      </header>

      {error ? <div className="player-auth__message player-auth__message--error">{error}</div> : null}

      {loading ? (
        <div className="player-dash__loading">
          <span className="player-dash__loading-pulse" aria-hidden="true" />
          <p className="player-auth__sub">Loading transactions…</p>
        </div>
      ) : (
        <section className="player-dash__card player-dash__section-card">
          <header className="player-dash__card-head player-dash__card-head--compact">
            <h2 className="player-dash__card-title">Transaction log</h2>
            <span className="player-dash__section-count">{data.total}</span>
          </header>
          {data.ledger?.length ? (
            <div className="player-wallet-table-wrap">
              <table className="player-wallet-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Change</th>
                    <th scope="col">Balance</th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledger.map((row) => (
                    <tr key={row.id}>
                      <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                      <td className={row.delta >= 0 ? "player-wallet-table__credit" : "player-wallet-table__debit"}>
                        {row.delta >= 0 ? `+${row.delta}` : row.delta}
                      </td>
                      <td>{row.balanceAfter}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="player-dash__card-sub">No coin transactions yet.</p>
          )}
        </section>
      )}
    </div>
  );
}
