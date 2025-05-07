import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';

import {
  Autocomplete,
  TextField,
  Paper,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
} from '@mui/material';

const userIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const incidentIcons = {
  accident: new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/565/565547.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  }),
  traffic: new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  }),
  police: new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  }),
  closure: new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/565/565486.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  }),
};

function LocationMarker({ position, icon, label }) {
  return position ? (
    <Marker position={position} icon={icon}>
      <Popup>{label}</Popup>
    </Marker>
  ) : null;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}min` : `${remainingMinutes}min`;
}

function HomePage() {
  const [userPosition, setUserPosition] = useState(null);
  const [startCoords, setStartCoords] = useState(null);
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [avoidTolls, setAvoidTolls] = useState(false);

  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [startOptions, setStartOptions] = useState([]);
  const [endOptions, setEndOptions] = useState([]);

  const defaultLocationOption = { label: 'Ma localisation', isLocation: true };

  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState('');
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setUserPosition(coords);
          setStartCoords(coords);
        },
        (err) => {
          console.error("Erreur géolocalisation :", err);
          setUserPosition([48.8566, 2.3522]);
        }
      );
    }
  }, []);

  const geocodeAddress = async (address) => {
    const apiKey = import.meta.env.VITE_ORS_API_KEY;
    const response = await axios.get('https://api.openrouteservice.org/geocode/search', {
      params: {
        api_key: apiKey,
        text: address,
        'boundary.country': 'FR',
      },
    });
    const coords = response.data.features[0].geometry.coordinates;
    return [coords[1], coords[0]];
  };

  const fetchAutocomplete = async (input, setOptions) => {
    if (input.length < 3) {
      setOptions([]);
      return;
    }
    try {
      const apiKey = import.meta.env.VITE_ORS_API_KEY;
      const res = await axios.get('https://api.openrouteservice.org/geocode/autocomplete', {
        params: {
          api_key: apiKey,
          text: input,
          size: 5,
          boundary_country: 'FR',
        },
      });
      const results = res.data.features.map((f, i) => ({
        label: f.properties.label,
        key: f.properties.id || `${f.properties.label}-${i}`
      }));
      setOptions(results);
    } catch (error) {
      console.error("Erreur autocomplete :", error);
    }
  };

  const calculateRoute = async () => {
    if (!startCoords || !destination) return;

    try {
      const destCoords = await geocodeAddress(destination);
      setDestinationCoords(destCoords);

      const apiKey = import.meta.env.VITE_ORS_API_KEY;
      const body = {
        coordinates: [
          [startCoords[1], startCoords[0]],
          [destCoords[1], destCoords[0]],
        ],
      };

      if (avoidTolls) {
        body.options = { avoid_features: ['tollways'] };
      }

      const response = await axios.post(
        `https://api.openrouteservice.org/v2/directions/driving-car/geojson`,
        body,
        {
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const geometry = response.data.features[0].geometry.coordinates.map(
        ([lng, lat]) => [lat, lng]
      );
      setRoute(geometry);

      const summary = response.data.features[0].properties.summary;
      setRouteInfo({
        distance: summary.distance,
        duration: summary.duration,
      });
    } catch (error) {
      console.error("Erreur calcul itinéraire :", error);
    }
  };

  const handleAddIncident = () => {
    if (!userPosition || !selectedIncident) return;
    const newIncident = {
      type: selectedIncident,
      position: userPosition,
    };
    setIncidents((prev) => [...prev, newIncident]);
    setIncidentDialogOpen(false);
    setSelectedIncident('');
  };

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <Paper elevation={3} sx={{ position: 'absolute', zIndex: 1000, top: 10, left: 55, padding: 3, width: 300 }}>
        <Stack spacing={2}>
          <Autocomplete
            options={[defaultLocationOption, ...startOptions]}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(o, v) => o.label === v.label}
            renderOption={(props, option) => (
              <li {...props} key={option.key || option.label}>{option.label}</li>
            )}
            inputValue={startInput}
            onInputChange={(e, val) => {
              setStartInput(val);
              if (val.length >= 3) {
                fetchAutocomplete(val, setStartOptions);
              } else {
                setStartOptions([]);
              }
            }}
            onChange={async (e, val) => {
              if (val?.isLocation) {
                setStartCoords(userPosition);
              } else if (val?.label) {
                const coords = await geocodeAddress(val.label);
                setStartCoords(coords);
              }
            }}
            filterOptions={(options) => options}
            renderInput={(params) => (
              <TextField {...params} label="Lieu de départ" size="small" />
            )}
          />

          <Autocomplete
            options={endOptions}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(o, v) => o.label === v.label}
            renderOption={(props, option) => (
              <li {...props} key={option.key || option.label}>{option.label}</li>
            )}
            inputValue={endInput}
            onInputChange={(e, val) => {
              setEndInput(val);
              fetchAutocomplete(val, setEndOptions);
            }}
            onChange={(e, val) => {
              if (val?.label) {
                setDestination(val.label);
              }
            }}
            renderInput={(params) => (
              <TextField {...params} label="Lieu de destination" size="small" />
            )}
          />

          <FormControlLabel
            control={<Checkbox checked={avoidTolls} onChange={(e) => setAvoidTolls(e.target.checked)} />}
            label="Éviter les péages"
          />

          <Button variant="contained" onClick={calculateRoute}>Calculer</Button>

          <Button
            variant="outlined"
            color="error"
            onClick={() => setIncidentDialogOpen(true)}
          >
            Signaler un incident
          </Button>

          {routeInfo && (
            <Typography variant="body2">
              <strong>Distance :</strong> {(routeInfo.distance / 1000).toFixed(2)} km<br />
              <strong>Durée :</strong> {formatDuration(routeInfo.duration)}
            </Typography>
          )}
        </Stack>
      </Paper>

      <Dialog open={incidentDialogOpen} onClose={() => setIncidentDialogOpen(false)}>
        <DialogTitle>Type d'incident</DialogTitle>
        <DialogContent>
          <Select
            fullWidth
            value={selectedIncident}
            onChange={(e) => setSelectedIncident(e.target.value)}
          >
            <MenuItem value="accident">🚗 Accident</MenuItem>
            <MenuItem value="traffic">🚦 Embouteillage</MenuItem>
            <MenuItem value="police">👮 Contrôle policier</MenuItem>
            <MenuItem value="closure">🚧 Route fermée</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIncidentDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleAddIncident}>Confirmer</Button>
        </DialogActions>
      </Dialog>

      <MapContainer center={userPosition || [46.603354, 1.888334]} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
        />
        <LocationMarker position={userPosition} icon={userIcon} label="📍 Vous êtes ici" />
        <LocationMarker position={destinationCoords} icon={destinationIcon} label="Destination" />
        {startCoords && <LocationMarker position={startCoords} icon={userIcon} label="Départ" />}
        {route && <Polyline positions={route} color="blue" />}

        {incidents.map((incident, i) => (
          <Marker key={i} position={incident.position} icon={incidentIcons[incident.type]}>
            <Popup>🚨 {incident.type}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default HomePage;
