import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

/* ---------- helpers ---------- */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json().catch(() => ({}));
}
function currency(n) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/* ---------- app ---------- */
function App() {
  // data
  const [children, setChildren] = useState([]);

  // header toggles
  const [admin, setAdmin] = useState(false);

  // forms / modals
  const [form, setForm] = useState({ name: "", weekly: "", start: "" }); // Add Child
  const [purchase, setPurchase] = useState({ id: null, amount: "", note: "" }); // Make Purchase
  const [adjust, setAdjust] = useState({ id: null, amount: "", note: "" }); // Adjust Balance (+/-)
  const [edit, setEdit] = useState({ id: null, weekly: "" }); // Edit Allowance
  const [history, setHistory] = useState({ id: null, entries: [] }); // View History

  /* ---------- load data ---------- */
  async function load() {
    setChildren(await api("/api/children"));
  }

  useEffect(() => {
    load();

    // header buttons
    const syncBtn = document.getElementById("syncBtn");
    const adminToggle = document.getElementById("adminToggle");
    if (syncBtn) {
      syncBtn.onclick = async () => {
        await api("/api/allowance/run", { method: "POST" });
        await load();
      };
    }
    if (adminToggle) {
      adminToggle.onclick = () => setAdmin((v) => !v);
    }
  }, []);

  /* ---------- Add Child ---------- */
  async function addChild(e) {
    e.preventDefault();
    await api("/api/children", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        weekly_allowance: parseFloat(form.weekly || "0"),
        starting_balance: parseFloat(form.start || "0"),
      }),
    });
    setForm({ name: "", weekly: "", start: "" });
    await load();
  }

  /* ---------- Purchase ---------- */
  function startPurchase(childId) {
    setPurchase({ id: childId, amount: "", note: "" });
  }
  async function confirmPurchase(e) {
    e.preventDefault();
    const amt = parseFloat(purchase.amount || "0");
    if (amt <= 0) return;
    await api("/api/purchase", {
      method: "POST",
      body: JSON.stringify({
        child_id: purchase.id,
        amount: amt,
        note: purchase.note || "",
      }),
    });
    setPurchase({ id: null, amount: "", note: "" });
    await load();
  }
  function cancelPurchase() {
    setPurchase({ id: null, amount: "", note: "" });
  }

  /* ---------- Adjust (+/-) ---------- */
  function startAdjust(childId) {
    setAdjust({ id: childId, amount: "", note: "" });
  }
  async function confirmAdjust(e) {
    e.preventDefault();
    const amt = parseFloat(adjust.amount || "0");
    if (amt === 0) return;
    await api("/api/adjust", {
      method: "POST",
      body: JSON.stringify({
        child_id: adjust.id,
        amount: amt, // may be positive (credit) or negative (debit)
        note: adjust.note || "",
      }),
    });
    setAdjust({ id: null, amount: "", note: "" });
    await load();
  }
  function cancelAdjust() {
    setAdjust({ id: null, amount: "", note: "" });
  }

  /* ---------- Edit weekly allowance ---------- */
  function startEdit(childId, currentWeekly) {
    setEdit({ id: childId, weekly: String(currentWeekly ?? "") });
  }
  async function confirmEdit(e) {
    e.preventDefault();
    const wk = parseFloat(edit.weekly || "0");
    if (wk < 0) return;
    await api(`/api/children/${edit.id}`, {
      method: "PATCH",
      body: JSON.stringify({ weekly_allowance: wk }),
    });
    setEdit({ id: null, weekly: "" });
    await load();
  }
  function cancelEdit() {
    setEdit({ id: null, weekly: "" });
  }

  /* ---------- Delete Child ---------- */
  async function handleDelete(childId) {
    if (!confirm("Delete this child and all their history?")) return;
    await api(`/api/children/${childId}`, { method: "DELETE" });
    await load();
    if (purchase.id === childId) cancelPurchase();
    if (adjust.id === childId) cancelAdjust();
    if (edit.id === childId) cancelEdit();
    if (history.id === childId) setHistory({ id: null, entries: [] });
  }

  /* ---------- History ---------- */
  async function toggleHistory(childId) {
    if (history.id === childId) {
      setHistory({ id: null, entries: [] });
      return;
    }
    const data = await api(`/api/children/${childId}/history`);
    setHistory({ id: childId, entries: data });
  }

  return (
    <div className="container" style={{ paddingBottom: 40 }}>
      {children.map((c) => (
        <div className="card" key={c.id}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <strong>{c.name}</strong>
              <div style={{ color: "#64748b" }}>
                Weekly: {currency(c.weekly_allowance)}
              </div>
            </div>
            <div className="balance">{currency(c.balance)}</div>
          </div>

          {/* Make Purchase */}
          {purchase.id === c.id ? (
            <form onSubmit={confirmPurchase} style={{ marginTop: 12 }}>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="Amount (e.g. 7.50)"
                value={purchase.amount}
                onChange={(e) =>
                  setPurchase({ ...purchase, amount: e.target.value })
                }
                required
              />
              <input
                placeholder="Note (optional)"
                value={purchase.note}
                onChange={(e) =>
                  setPurchase({ ...purchase, note: e.target.value })
                }
                style={{ marginTop: 8 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="submit">Confirm</button>
                <button
                  type="button"
                  onClick={cancelPurchase}
                  style={{ background: "#334155" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button style={{ marginTop: 12 }} onClick={() => startPurchase(c.id)}>
              Make Purchase
            </button>
          )}

          {/* Admin controls */}
          {admin && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {/* Edit weekly allowance */}
              {edit.id === c.id ? (
                <form onSubmit={confirmEdit} style={{ width: "100%" }}>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Weekly allowance"
                    value={edit.weekly}
                    onChange={(e) =>
                      setEdit({ ...edit, weekly: e.target.value })
                    }
                    required
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="submit">Save</button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      style={{ background: "#334155" }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => startEdit(c.id, c.weekly_allowance)}
                  style={{ background: "#6366f1" }}
                >
                  Edit Allowance
                </button>
              )}

              {/* Adjust (+/-) */}
              {adjust.id === c.id ? (
                <form onSubmit={confirmAdjust} style={{ width: "100%" }}>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Adjustment (+/-)"
                    value={adjust.amount}
                    onChange={(e) =>
                      setAdjust({ ...adjust, amount: e.target.value })
                    }
                    required
                  />
                  <input
                    placeholder="Note (optional)"
                    value={adjust.note}
                    onChange={(e) =>
                      setAdjust({ ...adjust, note: e.target.value })
                    }
                    style={{ marginTop: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="submit">Apply</button>
                    <button
                      type="button"
                      onClick={cancelAdjust}
                      style={{ background: "#334155" }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => startAdjust(c.id)}>Adjust Balance</button>
              )}

              {/* Delete */}
              <button
                onClick={() => handleDelete(c.id)}
                style={{ background: "#dc2626" }}
              >
                Delete Child
              </button>
            </div>
          )}

          {/* View / Hide History */}
          <button
            style={{ marginTop: 8, background: "#64748b" }}
            onClick={() => toggleHistory(c.id)}
          >
            {history.id === c.id ? "Hide History" : "View History"}
          </button>

          {/* History list */}
          {history.id === c.id && (
            <div
              style={{
                marginTop: 12,
                background: "#f1f5f9",
                borderRadius: 12,
                padding: 12,
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              {history.entries.length === 0 && (
                <div className="muted">No transactions yet</div>
              )}
              {history.entries.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "6px 0",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {tx.kind.charAt(0).toUpperCase() + tx.kind.slice(1)}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {new Date(tx.timestamp).toLocaleString()}
                    </div>
                    {tx.note && (
                      <div style={{ fontSize: 12, color: "#334155" }}>
                        {tx.note}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: (tx.amount ?? 0) >= 0 ? "#16a34a" : "#dc2626",
                      marginLeft: 12,
                      minWidth: 80,
                      textAlign: "right",
                    }}
                  >
                    {(tx.amount ?? 0) >= 0 ? "+" : ""}
                    {(tx.amount ?? 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Admin: Add Child panel */}
      {admin && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add Child</h3>
          <form onSubmit={addChild} style={{ display: "grid", gap: 8 }}>
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              placeholder="Weekly Allowance"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.weekly}
              onChange={(e) => setForm({ ...form, weekly: e.target.value })}
            />
            <input
              placeholder="Starting Balance (default 0)"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
            <button>Add</button>
          </form>
          <p className="muted" style={{ marginTop: 8 }}>
            Tip: Edit Allowance changes the weekly deposit for future Sundays.
            Use Adjust Balance for one-off corrections or bonuses.
          </p>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);