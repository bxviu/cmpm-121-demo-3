import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { LatLng, latLng } from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board";

const NULL_ISLAND = latLng({
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
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
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
    localStorage.setItem("playerCoins", JSON.stringify(playerCoins));
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
playerMarker.bindTooltip(() => {
  return `At: ${Math.round(
    playerMarker.getLatLng().lat / TILE_DEGREES
  )}, ${Math.round(playerMarker.getLatLng().lng / TILE_DEGREES)}`;
});
playerMarker.bindPopup(
  () => {
    updatePlayerCache(playerCoins, playerContainer);
    return playerContainer;
  },
  { closeOnClick: false, autoClose: false }
);
playerMarker.addTo(map);

let watchID = 0;
const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  watchID = navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      latLng(position.coords.latitude, position.coords.longitude)
    );
    redrawMap();
  });
});

const moveUp = document.querySelector("#north")!;
addMovementClickEvent(moveUp, TILE_DEGREES, 0);

const moveDown = document.querySelector("#south")!;
addMovementClickEvent(moveDown, -TILE_DEGREES, 0);

const moveLeft = document.querySelector("#west")!;
addMovementClickEvent(moveLeft, 0, -TILE_DEGREES);

const moveRight = document.querySelector("#east")!;
addMovementClickEvent(moveRight, 0, TILE_DEGREES);

const reset = document.querySelector("#reset")!;
reset.addEventListener("click", () => {
  // playerMarker.setLatLng(latLng(0, 0));
  navigator.geolocation.clearWatch(watchID);
  playerCoins.splice(0, playerCoins.length);
  playerHistory.splice(0, playerHistory.length);
  momentoStorage.clear();
  localStorage.clear();
  worldMap.clearKnownCells();
  renderedCaches.splice(0, renderedCaches.length);
  redrawMap();
});

function addMovementClickEvent(
  button: Element,
  deltaLat: number,
  deltaLng: number
) {
  button.addEventListener("click", () => {
    playerMarker.setLatLng(
      latLng(
        playerMarker.getLatLng().lat + deltaLat,
        playerMarker.getLatLng().lng + deltaLng
      )
    );
    redrawMap();
  });
}

const renderedCaches: Geocache[] = [];

function redrawMap() {
  map.eachLayer((layer) => {
    if (
      layer instanceof leaflet.Rectangle ||
      layer instanceof leaflet.Polyline
    ) {
      map.removeLayer(layer);
    }
  });
  renderedCaches.forEach((geoCache) => {
    const key = [geoCache.lat, geoCache.lng].toString();
    momentoStorage.set(key, geoCache.toMomento());
    localStorage.setItem(key, geoCache.toMomento());
  });
  renderedCaches.splice(0, renderedCaches.length);
  playerHistory.push(playerMarker.getLatLng());
  leaflet.polyline(playerHistory, { color: "red" }).addTo(map);
  map.setView(playerMarker.getLatLng());
  renderPits(playerMarker.getLatLng());
}

interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

const momentoStorage: Map<string, string> = new Map<string, string>();

class Geocache implements Momento<string> {
  lat: number;
  lng: number;
  coins: GeoCoin[];
  constructor(point: leaflet.LatLng) {
    this.lat = point.lat;
    this.lng = point.lng;
    this.coins = [];
  }
  toMomento() {
    return JSON.stringify(this.coins);
  }

  fromMomento(momento: string) {
    this.coins = JSON.parse(momento) as GeoCoin[];
  }
}

interface GeoCoin {
  lat: number;
  lng: number;
  serial: number;
}
///// need to update player ui when refreshing coins, local storage
///// remove unused momento storage
/////polyline
/////prompt before reset, center on coin's origin home, better coin ui, hide artificial movement unless asked
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
const playerHistory: LatLng[] = [];
if (localStorage.getItem("playerCoins")) {
  const coinString = localStorage.getItem("playerCoins")!;
  const storageCoins = JSON.parse(coinString) as GeoCoin[];
  playerCoins.push(...storageCoins);
  totalCoins = playerCoins.length;
}
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = totalCoins
  ? `${totalCoins} total GeoCoin(s)`
  : "No coins yet...";

const worldMap = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

function initializePit(point: leaflet.LatLng, geoCache: Geocache) {
  // const momento = momentoStorage.get([point.lat, point.lng].toString());
  const momento = localStorage.getItem([point.lat, point.lng].toString());
  if (momento) {
    geoCache.fromMomento(momento);
    return;
  }
  const startingCoins = Math.floor(
    Math.floor(luck([point.lat, point.lng, "initialValue"].toString()) * 100) /
      15
  );
  for (let k = 0; k < startingCoins; k++) {
    geoCache.coins.push({
      lat: point.lat,
      lng: point.lng,
      serial: k,
    });
  }
}

function makePit(i: number, j: number) {
  const bounds = worldMap.getCellBounds({ i, j });

  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  const coordinate = latLng(i, j);
  const geoCache = new Geocache(coordinate);
  initializePit(coordinate, geoCache);

  const tip = pit.bindTooltip(`Pit: ${coordinate.lat},${coordinate.lng}`);

  pit.bindPopup(() => {
    tip.closeTooltip();
    const container = document.createElement("div");
    selectedPit = {
      cache: geoCache.coins,
      container: container,
      coordinate: coordinate,
    };
    updatePlayerCache(playerCoins, playerContainer);
    updateGeoCoinCache(geoCache.coins, container, coordinate);
    container.addEventListener("click", (e) => {
      if (e.target instanceof HTMLButtonElement) {
        const regex = /(-?\d+)/g;
        const result = e.target.id.match(regex);

        // Convert the matched strings to numbers
        const numbers = result!.map((match) => parseInt(match, 10));

        const [lat, lng, serial] = numbers;
        totalCoins++;
        // remove coin and add it to player inventory
        const foundCoin = getCoin(geoCache.coins, {
          lat: lat,
          lng: lng,
          serial: serial,
        } as GeoCoin);
        playerCoins.push(
          geoCache.coins.splice(geoCache.coins.indexOf(foundCoin!), 1)[0]
        );
        localStorage.setItem("playerCoins", JSON.stringify(playerCoins));
        statusPanel.innerHTML = totalCoins
          ? `${totalCoins} total GeoCoin(s)`
          : "No coins yet...";
        updateGeoCoinCache(geoCache.coins, container, coordinate);
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
  return geoCache;
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

function renderPits(location: leaflet.LatLng) {
  const nearbyCells = worldMap.getCellsNearPoint(location);
  for (const cell of nearbyCells) {
    if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
      const canonicalCell = worldMap.getCellForPoint(latLng(cell.i, cell.j));
      renderedCaches.push(makePit(canonicalCell.i, canonicalCell.j));
    }
  }
}

renderPits(NULL_ISLAND);
