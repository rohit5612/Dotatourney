import { useMemo, useState } from "react";
import { api } from "../lib/api";

export function RegistrationCrmPage({ tournamentId, registrations, refreshRegistrations }) {
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    return (registrations || [])
      .filter((registration) => !roleFilter || registration.roles?.includes(roleFilter))
      .filter((registration) => !statusFilter || registration.registrationStatus === statusFilter)
      .sort((a, b) => (Number(b.mmr) || 0) - (Number(a.mmr) || 0));
  }, [registrations, roleFilter, statusFilter]);

  async function updateRegistration(registrationId, payload) {
    try {
      await api.updateRegistration(tournamentId, registrationId, payload);
      await refreshRegistrations();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-md border border-border bg-card p-2 text-sm text-secondary">{message}</p> : null}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg">Registration CRM</h2>
            <p className="text-sm text-muted-foreground">Mark Discord payments manually, approve players, and use role/MMR sorting for team assignment.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-md border border-input bg-background p-2" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="">All roles</option>
              {[...new Set((registrations || []).flatMap((registration) => registration.roles || []))].map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <select className="rounded-md border border-input bg-background p-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </section>
      <div className="grid gap-3">
        {filtered.map((registration) => (
          <div key={registration.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg">{registration.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {registration.roles?.join(", ") || "No roles"} - {registration.mmr || "MMR TBA"} MMR - {registration.location || "No location"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Steam: {registration.steamName} ({registration.steamProfile}) - Discord: {registration.discordHandle || "N/A"}
                </p>
              </div>
              <div className="text-sm">
                <div>Payment: <span className="capitalize text-secondary">{registration.paymentStatus}</span></div>
                <div>Status: <span className="capitalize text-secondary">{registration.registrationStatus}</span></div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
              <select className="rounded-md border border-input bg-background p-2" value={registration.paymentStatus} onChange={(event) => updateRegistration(registration.id, { paymentStatus: event.target.value })}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
              </select>
              <select className="rounded-md border border-input bg-background p-2" value={registration.registrationStatus} onChange={(event) => updateRegistration(registration.id, { registrationStatus: event.target.value })}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="rejected">Rejected</option>
              </select>
              <input className="rounded-md border border-input bg-background p-2" placeholder="Admin notes" defaultValue={registration.adminNotes} onBlur={(event) => updateRegistration(registration.id, { adminNotes: event.target.value })} />
              <button type="button" className="rounded-md border border-border px-3 py-2" onClick={() => updateRegistration(registration.id, { paymentStatus: "paid", registrationStatus: "approved" })}>
                Mark ready
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
