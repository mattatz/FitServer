
const EventEmitter = require('events').EventEmitter
const { noFitRectanglePolygon, noFitPolygon, minkowskiDifference} = require('../util.js')
const Part = require('../part.js')

module.exports = class NfpWorker extends EventEmitter {

  constructor() {
    super()
  }

  start(data) {
    let pa = Part.fromJSON(data.A)
    // let pa = data.A
    pa = pa.rotate(pa.rotation)

    let pb = Part.fromJSON(data.B)
    // let pb = data.B
    pb = pb.rotate(pb.rotation)

    let debug = data.debug || false

    let result
    if (data.A.isBin) {
      let polygon = noFitRectanglePolygon(pa, pb, data.inside, data.edges)
      if (polygon) {
        result = [polygon]
      } else {
        result = []
      }
    } else {
      // result = noFitPolygon(pa, pb, data.inside, data.edges, debug)
      if (data.edges) {
        result = noFitPolygon(pa, pb, data.inside, data.edges, debug)
      } else {
        result = minkowskiDifference(pa, pb)
      }
    }

    result = result.map(polygon => {
      if (polygon.area() > 0) {
        polygon.points.reverse()
      }
      return polygon
    })

    this.emit('message', {
      result: result
    })
  }

}

