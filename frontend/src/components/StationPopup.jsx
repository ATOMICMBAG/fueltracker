// ============================================================
// components/StationPopup.jsx — Detail-Overlay wenn Station gewählt
// ============================================================
import React from 'react';
import { useStore } from '../store/useStore.js';
import { priceColor, formatDist } from '../utils/api.js';

export default function StationPopup() {
  const { selectedStation, setSelectedStation, userLocation } = useStore(s => ({
    selectedStation: s.selectedStation,
    setSelectedStation: s.setSelectedStation,
    userLocation: s.userLocation,
  }));

  if (!selectedStation) return null;
  const s = selectedStation;
  const isEV = s.type === 'ev';

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}${
    userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : ''
  }&travelmode=driving`;

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      width: 380, maxWidth: 'calc(100vw - 32px)',
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      zIndex: 999, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 18 }}>{isEV ? '⚡' : '⛽'}</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{s.name || s.brand || 'Tankstelle'}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
            {[s.street, s.city, s.postcode].filter(Boolean).join(' · ')}
          </div>
          {s.dist && (
            <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>
              📍 {formatDist(s.dist)} entfernt
            </div>
          )}
        </div>
        <button
          onClick={() => setSelectedStation(null)}
          style={{
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            borderRadius: 6, color: 'var(--c-muted)', padding: '4px 9px', fontSize: 16, cursor: 'pointer',
          }}
        >✕</button>
      </div>

      {/* Prices */}
      <div style={{ padding: '14px 16px' }}>
        {isEV ? (
          <EVDetails station={s} />
        ) : (
          <FuelPrices station={s} />
        )}
      </div>

      {/* Actions */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid var(--c-border)',
        display: 'flex', gap: 10,
      }}>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 8,
            background: 'var(--c-accent)', color: '#fff', fontWeight: 600,
            fontSize: 13, textDecoration: 'none',
          }}
        >
          🗺 Route in Google Maps
        </a>
        <a
          href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}&zoom=16`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '9px 14px', borderRadius: 8,
            border: '1px solid var(--c-border)', color: 'var(--c-muted)',
            fontSize: 13, textDecoration: 'none',
          }}
        >
          OSM
        </a>
      </div>

      {/* Source badge */}
      <div style={{ padding: '4px 16px 10px', fontSize: 11, color: 'var(--c-muted)' }}>
        Quelle: {sourceLabel(s.source)}
        {s._fromCache && ' · ⚠ Gecachte Daten'}
      </div>
    </div>
  );
}

function FuelPrices({ station }) {
  const FUEL_LABELS = { e5: 'Super E5', e10: 'Super E10', diesel: 'Diesel', lpg: 'LPG / Autogas', adblue: 'AdBlue' };
  const prices = Object.entries(station.prices || {}).filter(([, v]) => v != null);

  if (!prices.length) {
    return <div style={{ color: 'var(--c-muted)', fontSize: 13 }}>Keine aktuellen Preise verfügbar</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {prices.map(([fuel, price]) => (
        <div key={fuel} style={{
          background: 'var(--c-surface2)', borderRadius: 10, padding: '10px 14px',
          borderLeft: `3px solid ${priceColor(price, fuel)}`,
        }}>
          <div style={{ fontSize: 11, color: 'var(--c-muted)', marginBottom: 2 }}>
            {FUEL_LABELS[fuel] || fuel.toUpperCase()}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: priceColor(price, fuel) }}>
            {price.toFixed(3)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>€ pro Liter</div>
        </div>
      ))}
    </div>
  );
}

function EVDetails({ station }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'Max. Leistung', value: station.maxKw ? `${station.maxKw} kW` : '–', color: 'var(--c-ev)' },
          { label: 'Ladepunkte',    value: station.numPoints || '–',                     color: 'var(--c-ev)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--c-surface2)', borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, color: 'var(--c-muted)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>
      {station.connections?.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 6 }}>Steckertypen</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {station.connections.map((c, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 6,
                background: 'rgba(167,139,250,0.15)', color: 'var(--c-ev)',
              }}>
                {c.type}{c.kw ? ` · ${c.kw} kW` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {station.pricing && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--c-muted)' }}>
          💰 Tarif: {station.pricing}
        </div>
      )}
    </div>
  );
}

function sourceLabel(source) {
  const labels = {
    tankerkoening:     'Tankerkönig (DE, Live)',
    econtrol:          'E-Control (AT, Live)',
    prix_carburants_fr:'prix-carburants.gouv.fr (FR)',
    mylpg:             'mylpg.eu',
    ocm:               'Open Charge Map',
    last_known_db:     'Lokale Datenbank',
    osm:               'OpenStreetMap',
  };
  return labels[source] || source || 'Unbekannt';
}
