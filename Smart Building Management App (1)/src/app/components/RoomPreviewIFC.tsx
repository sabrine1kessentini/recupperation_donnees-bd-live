import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { IFCSPACE } from 'web-ifc';
import wasmUrl from 'web-ifc/web-ifc.wasm?url';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { AlertTriangle, Loader } from 'lucide-react';
import { getIFCSharedState, registerIFCLoader } from './ifc-shared';

const IFC_FILE_PATH = '/models/building.ifc';

const ROOM_DISPLAY_NAMES: Record<string, string> = {
  B109: 'CONFERENCE ROOM 3',
  B125: 'CONFERENCE ROOM 1',
  B129: 'CONFERENCE ROOM 2',
  B150: 'MEETING ROOM 1',
  B152: 'MEETING ROOM 2',
  B111: 'CONFERENCE ROOM 5',
  B123: 'MEETING ROOM 3',
  B148: 'CONFERENCE ROOM 6',
  B119: 'MEETING ROOM 4',
};

const ROOM_GLOBAL_IDS: Record<string, string[]> = {
  B109: ['0uGek424j05BaSi7k8quU_'],
};

function normalizeKey(value: any): string | null {
  if (!value) return null;
  const text = typeof value === 'string' ? value : value.value ?? '';
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, ' ');
}

function getRoomSearchKeys(roomName: string): string[] {
  const normalizedRoom = roomName.trim().toLowerCase();
  const displayName = ROOM_DISPLAY_NAMES[roomName]?.trim().toLowerCase();
  const globalIds = ROOM_GLOBAL_IDS[roomName]?.map((id) => id.trim().toLowerCase()) ?? [];
  return [normalizedRoom, displayName, ...globalIds].filter(Boolean) as string[];
}

function roomKeyMatches(key: string, searchKeys: string[]): boolean {
  return searchKeys.some((searchKey) => key === searchKey || key.includes(searchKey));
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
    function applySubset(loader: any, modelID: number, targetIds: number[]) {
      const selectionMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a90e2, metalness: 0.2, roughness: 0.8,
      });

      const subset = loader.ifcManager.createSubset({
        modelID,
        ids: targetIds,
        scene,
        removePrevious: false,
        material: selectionMaterial,
      });

      if (subset) {
        const box      = new THREE.Box3().setFromObject(subset);
        const center   = box.getCenter(new THREE.Vector3());
        const size     = box.getSize(new THREE.Vector3());
        const distance = Math.max(size.x, size.y, size.z) * 2.5;
        cameraRef.current?.position.set(
          center.x + distance * 0.6,
          center.y + distance * 0.9,
          center.z + distance * 1.1,
        );
        cameraRef.current?.lookAt(center);
        controlsRef.current?.target.copy(center);
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
          const targetIds = findInSpaceMap(shared.spaceMap, roomName);
          console.log(`[IFC Preview] ${targetIds.length} espaces trouvés via spaceMap partagée`);

          if (disposed) return;

          if (targetIds.length === 0) {
            setStatus('error');
            setError(`Salle ${roomName} non trouvée`);
            return;
          }

          applySubset(shared.loader, shared.modelID, targetIds);
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

            // Ajouter à la scène + masquer (seul le subset sera visible)
            scene.add(ifcModel);
            const mats = Array.isArray(ifcModel.material) ? ifcModel.material : [ifcModel.material];
            mats.forEach((m: any) => {
              if (m) { m.transparent = true; m.opacity = 0; m.needsUpdate = true; }
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

            const targetIds = findInSpaceMap(spaceMap, roomName);
            console.log(`[IFC Preview] ${targetIds.length} espaces trouvés pour ${roomName}`);

            if (targetIds.length === 0) {
              setStatus('error');
              setError(`Salle ${roomName} non trouvée`);
              return;
            }

            applySubset(loader, modelID, targetIds);
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
