import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class BufferGeometryUtils {
  static mergeBufferGeometries(geometries, useGroups = false) {
    return mergeGeometries(geometries, useGroups);
  }
}
