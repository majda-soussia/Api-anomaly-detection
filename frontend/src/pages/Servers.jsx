import { useState } from "react";
import { useMetricsSocket } from "../hooks/useSocket";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { SkeletonRow } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/StateViews";

function StatusBadge({ status, isAnomaly }) {
  if (isAnomaly)
    return (
      <Badge tone="critical" dot>
        Anomalie
      </Badge>
    );
  if (status === "healthy") return <Badge tone="success">Healthy</Badge>;
  return <Badge tone="warning">{status?.toUpperCase() || "Unknown"}</Badge>;
}

function AddServerModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Le nom du serveur est requis.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, environment }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Échec de la création du serveur");
      }
      onCreated?.(json.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-surface-raised, #fff)",
          borderRadius: 8,
          padding: "var(--space-6, 24px)",
          width: 360,
          maxWidth: "90vw",
        }}
      >
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Ajouter un serveur</h3>
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Nom du serveur
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Serveur 4"
            style={{
              width: "100%",
              padding: "8px 10px",
              marginBottom: 12,
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontSize: 13,
            }}
          />

          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Environnement
          </label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              marginBottom: 16,
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontSize: 13,
            }}
          >
            <option value="production">production</option>
            <option value="staging">staging</option>
            <option value="development">development</option>
          </select>

          {error && (
            <p style={{ color: "var(--color-critical, #d33)", fontSize: 12, marginBottom: 12 }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "none",
                background: "var(--color-primary, #2563eb)",
                color: "#fff",
                fontSize: 13,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Ajout..." : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Servers() {
  const { metrics } = useMetricsSocket();
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div>
      <div
        style={{
          marginBottom: "var(--space-6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>État des serveurs</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Snapshot en temps réel de chaque serveur surveillé.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-primary, #2563eb)",
            color: "#fff",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + Ajouter un serveur
        </button>
      </div>

      <Card style={{ overflow: "hidden" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr
              style={{
                textAlign: "left",
                background: "var(--bg-surface-raised)",
              }}
            >
              <Th>Serveur</Th>
              <Th>Statut</Th>
              <Th>Requêtes</Th>
              <Th>Latence (ms)</Th>
              <Th>Erreurs 5xx</Th>
              <Th>Score anomalie</Th>
            </tr>
          </thead>
          <tbody>
            {!metrics &&
              Array.from({ length: 4 }).map((_, i) => (
                <SkeletonRow key={i} columns={6} />
              ))}
            {metrics &&
              metrics.map((server) => (
                <tr
                  key={server.server_id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                    Serveur {server.server_id}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <StatusBadge
                      status={server.status}
                      isAnomaly={server.is_anomaly}
                    />
                  </td>
                  <td className="mono" style={{ padding: "10px 12px" }}>
                    {server.request_count}
                  </td>
                  <td className="mono" style={{ padding: "10px 12px" }}>
                    {server.avg_response_time?.toFixed(1)}
                  </td>
                  <td className="mono" style={{ padding: "10px 12px" }}>
                    {(server.error_rate_5xx * 100).toFixed(2)}%
                  </td>
                  <td className="mono" style={{ padding: "10px 12px" }}>
                    {server.anomaly_score?.toFixed(2)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {metrics && metrics.length === 0 && (
          <EmptyState
            title="Aucun serveur détecté"
            description="Vérifiez que le pipeline de métriques est actif."
          />
        )}
      </Card>

      {showAddModal && (
        <AddServerModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        padding: "10px 12px",
        fontSize: 11,
        color: "var(--text-tertiary)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {children}
    </th>
  );
}