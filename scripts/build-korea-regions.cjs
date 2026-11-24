// Makes src/features/map/koreaRegions.json. Run once; kept so the map can be rebuilt or reframed.
//
//   node build-korea-regions.cjs <skorea-municipalities-2018-topo-simple.json> <out.json> [share of points to keep, default 0.1 — the app's file used 0.3]
//
// Input: https://github.com/southkorea/southkorea-maps (kostat/2018/json), boundaries by 통계청 SGIS,
// 공공누리 제1유형. Needs topojson-client and topojson-simplify, which are not dependencies of the
// app: run it from a scratch folder where they are installed.
// Turns KOSTAT's 2018 시군구 boundaries into the ~160 areas the app's map shows: every 시 and 군 as one
// area, with the 구 of a city merged into it and each 특별시/광역시 (and 세종) as a single area.
const fs = require('fs')
const topojson = require('topojson-client')
const [src, out] = process.argv.slice(2)
const simplify = require('topojson-simplify')
const KEEP = Number(process.argv[4] || 0.1) // share of the boundary points to keep
// Simplified as a topology, before merging, so neighbours keep sharing one border line with no gaps.
let topo = simplify.presimplify(JSON.parse(fs.readFileSync(src, 'utf8')))
topo = simplify.simplify(topo, simplify.quantile(topo, 1 - KEEP))
const object = Object.values(topo.objects)[0]

const METRO = { 11: '서울', 21: '부산', 22: '대구', 23: '인천', 24: '광주', 25: '대전', 26: '울산', 29: '세종' }
const PROVINCE = { 31: '경기', 32: '강원', 33: '충북', 34: '충남', 35: '전북', 36: '전남', 37: '경북', 38: '경남', 39: '제주' }
// 군위군 moved from 경북 to 대구 in July 2023, after this boundary set was made.
const MOVED = { 37310: '22' }

const groups = new Map()
for (const g of object.geometries) {
  const code = String(g.properties.code)
  const sido = code.slice(0, 2)
  let id, name, province
  if (MOVED[code]) {
    id = MOVED[code]; name = METRO[id]; province = ''
  } else if (METRO[sido]) {
    id = sido; name = METRO[sido]; province = ''
  } else if (code[4] !== '0') {
    // A 구 of a city in a province, e.g. 31011 수원시장안구 → 3101 수원시.
    id = code.slice(0, 4); name = g.properties.name.slice(0, g.properties.name.indexOf('시') + 1); province = PROVINCE[sido]
  } else {
    id = code; name = g.properties.name; province = PROVINCE[sido]
  }
  if (!groups.has(id)) groups.set(id, { id, name, province, geometries: [] })
  groups.get(id).geometries.push(g)
}

// Plain projection: longitude squeezed by cos(latitude) at the middle of the country. Good to a
// percent or so over an area this small, which is all a colouring map needs.
const LAT0 = 36
const kx = Math.cos((LAT0 * Math.PI) / 180)
const project = ([lon, lat]) => [lon * kx, -lat]
const area = (ring) => {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  return Math.abs(a / 2)
}

const WIDTH = 1000
const merged = [...groups.values()].map((g) => {
  const geom = topojson.merge(topo, g.geometries)
  const polygons = geom.coordinates.map((poly) => poly.map((ring) => ring.map(project)))
  return { ...g, polygons }
})

