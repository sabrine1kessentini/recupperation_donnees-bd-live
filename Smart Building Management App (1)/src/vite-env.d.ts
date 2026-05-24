/// <reference types="vite/client" />

declare module '*.wasm?url' {
  const src: string;
  export default src;
}

declare module 'web-ifc' {
  export const IFCSPACE: number;
  export const IFCWALLSTANDARDCASE: number;
  export const IFCWINDOW: number;
  export const IFCDOOR: number;
  export const IFCBUILDINGSTOREY: number;
  export const IFCRELAGGREGATES: number;
  export const IFCRELDEFINESBYPROPERTIES: number;
}

declare module 'web-ifc-three/IFCLoader' {
  import * as THREE from 'three';

  export class IFCLoader {
    public ifcManager: {
      setWasmPath(path: string): Promise<void>;
      getAllItemsOfType(modelID: number, type: number, verbose: boolean): Promise<any[]>;
      createSubset(config: {
        modelID: number;
        ids: number[];
        material: THREE.Material;
        scene?: THREE.Object3D;
        removePrevious: boolean;
        customID?: string;
      }): THREE.Mesh;
      removeSubset(modelID: number, parent?: THREE.Object3D, material?: THREE.Material): void;
      dispose?(): Promise<void>;
    };
    load(url: string, onLoad: (ifc: any) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: any) => void): void;
  }
}
