
module.exports = class Graph {

  constructor(width, height) {
    this.array = []
    this.width = width
    this.height = height
    for (let y = 0; y < height; y++) {
      let col = []
      for (let x = 0; x < width; x++) {
        col.push(false)
      }
      this.array.push(col)
    }
  }

  map(polygon) {
    for (let i = 0, n = polygon.points.length; i < n; i++) {
      let p0 = polygon.points[i]
      let p1 = polygon.points[(i + 1) % n]
      this.line(p0, p1)
    }
  }

  line(p0, p1) {
    let dir = p1.sub(p0)
    let ndir = dir.normalize()
    let u = 0.5
    let l = dir.length() / u
    for (let i = 0; i < l; i++) {
      let p = p0.add(ndir.multiplyScalar(i * u))
      this.plot(p.x, p.y)
    }
  }

  lod(source, width, height) {
    let array = []
    let w = width - 1
    let h = height - 1
    for (let y = 0; y < height; y += 2) {
      let row = []
      for (let x = 0; x < width; x += 2) {
        let x0 = x
        let x1 = Math.min(x + 1, w)
        let y0 = y
        let y1 = Math.min(y + 1, h)
        let s0 = source[y0][x0]
        let s1 = source[y0][x1]
        let s2 = source[y1][x0]
        let s3 = source[y1][x1]
        row.push(s0 || s1 || s2 || s3)
      }
      array.push(row)
    }
    return array
  }

  display(lod = 0) {
    let table = ''

    let rows = process.stdout.rows
    let columns = process.stdout.columns

    let source = this.array
    let width = this.width
    let height = this.height

    for (let i = 0; i < lod; i++) {
      source = this.lod(source, width, height)
      width = Math.ceil(width / 2)
      height = Math.ceil(height / 2)
    }

    for (let y = 0; y < height; y++) {
      if (y >= rows) break

      for (let x = 0; x < width; x++) {
        if (x >= columns) break

        if(source[y][x]) {
          table += 'x'
        } else {
          table += '-'
        }
      }
      table += '\n'
    }

    // util.inspect(table, { maxArrayLength: null })
    console.log(table)
  }

  plot(x, y) {
    let ix = Math.floor(x)
    let iy = Math.floor(y)
    if(0 <= ix && ix <= this.width && 0 <= iy && iy <= this.height - 1) {
      this.array[iy][ix] = true
    }
  }

  clear() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.array[y][x] = false
      }
    }
  }

}