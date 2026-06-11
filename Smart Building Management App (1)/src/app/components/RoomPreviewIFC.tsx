import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { IFCSPACE, IFCRELCONTAINEDINSPATIALSTRUCTURE, IFCRELAGGREGATES } from 'web-ifc';
import wasmUrl from 'web-ifc/web-ifc.wasm?url';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { AlertTriangle, Loader } from 'lucide-react';
import { getIFCSharedState, registerIFCLoader } from './ifc-shared';

const IFC_FILE_PATH = '/models/building.ifc';
const IFCRELSPACEBOUNDARY = 3451746338;

// Global IDs from mapping_final_updated.json — used for exact IFC space lookup
const ROOM_GLOBAL_IDS: Record<string, string[]> = {
  B109: ['0uGek424j05BaSi7k8quU_', '0mnyWlb4b5Je_kNpm0jKVr'],
  B119: ['1oeLNWdyvD2xBpFQTGTp9W', '0mnyWlb4b5Je_kNpm0jKVv'],
  B111: ['0uGek424j05BaSi7k8quP2', '0mnyWlb4b5Je_kNpm0jKVt'],
  B113: ['0JaVFNY8150g9wOWKQH9Vm', '0mnyWlb4b5Je_kNpm0jKVu'],
  B123: ['39xeVIdXb0Oeui8c6ndGDL', '0mnyWlb4b5Je_kNpm0jKVl'],
  B125: ['39xeVIdXb0Oeui8c6ndGD9', '0mnyWlb4b5Je_kNpm0jKVf'],
  B129: ['39xeVIdXb0Oeui8c6ndGD1', '0mnyWlb4b5Je_kNpm0jKVb'],
  B135: ['0PeKSAvI59PfDaeCq6ElAH', '0mnyWlb4b5Je_kNpm0jKVW'],
  B137: ['0jdEFTa3r2xhGxvrW4$OxT', '0mnyWlb4b5Je_kNpm0jKVZ'],
  B139: ['0jdEFTa3r2xhGxvrW4$OxP', '0mnyWlb4b5Je_kNpm0jKUT'],
  B148: ['16W6cLvsb3jBoxMDVIAJX9', '0mnyWlb4b5Je_kNpm0jKUL'],
  B150: ['2gt9UqKnT4DvHlrgGjUXd6', '0mnyWlb4b5Je_kNpm0jKUG'],
  B152: ['2gt9UqKnT4DvHlrgGjUXd4', '0mnyWlb4b5Je_kNpm0jKUJ'],
};

function normalizeKey(value: any): string | null {
  if (!value) return null;
  const text = typeof value === 'string' ? value : value.value ?? '';
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, ' ');
}

// Only use the exact room code and known Global IDs — no display name guessing
function getRoomSearchKeys(roomName: string): string[] {
  const code = roomName.trim().toLowerCase();
  const globalIds = ROOM_GLOBAL_IDS[roomName]?.map(id => id.trim().toLowerCase()) ?? [];
  return [code, ...globalIds];
}

// Exact match only — prevents partial matches across rooms
function roomKeyMatches(key: string, searchKeys: string[]): boolean {
  return searchKeys.some((searchKey) => key === searchKey);
}

/** Cherche les expressIDs de la salle dans la spaceMap de BuildingView. */
function findInSpaceMap(spaceMap: Map<string, number[]>, roomName: string): number[] {
  const searchKeys = getRoomSearchKeys(roomName);
  const result = new Set<number>();
  for (const [key, ids] of spaceMap.entries()) {
    if (roomKeyMatches(key, searchKeys)) ids.forEach(id => result.add(id));
  }
  return Array.from(result);
}

