import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board";

const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const NULL_ISLAND = leaflet.latLng({
  lat: 0,
  lng: 0,
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
  center: NULL_ISLAND,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      // eslint-disable-next-line @typescript-eslint/quotes
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

let selectedPit: {
  cache: GeoCoin[];
  container: HTMLDivElement;
  coordinate: { lat: number; lng: number };
} | null = null;
const playerMarker = leaflet.marker(NULL_ISLAND);
const playerContainer = document.createElement("div");
playerContainer.addEventListener("click", (e) => {
  if (e.target instanceof HTMLButtonElement) {
    const regex = /(-?\d+)/g;
    const result = e.target.id.match(regex);

    // Convert the matched strings to numbers
    const numbers = result!.map((match) => parseInt(match, 10));

    const [lat, lng, serial] = numbers;
    totalCoins--;
    // remove coin and add it to player inventory
    const foundCoin = getCoin(playerCoins, {
      lat: lat,
      lng: lng,
      serial: serial,
    } as GeoCoin);
    selectedPit!.cache.push(
      playerCoins.splice(playerCoins.indexOf(foundCoin!), 1)[0]
    );
    statusPanel.innerHTML = `${totalCoins} total GeoCoin(s)`;
    updateGeoCoinCache(
      selectedPit!.cache,
      selectedPit!.container,
      selectedPit!.coordinate
    );
    updatePlayerCache(playerCoins, playerContainer);
  }
  e.stopPropagation();
  e.preventDefault();
  return false;
});
playerMarker.bindTooltip("That's you!");
playerMarker.bindPopup(
  () => {
    updatePlayerCache(playerCoins, playerContainer);
    return playerContainer;
  },
  { closeOnClick: false, autoClose: false }
);
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
    renderPits(playerMarker.getLatLng());
  });
});

const reset = document.querySelector("#north")!;
reset.addEventListener("click", () => {
  playerMarker.setLatLng(leaflet.latLng(0, 0));
  map.setView(playerMarker.getLatLng());
  renderPits(playerMarker.getLatLng());
});

interface GeoCoin {
  lat: number;
  lng: number;
  serial: number;
}

function getCoin(coinCache: GeoCoin[], coinData: GeoCoin): GeoCoin | undefined {
  for (const coin of coinCache) {
    if (
      coin.lat == coinData.lat &&
      coin.lng == coinData.lng &&
      coin.serial == coinData.serial
    ) {
      return coin;
    }
  }
  return undefined;
}

let totalCoins = 0;
const playerCoins: GeoCoin[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

const worldMap = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

function makePit(i: number, j: number, originLocation: leaflet.LatLng) {
  const bounds = leaflet.latLngBounds([
    [
      originLocation.lat + i * TILE_DEGREES,
      originLocation.lng + j * TILE_DEGREES,
    ],
    [
      originLocation.lat + (i + 1) * TILE_DEGREES,
      originLocation.lng + (j + 1) * TILE_DEGREES,
    ],
  ]);

  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  const startingCoins = Math.floor(
    Math.floor(luck([i, j, "initialValue"].toString()) * 100) / 15
  );

  const coordinate = {
    lat: Math.floor(bounds.getCenter().lat / TILE_DEGREES),
    lng: Math.floor(bounds.getCenter().lng / TILE_DEGREES),
  };
  const geoCoinCache: GeoCoin[] = [];
  for (let k = 0; k < startingCoins; k++) {
    geoCoinCache.push({
      lat: coordinate.lat,
      lng: coordinate.lng,
      serial: k,
    });
  }

  const tip = pit.bindTooltip(`Pit: ${coordinate.lat},${coordinate.lng}`);

  pit.bindPopup(() => {
    tip.closeTooltip();
    const container = document.createElement("div");
    selectedPit = {
      cache: geoCoinCache,
      container: container,
      coordinate: coordinate,
    };
    updatePlayerCache(playerCoins, playerContainer);
    updateGeoCoinCache(geoCoinCache, container, coordinate);
    container.addEventListener("click", (e) => {
      if (e.target instanceof HTMLButtonElement) {
        const regex = /(-?\d+)/g;
        const result = e.target.id.match(regex);

        // Convert the matched strings to numbers
        const numbers = result!.map((match) => parseInt(match, 10));

        const [lat, lng, serial] = numbers;
        totalCoins++;
        // remove coin and add it to player inventory
        const foundCoin = getCoin(geoCoinCache, {
          lat: lat,
          lng: lng,
          serial: serial,
        } as GeoCoin);
        playerCoins.push(
          geoCoinCache.splice(geoCoinCache.indexOf(foundCoin!), 1)[0]
        );
        statusPanel.innerHTML = `${totalCoins} total GeoCoin(s)`;
        updateGeoCoinCache(geoCoinCache, container, coordinate);
        updatePlayerCache(playerCoins, playerContainer);
      }
      e.stopPropagation();
      e.preventDefault();
      return false;
    });
    return container;
  });
  pit.getPopup()!.on("remove", () => {
    selectedPit = null;
    updatePlayerCache(playerCoins, playerContainer);
  });
  pit.addTo(map);
}

function updateGeoCoinCache(
  geoCoinCache: GeoCoin[],
  container: HTMLDivElement,
  coordinate: { lat: number; lng: number }
) {
  container.innerHTML = `<div>There is a pit here at "${coordinate.lat}, ${coordinate.lng}". It has <span id="coinAmount">${geoCoinCache.length}</span> coins.</div>`;
  geoCoinCache.forEach((coin) => {
    container.innerHTML += `<div>GeoCoin | ${coin.lat}:${coin.lng}#${coin.serial} <button id="collectLat${coin.lat}Lng${coin.lng}S${coin.serial}">Collect</button></div>`;
  });
}

function updatePlayerCache(coinCache: GeoCoin[], container: HTMLDivElement) {
  container.innerHTML = `<div>You have <span id="coinAmount">${coinCache.length}</span> coins.</div>`;
  coinCache.forEach((coin) => {
    if (selectedPit) {
      container.innerHTML += `<div>GeoCoin | ${coin.lat}:${coin.lng}#${coin.serial} <button id="depositLat${coin.lat}Lng${coin.lng}S${coin.serial}">Deposit</button></div>`;
    } else {
      container.innerHTML += `<div>GeoCoin | ${coin.lat}:${coin.lng}#${coin.serial}</div>`;
    }
  });
}

function createCell(i: number, j: number, originLocation: leaflet.LatLng) {
  const pitCell = worldMap.getCellForPoint(
    leaflet.latLng({
      lat: originLocation.lat + i * TILE_DEGREES,
      lng: originLocation.lng + j * TILE_DEGREES,
    })
  );
  if (pitCell) {
    return;
  }
  makePit(i, j, originLocation);
  worldMap.setCellForPoint({
    i: originLocation.lat + i * TILE_DEGREES,
    j: originLocation.lng + j * TILE_DEGREES,
  });
}

function renderPits(location: leaflet.LatLng) {
  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      if (
        luck([i + location.lat, j + location.lng].toString()) <
        PIT_SPAWN_PROBABILITY
      ) {
        createCell(i, j, location);
      }
    }
  }
  worldMap.check();
}

renderPits(NULL_ISLAND);
