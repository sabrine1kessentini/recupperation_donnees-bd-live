//buildingview.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  IFCSPACE,
  IFCRELCONTAINEDINSPATIALSTRUCTURE,
  IFCRELAGGREGATES,
} from 'web-ifc';
import wasmUrl from 'web-ifc/web-ifc.wasm?url';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { AlertTriangle, Building2, Layers } from 'lucide-react';
import { registerIFCLoader } from './ifc-shared';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const IFCRELSPACEBOUNDARY = 3451746338;
const IFC_FILE_PATH = '/models/building.ifc';
const TARGET_ROOMS = [
  'B109', 'B119', 'B148', 'B113',
  'B123', 'B111', 'B139', 'B135',
  'B125', 'B129', 'B137', 'B150',
  'B152',
];

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

function getIfcText(value: any): string {
  if (!value) return '';
  return typeof value === 'string' ? value : (value.value ?? '');
}

function normalizeKey(value: any): string | null {
  const text = getIfcText(value).trim().toLowerCase();
  if (!text) return null;
  return text.replace(/\s+/g, ' ');
}

function getRoomSearchKeys(roomName: string): string[] {
  const normalizedRoom = roomName.trim().toLowerCase();
  const displayName = ROOM_DISPLAY_NAMES[roomName]?.trim().toLowerCase();
  return [normalizedRoom, displayName].filter(Boolean) as string[];
}

function roomKeyMatches(key: string, searchKeys: string[]): boolean {
  return searchKeys.some((searchKey) => key === searchKey || key.includes(searchKey));
}

// ─────────────────────────────────────────────────────────────────────────────
// Récupère une estimation de BBox depuis les propriétés IFC du space
// En lisant ObjectPlacement + Representation du IFCSPACE
// ─────────────────────────────────────────────────────────────────────────────
async function getRoomBBoxFromIFC(
  manager: any,
  modelID: number,
  spaceExpressId: number
): Promise<{ center: THREE.Vector3; size: THREE.Vector3 } | null> {
  try {
    // Lire les propriétés de quantité (BaseQuantities) pour avoir les vraies dimensions
    const psets = await manager.getPropertySets(modelID, spaceExpressId, true);
    let floorArea = 0;
    let height = 0;
    let perimeter = 0;

    for (const pset of psets) {
      const psetName = getIfcText(pset?.Name).toLowerCase();
      const quantities = pset?.Quantities ?? pset?.HasProperties ?? [];
      for (const q of quantities) {
        const qName = getIfcText(q?.Name).toLowerCase();
        const val = q?.LengthValue?.value ?? q?.AreaValue?.value ?? q?.VolumeValue?.value ?? null;
        if (val === null) continue;
        if (qName.includes('floorarea') || qName.includes('netfloor') || qName.includes('grossfloor')) {
          floorArea = Math.max(floorArea, val);
        }
        if (qName.includes('height')) height = Math.max(height, val);
        if (qName.includes('perimeter')) perimeter = Math.max(perimeter, val);
      }
    }

    console.log('[BBox IFC] floorArea:', floorArea, 'height:', height, 'perimeter:', perimeter);

    // Ces valeurs sont en unités IFC (probablement mm → diviser par 1000, ou m directs)
    // On détecte l'unité : si floorArea > 1000, c'est du mm²
    let areaM2 = floorArea;
    let heightM = height;
    let perimM = perimeter;

    if (floorArea > 1000) { // mm² → m²
      areaM2 = floorArea / 1e6;
      heightM = height / 1000;
      perimM = perimeter / 1000;
    } else if (floorArea > 100) { // cm² → m²  
      areaM2 = floorArea / 1e4;
      heightM = height / 100;
      perimM = perimeter / 100;
    }
    // sinon déjà en m

    // Estimer width/depth depuis aire et périmètre
    // périmètre = 2(w+d), aire = w*d → résoudre le système
    // w+d = P/2, w*d = A → w² - (P/2)w + A = 0
    let estWidth = 0, estDepth = 0;
    if (areaM2 > 0 && perimM > 0) {
      const halfP = perimM / 2;
      const discriminant = halfP * halfP - 4 * areaM2;
      if (discriminant >= 0) {
        estWidth = (halfP + Math.sqrt(discriminant)) / 2;
        estDepth = (halfP - Math.sqrt(discriminant)) / 2;
      } else {
        estWidth = estDepth = Math.sqrt(areaM2);
      }
    }

    console.log('[BBox IFC] estWidth:', estWidth, 'estDepth:', estDepth, 'heightM:', heightM);

    if (estWidth > 0 && estDepth > 0 && heightM > 0) {
      return {
        center: new THREE.Vector3(0, 0, 0), // sera surchargé par la position réelle
        size: new THREE.Vector3(estWidth, heightM, estDepth),
      };
    }
  } catch (e) {
    console.warn('[BBox IFC] Erreur lecture psets:', e);
  }
  return null;
}

