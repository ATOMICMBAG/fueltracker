// ============================================================
// components/Sidebar.jsx — Sortierte Stationsliste
// ============================================================
import React, { useState } from "react";
import { useStore } from "../store/useStore.js";
import { priceColor, formatPrice, formatDist } from "../utils/api.js";

export default function Sidebar() {
  const {
    stations,
    evStations,
    filters,
    isLoading,
    selectedStation,
    setSelectedStation,
    userLocation,
  } = useStore((s) => ({
    stations: s.stations,
    evStations: s.evStations,
    filters: s.filters,
    isLoading: s.isLoading,
    selectedStation: s.selectedStation,
    setSelectedStation: s.setSelectedStation,
    userLocation: s.userLocation,
  }));

  const [tab, setTab] = useState("fuel"); // 'fuel' | 'ev'
  const fuelKey = filters.fuel === "all" ? "diesel" : filters.fuel;

  const sorted = [...stations].sort((a, b) => {
    const pa = a.prices?.[fuelKey] ?? Infinity;
    const pb = b.prices?.[fuelKey] ?? Infinity;
    return pa !== pb ? pa - pb : (a.dist || 0) - (b.dist || 0);
  });

  return (
    <div
      style={{
        width: 300,
        height: "99.5%",
        background: "var(--c-surface)",
        borderLeft: "1px solid var(--c-border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Tabs */}
      <div
        style={{ display: "flex", borderBottom: "1px solid var(--c-border)" }}
      >
        {[
          ["fuel", "⛽ Kraftstoff"],
          ["ev", "⚡ EV"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background: "transparent",
              color: tab === key ? "var(--c-accent)" : "var(--c-muted)",
              borderBottom:
                tab === key ?
                  "2px solid var(--c-accent)"
                : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {isLoading ?
          <LoadingList />
        : tab === "fuel" ?
          sorted.length ?
            sorted.map((s, i) => (
              <StationRow
                key={s.id}
                station={s}
                rank={i + 1}
                fuelKey={fuelKey}
                isSelected={selectedStation?.id === s.id}
                onClick={() => setSelectedStation(s)}
                isCheapest={i === 0}
              />
            ))
          : <EmptyState
              msg="Günstig Kraftstoff tanken in Deutschland, Österreich et la France"
              hint="GPS einschalten oder Suche Ort, Radius vergrößern oder Filter anpassen"
              msg2="Keine Tankstellen gefunden"
            />

        : evStations.length ?
          evStations.map((s) => (
            <EVRow
              key={s.id}
              station={s}
              isSelected={selectedStation?.id === s.id}
              onClick={() => setSelectedStation(s)}
            />
          ))
        : <EmptyState
            msg="Günstig Kraftstoff tanken in Deutschland, Österreich et la France"
            hint="GPS einschalten oder Suche Ort, Radius vergrößern oder EV-Filter aktivieren"
            msg2="Keine Tankstellen gefunden"
          />
        }
      </div>

      {/* Footer stats */}
      {tab === "fuel" && sorted.length > 0 && (
        <StatsFooter stations={sorted} fuelKey={fuelKey} />
      )}
    </div>
  );
}

function StationRow({
  station,
  rank,
  fuelKey,
  isSelected,
  onClick,
  isCheapest,
}) {
  const price = station.prices?.[fuelKey];
  const color = priceColor(price, fuelKey);

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px",
        cursor: "pointer",
        transition: "background 0.1s",
        background: isSelected ? "var(--c-surface2)" : "transparent",
        borderLeft:
          isSelected ? "3px solid var(--c-accent)" : "3px solid transparent",
        borderBottom: "1px solid var(--c-border)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--c-surface2)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background =
          isSelected ? "var(--c-surface2)" : "transparent")
      }
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 2,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--c-muted)",
                background: "var(--c-surface2)",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              #{rank}
            </span>
            {isCheapest && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--c-cheap)",
                  background: "rgba(34,197,94,0.1)",
                  borderRadius: 4,
                  padding: "1px 5px",
                }}
              >
                GÜNSTIGSTE
              </span>
            )}
          </div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {station.name || station.brand || "Tankstelle"}
          </div>
          <div style={{ fontSize: 12, color: "var(--c-muted)", marginTop: 2 }}>
            {[station.street, station.city].filter(Boolean).join(", ")}
          </div>
          <div
            style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}
          >
            {Object.entries(station.prices || {}).map(
              ([ft, p]) =>
                p && (
                  <span
                    key={ft}
                    style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background:
                        ft === fuelKey ?
                          `${priceColor(p, ft)}22`
                        : "var(--c-surface2)",
                      color:
                        ft === fuelKey ? priceColor(p, ft) : "var(--c-muted)",
                      fontWeight: ft === fuelKey ? 700 : 400,
                    }}
                  >
                    {ft.toUpperCase()} {p.toFixed(3)}
                  </span>
                ),
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color }}>
            {price ? price.toFixed(3) : "–"}
          </div>
          <div style={{ fontSize: 11, color: "var(--c-muted)" }}>€ / L</div>
          {station.dist && (
            <div
              style={{ fontSize: 11, color: "var(--c-muted)", marginTop: 4 }}
            >
              {formatDist(station.dist)}
            </div>
          )}
        </div>
      </div>
      {!station.isOpen && (
        <div style={{ fontSize: 11, color: "var(--c-danger)", marginTop: 4 }}>
          ● Geschlossen
        </div>
      )}
    </div>
  );
}

