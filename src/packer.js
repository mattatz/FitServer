
const { Worker, isMainThread, workerData, parentPort, threadId } = require('worker_threads')

const XorShift = require('./math/xorshift.js')

const GA = require('./ga/ga.js')

const Polygon = require('./math/polygon.js')
const NfpWorker = require('./workers/nfp.worker.js')
const PlaceWorker = require('./workers/place.worker.js')

const { createUniqueKey, offsetPolygon } = require('./util.js')

module.exports = class Packer {

  constructor() {
    this.running = false

    this.bins = []
    this.parts = []
    this.config = {}
  }

  start(bins, parts, config, callbacks = {}) {
    if (this.running) {
      this.stop()
    }

    this.running = true

    // Sort by area in descending
    // this.bins = bins.map(b => b).sort((b0, b1) => { return (b0.area() > b1.area()) ? 1 : -1 })
    this.bins = bins // Disable sort for bins
    this.source = this.parts = parts.map(p => p).sort((p0, p1) => { return (p0.area() > p1.area()) ? 1 : -1 })

    this.group(this.bins)
    this.group(this.source)

    this.config = config || {}
    this.rnd = new XorShift(this.config.seed || 0)

    if (this.config.spacing > 0) {
      this.parts = this.parts.map(part => {
        return offsetPolygon(part, config.spacing)
      })
    }

    return this.packAsync({
      onEvaluation: (e) => {
        if (callbacks && callbacks.onEvaluation)
          callbacks.onEvaluation(e)
      },
      onPacking: (e) => {
        if (callbacks && callbacks.onPacking) {
          callbacks.onPacking(e)
        }
      },
      onPackingCompleted: (e) => {
        if (callbacks && callbacks.onPackingCompleted) {
          callbacks.onPackingCompleted(e)
        }
      }
    })
  }

  group(polygons, prefix = '') {
    polygons = polygons.slice()

    let groups = []
    groups.push([polygons.pop()])

    polygons.forEach((poly) => {
      let found = false
      for (let i = 0, n = groups.length; i < n; i++) {
        let grp = groups[i]
        let head = grp[0]
        if(head.approximately(poly)) {
          grp.push(poly)
          found = true
        }
      }

      if (!found) {
        groups.push([ poly ])
      }
    })

    groups.forEach((grp, idx) => {
      grp.forEach(poly => {
        poly.groupId = `${prefix}${idx}`
      })
    })
  }

  stop() {
    this.running = false

    /*
    if (nfpWorker !== undefined)
      nfpWorker.terminate()

    if (placeWorker !== undefined)
      placeWorker.terminate()

    nfpWorker = new NfpWorker()
    placeWorker = new PlaceWorker()
    */
  }

  transform(dna, parts, range) {
    return parts.map((part, idx) => {
      return part.transform(dna.genes[idx], range)
    })
  }

  format(args) {
    let placed = this.applyPlacements(args.placements, this.source.map(p => p.clone()))
    args.bins = this.bins
    args.placed = placed
    args.unplaced = args.unplaced.map(p => {
      return this.source.find(part => part.id === p.id)
    })
    return args
  }

  applyPlacements(placements, parts) {
    let packed = []
    placements.forEach(placement => {
      const id = placement.part
      let idx = parts.findIndex(part => part.id === id)
      if (idx !== -1) {
        parts[idx] = parts[idx].rotate(placement.rotation).translate(placement.position.x, placement.position.y)
        packed.push(parts[idx])
      }
    })
    return packed
  }

  addBin(bin) {
    this.bins.push(bin)
  }

  packAsync(callbacks = {}) {
    let cache = {}

    // console.log(this.bins, this.parts)

    let ga = new GA(this.rnd, this.parts.length, {
      population: this.config.population,
      mutationRate: this.config.mutationRate,
      steps: this.config.rotationSteps
    })

    let generations = this.config.generations
    return new Promise((resolve) => {
      this.stepAsync(null, 0, generations, ga, cache, callbacks).then((args) => {
        for (let key in cache) {
          delete cache[key]
        }
        resolve(args)
      })
   })
  }

  stepAsync(dominant, current, generations, ga, cache, callbacks) {
    return new Promise((resolve) => {
      this.evaluateAllAsync(current, ga.population, 0, cache, callbacks).then(() => {
        let cand = ga.getDominant()

        // Keep dominant dna
        if ((dominant === null) || (cand.cost < dominant.cost)) {
          dominant = cand.clone()
        }

        let args = {
          generation: current,
          placements: dominant.options.placements,
          unplaced: dominant.options.unplaced,
          dominant: dominant
        }
        let result = this.format(args)

        if (current < generations) {
          if (callbacks.onPacking !== undefined) {
            callbacks.onPacking(result)
          }

          ga.step()
          return this.stepAsync(dominant, current + 1, generations, ga, cache, callbacks).then(resolve)
        } else {
          if (callbacks.onPackingCompleted !== undefined) {
            callbacks.onPackingCompleted(result)
          }
          resolve(result)
        }
      })
    })
  }

  evaluateAllAsync(generation, population, current, cache, callbacks) {
    let len = population.length

    return new Promise((resolve) => {
      if (current >= len) resolve()
      else {
        let dna = population[current]
        this.evaluateAsync(dna, cache, (progress) => {
          if (callbacks.onEvaluation !== undefined) {
            let unit = (1 / len) * progress
            callbacks.onEvaluation({
              generation: generation,
              progress: unit + (current / len)
            })
          }
        }).then(() => {
          if (callbacks.onEvaluation !== undefined) {
            callbacks.onEvaluation({
              generation: generation,
              progress: ((current + 1) / len)
            })
          }

          this.evaluateAllAsync(generation, population, current + 1, cache, callbacks).then(resolve)
        })
      }

    })
  }

  evaluateAsync(dna, cache, onProgress) {
    let transformed = this.transform(dna, this.parts, this.config.rotationSteps || 4)
    return new Promise((resolve) => {

      // let hrstart = process.hrtime()
      this.createNfpsAsync(transformed, cache, false, false, onProgress).then(() => {
        // hrstart = process.hrtime()
        this.placeAsync(transformed, cache).then(function (result) {
          // hrend = process.hrtime(hrstart)
          // console.info('place worker time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)

          transformed = []
          dna.evaluate(result.cost, result)
          resolve(dna)
        })
      })
    })
  }

  placeAsync(parts, cache) {
    return new Promise((resolve) => {

      // const hrstart = process.hrtime()

      const placeWorker = new PlaceWorker()
      placeWorker.on('message', function(data) {
        // const hrend = process.hrtime(hrstart)
        // console.info('place worker time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)

        let result = data.result
        resolve(result)
      })
      placeWorker.start({
        bins: this.bins,
        parts: parts,
        nfpCache: cache
      })

      /*
      const worker = new Worker('./src/workers/place-worker-thread.js', {
        workerData: {
          bins: this.bins,
          parts: parts,
          nfpCache: cache
        }
      })
      worker.on('message', (message) => {
        const hrend = process.hrtime(hrstart)
        console.info('place worker time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)

        // const result = message.result.map(r => Polygon.fromJSON(r))
        resolve(message.result)
      })
      */

    })
  }

  createNfpsAsync(parts, cache, inside = false, edges = false, onProgress) {
    let pairs = []

    for (let i = 0, n = this.bins.length; i < n; i++) {
      let bin = this.bins[i]
      for (let j = 0, m = parts.length; j < m; j++) {
        let polygon = parts[j]
        let key = createUniqueKey(bin, polygon, inside, edges)
        if (!(key in cache)) {
          pairs.push({
            A: bin, B: polygon, inside: inside, edges: edges
          })
        }
      }
    }

    for (let i = 0, n = parts.length; i < n; i++) {
      let A = parts[i]
      for (let j = 0; j < n; j++) {
        let B = parts[j]
        if (i === j) continue
        let key = createUniqueKey(A, B, inside, edges)
        if (!(key in cache)) {
          pairs.push({
            A: A, B: B, inside: inside, edges: edges
          })
        }
      }
    }

    return this.createAllNfpAsync(pairs, 0, cache, onProgress)
  }

  createAllNfpAsync(pairs, current, cache, onProgress) {
    let len = pairs.length

    // console.log(pairs.length)

    return new Promise((resolve) => {
      if (current >= len) resolve(cache)
      else {
        let pair = pairs[current]
        this.createNfpAsync(pair.A, pair.B, pair.inside, pair.edges).then((result) => {
          cache[result.key] = result.nfp
          // console.log(result.key, result.nfp)

          if (onProgress !== undefined)
            onProgress(current / (len - 1))

          return this.createAllNfpAsync(pairs, current + 1, cache, onProgress).then(resolve)
        })
      }
    })
  }

  createNfpAsync(A, B, inside = false, edges = false) {
    return new Promise((resolve) => {

      const key = createUniqueKey(A, B, inside, edges)

      // const hrstart = process.hrtime()

      const nfpWorker = new NfpWorker()
      nfpWorker.on('message', function(data) {
        // const hrend = process.hrtime(hrstart)
        // console.info('nfp worker time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
        resolve({ key: key, nfp: data.result })
      })
      nfpWorker.start({
        A: A,
        B: B,
        inside: inside,
        edges: edges
      })

      /*
      const hrstart = process.hrtime()
      const worker = new Worker('./src/workers/nfp-worker-thread.js', {
        workerData: {
          A: A,
          B: B,
          inside: inside,
          edges: edges
        }
      })
      worker.on('message', (message) => {
        const hrend = process.hrtime(hrstart)
        console.info('nfp worker time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
        // const result = message.result.map(r => Polygon.fromJSON(r))
        const result = message.result
        // console.log(result)
        resolve({ key: key, nfp: result })
      })
      */
      // const hrend = process.hrtime(hrstart)
      // console.info('Setup time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)

    })
  }

}