
import { PathLayer } from '@deck.gl/layers';
import { LayerExtension } from '@deck.gl/core';
import * as vec3 from 'gl-matrix/vec3';

/* ---- ArrowPathLayer ---- */
export class ArrowPathLayer extends PathLayer {
    getShaders() {
      const shaders = super.getShaders();
      shaders.inject['vs:#decl'] += `\
    uniform float arrowPathStart;`;
      shaders.inject['vs:#main-end'] += `\
    vArrowPathOffset += arrowPathStart;`;
      return shaders;
    }
    
    draw(opts) {
      opts.uniforms.arrowPathStart = this.props.arrowPathStart || 0;
      super.draw(opts);
    }
}
/* ---- ArrowPathLayer ---- */

/* ---- ArrowPathStyleExtension ---- */

// export type ArrowPathStyleExtension<DataT = any> = {
//   /**
//    * Accessor for the size array to draw each path with: `[solidLength, gapLength]` relative to the length of the path.
//    */
//   getSizeArray?;
// };

// TODO: check if we could just use a subclass of PathLayer instead of using this LayerExtension functionality. 
// See https://deck.gl/docs/developer-guide/custom-layers/layer-extensions

/** Adds selected features to the `ArrowPathLayer` */
const arrowPathStyleExtensionDefaultProps = {
  getSizeArray: {type: 'accessor', value: [0, 0]},
};
export class ArrowPathStyleExtension extends LayerExtension {
  static defaultProps = arrowPathStyleExtensionDefaultProps;
  static extensionName = 'ArrowPathStyleExtension';

  getShaders() {
    return {
        // Code here is largely inspired by / copied from https://github.com/visgl/deck.gl/blob/master/modules/extensions/src/path-style/path-style-extension.ts
    
        inject: {
          'vs:#decl': `
      attribute vec2 instanceArrowPathArrays;
      attribute float instanceArrowPathOffsets;
      varying vec2 vArrowPathArray;
      varying float vArrowPathOffset;
      `,
      
          'vs:#main-end': `
      vArrowPathArray = instanceArrowPathArrays;
      vArrowPathOffset = instanceArrowPathOffsets / width.x;
      `,
      
          'fs:#decl': `
      varying vec2 vArrowPathArray;
      varying float vArrowPathOffset;
      
      float round(float x) {
        return floor(x + 0.5);
      }
      `,
          'fs:#main-start': `
        float solidLength = vArrowPathArray.x;
        float gapLength = vArrowPathArray.y;
        float unitLength = solidLength + gapLength;
      
        float offset = 0.0;
        float unitOffset = 0.0;
        if (unitLength > 0.0) {
          offset = vArrowPathOffset;
          unitOffset = mod(vPathPosition.y + offset, unitLength);
        }
      `,
          'fs:#main-end': `\
        float relY = unitOffset / unitLength;
    
        // See this link for info about vPathPosition variable
        // https://github.com/visgl/deck.gl/blob/b7c9fcc2b6e8693b5574a498fd128919b9780b49/modules/layers/src/path-layer/path-layer-fragment.glsl.ts#L31-L35
    
        // Draw a white arrow for the first 12% of the arrow length.
        float arrowEnd = 0.12;
        if (relY < arrowEnd && abs(vPathPosition.x) <= 10.0*relY) {
          gl_FragColor = vec4(255/255, 255/255, 255/255, 1.0); // white
        } else {
          // Can this be cleaned up?
          // This is to make the fade start at the end of the white arrow rather than at the top.
          float alpha = 1.0 - relY;
          if (relY < arrowEnd) {
              alpha = 1.0 - alpha - arrowEnd;
          }
    
          gl_FragColor = vec4(102/255, 102/255, 255/255, mix(0.5, 1.0, alpha));
        }
      `
        }
    };
  }

  initializeState(context, extension) {
    const attributeManager = this.getAttributeManager();
    if (!attributeManager) {
      return;
    }

    attributeManager.addInstanced({
        instanceArrowPathArrays: {size: 2, accessor: 'getSizeArray'},
        instanceArrowPathOffsets: {
          size: 1,
          accessor: 'getPath',
          transform: extension.getArrowPathOffsets.bind(this)
        }
    });
  }

  getArrowPathOffsets(path) {
    const result = [0];
    if (path === undefined) {
        return result;
    }
    const positionSize = this.props.positionFormat === 'XY' ? 2 : 3;
    const isNested = Array.isArray(path[0]);
    const geometrySize = isNested ? path.length : path.length / positionSize;

    let p;
    let prevP;
    for (let i = 0; i < geometrySize - 1; i++) {
      p = isNested ? path[i] : path.slice(i * positionSize, i * positionSize + positionSize);
      p = this.projectPosition(p);

      if (i > 0) {
        result[i] = result[i - 1] + vec3.dist(prevP, p);
      }

      prevP = p;
    }
    return result;
  }
}

/* ---- ArrowPathStyleExtension ---- */