function EVRow({ station, isSelected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px",
        cursor: "pointer",
        borderBottom: "1px solid var(--c-border)",
        background: isSelected ? "var(--c-surface2)" : "transparent",
        borderLeft:
          isSelected ? "3px solid var(--c-ev)" : "3px solid transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{station.name}</div>
          <div style={{ fontSize: 12, color: "var(--c-muted)" }}>
            {station.operator || ""}
          </div>
          <div style={{ fontSize: 11, color: "var(--c-ev)", marginTop: 4 }}>
            {station.numPoints} Punkt(e) ·{" "}
            {station.maxKw ? `bis ${station.maxKw} kW` : ""}
          </div>
          <div style={{ fontSize: 11, color: "var(--c-muted)", marginTop: 2 }}>
            {station.connections
              ?.slice(0, 2)
              .map((c) => c.type)
              .join(", ")}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--c-ev)" }}>
            ⚡
          </div>
          {station.dist && (
            <div style={{ fontSize: 11, color: "var(--c-muted)" }}>
              {formatDist(station.dist)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsFooter({ stations, fuelKey }) {
  const prices = stations.map((s) => s.prices?.[fuelKey]).filter(Boolean);
  if (!prices.length) return null;
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = (((max - min) / min) * 100).toFixed(1);

  return (
    <div
      style={{
        padding: "10px 14px",
        borderTop: "1px solid var(--c-border)",
        background: "var(--c-surface2)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8,
      }}
    >
      {[
        { label: "Min", value: min.toFixed(3) + " €", color: "var(--c-cheap)" },
        { label: "Ø", value: avg.toFixed(3) + " €", color: "var(--c-warn)" },
        {
          label: "Max",
          value: max.toFixed(3) + " €",
          color: "var(--c-danger)",
        },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ textAlign: "center" }}>
          <div
            style={{ fontSize: 10, color: "var(--c-muted)", marginBottom: 2 }}
          >
            {label}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function LoadingList() {
  return (
    <div style={{ padding: 16 }}>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          style={{
            height: 72,
            marginBottom: 8,
            borderRadius: 8,
            background: "var(--c-surface2)",
            animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite alternate`,
          }}
        />
      ))}
      <style>{`@keyframes pulse { from { opacity: 0.4 } to { opacity: 0.8 } }`}</style>
    </div>
  );
}

function EmptyState({ msg, hint, msg2 }) {
  return (
    <div style={{ padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⛽</div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{msg}</div>
      <div style={{ fontSize: 12, color: "var(--c-muted)" }}>{hint}</div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{msg2}</div>
    </div>
  );
}
