// ============================================================
// hooks/useStations.js — Stations data fetching
// ============================================================
import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore.js";
import { fetchNearbyStations, fetchEVStations } from "../utils/api.js";

export function useStations() {
  const { userLocation, filters, setStations, setEvStations, setIsLoading } =
    useStore();
  const abortRef = useRef(null);

  useEffect(() => {
    if (!userLocation) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const load = async () => {
      setIsLoading(true);
      try {
        const [stationsData, evData] = await Promise.allSettled([
          fetchNearbyStations({
            lat: userLocation.lat,
            lng: userLocation.lng,
            radius: filters.radius,
            fuel: "all",
            maxPrice: filters.maxPrice || undefined,
            onlyOpen: filters.onlyOpen,
          }),
          filters.showEV ?
            fetchEVStations({
              lat: userLocation.lat,
              lng: userLocation.lng,
              radius: filters.radius,
            })
          : Promise.resolve({ stations: [] }),
        ]);

        if (stationsData.status === "fulfilled") {
          setStations(stationsData.value.stations || []);
        }
        if (evData.status === "fulfilled") {
          setEvStations(evData.value.stations || []);
        }
      } catch (err) {
        if (err.name !== "AbortError")
          console.error("Fetch stations error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [
    userLocation,
    filters.fuel,
    filters.radius,
    filters.maxPrice,
    filters.onlyOpen,
    filters.showEV,
  ]);
}