// Résout les IDs de tous les éléments architecturaux d'une salle (murs, sol, etc.)
// depuis l'ID de l'IFCSPACE — même logique que BuildingView
async function findElementsForRoom(
  manager: any,
  modelID: number,
  spaceId: number,
): Promise<number[]> {
  const allIds = new Set<number>([spaceId]);
  const excludedIds = new Set<number>();

  // Éléments contenus dans l'espace
  try {
    const rels = await manager.getAllItemsOfType(modelID, IFCRELCONTAINEDINSPATIALSTRUCTURE, true);
    for (const rel of rels) {
      const relSpace = rel.RelatingStructure;
      const relId = typeof relSpace === 'object' ? (relSpace?.value ?? relSpace?.expressID) : relSpace;
      if (relId !== spaceId) continue;
      const related = rel.RelatedElements;
      if (!Array.isArray(related)) continue;
      for (const el of related) {
        const id = typeof el === 'object' ? (el?.value ?? el?.expressID) : el;
        if (id) allIds.add(id);
      }
    }
  } catch (_) {}

  // Éléments de frontière de l'espace (murs, planchers…)
  try {
    const rels = await manager.getAllItemsOfType(modelID, IFCRELSPACEBOUNDARY, true);
    for (const rel of rels) {
      const relSpace = rel.RelatingSpace;
      const relId = typeof relSpace === 'object' ? (relSpace?.value ?? relSpace?.expressID) : relSpace;
      if (relId !== spaceId) continue;
      const element = rel.RelatedBuildingElement;
      if (!element) continue;
      const id = typeof element === 'object' ? (element?.value ?? element?.expressID) : element;
      if (!id) continue;
      try {
        const entity = await manager.getItemProperties(modelID, id, false);
        const typeStr = String(entity?.type ?? '').toUpperCase();
        const predType = String(entity?.PredefinedType?.value ?? entity?.PredefinedType ?? '').toUpperCase();
        const nameStr = String(entity?.Name?.value ?? entity?.Name ?? '').toUpperCase();
        const isCeiling =
          (typeStr.includes('SLAB') && (predType === 'ROOF' || predType === 'BASESLAB')) ||
          typeStr.includes('ROOF') ||
          nameStr.includes('CEILING') || nameStr.includes('PLAFOND') || nameStr.includes('TOITURE');
        if (isCeiling) excludedIds.add(id);
        else allIds.add(id);
      } catch (_) { allIds.add(id); }
    }
  } catch (_) {}

  excludedIds.forEach(id => allIds.delete(id));

  // Sous-éléments agrégés
  try {
    const aggRels = await manager.getAllItemsOfType(modelID, IFCRELAGGREGATES, true);
    const snapshot = Array.from(allIds);
    for (const rel of aggRels) {
      const relObj = rel.RelatingObject;
      const relId = typeof relObj === 'object' ? (relObj?.value ?? relObj?.expressID) : relObj;
      if (!snapshot.includes(relId)) continue;
      const related = rel.RelatedObjects;
      if (!Array.isArray(related)) continue;
      for (const el of related) {
        const id = typeof el === 'object' ? (el?.value ?? el?.expressID) : el;
        if (id && !excludedIds.has(id)) allIds.add(id);
      }
    }
  } catch (_) {}

  return Array.from(allIds);
}

async function resolveRoomIds(
  manager: any,
  modelID: number,
  spaceIds: number[],
): Promise<number[]> {
  const all = new Set<number>();
  for (const spaceId of spaceIds) {
    const ids = await findElementsForRoom(manager, modelID, spaceId);
    ids.forEach(id => all.add(id));
  }
  return Array.from(all);
}

interface RoomPreviewIFCProps {
  roomName: string;
}

