export interface Position {
  lat: number
  lng: number
  accuracy: number
}
export async function getPosition(): Promise<Position | null> {
  return null
}
