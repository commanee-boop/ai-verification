import { Color, DynamicAtmosphereLightingType, JulianDate, PostProcessStage, ShadowMode, SunLight, Viewer, buildModuleUrl } from 'cesium'

export const thailandCamera = { longitude: 100.6, latitude: 14.7, heading: 18, pitch: -52, range: 1800000 } as const
export function sceneTimestamp(timestamp: number, daylightPreview: boolean) {
  const date = new Date(timestamp)
  if (daylightPreview) date.setUTCHours(3, 0, 0, 0)
  return date
}
export function configureGisScene(viewer: Viewer) {
  const scene = viewer.scene, globe = scene.globe
  scene.backgroundColor = Color.fromCssColorString('#071220')
  globe.baseColor = Color.fromCssColorString('#102231')
  globe.enableLighting = true
  globe.showGroundAtmosphere = false
  globe.dynamicAtmosphereLighting = true
  globe.dynamicAtmosphereLightingFromSun = true
  globe.atmosphereSaturationShift = -0.25
  globe.atmosphereBrightnessShift = -0.12
  globe.showWaterEffect = true
  globe.oceanNormalMapUrl = buildModuleUrl('Assets/Textures/waterNormalsSmall.jpg')
  // Bound tile residency and render targets on integrated GPUs.
  globe.maximumScreenSpaceError = 8
  globe.tileCacheSize = 24
  globe.preloadAncestors = false
  globe.preloadSiblings = false
  scene.light = new SunLight({ intensity: 1.8, color: Color.fromCssColorString('#f4f8ff') })
  scene.atmosphere.dynamicLighting = DynamicAtmosphereLightingType.SUNLIGHT
  scene.atmosphere.saturationShift = -0.25
  scene.atmosphere.brightnessShift = -0.1
  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.show = true
    scene.skyAtmosphere.perFragmentAtmosphere = true
    scene.skyAtmosphere.saturationShift = -0.3
    scene.skyAtmosphere.brightnessShift = -0.15
  }
  if (scene.skyBox) scene.skyBox.show = false
  if (scene.sun) scene.sun.show = false
  if (scene.moon) scene.moon.show = false
  scene.fog.enabled = true
  scene.fog.density = 0.00008
  scene.fog.minimumBrightness = 0.1
  scene.fog.screenSpaceErrorFactor = 1.5
  scene.highDynamicRange = false
  scene.msaaSamples = 1
  scene.sunBloom = false
  scene.postProcessStages.fxaa.enabled = false
  viewer.shadows = false
  viewer.terrainShadows = ShadowMode.DISABLED
  scene.shadowMap.softShadows = true
  scene.shadowMap.size = 1024
  scene.shadowMap.maximumDistance = 30000
  let grade: { enabled: boolean } | undefined
  function gradingStage() { return grade ??= scene.postProcessStages.add(new PostProcessStage({ name: 'acmi-modern-gis-grade',
    fragmentShader: `uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
void main() {
  vec2 uv = v_textureCoordinates;
  vec2 texel = 1.0 / czm_viewport.zw;
  vec4 original = texture(colorTexture, uv);
  vec3 neighbours = (texture(colorTexture, uv + vec2(texel.x, 0.0)).rgb
    + texture(colorTexture, uv - vec2(texel.x, 0.0)).rgb
    + texture(colorTexture, uv + vec2(0.0, texel.y)).rgb
    + texture(colorTexture, uv - vec2(0.0, texel.y)).rgb) * 0.25;
  vec3 sharp = clamp(original.rgb + (original.rgb - neighbours) * 0.16, 0.0, 1.0);
  float chroma = max(max(sharp.r, sharp.g), sharp.b) - min(min(sharp.r, sharp.g), sharp.b);
  vec3 cool = pow(sharp, vec3(0.97)) * vec3(0.94, 1.01, 1.055);
  cool = (cool - 0.18) * 1.045 + 0.18;
  vec3 graded = mix(cool, sharp, smoothstep(0.25, 0.65, chroma));
  float vignette = 1.0 - 0.055 * smoothstep(0.25, 0.72, distance(uv, vec2(0.5)));
  out_FragColor = vec4(clamp(graded * vignette, 0.0, 1.0), original.a);
}` })) }
  scene.postProcessStages.bloom.uniforms.contrast = 24
  scene.postProcessStages.bloom.uniforms.brightness = -0.4
  scene.postProcessStages.bloom.uniforms.glowOnly = false
  return { setEnabled(enabled: boolean) { if (enabled) gradingStage().enabled = true; else if (grade) grade.enabled = false; globe.showGroundAtmosphere = enabled; scene.postProcessStages.fxaa.enabled = enabled; scene.postProcessStages.bloom.enabled = enabled; viewer.shadows = enabled; viewer.terrainShadows = enabled ? ShadowMode.ENABLED : ShadowMode.DISABLED; scene.requestRender() }, syncSun(timestamp: number, daylightPreview: boolean) { viewer.clock.currentTime = JulianDate.fromDate(sceneTimestamp(timestamp, daylightPreview)); viewer.clock.shouldAnimate = false; scene.requestRender() } }
}
