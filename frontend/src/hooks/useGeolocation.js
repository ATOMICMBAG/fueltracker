// ============================================================
// hooks/useGeolocation.js — Browser GPS hook
// ============================================================
import { useEffect } from "react";
import { useStore } from "../store/useStore.js";

export function useGeolocation() {
  const { setUserLocation, setLocationError, setLocationLoading } = useStore();

  const locate = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation nicht verfügbar");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationLoading(false);
      },
      (err) => {
        const msgs = {
          1: "Aktiviere GPS",
          2: "Suche GPS",
          3: "Kein GPS",
        };
        setLocationError(msgs[err.code] || "Unbekannter Fehler");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  // Auto-locate on first load
  useEffect(() => {
    locate();
  }, []);

  return { locate };
}
