
const Vector = require('./vector.js')

module.exports = class IndexedVector extends Vector {

  constructor (x, y, start, end) {
    super(x, y)
    this.start = start
    this.end = end
  }

  clone() {
    let cloned = super.clone()
    cloned.start = this.start.clone()
    cloned.end = this.end.clone()
    return cloned
  }

}
