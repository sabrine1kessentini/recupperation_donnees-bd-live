/**
 * Singleton IFC partagé entre BuildingView et RoomPreviewIFC.
 *
 * Problème : le module WASM de web-ifc est un singleton global.
 * Si BuildingView charge le fichier IFC en premier (modelID=0),
 * un second IFCLoader (RoomPreviewIFC) obtient modelID=1 pour lequel
 * getAllItemsOfType(IFCSPACE) retourne toujours 0 — bug connu du WASM.
 *
 * Solution : BuildingView enregistre son loader+spaceMap ici après chargement.
 * RoomPreviewIFC consomme ce singleton au lieu de créer un second loader.
 */

export interface IFCSharedState {
  loader: any;
  modelID: number;
  /** spaceMap[key] = [expressID, ...] — construit par BuildingView */
  spaceMap: Map<string, number[]>;
}

let _state: IFCSharedState | null = null;

/**
 * Appelé par BuildingView dès que son loader+spaceMap sont prêts.
 */
export function registerIFCLoader(
  loader: any,
  modelID: number,
  spaceMap: Map<string, number[]>,
): void {
  _state = { loader, modelID, spaceMap };
}

/**
 * Retourne l'état partagé, ou null si BuildingView n'a pas encore chargé.
 */
export function getIFCSharedState(): IFCSharedState | null {
  return _state;
}
