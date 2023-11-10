// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import {LayerExtension} from '@deck.gl/core';
//import {Vector3 as vec3} from '@math.gl/core';
import * as vec3 from 'gl-matrix/vec3';

const defaultProps = {
  getDashArray: {type: 'accessor', value: [0, 0]},
  getOffset: {type: 'accessor', value: 0},
  dashJustified: false,
  dashGapPickable: false
};

// export type PathStyleExtensionProps<DataT = any> = {
//   /**
//    * Accessor for the dash array to draw each path with: `[dashSize, gapSize]` relative to the width of the path.
//    * Requires the `dash` option to be on.
//    */
//   getDashArray?;
//   /**
//    * Accessor for the offset to draw each path with, relative to the width of the path.
//    * Negative offset is to the left hand side, and positive offset is to the right hand side.
//    * @default 0
//    */
//   getOffset?;
//   /**
//    * If `true`, adjust gaps for the dashes to align at both ends.
//    * @default false
//    */
//   dashJustified?;
//   /**
//    * If `true`, gaps between solid strokes are pickable. If `false`, only the solid strokes are pickable.
//    * @default false
//    */
//   dashGapPickable?;
// };

// type PathStyleExtensionOptions = {
//   /**
//    * Add capability to render dashed lines.
//    * @default false
//    */
//   dash: boolean;
//   /**
//    * Add capability to offset lines.
//    * @default false
//    */
//   offset: boolean;
//   /**
//    * Improve dash rendering quality in certain circumstances. Note that this option introduces additional performance overhead.
//    * @default false
//    */
//   highPrecisionDash: boolean;
// };

/** Adds selected features to the `PathLayer` and composite layers that render the `PathLayer`. */
export default class PathStyleExtension2 extends LayerExtension {
  static defaultProps = defaultProps;
  static extensionName = 'PathStyleExtension2';

  constructor({
    dash = false,
    offset = false,
    highPrecisionDash = false
  } = {}) {
    super({dash: dash || highPrecisionDash, offset, highPrecisionDash});
  }

  getShaders() {
    return dashShaders;
  }

  initializeState(context, extension) {
    const attributeManager = this.getAttributeManager();
    if (!attributeManager/* || !extension.isEnabled(thisL)*/) {
      // This extension only works with the PathLayer
      return;
    }

    if (extension.opts.dash) {
      attributeManager.addInstanced({
        instanceDashArrays: {size: 2, accessor: 'getDashArray'},
        instanceDashOffsets: extension.opts.highPrecisionDash
          ? {
              size: 1,
              accessor: 'getPath',
              transform: extension.getDashOffsets.bind(this)
            }
          : {
              size: 1,
              update: attribute => {
                attribute.constant = true;
                attribute.value = [0];
              }
            }
      });
    }
  }

  updateState(
    _,
    params,
  ) {
    //if (!extension.isEnabled(thisL)) {
    //  return;
    //}

    const uniforms = {};

    if (params.opts.dash) {
      uniforms.dashAlignMode = this.props.dashJustified ? 1 : 0;
      uniforms.dashGapPickable = Boolean(this.props.dashGapPickable);
    }
    for (const model of this.getModels()) {
        model.setUniforms(uniforms);
    }
    //this.state.model.setUniforms(uniforms);
  }

  getDashOffsets(path) {
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

const dashShaders = {
    inject: {
      'vs:#decl': `
  attribute vec2 instanceDashArrays;
  attribute float instanceDashOffsets;
  varying vec2 vDashArray;
  varying float vDashOffset;
  `,
  
      'vs:#main-end': `
  vDashArray = instanceDashArrays;
  vDashOffset = instanceDashOffsets / width.x;
  `,
  
      'fs:#decl': `
  uniform float dashAlignMode;
  uniform float capType;
  uniform bool dashGapPickable;
  varying vec2 vDashArray;
  varying float vDashOffset;
  
  float round(float x) {
    return floor(x + 0.5);
  }
  `,
  
      // if given position is in the gap part of the dashed line
      // dashArray.x: solid stroke length, relative to width
      // dashArray.y: gap length, relative to width
      // alignMode:
      // 0 - no adjustment
      // o----     ----     ----     ---- o----     -o----     ----     o
      // 1 - stretch to fit, draw half dash at each end for nicer joints
      // o--    ----    ----    ----    --o--      --o--     ----     --o
      'fs:#main-start': `
    float solidLength = vDashArray.x;
    float gapLength = vDashArray.y;
    float unitLength = solidLength + gapLength;
  
    float offset;
  
    if (unitLength > 0.0) {
      if (dashAlignMode == 0.0) {
        offset = vDashOffset;
      } else {
        unitLength = vPathLength / round(vPathLength / unitLength);
        offset = solidLength / 2.0;
      }
  
      float unitOffset = mod(vPathPosition.y + offset, unitLength);
  
      if (gapLength > 0.0 && unitOffset > solidLength) {
        if (capType <= 0.5) {
          if (!(dashGapPickable && picking_uActive)) {
            discard;
          }
        } else {
          // caps are rounded, test the distance to solid ends
          float distToEnd = length(vec2(
            min(unitOffset - solidLength, unitLength - unitOffset),
            vPathPosition.x
          ));
          if (distToEnd > 1.0) {
            if (!(dashGapPickable && picking_uActive)) {
              discard;
            }
          }
        }
      }
    }
  `,
   /*   'fs:DECKGL_FILTER_COLOR': `\
    color = vec4(102, 102, 255, 1)
  `,*/
    /*   'fs:#main-end': `\
    gl_FragColor = vec4(102, 102, 255, 1.0)
`*/
    }
};