async function findAllRoomIds(spaceMap: Map<string, number[]>, roomName: string): Promise<number[]> {
  const result = new Set<number>();
  const searchKeys = getRoomSearchKeys(roomName);

  for (const searchKey of searchKeys) {
    const byExactKey = spaceMap.get(searchKey);
    if (byExactKey?.length) byExactKey.forEach(id => result.add(id));
  }

  for (const guid of ROOM_GLOBAL_IDS[roomName] ?? []) {
    const byGuid = spaceMap.get(guid.trim().toLowerCase());
    if (byGuid?.length) byGuid.forEach(id => result.add(id));
  }

  for (const [key, ids] of spaceMap.entries()) {
    if (roomKeyMatches(key, searchKeys)) ids.forEach(id => result.add(id));
  }

  console.log(`[IFC] Room IDs trouvés pour ${roomName}:`, Array.from(result));
  return Array.from(result);
}

async function findElementsForOneRoom(
  manager: any,
  modelID: number,
  roomExpressId: number
): Promise<number[]> {
  const allIds = new Set<number>([roomExpressId]);
  const excludedIds = new Set<number>();

  try {
    const containedRels = await manager.getAllItemsOfType(modelID, IFCRELCONTAINEDINSPATIALSTRUCTURE, true);
    for (const rel of containedRels) {
      const relSpace = rel.RelatingStructure;
      const relId = typeof relSpace === 'object' ? (relSpace?.value ?? relSpace?.expressID) : relSpace;
      if (relId !== roomExpressId) continue;
      const related = rel.RelatedElements;
      if (!Array.isArray(related)) continue;
      for (const el of related) {
        const id = typeof el === 'object' ? (el?.value ?? el?.expressID) : el;
        if (id) allIds.add(id);
      }
    }
  } catch (e) { console.warn('[IFC] ContainedInSpatialStructure error:', e); }

  try {
    const spaceBoundaryRels = await manager.getAllItemsOfType(modelID, IFCRELSPACEBOUNDARY, true);
    for (const rel of spaceBoundaryRels) {
      const relSpace = rel.RelatingSpace;
      const relId = typeof relSpace === 'object' ? (relSpace?.value ?? relSpace?.expressID) : relSpace;
      if (relId !== roomExpressId) continue;
      const element = rel.RelatedBuildingElement;
      if (!element) continue;
      const id = typeof element === 'object' ? (element?.value ?? element?.expressID) : element;
      if (!id) continue;
      try {
        const entity = await manager.getItemProperties(modelID, id, false);
        const typeStr = String(entity?.type ?? '').toUpperCase();
        const nameStr = getIfcText(entity?.Name).toUpperCase();
        const predType = getIfcText(entity?.PredefinedType).toUpperCase();
        const isCeiling =
          (typeStr.includes('SLAB') && (predType === 'ROOF' || predType === 'BASESLAB')) ||
          typeStr.includes('ROOF') ||
          nameStr.includes('CEILING') || nameStr.includes('PLAFOND') || nameStr.includes('TOITURE');
        if (isCeiling) excludedIds.add(id);
        else allIds.add(id);
      } catch (_) { allIds.add(id); }
    }
  } catch (e) { console.warn('[IFC] SpaceBoundary error:', e); }

  excludedIds.forEach(id => allIds.delete(id));

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
  } catch (e) { console.warn('[IFC] Aggregates error:', e); }

  return Array.from(allIds);
}

