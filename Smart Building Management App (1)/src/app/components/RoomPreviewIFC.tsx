import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { IFCSPACE } from 'web-ifc';
import wasmUrl from 'web-ifc/web-ifc.wasm?url';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { AlertTriangle, Loader } from 'lucide-react';

const IFC_FILE_PATH = '/models/building.ifc';

function normalizeKey(value: any): string | null {
  if (!value) return null;
  const text = typeof value === 'string' ? value : value.value ?? '';
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, ' ');
}

interface RoomPreviewIFCProps {
  roomName: string;
}

export function RoomPreviewIFC({ roomName }: RoomPreviewIFCProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [error, setError] = useState('');

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
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      10000
    );
    camera.position.set(25, 35, 55);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 1.3));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(40, 90, 50);
    scene.add(dirLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controlsRef.current = controls;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    let disposed = false;

    (async () => {
      try {
        const loader = new IFCLoader();
        const wasmPath = wasmUrl.replace(/web-ifc\.wasm$/, '');
        await loader.ifcManager.setWasmPath(wasmPath);

        console.log(`[IFC Preview] Chargement : ${IFC_FILE_PATH}`);

        loader.load(
          IFC_FILE_PATH,
          async (ifcModel: any) => {
            if (disposed) return;

            console.log('[IFC Preview] Modèle chargé');

            // Récupérer toutes les salles
            const spaces = await ifcModel.ifcManager.getAllItemsOfType(
              ifcModel.modelID,
              IFCSPACE,
              true
            );

            console.log(`[IFC Preview] ${spaces.length} espaces trouvés`);

            // Chercher la salle correspondante
            const targetNormalized = normalizeKey(roomName);
            let targetSpaceIds: number[] = [];

            spaces.forEach((space: any) => {
              const keys = [
                normalizeKey(space.GlobalId),
                normalizeKey(space.Name),
                normalizeKey(space.LongName),
                normalizeKey(space.Tag),
              ].filter(Boolean) as string[];

              keys.forEach((key) => {
                if (targetNormalized && key === targetNormalized) {
                  targetSpaceIds.push(space.expressID);
                  console.log(`[IFC Preview] Salle trouvée: ${roomName} (ID: ${space.expressID})`);
                }
              });
            });

            if (targetSpaceIds.length === 0) {
              setStatus('error');
              setError(`Salle ${roomName} non trouvée`);
              return;
            }

            // Afficher uniquement la salle cible via subset
            const selectionMaterial = new THREE.MeshStandardMaterial({
              color: 0x4a90e2,
              metalness: 0.2,
              roughness: 0.8,
            });

            const subset = ifcModel.ifcManager.createSubset({
              modelID: ifcModel.modelID,
              ids: targetSpaceIds,
              scene,
              removePrevious: true,
              material: selectionMaterial,
            });

            if (subset) {
              // Zoom sur la salle
              const box = new THREE.Box3().setFromObject(subset);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());
              const distance = Math.max(size.x, size.y, size.z) * 2.5;

              cameraRef.current?.position.set(
                center.x + distance * 0.6,
                center.y + distance * 0.9,
                center.z + distance * 1.1
              );
              cameraRef.current?.lookAt(center);
              controlsRef.current?.target.copy(center);
            }

            setStatus('loaded');
          },
          (progress: any) => {
            const percent = ((progress.loaded / progress.total) * 100).toFixed(1);
            console.log(`[IFC Preview] Chargement: ${percent}%`);
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