// The map is framed on the mainland, so the areas come out as large as a phone allows. Islets
// beyond the frame (백령도, 가거도 …) are left out; their areas are still there through their main
// part. The far islands sit in boxes in empty sea, the way printed maps do it: 울릉도 and 독도
// enlarged at the top right, 제주 at its true size at the bottom right.
const FRAME = { west: 125.92, east: 129.62, south: 33.9, north: 38.66 }
const JEJU = new Set(['39010', '39020'])
// 제주 is slid this far (degrees) into the sea south of 거제.
const JEJU_SHIFT = { lon: 2.27, lat: 0.82 }
const [minX, maxY] = project([FRAME.west, FRAME.south]).map((v, i) => (i === 0 ? v : v))
const [maxX, minY] = project([FRAME.east, FRAME.north])
const PAD = 10
const scale = (WIDTH - PAD * 2) / (maxX - minX)
const HEIGHT = Math.ceil((maxY - minY) * scale + PAD * 2)
const MIN_AREA = 6 // px² at this scale: smaller islands only add weight
const ULLEUNG = '37430'
const INSET = { x: WIDTH - 176, y: 196, width: 160, height: 104 }
const jejuVector = (() => {
  const a = project([0, 0]), b = project([JEJU_SHIFT.lon, JEJU_SHIFT.lat])
  return [(b[0] - a[0]) * scale, (b[1] - a[1]) * scale]
})()
// Pieces of 제주 north of this line (추자도) would land on the mainland's south coast when slid.
const JEJU_NORTH_LIMIT = toPxY(33.75)
function toPxY(lat) { return (project([0, lat])[1] - minY) * scale + PAD }
const toPx = ([x, y]) => [(x - minX) * scale + PAD, (y - minY) * scale + PAD]
const centre = (ring) => {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}
// Moves a polygon so its centre lands on `to`, enlarged by `k` about `from`.
const place = (poly, from, to, k) => poly.map((ring) => ring.map(([x, y]) => [to[0] + (x - from[0]) * k, to[1] + (y - from[1]) * k]))
const inFrame = (poly) => poly[0].some(([x, y]) => x >= 0 && x <= WIDTH && y >= 0 && y <= HEIGHT)


// The name printed on an area: '수원시' → '수원', '가평군' → '가평'. Short enough to fit, and the map
// itself shows which 고성 or 광주 is meant.
const shortName = (name) => (name.length > 2 ? name.replace(/[시군]$/, '') : name)

const inside = (ring, x, y) => {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}
const edgeDistance = (ring, x, y) => {
  let best = Infinity
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i]
    const dx = bx - ax, dy = by - ay
    const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)))
  }
  return best
}
// Where the name sits and how big it can be: the spot of the area's biggest piece that is farthest
// from its edge (a plain centre can fall outside a bent shape), sized to the room there.
const LABEL = { min: 8, max: 26 }
function labelFor(ring, text) {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const step = Math.max(1, Math.min(x1 - x0, y1 - y0) / 36)
  let spot = [(x0 + x1) / 2, (y0 + y1) / 2], room = -1
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      if (!inside(ring, x, y)) continue
      // Names are wider than tall, so room to the sides counts for more than room above and below.
      const d = edgeDistance(ring, x, y)
      if (d > room) { room = d; spot = [x, y] }
    }
  }
  // The stretch of the area on the name's own line, to centre it and to know how wide it may be.
  const cuts = []
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > spot[1] !== yj > spot[1]) cuts.push(((xj - xi) * (spot[1] - yi)) / (yj - yi) + xi)
  }
  cuts.sort((a, b) => a - b)
  let left = spot[0] - room, right = spot[0] + room
  for (let i = 0; i + 1 < cuts.length; i += 2) if (cuts[i] <= spot[0] && spot[0] <= cuts[i + 1]) { left = cuts[i]; right = cuts[i + 1] }
  // Pull the name toward the middle of that stretch, but not so far that it leaves the roomy spot.
  const mid = (left + right) / 2
  const x = spot[0] + Math.max(-room * 0.6, Math.min(room * 0.6, mid - spot[0]))
  const width = 2 * Math.min(x - left, right - x)
  const size = Math.max(LABEL.min, Math.min(LABEL.max, (width * 0.9) / text.length, room * 2.1))
  return { text, x: Math.round(x), y: Math.round(spot[1]), size: Math.round(size * 10) / 10 }
}

