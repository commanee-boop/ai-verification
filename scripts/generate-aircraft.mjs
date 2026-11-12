// Original low-poly visualization glyph, CC0. Not an aerodynamic model.
import { writeFileSync, mkdirSync } from 'node:fs'
const vertices = [], triangle = (a, b, c) => vertices.push(...a, ...b, ...c)
const nose = [12, 0, 0], tail = [-9, 0, 0], left = [-2, 0, -8], right = [-2, 0, 8], top = [-1, 1.4, 0], bottom = [-1, -1, 0]
triangle(nose, top, left); triangle(nose, right, top); triangle(nose, left, bottom); triangle(nose, bottom, right)
triangle(left, top, tail); triangle(top, right, tail); triangle(tail, bottom, left); triangle(right, bottom, tail)
triangle([-7, 0, 0], [-10, 0, -4], [-10, 0, 4]); triangle([-6, 0, 0], [-10, 0, 0], [-10, 4, 0])
const buffer = Buffer.from(new Float32Array(vertices).buffer)
const gltf = { asset: { version: '2.0', generator: 'ACMI original visualization glyph', copyright: 'ACMI prototype contributors · CC0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0, mode: 4 }] }], materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.7, 0.85, 1, 1], metallicFactor: 0.2, roughnessFactor: 0.6 } }], buffers: [{ byteLength: buffer.length, uri: 'data:application/octet-stream;base64,' + buffer.toString('base64') }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: buffer.length, target: 34962 }], accessors: [{ bufferView: 0, componentType: 5126, count: vertices.length / 3, type: 'VEC3', min: [-10, -1, -8], max: [12, 4, 8] }] }
mkdirSync('public/models', { recursive: true }); writeFileSync('public/models/aircraft.gltf', JSON.stringify(gltf))
