/**
 * lib/geo.ts
 * ---------------------------------------------------------------------------
 * Client-side geospatial helpers (Turf.js) for SilverBack Sentry:
 *
 *   - `checkGeofence()`        → point-in-polygon test against the park boundary
 *   - `isWithinRadius()`       → 500 m community safety-zone proximity checks
 *   - `useMarkerClusters()`    → bounding-box grid clustering for map markers
 *
 * All helpers accept plain `{ latitude, longitude }` objects (react-native-maps
 * convention) AND Firestore `GeoPoint`s interchangeably.
 */

import { useMemo } from 'react';
import { GeoPoint } from 'firebase/firestore';
import { point, polygon } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import distance from '@turf/distance';

/* ========================================================================== *
 * Coordinate normalization
 * ========================================================================== */

/** react-native-maps style coordinate. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Anything this module accepts as a coordinate. */
export type CoordinateInput = LatLng | GeoPoint;

/** Map viewport region (react-native-maps `Region`). */
export interface MapRegion extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Narrow a CoordinateInput to a plain LatLng. */
export function toLatLng(coord: CoordinateInput): LatLng {
  if (coord instanceof GeoPoint) {
    return { latitude: coord.latitude, longitude: coord.longitude };
  }
  return coord;
}

/** Turf uses GeoJSON ordering: [longitude, latitude]. */
function toPosition(coord: CoordinateInput): [number, number] {
  const { latitude, longitude } = toLatLng(coord);
  return [longitude, latitude];
}

/* ========================================================================== *
 * Geofencing
 * ========================================================================== */

/**
 * A polygon ring expressed as LatLng vertices. The ring is closed
 * automatically if the last vertex differs from the first.
 */
export type PolygonRing = readonly CoordinateInput[];

/**
 * Point-in-polygon test: is `currentCoord` inside `parkPolygon`?
 * Used both for park-boundary alerts and no-go zone checks.
 *
 * @throws if the polygon has fewer than 3 vertices.
 */
export function checkGeofence(
  currentCoord: CoordinateInput,
  parkPolygon: PolygonRing,
): boolean {
  if (parkPolygon.length < 3) {
    throw new Error('[geo] A geofence polygon requires at least 3 vertices');
  }

  const ring = parkPolygon.map(toPosition);
  // GeoJSON polygons must be explicitly closed.
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) {
    ring.push([firstLng, firstLat]);
  }

  return booleanPointInPolygon(point(toPosition(currentCoord)), polygon([ring]));
}

/**
 * True when `coordA` and `coordB` are within `radiusInMeters` of each other.
 * Drives the 500 m community safety monitoring zones.
 */
export function isWithinRadius(
  coordA: CoordinateInput,
  coordB: CoordinateInput,
  radiusInMeters: number,
): boolean {
  const meters = distance(point(toPosition(coordA)), point(toPosition(coordB)), {
    units: 'meters',
  });
  return meters <= radiusInMeters;
}

/** Great-circle distance in meters between two coordinates. */
export function distanceInMeters(
  coordA: CoordinateInput,
  coordB: CoordinateInput,
): number {
  return distance(point(toPosition(coordA)), point(toPosition(coordB)), {
    units: 'meters',
  });
}

/* ========================================================================== *
 * Marker clustering (bounding-box grid)
 * ========================================================================== */

/** A map marker eligible for clustering. */
export interface ClusterablePoint {
  id: string;
  coordinate: CoordinateInput;
}

/** One rendered cluster: a centroid plus its member points. */
export interface MarkerCluster<T extends ClusterablePoint> {
  /** Stable key derived from the grid cell, usable as a React key. */
  id: string;
  /** Centroid of all member coordinates — where the cluster marker renders. */
  coordinate: LatLng;
  /** Members inside this grid cell; length 1 means "render a plain marker". */
  points: T[];
}