const jejuBox = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
const regions = merged.map((r) => {
  let scaled = r.polygons.map((poly) => poly.map((ring) => ring.map(toPx)))
  scaled.sort((a, b) => area(b[0]) - area(a[0]))
  let kept
  if (r.id === ULLEUNG) {
    // 울릉도 (the big piece and what lies right beside it) on the left of the box, 독도 on the right.
    const home = centre(scaled[0][0])
    const near = (poly) => Math.abs(centre(poly[0])[0] - home[0]) < 40
    const dokdo = scaled.filter((poly) => !near(poly))
    const dokdoHome = dokdo.length ? centre(dokdo[0][0]) : home
    kept = [
      ...scaled.filter(near).map((poly) => place(poly, home, [INSET.x + 66, INSET.y + 54], 3.3)),
      ...dokdo.map((poly) => place(poly, dokdoHome, [INSET.x + 132, INSET.y + 66], 14)),
    ]
  } else if (JEJU.has(r.id)) {
    kept = scaled
      .filter((poly, i) => i === 0 || (area(poly[0]) >= MIN_AREA && centre(poly[0])[1] > JEJU_NORTH_LIMIT))
      .map((poly) => poly.map((ring) => ring.map(([x, y]) => [x + jejuVector[0], y + jejuVector[1]])))
    for (const poly of kept) for (const [x, y] of poly[0]) {
      jejuBox.x0 = Math.min(jejuBox.x0, x); jejuBox.x1 = Math.max(jejuBox.x1, x)
      jejuBox.y0 = Math.min(jejuBox.y0, y); jejuBox.y1 = Math.max(jejuBox.y1, y)
    }
  } else {
    kept = scaled.filter((poly, i) => i === 0 || (area(poly[0]) >= MIN_AREA && inFrame(poly)))
  }
  let d = ''
  for (const poly of kept) {
    for (const ring of poly) {
      // Holes that are themselves specks go too.
      if (ring !== poly[0] && area(ring) < MIN_AREA) continue
      // Whole pixels, each point written as a step from the last one: about a third of the size.
      const pts = []
      for (const [x, y] of ring) {
        const p = [Math.round(x), Math.round(y)]
        const q = pts[pts.length - 1]
        if (!q || q[0] !== p[0] || q[1] !== p[1]) pts.push(p)
      }
      if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop()
      if (pts.length < 3) continue
      let path = `M${pts[0][0]},${pts[0][1]}l`
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1]
        path += (i > 1 && dx >= 0 ? ' ' : '') + dx + (dy >= 0 ? ',' : '') + dy
      }
      d += path + 'z'
    }
  }
  const biggest = kept.reduce((a, b) => (area(b[0]) > area(a[0]) ? b : a))[0]
  return { id: r.id, name: r.name, province: r.province, label: labelFor(biggest, shortName(r.name)), d }
})
const ORDER = ['', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
regions.sort((a, b) => ORDER.indexOf(a.province) - ORDER.indexOf(b.province) || a.id.localeCompare(b.id))

const BOX_PAD = 14
const insets = [
  { label: '울릉도 · 독도', ...INSET },
  { label: '제주도', x: Math.round(jejuBox.x0 - BOX_PAD), y: Math.round(jejuBox.y0 - BOX_PAD), width: Math.round(jejuBox.x1 - jejuBox.x0 + BOX_PAD * 2), height: Math.round(jejuBox.y1 - jejuBox.y0 + BOX_PAD * 2) },
]
console.log(JSON.stringify(insets))
fs.writeFileSync(out, JSON.stringify({ width: WIDTH, height: HEIGHT, insets, regions }) + '\n')
console.log(regions.length, 'areas', WIDTH + 'x' + HEIGHT, Math.round(fs.statSync(out).size / 1024) + 'KB')
const names = regions.map((r) => (r.province ? r.province + ' ' : '') + r.name)
console.log('names at the smallest size:', regions.filter((r) => r.label.size <= LABEL.min).map((r) => r.name).join(' '))
console.log('duplicate labels:', names.filter((n, i) => names.indexOf(n) !== i))
console.log(names.join(', '))
