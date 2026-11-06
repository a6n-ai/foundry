export interface MapAsset { bytes: Uint8Array; contentType?: string }

export interface MapTileProvider {
  readonly id: string;
  /** Style descriptor JSON bytes. */
  style(): Promise<MapAsset>;
  tile(z: string, x: string, y: string): Promise<MapAsset>;
  sprite(file: string): Promise<MapAsset>;
  /** `fontStack` is already percent-decoded. */
  glyphs(fontStack: string, range: string): Promise<MapAsset>;
}