export interface ClusterOptions {
  /**
   * How many grid cells the visible region is divided into along each axis.
   * Higher → smaller cells → more, tighter clusters. Default 8.
   */
  gridSize?: number;
}

/**
 * Pure grid clustering: divides the visible region's bounding box into
 * `gridSize × gridSize` cells and merges all points sharing a cell.
 * Points outside the visible region (with a half-delta margin) are skipped —
 * off-screen markers cost render time without being visible.
 */
export function clusterMarkers<T extends ClusterablePoint>(
  points: readonly T[],
  region: MapRegion,
  options: ClusterOptions = {},
): MarkerCluster<T>[] {
  const gridSize = options.gridSize ?? 8;

  // Visible bounding box, padded by half a delta so markers entering the
  // viewport during a pan are already placed.
  const minLat = region.latitude - region.latitudeDelta;
  const maxLat = region.latitude + region.latitudeDelta;
  const minLng = region.longitude - region.longitudeDelta;
  const maxLng = region.longitude + region.longitudeDelta;

  const cellLat = (maxLat - minLat) / gridSize;
  const cellLng = (maxLng - minLng) / gridSize;

  const cells = new Map<string, T[]>();

  for (const p of points) {
    const { latitude, longitude } = toLatLng(p.coordinate);
    if (
      latitude < minLat ||
      latitude > maxLat ||
      longitude < minLng ||
      longitude > maxLng
    ) {
      continue;
    }
    const row = Math.floor((latitude - minLat) / cellLat);
    const col = Math.floor((longitude - minLng) / cellLng);
    const key = `${row}:${col}`;
    const bucket = cells.get(key);
    if (bucket !== undefined) {
      bucket.push(p);
    } else {
      cells.set(key, [p]);
    }
  }

  const clusters: MarkerCluster<T>[] = [];
  for (const [key, members] of cells) {
    let latSum = 0;
    let lngSum = 0;
    for (const member of members) {
      const { latitude, longitude } = toLatLng(member.coordinate);
      latSum += latitude;
      lngSum += longitude;
    }
    clusters.push({
      id: `cluster-${key}`,
      coordinate: {
        latitude: latSum / members.length,
        longitude: lngSum / members.length,
      },
      points: members,
    });
  }
  return clusters;
}

/**
 * React hook wrapper: memoized clustering keyed on the point set and the
 * (rounded) viewport, so map pans only re-cluster when the view meaningfully
 * moves. Hook this straight into the existing map screens' state.
 */
export function useMarkerClusters<T extends ClusterablePoint>(
  points: readonly T[],
  region: MapRegion,
  options: ClusterOptions = {},
): MarkerCluster<T>[] {
  const gridSize = options.gridSize ?? 8;

  // Quantize the region so tiny GPS/pan jitter doesn't thrash the memo.
  const regionKey = useMemo(() => {
    const q = (n: number): number => Math.round(n * 1000) / 1000;
    return [
      q(region.latitude),
      q(region.longitude),
      q(region.latitudeDelta),
      q(region.longitudeDelta),
    ].join(',');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  return useMemo(
    () => clusterMarkers(points, region, { gridSize }),
    // regionKey intentionally stands in for the raw region object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, regionKey, gridSize],
  );
}

/* ========================================================================== *
 * Park boundary reference polygon
 * ========================================================================== */

/**
 * Simplified outline of Bwindi Impenetrable National Park.
 * Replace with the surveyed UWA boundary shapefile export for production —
 * the Cloud Functions package keeps its own copy of the same ring.
 */
export const BWINDI_PARK_POLYGON: PolygonRing = [
  { latitude: -0.99, longitude: 29.575 },
  { latitude: -0.885, longitude: 29.6 },
  { latitude: -0.85, longitude: 29.685 },
  { latitude: -0.93, longitude: 29.77 },
  { latitude: -1.06, longitude: 29.775 },
  { latitude: -1.125, longitude: 29.7 },
  { latitude: -1.09, longitude: 29.6 },
];