export function RoomPreviewIFC({ roomName }: RoomPreviewIFCProps) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const loaderRef   = useRef<any>(null);

  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [error,  setError]  = useState('');

  useEffect(() => {
    if (!mountRef.current) return;

    setStatus('loading');
    setError('');

    const container = mountRef.current;
    const renderer  = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0xf5f0e4, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f0e4);

    const camera = new THREE.PerspectiveCamera(
      55, container.clientWidth / container.clientHeight, 0.1, 10000
    );
    camera.position.set(25, 35, 55);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 1.3));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(40, 90, 50);
    scene.add(dirLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.1;
    controlsRef.current = controls;

    let animId   = 0;
    let disposed = false;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ─── Helpers pour créer le subset et zoomer ────────────────────────────
    function fitCamera(obj: THREE.Object3D): boolean {
      const box = new THREE.Box3().setFromObject(obj);
      if (box.isEmpty()) return false;
      const center   = box.getCenter(new THREE.Vector3());
      const size     = box.getSize(new THREE.Vector3());
      const distance = Math.max(size.x, size.y, size.z) * 2.5;
      if (!isFinite(distance) || distance === 0) return false;
      cameraRef.current?.position.set(
        center.x + distance * 0.6,
        center.y + distance * 0.9,
        center.z + distance * 1.1,
      );
      cameraRef.current?.lookAt(center);
      controlsRef.current?.target.copy(center);
      return true;
    }

    function applySubset(loader: any, modelID: number, targetIds: number[], ifcModel?: THREE.Object3D) {
      // ── Isoler la salle : mêmes couleurs que BuildingView ────────────────────
      try {
        loader.ifcManager.hideAllItems(modelID);
        loader.ifcManager.showItems(modelID, targetIds);
      } catch (_) {}

      // Standalone (ifcModel dans cette scène) → opacité complète = couleurs IFC originales
      if (ifcModel) {
        const mats = Array.isArray((ifcModel as any).material)
          ? (ifcModel as any).material
          : [(ifcModel as any).material];
        mats.forEach((m: any) => {
          if (m) { m.transparent = false; m.opacity = 1; m.needsUpdate = true; }
        });
      }

      // ── Subset invisible uniquement pour le positionnement caméra ────────────
      // (colorWrite:false → non rendu, mais utilisable pour Box3)
      let cameraFitted = false;
      try {
        const camMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
        const sub = loader.ifcManager.createSubset({
          modelID,
          ids: targetIds,
          scene,
          removePrevious: true,
          material: camMat,
        });
        if (sub) {
          sub.updateMatrixWorld(true);
          cameraFitted = fitCamera(sub);
          scene.remove(sub);   // retiré après usage caméra, display via showItems
        }
      } catch (_) {}

      if (!cameraFitted && ifcModel) fitCamera(ifcModel);
      if (!cameraFitted && !ifcModel) {
        console.warn('[IFC Preview] Caméra non positionnée — aucune géométrie de référence');
      }

      setStatus('loaded');
    }

    (async () => {
      try {
        // ── Cas 1 : BuildingView déjà chargé → réutiliser son loader (modelID=0) ──
        // Attendre 500ms pour laisser le temps à BuildingView d'enregistrer son loader
        // (cas où les deux composants montent quasi simultanément)
        await new Promise(r => setTimeout(r, 500));

        const shared = getIFCSharedState();
        if (shared) {
          console.log(`[IFC Preview] Utilisation du loader partagé (modelID=${shared.modelID})`);
          const spaceIds = findInSpaceMap(shared.spaceMap, roomName);
          console.log(`[IFC Preview] ${spaceIds.length} espaces trouvés via spaceMap partagée`);

          if (disposed) return;

          if (spaceIds.length === 0) {
            setStatus('error');
            setError(`Salle ${roomName} non trouvée`);
            return;
          }

          const allIds = await resolveRoomIds(shared.loader.ifcManager, shared.modelID, spaceIds);
          console.log(`[IFC Preview] ${allIds.length} éléments architecturaux résolus pour ${roomName}`);

          if (disposed) return;
          applySubset(shared.loader, shared.modelID, allIds);
          return;
        }

        // ── Cas 2 : BuildingView absent → charger le fichier indépendamment ──
        // (utilisateur sur la page Réservation sans passer par la page Building)
        // Dans ce cas, le WASM est frais et attribue modelID=0 → getAllItemsOfType fonctionne.
        console.log('[IFC Preview] Pas de loader partagé — chargement autonome');
        const loader = new IFCLoader();
        loaderRef.current = loader;
        const wasmPath = wasmUrl.replace(/web-ifc\.wasm$/, '');
        await loader.ifcManager.setWasmPath(wasmPath);

        loader.load(
          IFC_FILE_PATH,
          async (ifcModel: any) => {
            if (disposed || !ifcModel?.ifcManager) return;

            console.log('[IFC Preview] Modèle chargé, modelID:', ifcModel.modelID);
            const modelID = ifcModel.modelID;

            // Ajouter à la scène — opacité initiale comme BuildingView (0.15), sera mise à 1
            // par applySubset via showItems pour la salle sélectionnée
            scene.add(ifcModel);
            const mats = Array.isArray(ifcModel.material) ? ifcModel.material : [ifcModel.material];
            mats.forEach((m: any) => {
              if (m) { m.transparent = true; m.opacity = 0.15; m.needsUpdate = true; }
            });

            // Indexer les espaces (verbose=false → plus fiable)
            let spaceIds: number[] = [];
            try {
              spaceIds = await loader.ifcManager.getAllItemsOfType(modelID, IFCSPACE, false);
            } catch (e) {
              console.warn('[IFC Preview] getAllItemsOfType:', e);
            }
            console.log(`[IFC Preview] ${spaceIds.length} IDs espaces`);

            // Construire la spaceMap et l'enregistrer pour les prochains renders
            const spaceMap = new Map<string, number[]>();
            for (const id of spaceIds) {
              if (disposed) return;
              try {
                const p = await loader.ifcManager.getItemProperties(modelID, id, false);
                [p?.GlobalId, p?.Name, p?.LongName, p?.Tag].forEach((v: any) => {
                  const k = normalizeKey(v);
                  if (k) {
                    const arr = spaceMap.get(k) ?? [];
                    if (!arr.includes(id)) arr.push(id);
                    spaceMap.set(k, arr);
                  }
                });
              } catch (_) {}
            }

            // Enregistrer pour que BuildingView (s'il se monte plus tard) ne recharge pas
            registerIFCLoader(loader, modelID, spaceMap);

            if (disposed) return;

            const spaceOnlyIds = findInSpaceMap(spaceMap, roomName);
            console.log(`[IFC Preview] ${spaceOnlyIds.length} espaces IFCSPACE trouvés pour ${roomName}`);

            if (spaceOnlyIds.length === 0) {
              setStatus('error');
              setError(`Salle ${roomName} non trouvée`);
              return;
            }

            // Résoudre tous les éléments architecturaux liés à la salle (murs, sol…)
            const allRoomIds = await resolveRoomIds(loader.ifcManager, modelID, spaceOnlyIds);
            console.log(`[IFC Preview] ${allRoomIds.length} éléments architecturaux résolus pour ${roomName}`);

            if (disposed) return;

            applySubset(loader, modelID, allRoomIds, ifcModel);
          },
          (progress: any) => {
            const pct = ((progress.loaded / progress.total) * 100).toFixed(1);
            console.log(`[IFC Preview] Chargement: ${pct}%`);
          },
          (err: any) => {
            console.error('[IFC Preview] Erreur:', err);
            setStatus('error');
            setError('Erreur WebAssembly ou fichier IFC invalide');
          }
        );
      } catch (err: any) {
        console.error('[IFC Preview] Exception:', err);
        setStatus('error');
        setError(err.message);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [roomName]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
      <div ref={mountRef} className="w-full h-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90">
          <div className="text-center">
            <Loader className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-sm font-medium">Chargement de la salle...</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
