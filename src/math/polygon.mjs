
import Vector from './vector.mjs'
import BoundingBox from './bounding_box.mjs'

export default class Polygon {

  constructor(points, options = {}) {
    this.points = points
    this.options = options
  }

  static fromJSON(json) {
    let points = json.points.map(p => Vector.fromJSON(p))
    return new Polygon(points, json.options)
  }

  bounds() {
    let minX = Number.MAX_VALUE, maxX = Number.MIN_VALUE
    let minY = Number.MAX_VALUE, maxY = Number.MIN_VALUE

    this.points.forEach(p => {
      minX = Math.min(p.x, minX)
      minY = Math.min(p.y, minY)
      maxX = Math.max(p.x, maxX)
      maxY = Math.max(p.y, maxY)
    })

    return new BoundingBox(new Vector(minX, minY), new Vector(maxX, maxY))
  }

  translate(dx, dy) {
    let np = this.clone()
    np.points = np.points.map(p => {
      return p.translate(dx, dy)
    })
    return np
  }

  rotate(angle) {
    let np = this.clone()
    let sin = Math.sin(angle)
    let cos = Math.cos(angle)
    np.points = np.points.map(p => {
      return new Vector(p.x * cos - p.y * sin, p.x * sin + p.y * cos, p.marked)
    })
    return np
  }

  clone() {
    let points = this.points.map(p => p.clone())
    let np = new Polygon(points, this.options)
    return np
  }

  area() {
    let area = 0;
    let n = this.points.length
    for (let i = 0, j = n - 1; i < n; j = i++) {
      area += (this.points[j].x + this.points[i].x) * (this.points[j].y - this.points[i].y)
    }
    return 0.5 * area
  }

}
