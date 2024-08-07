/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { PathLayer, PathLayerProps } from '@deck.gl/layers';
import { Accessor, DefaultProps } from '@deck.gl/core';
import * as vec3 from 'gl-matrix/vec3/';

export type AnimatedArrowPathLayerProps<DataT = any> = _AnimatedArrowPathLayerProps<DataT> & PathLayerProps<DataT>;

type _AnimatedArrowPathLayerProps<DataT = unknown> = {
    /**
     * [solid length, gap length] accessor.
     * @default 8
     */
    getDistanceBetweenArrows?: Accessor<DataT, number>;

    /**
     * Arrow path speed scaling. The larger the number, the slower the path movement. 0 prevents movement
     * @default 1
     */
    speedDivider?: number;

    /**
     * Set to `true` to disable animation
     */
    disableAnimation?: boolean;
};

const defaultProps: DefaultProps<AnimatedArrowPathLayerProps> = {
    getDistanceBetweenArrows: { type: 'accessor', value: 20 },
    speedDivider: 1,
    disableAnimation: false
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
            this.setState({
                animationID: window.requestAnimationFrame(animate) // draw next frame
            });
        };
        const animationID = this.props.disableAnimation === true ? 0 : window.requestAnimationFrame(animate);
        this.setState({
            animationID: animationID
        });

        const attributeManager = this.getAttributeManager();
        attributeManager?.addInstanced({
            instanceDistanceBetweenArrows: { size: 1, accessor: 'getDistanceBetweenArrows' },
            instanceStartOffsetRatios: {
                size: 1,
                accessor: 'getPath',
                transform: this.getStartOffsetRatios
            },
            instanceLengthRatios: {
                size: 1,
                accessor: 'getPath',
                transform: this.getLengthRatios
            }
        });
    }

    draw(opts) {
        opts.uniforms.arrowPathTimeStep =
            this.props.disableAnimation === true ? 0 : (performance.now() % 100000) / 100000; // resets every 100 seconds
        opts.uniforms.speedDivider = this.props.speedDivider;
        super.draw(opts);
    }

    getStartOffsetRatios = (path): number[] => {
        const result = [0] as number[];
        if (path === undefined || path.length < 2) {
            return result;
        }
        const positionSize = this.props.positionFormat === 'XY' ? 2 : 3;
        const isNested = Array.isArray(path[0]);
        const geometrySize = isNested ? path.length : path.length / positionSize;
        let sumLength = 0;
        let p;
        let prevP;
        for (let i = 0; i < geometrySize; i++) {
            p = isNested ? path[i] : path.slice(i * positionSize, i * positionSize + positionSize);
            p = this.projectPosition(p);
            if (i > 0) {
                const distance = vec3.dist(prevP, p);
                if (i < geometrySize - 1) {
                    result[i] = result[i - 1] + distance;
                }
                sumLength += distance;
            }
            prevP = p;
        }
        for (let i = 0, count = result.length; i < count; i++) {
            result[i] = result[i] / sumLength;
        }
        console.log('getStartOffsetRatios', result);
        return result;
    };

    getLengthRatios = (path): number[] => {
        const result = [] as number[];
        if (path === undefined || path.length < 2) {
            return result;
        }
        const positionSize = this.props.positionFormat === 'XY' ? 2 : 3;
        const isNested = Array.isArray(path[0]);
        const geometrySize = isNested ? path.length : path.length / positionSize;
        let sumLength = 0;
        let p;
        let prevP = this.projectPosition(isNested ? path[0] : path.slice(0, positionSize));
        for (let i = 1; i < geometrySize; i++) {
            p = isNested ? path[i] : path.slice(i * positionSize, i * positionSize + positionSize);
            p = this.projectPosition(p);
            const distance = vec3.dist(prevP, p);
            sumLength += distance;
            result[i - 1] = distance;
            prevP = p;
        }
        for (let i = 0, count = result.length; i < count; i++) {
            result[i] = result[i] / sumLength;
        }
        return result;
    };

    getShaders() {
        return Object.assign({}, super.getShaders(), {
            inject: {
                'vs:#decl': `

                attribute float instanceDistanceBetweenArrows;
                attribute float instanceLengthRatios;
                attribute float instanceStartOffsetRatios;
                varying float vLengthRatio;
                varying float vStartOffsetRatio;
                varying float vDistanceBetweenArrows;
                varying float vArrowPathOffset;
                uniform float arrowPathTimeStep;
                uniform float speedDivider;
          `,

                'vs:#main-end': `

                vLengthRatio = instanceLengthRatios;
                vStartOffsetRatio = instanceStartOffsetRatios;
                vDistanceBetweenArrows = instanceDistanceBetweenArrows;
                vArrowPathOffset = 0.0; //vPathPosition.x;// 

                if (speedDivider != 0.0) {
                  vArrowPathOffset += ((arrowPathTimeStep) / speedDivider) / width.x;
                }
          `,

                'fs:#decl': `

                varying float vDistanceBetweenArrows;
                varying float vStartOffsetRatio;
                varying float vLengthRatio;
                varying float vArrowPathOffset;

          `,
                'fs:#main-start': `

                if (vLengthRatio == 0.0) { // this should not happen
                    discard;
                }
          `,
                'fs:#main-end': `

                float percentFromCenter = abs(vPathPosition.x);
                float offset = vArrowPathOffset;
                float totalLength = vPathLength / vLengthRatio;
                float startDistance = vStartOffsetRatio * totalLength;
                float distanceSoFar = startDistance + vPathPosition.y - offset +percentFromCenter;
                float arrowIndex = mod(distanceSoFar, vDistanceBetweenArrows);
                float percentOfDistanceBetweenArrows = 1.0 - arrowIndex / vDistanceBetweenArrows;
                //float sideAttenuation = 1.0;
                if (percentOfDistanceBetweenArrows < 0.5) {
                    float percentBlack = percentOfDistanceBetweenArrows / 0.5 * 0.5;
                    gl_FragColor = vec4(mix(vColor.r, 0.0, percentBlack), mix(vColor.g, 0.0, percentBlack), mix(vColor.b, 0.0, percentBlack), 1.0);
                } else if (percentOfDistanceBetweenArrows < 0.75) {
                    float percentWhite = (1.0 - (percentOfDistanceBetweenArrows - 0.5) * 4.0) * 0.75;
                    gl_FragColor = vec4(mix(vColor.r, 1.0, percentWhite), mix(vColor.g, 1.0, percentWhite), mix(vColor.b, 1.0, percentWhite), 1.0);
                } else {
                    gl_FragColor = vec4(vColor.r, vColor.g, vColor.b, 1.0);
                }

                // See this link for info about vPathPosition variable
                // https://github.com/visgl/deck.gl/blob/b7c9fcc2b6e8693b5574a498fd128919b9780b49/modules/layers/src/path-layer/path-layer-fragment.glsl.ts#L31-L35

          `
            }
        });
    }
}
