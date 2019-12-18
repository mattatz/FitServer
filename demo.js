
const Fit = require('./src/index.js')

let packer = new Fit.Packer()

// initial bin size
const width = 300
const height = 128

const graph = new Fit.Graph(width, height)

function createDebugRect(id, size = 100, options = {}) {
  let points = []
  points.push(new Fit.Vector(0, size))
  points.push(new Fit.Vector(0, 0))
  points.push(new Fit.Vector(size, 0))
  points.push(new Fit.Vector(size, size))
  return new Fit.Part(id, points, options)
}

function createDebugPart(id, vertices = 6, minRadius = 50, maxRadius = 100, dx = 0, dy = 0, options = {}) {
  let points = []

  let interval = maxRadius - minRadius

  for (let i = 0; i < vertices; i++) {
    let r = (i / vertices) * Math.PI * 2
    let x = Math.cos(r) * (Math.random() * interval + minRadius) + dx
    let y = Math.sin(r) * (Math.random() * interval + minRadius) + dy
    points.push(new Fit.Vector(x, y))
  }

  return new Fit.Part(id, points, options)
}

const visualize = (bins = [], placed = [], placements = [], unplaced = []) => {
  console.clear()
  graph.clear()

  bins.forEach((bin, idx) => {
    placements.forEach(placement => {
      if (placement.bin === bin.id) {
        let part = placed.find(p => placement.part === p.id)
        if (part !== undefined && bin.id === 0) {
          graph.map(part)
        }
      }
    })
  })

  graph.display(1)
}

const start = async () => {
  let bin = new Fit.Bin(0, width, height)

  let parts = []
  for (let i = 0; i < 10; i++) {
    parts.push(createDebugPart(parts.length, Math.floor(Math.random() * 5 + 3), 10, 50, 0, 0))
  }
  /*
  for (let i = 0; i < 3; i++) {
    parts.push(createDebugRect(parts.length, 100))
  }
  */

  let config = {
    spacing: 2,             // space between parts
    rotationSteps: 4,       // # of angles for available rotation (ex. 4 means [0, 90, 180, 270] angles from 360 / 4 )
    population: 10,         // # of population in GA
    generations: 10,        // # of generations in GA
    mutationRate: 0.25      // mutation rate in GA
  }

  visualize([], [], [], parts)

  let result = await packer.start([bin], parts, config, {
    onEvaluation: (e) => {
    },
    onPacking: (e) => {
      visualize(e.bins, e.placed, e.placements, e.unplaced)
      if (e.unplaced.length > 0) {
        let last = e.bins[e.bins.length - 1]
        let newBin = new Fit.Bin(last.id + 1, width, height, { strokeColor: '#aaa', strokeWidth: 2 })
        packer.addBin(newBin)
      }
    },
    onPackingCompleted: (e) => {
      // visualize(e.bins, e.placed, e.placements, e.unplaced)
    }
  })

  visualize(result.bins, result.placed, result.placements, result.unplaced)

  return result
}

start()