async function findAllElementsInRoom(
  manager: any,
  modelID: number,
  spaceMap: Map<string, number[]>,
  roomName: string
): Promise<{ ids: number[]; primaryRoomId: number | null }> {
  const roomIds = await findAllRoomIds(spaceMap, roomName);
  if (!roomIds.length) return { ids: [], primaryRoomId: null };

  const allIds = new Set<number>();
  for (const roomId of roomIds) {
    const ids = await findElementsForOneRoom(manager, modelID, roomId);
    ids.forEach(id => allIds.add(id));
  }

  const primaryRoomId = roomIds[0] ?? null;

  console.log(`[IFC] ${roomName} total — ${allIds.size} éléments (depuis ${roomIds.length} nœuds)`);
  return { ids: Array.from(allIds), primaryRoomId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue intérieure : on utilise la BBox du subset isolé, puis les propriétés IFC
// comme fallback si la géométrie de la salle ne suffit pas.
// ─────────────────────────────────────────────────────────────────────────────
function applyInteriorCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  center: THREE.Vector3,
  roomSizeEstimate: THREE.Vector3
) {
  // Axe de profondeur le plus long
  const width = Math.max(roomSizeEstimate.x, 1);
  const height = Math.max(roomSizeEstimate.y, 2.4);
  const depth = Math.max(roomSizeEstimate.z, 1);
  const useZ = depth >= width;

  // Plancher = center.y - hauteur/2, yeux = plancher + 1.6m
  // (en coordonnées monde Three.js, Y est vers le haut)
  const floorY = center.y - height / 2;
  const eyeY = floorY + Math.min(Math.max(height * 0.35, 1.5), height * 0.75);
  const cameraOffset = Math.max((useZ ? depth : width) * 0.22, 0.8);
  const lookOffset = Math.max((useZ ? depth : width) * 0.28, 1.2);

  const camPos = useZ
    ? new THREE.Vector3(center.x, eyeY, center.z + cameraOffset)
    : new THREE.Vector3(center.x + cameraOffset, eyeY, center.z);
  const target = useZ
    ? new THREE.Vector3(center.x, eyeY, center.z - lookOffset)
    : new THREE.Vector3(center.x - lookOffset, eyeY, center.z);

  controls.target.copy(target);
  controls.minDistance = 0.01;
  controls.maxDistance = 100000;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  camera.near = 0.01;
  camera.fov = 78;
  camera.position.copy(camPos);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  controls.update();

  console.log('[ZOOM] Applied — center:', center, 'size:', roomSizeEstimate, 'camPos:', camPos, 'target:', target, 'eyeY:', eyeY);
}

function applyOverviewCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  center: THREE.Vector3,
  size: THREE.Vector3
) {
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDim * 2.2;

  controls.target.copy(center);
  controls.minDistance = 0.01;
  controls.maxDistance = 100000;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  camera.near = 0.01;
  camera.fov = 55;
  camera.position.set(
    center.x + distance * 0.8,
    center.y + distance * 0.65,
    center.z + distance * 0.9
  );
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  controls.update();

  console.log('[ZOOM] Overview applied — center:', center, 'size:', size, 'distance:', distance);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lit le centre réel de la salle depuis les coordonnées de placement IFC
// en lisant la BBox de l'IFCSPACE depuis le mesh Three.js du modèle
// On filtre les vertices du mesh principal qui correspondent aux IDs de la salle
// ─────────────────────────────────────────────────────────────────────────────
function getCenterFromModel(model: any): THREE.Vector3 | null {
  // Le modèle IFC est un Mesh unique avec toute la géométrie
  // On utilise sa BBox complète pour estimer la position du bâtiment
  // puis on utilisera les données IFC pour affiner
  try {
    const box = new THREE.Box3();
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    if (!box.isEmpty()) {
      return box.getCenter(new THREE.Vector3());
    }
  } catch (e) { /* ignore */ }
  return null;
}

function getObjectBounds(object: THREE.Object3D): { center: THREE.Vector3; size: THREE.Vector3 } | null {
  try {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return null;
    return {
      center: box.getCenter(new THREE.Vector3()),
      size: box.getSize(new THREE.Vector3()),
    };
  } catch (e) {
    return null;
  }
}

export function BuildingView() {
  const mountRef = useRef<HTMLDivElement>(null);
  const ifcModelRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const subsetRef = useRef<any>(null);
  const spaceMapRef = useRef<Map<string, number[]>>(new Map());
  // Stocker le center du bâtiment calculé au chargement
  const buildingCenterRef = useRef<THREE.Vector3 | null>(null);

  const selectionMat = useRef(
    new THREE.MeshLambertMaterial({
      color: 0x00cc44,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthTest: true,
    })
  );

  const [modelStatus, setModelStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [modelError, setModelError] = useState('');
  const [isIsolated, setIsIsolated] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('B109');
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8084/ws'),
      reconnectDelay: 5000,
      onConnect: () => setWsConnected(true),
      onDisconnect: () => setWsConnected(false),
    });
    client.activate();
    return () => { client.deactivate(); };
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0xf5f0e4, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f0e4);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60, container.clientWidth / container.clientHeight, 0.01, 100000
    );
    camera.position.set(25, 35, 55);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dir1.position.set(40, 90, 50);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xffffff, 1.0);
    dir2.position.set(-40, 60, -50);
    scene.add(dir2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.01;
    controls.maxDistance = 100000;
    controlsRef.current = controls;

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    let disposed = false;
    (async () => {
      try {
        const loader = new IFCLoader();
        const wasmPath = wasmUrl.replace(/web-ifc\.wasm$/, '');
        await loader.ifcManager.setWasmPath(wasmPath);

        loader.load(
          IFC_FILE_PATH,
          async (ifcModel: any) => {
            if (disposed || !ifcModel?.ifcManager) {
              setModelStatus('error');
              setModelError('Modèle IFC invalide');
              return;
            }
            ifcModelRef.current = ifcModel;
            scene.add(ifcModel);

            // Calculer le center du bâtiment immédiatement après le chargement
            setTimeout(() => {
              const c = getCenterFromModel(ifcModel);
              if (c) {
                buildingCenterRef.current = c;
                console.log('[IFC] Building center:', c);
              }
            }, 500);

            try {
              const spaces = await ifcModel.ifcManager.getAllItemsOfType(
                ifcModel.modelID, IFCSPACE, true
              );
              spaces.forEach((space: any) => {
                const id: number = space.expressID;
                [space.GlobalId, space.Name, space.LongName, space.Tag]
                  .map(normalizeKey)
                  .filter(Boolean)
                  .forEach((key: any) => {
                    const arr = spaceMapRef.current.get(key) ?? [];
                    if (!arr.includes(id)) arr.push(id);
                    spaceMapRef.current.set(key, arr);
                  });
              });
              console.log(`[IFC] ${spaces.length} espaces indexés`);
            } catch (e) {
              console.error('[IFC] Erreur indexation:', e);
            }

            // Partager le loader avec RoomPreviewIFC pour éviter le conflit modelID
            registerIFCLoader(loader, ifcModel.modelID, spaceMapRef.current);

            const mats = Array.isArray(ifcModel.material)
              ? ifcModel.material : [ifcModel.material];
            mats.forEach((m: any) => {
              m.transparent = true; m.opacity = 0.15; m.needsUpdate = true;
            });
            setModelStatus('loaded');
          },
          undefined,
          (err: any) => { setModelStatus('error'); setModelError(String(err?.message ?? err)); }
        );
      } catch (err: any) {
        setModelStatus('error');
        setModelError(err.message);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (modelStatus !== 'loaded' || !ifcModelRef.current || !sceneRef.current) return;

    const model = ifcModelRef.current;
    const scene = sceneRef.current;
    const manager = model.ifcManager;

    const setOpacity = (opacity: number) => {
      const mats = Array.isArray(model.material) ? model.material : [model.material];
      mats.forEach((m: any) => {
        m.transparent = opacity < 1; m.opacity = opacity; m.needsUpdate = true;
      });
      model.visible = opacity > 0;
    };

    const cleanup = () => {
      if (subsetRef.current) {
        scene.remove(subsetRef.current);
        subsetRef.current.geometry?.dispose();
        subsetRef.current = null;
      }
      try { manager.removeSubset(model.modelID, undefined, selectionMat.current); } catch (_) {}
    };

    if (isIsolated) {
      cleanup();

      findAllElementsInRoom(manager, model.modelID, spaceMapRef.current, selectedRoom)
        .then(async ({ ids: allIds, primaryRoomId }) => {
          if (!allIds.length) {
            console.warn(`[IFC] Aucun élément trouvé pour ${selectedRoom}`);
            manager.showAllItems(model.modelID);
            setOpacity(0.15);
            return;
          }

          manager.hideAllItems(model.modelID);
          manager.showItems(model.modelID, allIds);
          model.visible = true;
          setOpacity(1);

          // Subset coloré
          let subsetBounds: { center: THREE.Vector3; size: THREE.Vector3 } | null = null;

          try {
            const subset = manager.createSubset({
              modelID: model.modelID,
              ids: allIds,
              removePrevious: true,
              material: selectionMat.current,
              customID: `${selectedRoom.toLowerCase()}-subset`,
            });
            if (subset) {
              subset.visible = true;
              scene.add(subset);
              subsetRef.current = subset;
              subsetBounds = getObjectBounds(subset);
            }
          } catch (e) {
            console.warn('[IFC] Subset non créé:', e);
          }

          if (!subsetBounds && primaryRoomId) {
            subsetBounds = await getRoomBBoxFromIFC(manager, model.modelID, primaryRoomId);
          }

          if (!subsetBounds) {
            subsetBounds = getObjectBounds(model);
          }

          if (!subsetBounds) return;

          // Centre depuis les logs précédents (coordonnées Three.js réelles)
          // center = (46.28, -2.76, -29.17) — ce sont les vraies coordonnées monde
          const roomCenter = subsetBounds.center;
          const roomSize = subsetBounds.size;

          console.log(`[ZOOM] ${selectedRoom} roomCenter:`, roomCenter, 'roomSize:', roomSize);

          const camera = cameraRef.current;
          const controls = controlsRef.current;
          if (!camera || !controls) return;

          // Attendre quelques frames pour le rendu du subset
          let frames = 0;
          const waitAndApply = () => {
            frames++;
            if (rendererRef.current) rendererRef.current.render(scene, camera);
            if (frames < 5) { requestAnimationFrame(waitAndApply); return; }
            applyInteriorCamera(camera, controls, roomCenter, roomSize);
          };
          requestAnimationFrame(waitAndApply);
        });

    } else {
      cleanup();
      manager.showAllItems(model.modelID);
      setOpacity(0.15);

      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
      if (cameraRef.current) {
        cameraRef.current.near = 0.01;
        cameraRef.current.fov = 60;
        cameraRef.current.position.set(25, 35, 55);
        cameraRef.current.updateProjectionMatrix();
      }
    }
  }, [modelStatus, isIsolated, selectedRoom]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 to-zinc-100">
      <header className="m-6 rounded-3xl bg-white/90 border border-white p-6 shadow-xl backdrop-blur-xl">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">Jumeau Numérique</p>
            <h1 className="text-3xl font-bold">
              {ROOM_DISPLAY_NAMES[selectedRoom] ?? 'Salle IFC'} ({selectedRoom})
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${wsConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {wsConnected ? '● Live' : '○ Offline'}
            </span>
            <select
              value={selectedRoom}
              onChange={(event) => setSelectedRoom(event.target.value)}
              disabled={modelStatus !== 'loaded'}
              className="bg-white px-4 py-3 rounded-2xl border text-sm font-medium hover:bg-amber-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {TARGET_ROOMS.map((room) => (
                <option key={room} value={room}>
                  {room} - {ROOM_DISPLAY_NAMES[room] ?? 'Salle'}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsIsolated(v => !v)}
              disabled={modelStatus !== 'loaded'}
              className="flex items-center gap-2 bg-white px-6 py-3 rounded-2xl border hover:bg-amber-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Building2 className="h-5 w-5" />
              {isIsolated ? 'Voir tout le bâtiment' : 'Voir uniquement la salle'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 gap-6 p-6">
        <div className="flex-1 relative rounded-3xl overflow-hidden border border-white shadow-2xl bg-white">
          <div ref={mountRef} className="w-full h-full" />

          {isIsolated && modelStatus === 'loaded' && (
            <div className="absolute top-4 left-4 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur">
              Vue intérieure {selectedRoom} - zoom libre molette
            </div>
          )}

          {modelStatus === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90">
              <div className="text-center">
                <Layers className="h-12 w-12 animate-spin mx-auto text-amber-600" />
                <p className="mt-4 text-lg">Chargement du modèle 3D...</p>
              </div>
            </div>
          )}
          {modelStatus === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50">
              <div className="text-center max-w-md">
                <AlertTriangle className="h-16 w-16 text-red-600 mx-auto" />
                <p className="mt-4 font-bold text-red-700">Erreur de chargement</p>
                <p className="text-sm text-red-600 mt-2">{modelError}</p>
              </div>
            </div>
          )}
        </div>

        <div className="w-96 bg-white/90 border border-white rounded-3xl p-6 shadow-xl backdrop-blur-xl flex flex-col gap-6">
          {/* Panneau capteurs */}
        </div>
      </div>
    </div>
  );
}
