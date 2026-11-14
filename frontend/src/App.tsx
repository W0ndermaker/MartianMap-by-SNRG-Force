// App shell. Panels and charts from other developers mount next to <MapView />.
import MapView from './map/MapView';

export default function App() {
  return (
    <main className="h-full w-full">
      <MapView />
    </main>
  );
}
