import React, { useState } from "react";
import { useStore } from "../store/useStore.js";
import LocationSearch from "./LocationSearch.jsx";

const s = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    height: 52,
    background: "var(--c-surface)",
    borderBottom: "1px solid var(--c-border)",
    flexShrink: 0,
    zIndex: 100,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 700,
    fontSize: 17,
    letterSpacing: "-0.3px",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "var(--c-accent2)",
  },
  locBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 6px",
    background: "transparent",
    border: "1px solid var(--c-border)",
    borderRadius: 3,
    color: "var(--c-muted)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  sideBtn: {
    padding: "3px 6px",
    background: "transparent",
    border: "1px solid var(--c-border)",
    borderRadius: 3,
    color: "var(--c-muted)",
    fontSize: 13,
    cursor: "pointer",
  },
  status: { fontSize: 12, color: "var(--c-muted)" },
  locDot: {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    marginRight: 5,
  },
  searchToggle: {
    padding: "3px 6px",
    background: "transparent",
    border: "1px solid var(--c-border)",
    borderRadius: 3,
    color: "var(--c-muted)",
    fontSize: 13,
    cursor: "pointer",
    marginRight: 6,
  },
  rightSection: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  searchContainer: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    padding: "3px 6px",
    background: "var(--c-surface)",
    borderBottom: "1px solid var(--c-border)",
    zIndex: 99,
  },
};

export default function Header() {
  const {
    userLocation,
    locationError,
    locationLoading,
    toggleSidebar,
    sidebarOpen,
  } = useStore((s) => ({
    userLocation: s.userLocation,
    locationError: s.locationError,
    locationLoading: s.locationLoading,
    toggleSidebar: s.toggleSidebar,
    sidebarOpen: s.sidebarOpen,
  }));

  const [showSearch, setShowSearch] = useState(false);

  const statusColor =
    locationError ? "var(--c-danger)"
    : userLocation ? "var(--c-cheap)"
    : "var(--c-warn)";
  const statusText =
    locationError ? locationError
    : locationLoading ? "Ortung..."
    : userLocation ?
      `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
    : "Kein Standort";

  // GPS Orten
  const handleLocate = () => {
    if (!navigator.geolocation) {
      useStore.getState().setLocationError("nicht verf\u00fcgbar");
      return;
    }
    useStore.getState().setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        useStore.getState().setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => {
        const msgs = {
          1: "Aktiviere GPS",
          2: "Suche GPS",
          3: "Kein GPS",
        };
        useStore
          .getState()
          .setLocationError(msgs[err.code] || "Fehler bei Ortung");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <>
      <header style={s.header}>
        <div style={s.logo}>
          <div />
          maazi.de
        </div>

        <button
          style={s.locBtn}
          onClick={handleLocate}
          title="GPS-Standort ermitteln"
        >
          GPS
          <div style={s.status}>
            <span style={{ ...s.locDot, background: statusColor }} />
            {statusText}
          </div>
        </button>

        <div style={s.rightSection}>
          <button
            style={{
              ...s.searchToggle,
              background: showSearch ? "var(--c-accent)" : "transparent",
              color: showSearch ? "#fff" : "var(--c-muted)",
              border: showSearch ? "1px solid var(--c-accent)" : "",
            }}
            onClick={() => setShowSearch(!showSearch)}
            title="Adresse oder Koordinaten eingeben"
          >
            Suche
          </button>
          <button style={s.sideBtn} onClick={toggleSidebar}>
            {sidebarOpen ? "Map" : "Detail"}
          </button>
        </div>
      </header>
      {showSearch && (
        <div style={s.searchContainer}>
          <LocationSearch />
        </div>
      )}
    </>
  );
}
