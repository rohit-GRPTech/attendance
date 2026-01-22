/* ================= MAP ================= */
const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: [73.4167, 18.0833],
  zoom: 14.8,
  pitch: 40,
  bearing: -10,
  antialias: true,
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

/* ================= STATE ================= */
let mode = "IDLE";
let moveTimer = null;
let pickupMarker = null;
let dropMarker = null;
const loader = document.getElementById("loader");
const rideStatus = document.getElementById("ride-status");
const etaValue = document.getElementById("eta");
const distanceValue = document.getElementById("distance");
const fareValue = document.getElementById("fare");
const pickupSelect = document.getElementById("pickup-select");
const dropSelect = document.getElementById("drop-select");
const loaderSub = document.getElementById("loader-sub");

/* ================= MATH ================= */
const toRad = (value) => (value * Math.PI) / 180;

function bearing(a, b) {
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function distance(a, b) {
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatKm(meters) {
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatMinutes(seconds) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function estimateFare(meters) {
  const base = 45;
  const perKm = 12;
  return `₹ ${(base + (meters / 1000) * perKm).toFixed(0)}`;
}

/* ================= LOAD ================= */
map.on("load", () => {
  map.getStyle().layers.forEach((layer) => {
    if (layer.type === "background") {
      map.setPaintProperty(layer.id, "background-color", "#F6F7F9");
    }

    if (layer.id.includes("water") && layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#CFE8F3");
    }

    if (layer.id.includes("park") && layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#DFF2E1");
    }

    if (layer["source-layer"] === "landuse" && layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#EFEFEF");
      map.setPaintProperty(layer.id, "fill-opacity", 0.9);
    }

    if (layer.type === "line") {
      if (layer.id.includes("motorway")) {
        map.setPaintProperty(layer.id, "line-color", "#F4C430");
      } else {
        map.setPaintProperty(layer.id, "line-color", "#FFFFFF");
      }
    }

    if (layer.id.includes("poi") || layer.id.includes("boundary")) {
      try {
        map.setLayoutProperty(layer.id, "visibility", "none");
      } catch (error) {
        // ignore layers that cannot be changed
      }
    }
  });

  map.loadImage("images/car.svg", (error, image) => {
    if (error) {
      alert("images/car.svg missing");
      return;
    }
    map.addImage("car-icon", image, { pixelRatio: 2 });
  });
});

/* ================= DEMO MODE ================= */
function bookRide() {
  mode = "DEMO";
  cleanup();
  loader.style.display = "flex";
  rideStatus.textContent = "Finding best route";
  loaderSub.textContent = "Matching with a nearby rider";
  document.getElementById("btn").innerText = "Cancel Ride";

  const pickupOption = pickupSelect.options[pickupSelect.selectedIndex];
  const dropOption = dropSelect.options[dropSelect.selectedIndex];
  const from = [Number(pickupOption.dataset.lng), Number(pickupOption.dataset.lat)];
  const to = [Number(dropOption.dataset.lng), Number(dropOption.dataset.lat)];

  fetch("api/book.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pickup_id: pickupSelect.value,
      drop_id: dropSelect.value,
    }),
  })
    .then((response) => response.json())
    .then((booking) => {
      if (booking.error) {
        loaderSub.textContent = booking.error;
        setTimeout(stopDemo, 1200);
        return;
      }

      loaderSub.textContent = `${booking.rider.name} assigned • ${booking.rider.vehicle_type}`;

      return fetch(
        `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`
      ).then((response) => response.json());
    })
    .then((data) => {
      if (!data || mode !== "DEMO") return;

      const coords = data.routes[0].geometry.coordinates;
      const routeDistance = data.routes[0].distance;
      const routeDuration = data.routes[0].duration;
      let i = 0;

      pickupMarker = createPin("pickup", from);
      dropMarker = createPin("drop", to);

      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: coords } },
      });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        paint: { "line-color": "#FFFFFF", "line-width": 9 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#1DBF73", "line-width": 6 },
      });

      map.addSource("car", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "car-layer",
        type: "symbol",
        source: "car",
        layout: {
          "icon-image": "car-icon",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.04, 14, 0.05, 16, 0.07, 18, 0.09],
          "icon-rotation-alignment": "map",
          "icon-rotate": ["get", "bearing"],
          "icon-allow-overlap": true,
        },
      });

      loader.style.display = "none";
      rideStatus.textContent = "Driver en route";
      etaValue.textContent = formatMinutes(routeDuration);
      distanceValue.textContent = formatKm(routeDistance);
      fareValue.textContent = estimateFare(routeDistance);

      function move() {
        if (i >= coords.length - 1 || mode !== "DEMO") {
          stopDemo();
          return;
        }

        const current = coords[i];
        const next = coords[i + 1];
        const meters = distance(current, next);
        const delay = clamp(meters * 6, 500, 1800);

        map.getSource("car").setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: current },
              properties: { bearing: bearing(current, next) },
            },
          ],
        });

        map.easeTo({ center: current, duration: delay });
        i += 1;
        moveTimer = setTimeout(move, delay);
      }
      move();
    });
}

function stopDemo() {
  document.getElementById("btn").innerText = "Book Nearest Rider";
  rideStatus.textContent = "Ready for pickup";
  cleanup();
}

/* ================= CLEANUP ================= */
function cleanup() {
  clearTimeout(moveTimer);
  ["car-layer", "route-line", "route-casing"].forEach((layer) => {
    if (map.getLayer(layer)) map.removeLayer(layer);
  });
  ["car", "route"].forEach((source) => {
    if (map.getSource(source)) map.removeSource(source);
  });
  if (pickupMarker) {
    pickupMarker.remove();
    pickupMarker = null;
  }
  if (dropMarker) {
    dropMarker.remove();
    dropMarker = null;
  }
}

/* ================= BUTTON ================= */
document.getElementById("btn").onclick = () => {
  mode === "DEMO" ? stopDemo() : bookRide();
};

/* ================= CUSTOM PIN ONLY ================= */
function createPin(type, coord) {
  const el = document.createElement("div");
  el.className = `maplibregl-marker custom-pin pin ${type}`;
  return new maplibregl.Marker(el, { anchor: "center" }).setLngLat(coord).addTo(map);
}

pickupSelect.addEventListener("change", () => stopDemo());
dropSelect.addEventListener("change", () => stopDemo());
