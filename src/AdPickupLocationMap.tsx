
import { useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type AdPickupLocationMapProps = {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (latitude: number, longitude: number) => void;
};

const pickupIcon = L.divIcon({
  className: "pickup-location-marker",
  html: `
    <div style="
      width: 30px;
      height: 30px;
      background: #dc2626;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,.35);
    "></div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function MapClickHandler({
  onLocationChange,
}: {
  onLocationChange: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onLocationChange(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export default function AdPickupLocationMap({
  latitude,
  longitude,
  onLocationChange,
}: AdPickupLocationMapProps) {
  const selectedPosition = useMemo<[number, number] | null>(() => {
    if (latitude === null || longitude === null) return null;
    return [latitude, longitude];
  }, [latitude, longitude]);

  const defaultCenter: [number, number] = [35, 38.5];
  const center = selectedPosition ?? defaultCenter;

  return (
    <div
      dir="ltr"
      style={{
        width: "100%",
        height: "380px",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #ddd",
      }}
    >
      <MapContainer
        center={center}
        zoom={selectedPosition ? 15 : 6}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onLocationChange={onLocationChange} />

        {selectedPosition && (
          <Marker
            position={selectedPosition}
            icon={pickupIcon}
            draggable
            eventHandlers={{
              dragend(event) {
                const position = event.target.getLatLng();
                onLocationChange(position.lat, position.lng);
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
