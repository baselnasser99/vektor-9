import * as THREE from 'three';

// Sky dome colored by height above the horizon from a list of [elevation 0..1, color]; below the horizon it is haze, so the ground melts into it.
export function skyDome(stops, radius = 450) {
  const geo = new THREE.SphereGeometry(radius, 64, 32);
  const pos = geo.attributes.position, colors = [], c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const e = Math.max(pos.getY(i) / radius, 0);
    const k = stops.findIndex(([at]) => at >= e);
    const [a, ca] = stops[Math.max(k - 1, 0)], [b, cb] = stops[k];
    c.set(ca).lerp(new THREE.Color(cb), b > a ? (e - a) / (b - a) : 0);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
}
