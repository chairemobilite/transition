/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { PathLayer, PathLayerProps } from '@deck.gl/layers/typed';
import { AccessorFunction, DefaultProps } from '@deck.gl/core';
import * as vec3 from 'gl-matrix/vec3';

export type AnimatedArrowPathLayerProps<DataT = any> = _AnimatedArrowPathLayerProps<DataT> & PathLayerProps<DataT>;

type _AnimatedArrowPathLayerProps<DataT = unknown> = {
    /**
     * [solid length, gap length] accessor.
     * @default [4, 4]
     */
    getSizeArray?: AccessorFunction<number, number>;

    /**
     * Arrow path speed scaling. The larger the number, the slower the path movement.
     * @default 3
     */
    speedDivider?: number;
};

const defaultProps: DefaultProps<AnimatedArrowPathLayerProps> = {
    getSizeArray: { type: 'accessor', value: [4, 4] },
    speedDivider: 3
};

export default class AnimatedArrowPathLayer<DataT = any, ExtraProps extends object = never> extends PathLayer<
    DataT,
    Required<_AnimatedArrowPathLayerProps> & ExtraProps
> {
    static layerName = 'AnimatedArrowPathLayer';
    static defaultProps = defaultProps;

    state!: {
        animationID: number;
        time: number;
        pathTesselator: any; // From PathLayer
    };

    constructor(props: any) {
        super(props);
    }

    initializeState() {
        super.initializeState();

        const animate = () => {
            const currentTime = this.state.time || 0;
            this.setState({
                time: currentTime + 1, // % loopLength,
                animationID: window.requestAnimationFrame(animate) // draw next frame
            });
        };
        const animationID = window.requestAnimationFrame(animate);
        this.setState({
            animationID: animationID
        });

        const attributeManager = this.getAttributeManager();
        attributeManager?.addInstanced({
            instanceArrowPathArrays: { size: 2, accessor: 'getSizeArray' },
            instanceArrowPathOffsets: {
                size: 1,
                accessor: 'getPath',
                transform: this.getArrowPathOffsets.bind(this) // TODO: Check if this is executed multiple times or just at layer creation
            }
        });
    }

    draw(opts) {
        opts.uniforms.arrowPathTimeStep = this.state.time || 0;
        opts.uniforms.speedDivider = this.props.speedDivider;
        super.draw(opts);
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

    getShaders() {
        return Object.assign({}, super.getShaders(), {
            // Code here is largely inspired by / copied from https://github.com/visgl/deck.gl/blob/master/modules/extensions/src/path-style/path-style-extension.ts

            inject: {
                'vs:#decl': `
          attribute vec2 instanceArrowPathArrays;
          attribute float instanceArrowPathOffsets;
          varying vec2 vArrowPathArray;
          varying float vArrowPathOffset;
          uniform float arrowPathTimeStep;
          uniform float speedDivider;
          `,

                'vs:#main-end': `
          vArrowPathArray = instanceArrowPathArrays;
          vArrowPathOffset = instanceArrowPathOffsets / width.x;
          vArrowPathOffset += (arrowPathTimeStep / speedDivider);
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
              // TODO : Can this be simplified?
              // This is to make the fade start at the end of the white arrow rather than at the top.
              float alpha = 1.0 - relY;
              if (relY < arrowEnd) {
                  alpha = 1.0 - alpha - arrowEnd;
              }
              gl_FragColor = vec4(vColor.r, vColor.g, vColor.b, mix(0.5, 1.0, alpha));
            }
          `
            }
        });
    }
}
