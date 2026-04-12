// ============================================================
// components/FilterBar.jsx — Kraftstoff + Radius + Optionen
// ============================================================
import React from "react";
import { useStore } from "../store/useStore.js";

const FUELS = [
  { key: "diesel", label: "Diesel", color: "#333333" },
  { key: "e10", label: "E10", color: "#333333" },
  { key: "e5", label: "E5", color: "#333333" },
  { key: "lpg", label: "LPG", color: "#333333" },
  { key: "all", label: "Alle", color: "#333333" },
];

const RADII = [3, 5, 10, 20, 35, 50];

export default function FilterBar() {
  const { filters, setFilter, isLoading, stations } = useStore((s) => ({
    filters: s.filters,
    setFilter: s.setFilter,
    isLoading: s.isLoading,
    stations: s.stations,
  }));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "4px 8px",
        background: "var(--c-surface)",
        borderBottom: "1px solid var(--c-border)",
        flexShrink: 0,
        overflowX: "auto",
        flexWrap: "wrap",
      }}
    >
      {/* Fuel type pills */}
      <div style={{ display: "flex", gap: 6 }}>
        {FUELS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter("fuel", f.key)}
            style={{
              padding: "2px 6px",
              borderRadius: 3,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              background:
                filters.fuel === f.key ? f.color : "var(--c-surface2)",
              color: filters.fuel === f.key ? "#fff" : "var(--c-muted)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        <input
          type="checkbox"
          checked={filters.showEV}
          onChange={(e) => setFilter("showEV", e.target.checked)}
          style={{ accentColor: "var(--c-ev)" }}
        />
        <span style={{ color: "var(--c-muted)" }}>EV-Ladesäulen</span>
      </label>

      {/* Radius */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--c-muted)" }}>| Radius</span>
        <select
          value={filters.radius}
          onChange={(e) => setFilter("radius", parseInt(e.target.value))}
          style={{
            background: "var(--c-surface2)",
            border: "1px solid var(--c-border)",
            color: "var(--c-text)",
            borderRadius: 3,
            padding: "2px 4px",
            fontSize: 13,
          }}
        >
          {RADII.map((r) => (
            <option key={r} value={r}>
              {r} km
            </option>
          ))}
        </select>
      </div>

      {/* Max price */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--c-muted)" }}>| Max €</span>
        <input
          type="number"
          step="0.01"
          min="0.5"
          max="4"
          placeholder="z.B. 1.80"
          value={filters.maxPrice || ""}
          onChange={(e) =>
            setFilter(
              "maxPrice",
              e.target.value ? parseFloat(e.target.value) : null,
            )
          }
          style={{
            width: 80,
            background: "var(--c-surface2)",
            border: "1px solid var(--c-border)",
            color: "var(--c-text)",
            borderRadius: 3,
            padding: "2px 4px",
            fontSize: 13,
          }}
        />
      </div>

      {/* Status */}
      <div
        style={{
          marginLeft: "auto",
          fontSize: 12,
          color: "var(--c-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {isLoading ?
          "| ⏳ Bitte Warten …"
        : `| ${stations.length} Tankstelle${stations.length !== 1 ? "n" : ""}`}
        {/* Toggles */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          |
          <input
            type="checkbox"
            checked={filters.onlyOpen}
            onChange={(e) => setFilter("onlyOpen", e.target.checked)}
            style={{ accentColor: "var(--c-accent)" }}
          />
          <span style={{ color: "var(--c-muted)" }}>Geöffnet</span>
        </label>
      </div>
    </div>
  );
}
