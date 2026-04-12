// ============================================================
// App.jsx — Root layout
// ============================================================
import React from 'react';
import { useGeolocation } from './hooks/useGeolocation.js';
import { useStations } from './hooks/useStations.js';
import MapView from './components/MapView.jsx';
import Sidebar from './components/Sidebar.jsx';
import FilterBar from './components/FilterBar.jsx';
import Header from './components/Header.jsx';
import StationPopup from './components/StationPopup.jsx';
import { useStore } from './store/useStore.js';

export default function App() {
  useGeolocation();
  useStations();

  const sidebarOpen = useStore(s => s.sidebarOpen);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />
      <FilterBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <MapView />
        {sidebarOpen && <Sidebar />}
        <StationPopup />
      </div>
    </div>
  );
}
