// The traverse layer is fetched as a static asset, not bundled as a module.
declare module '*.geojson?url' {
  const url: string
  export default url
}
