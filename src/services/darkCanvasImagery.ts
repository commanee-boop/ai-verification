import { OpenStreetMapImageryProvider } from 'cesium'

/** Raster OSM cartography recolored on Canvas; no fabricated geographic features. */
export class DarkCanvasImageryProvider extends OpenStreetMapImageryProvider {
  constructor(url: string) { super({ url, maximumLevel: 19 }) }
  override requestImage(...args: Parameters<OpenStreetMapImageryProvider['requestImage']>): ReturnType<OpenStreetMapImageryProvider['requestImage']> {
    const image = super.requestImage(...args)
    if (!image) return undefined
    return image.then(source => {
      const canvas = document.createElement('canvas')
      canvas.width = source.width; canvas.height = source.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Canvas basemap rendering unavailable')
      // Cesium decodes ImageBitmap tiles with flipY for GPU upload. Restore their
      // north-up orientation before returning a Canvas (GPU upload flips Canvas).
      ctx.save()
      if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) { ctx.translate(0, canvas.height); ctx.scale(1, -1) }
      ctx.drawImage(source as CanvasImageSource, 0, 0)
      if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close()
      ctx.restore()
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = pixels.data
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], l = (r + g + b) / 3
        let rgb: number[]
        // These thresholds restyle OSM's drawn palette; they are not a water mask.
        if (b > r * 1.08 && g > r * 1.03 && b > 130) rgb = [10, 38, 56]
        else if (l < 115) { const ink = 0.65 + (115 - l) / 230; rgb = [120 * ink, 155 * ink, 178 * ink] }
        else if (g > r * 1.03 && g > b * 1.06) rgb = [19, 42, 40]
        else if (l > 247) rgb = [48, 66, 82]
        else if (l > 230 && Math.max(r, g, b) - Math.min(r, g, b) < 30) rgb = [24, 35, 49]
        else rgb = [24 + (255 - l) * 0.05, 32 + (255 - l) * 0.06, 45 + (255 - l) * 0.08]
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]
      }
      ctx.putImageData(pixels, 0, 0)
      return canvas
    })
  }
}
