import { create } from "zustand";

export const useStore = create((set, get) => ({
  // --- User Location -------------------------------------------
  userLocation: null, // { lat, lng }
  locationError: null,
  locationLoading: false,

  setUserLocation: (loc) => set({ userLocation: loc, locationError: null }),
  setLocationError: (err) =>
    set({ locationError: err, locationLoading: false }),
  setLocationLoading: (v) => set({ locationLoading: v }),

  // --- Location Search (manuelle Eingabe) ----------------------
  searchInput: "", // Text im Suchfeld
  searchResults: [], // [{ lat, lng, name, type }] vom Geocoder
  searchLoading: false,

  setSearchInput: (val) => set({ searchInput: val }),
  setSearchResults: (results) =>
    set({ searchResults: results, searchLoading: false }),
  setSearchLoading: () => set({ searchResults: [], searchLoading: true }),
  clearSearch: () =>
    set({ searchInput: "", searchResults: [], searchLoading: false }),

  // --- Filters ------------------------------------------------
  filters: {
    fuel: "diesel", // 'e5'|'e10'|'diesel'|'lpg'|'all'
    radius: 10, // km
    maxPrice: null,
    onlyOpen: true,
    showEV: false,
  },
  setFilter: (key, val) =>
    set((s) => ({ filters: { ...s.filters, [key]: val } })),

  // --- Map State ----------------------------------------------
  mapCenter: [51.1657, 10.4515], // Deutschland-Mitte
  mapZoom: 6,
  selectedStation: null,

  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  setSelectedStation: (s) => set({ selectedStation: s }),

  // --- Stations -----------------------------------------------
  stations: [],
  evStations: [],
  isLoading: false,
  lastFetched: null,

  setStations: (stations) => set({ stations, lastFetched: Date.now() }),
  setEvStations: (evStations) => set({ evStations }),
  setIsLoading: (v) => set({ isLoading: v }),

  // --- UI -----------------------------------------------------
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
