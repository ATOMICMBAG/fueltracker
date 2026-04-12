import React, { useState, useRef, useEffect } from "react";
import { useStore } from "../store/useStore.js";

const styles = {
  wrapper: {
    position: "relative",
    width: "100%",
  },
  inputRow: {
    display: "flex",
    gap: 6,
    width: "100%",
  },
  searchInput: {
    flex: 1,
    padding: "8px 12px",
    border: "1px solid var(--c-border, #ccc)",
    borderRadius: 8,
    fontSize: 14,
    background: "var(--c-surface, #fff)",
    color: "var(--c-text, #222)",
    outline: "none",
  },
  searchBtn: {
    padding: "8px 14px",
    background: "var(--c-accent, #3b82f6)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  coordsInput: {
    padding: "8px 10px",
    border: "1px solid var(--c-border, #ccc)",
    borderRadius: 8,
    fontSize: 13,
    background: "var(--c-surface, #fff)",
    color: "var(--c-text, #222)",
    outline: "none",
    width: 90,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    background: "var(--c-surface, #fff)",
    border: "1px solid var(--c-border, #ccc)",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    maxHeight: 250,
    overflowY: "auto",
    zIndex: 1000,
  },
  resultItem: {
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: "1px solid var(--c-border, #eee)",
    fontSize: 13,
  },
  resultName: {
    fontWeight: 600,
    marginBottom: 2,
  },
  resultDetail: {
    color: "var(--c-muted, #888)",
    fontSize: 12,
  },
  loading: {
    padding: "12px",
    textAlign: "center",
    color: "var(--c-muted, #888)",
    fontSize: 13,
  },
  noResults: {
    padding: "12px",
    textAlign: "center",
    color: "var(--c-muted, #888)",
    fontSize: 13,
  },
};

// Nominatim Geocoding (OpenStreetMap, kostenlos)
async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "de" },
  });
  if (!res.ok) throw new Error("Geocoding fehlgeschlagen");
  const data = await res.json();
  return data.map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    name: item.display_name.split(",").slice(0, 2).join(","),
    detail: item.display_name.split(",").slice(2, 4).join(","),
    type: item.type,
  }));
}

export default function LocationSearch() {
  const {
    searchInput,
    searchResults,
    searchLoading,
    setSearchInput,
    setSearchResults,
    setSearchLoading,
    setUserLocation,
    setMapCenter,
    setLocationError,
  } = useStore();

  const [showDropdown, setShowDropdown] = useState(false);
  const [coordInput, setCoordInput] = useState("");
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Klick außerhalb schließt Dropdown
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearchLoading();
    setShowDropdown(true);

    try {
      const results = await geocodeAddress(query);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchResults([]);
      }
    } catch (err) {
      setLocationError("Suche fehlgeschlagen: " + err.message);
      setSearchResults([]);
    }
  };

  const handleInputChange = (val) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val), 400);
  };

  const handleSelect = (result) => {
    setUserLocation({ lat: result.lat, lng: result.lng });
    setMapCenter([result.lat, result.lng]);
    setShowDropdown(false);
    setSearchInput(result.name);
  };

  const handleCoordsSubmit = () => {
    // Koordinaten parsen: "lat, lng" oder "lat lng"
    const parts = coordInput
      .replace(/[^\d.,-]/g, ",")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number);

    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (parts[0] < -90 || parts[0] > 90) {
        setLocationError("Breitengrad muss zwischen -90 und 90 liegen");
        return;
      }
      if (parts[1] < -180 || parts[1] > 180) {
        setLocationError("Längengrad muss zwischen -180 und 180 liegen");
        return;
      }
      setUserLocation({ lat: parts[0], lng: parts[1] });
      setMapCenter([parts[0], parts[1]]);
      setLocationError(null);
    } else {
      setLocationError(
        "Ungültige Koordinaten. Format: 52.52, 13.40 (Breitengrad, Längengrad)",
      );
    }
  };

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      <div style={styles.inputRow}>
        <input
          type="text"
          placeholder="PLZ, Stadt, Adresse eingeben..."
          value={searchInput}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          style={styles.searchInput}
        />
        <button
          onClick={() => handleSearch(searchInput)}
          disabled={searchLoading}
          style={{
            ...styles.searchBtn,
            opacity: searchLoading ? 0.6 : 1,
          }}
        >
          {searchLoading ? "..." : "Suche"}
        </button>
      </div>

      <div
        style={{
          ...styles.inputRow,
          marginTop: 6,
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="oder Koordinaten: 52.52, 13.40"
          value={coordInput}
          onChange={(e) => setCoordInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCoordsSubmit()}
          style={{ ...styles.coordsInput, flex: 1 }}
        />
        <button onClick={handleCoordsSubmit} style={styles.searchBtn}>
          Go
        </button>
      </div>

      {showDropdown && searchLoading && (
        <div style={styles.dropdown}>
          <div style={styles.loading}>Suche...</div>
        </div>
      )}

      {showDropdown && searchResults.length > 0 && !searchLoading && (
        <div style={styles.dropdown}>
          {searchResults.map((r, i) => (
            <div
              key={i}
              style={styles.resultItem}
              onClick={() => handleSelect(r)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--c-hover, #f0f0f0)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div style={styles.resultName}>{r.name}</div>
              <div style={styles.resultDetail}>{r.detail}</div>
            </div>
          ))}
        </div>
      )}

      {showDropdown &&
        searchResults.length === 0 &&
        !searchLoading &&
        searchInput.length >= 2 && (
          <div style={styles.dropdown}>
            <div style={styles.noResults}>
              Keine Ergebnisse für "{searchInput}"
            </div>
          </div>
        )}
    </div>
  );
}
