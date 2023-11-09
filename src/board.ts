import leaflet from "leaflet";
import luck from "./luck";

interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map();
  }

  private getCanonicalCell(cell: Cell): Cell {
    let { i, j } = cell;
    const step = 0.0001;
    i = Math.round(i / step);
    j = Math.round(j / step);
    const key = [i, j].toString();
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    return this.getCanonicalCell({
      i: point.lat,
      j: point.lng,
    });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    return leaflet.latLngBounds([
      [cell.i, cell.j],
      [cell.i + this.tileWidth, cell.j + this.tileWidth],
    ]);
  }

  getCellsNearPoint(point: leaflet.LatLng, spawnChance: number): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);
    for (
      let i = -this.tileVisibilityRadius;
      i <= this.tileVisibilityRadius;
      i++
    ) {
      for (
        let j = -this.tileVisibilityRadius;
        j <= this.tileVisibilityRadius;
        j++
      ) {
        if (luck([i, j].toString()) < spawnChance) {
          const cell = { i: originCell.i + i, j: originCell.j + j };
          resultCells.push(cell);
        }
      }
    }
    // const originBounds = this.getCellBounds(originCell);
    // this.knownCells.forEach((cell) => {
    //   if (originCell.i === cell.i && originCell.j === cell.j) {
    //     return;
    //   }
    //   const cellBounds = this.getCellBounds(cell);
    //   if (originBounds.pad(this.tileVisibilityRadius).intersects(cellBounds)) {
    //     resultCells.push(cell);
    //   }
    // });
    return resultCells;
  }

  check() {
    console.log(this.knownCells);
  }
}
