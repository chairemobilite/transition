/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { DefaultProps, Layer, LayerContext, LayerExtension } from '@deck.gl/core';

import type { ShaderModule } from '@luma.gl/shadertools';
import { vec3 } from 'gl-matrix';

const uniformBlock = `\
uniform animatedArrowPathUniforms {
  float time;
} animatedArrowPath;
`;

type AnimatedArrowPathProps = {
    time: number;
};

const defaultProps: DefaultProps<_AnimatedArrowPathLayerProps> = {
    time: { type: 'number', value: 0, min: 0, max: 1 },
    disableAnimation: { type: 'boolean', value: false }
};

type _AnimatedArrowPathLayerProps = {
    time: number;
    /**
     * Set to `true` to disable animation
     */
    disableAnimation: boolean;
};

export default class AnimatedArrowPathExtension extends LayerExtension {
    static extensionName = 'AnimatedArrowPathExtension';
    static layerName = 'AnimatedArrowPathLayer';
    static defaultProps = defaultProps;

    initializeState(this: Layer<_AnimatedArrowPathLayerProps>, context: LayerContext, extension: this) {
        this.getAttributeManager()?.addInstanced({
            instanceStartOffsetRatios: {
                size: 1,
                accessor: 'getPath',
                transform: extension.getStartOffsetRatios.bind(this)
            },
            instanceLengthRatios: {
                size: 1,
                accessor: 'getPath',
                transform: extension.getLengthRatios.bind(this)
            }
        });
    }

    getStartOffsetRatios(this: Layer<_AnimatedArrowPathLayerProps>, path): number[] {
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
        return result;
    }

    getLengthRatios(this: Layer<AnimatedArrowPathProps>, path): number[] {
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
        result.push(result[0]); // add last point again to make sure closed paths are handled
        // for some reason, with closed loop paths, it seems the segments are drawn in reverse order or with an offset of 1 index
        return result;
    }

    // TODO: investigate if using a global timer updated in the MainMap state and sent as prop would be better? I guess not, but we should benchmark at least.
    draw(this: Layer<_AnimatedArrowPathLayerProps>, _params: any, _extension: this) {
        const zoom = this.context.viewport?.zoom || 14;

        // Use a non-linear interpolation to match the specified values
        // For zoom 12 -> 0.5, zoom 14 -> 1.0, zoom 20 -> 15.0
        // these values have been tested manually and give the best animation speed by zoom
        let zoomFactor;

        if (zoom < 10) {
            zoomFactor = 0.1;
        } else if (zoom <= 12) {
            // Linear from minZoom to zoom 12
            zoomFactor = 0.5;
        } else if (zoom <= 14) {
            // Linear from zoom 12 to zoom 14
            zoomFactor = 0.5 + ((zoom - 12) * (1.0 - 0.5)) / (14 - 12);
        } else {
            // Exponential from zoom 14 to zoom 20
            const t = (zoom - 14) / (20 - 14);
            zoomFactor = 1.0 + t * t * (15.0 - 1.0);
        }

        const animatedArrowProps: AnimatedArrowPathProps = {
            time: this.props.disableAnimation ? 1 : (performance.now() % 10000) / (10000 * zoomFactor)
        };
        (this.state.model as any)?.shaderInputs.setProps({ animatedArrowPath: animatedArrowProps });
    }

    getShaders(this: Layer<_AnimatedArrowPathLayerProps>) {
        const inject = {
            'vs:#decl': `
                in float instanceLengthRatios;
                in float instanceStartOffsetRatios;
                out float vLengthRatio;
                out float vStartOffsetRatio;
                out float vArrowPathOffset;
            `,

            'vs:#main-end': `
                vLengthRatio = instanceLengthRatios;
                vStartOffsetRatio = instanceStartOffsetRatios;
                vArrowPathOffset += ((animatedArrowPath.time) / 30.0) / width.x;
            `,

            'fs:#decl': `
                in float vArrowPathOffset;
                in float vDistanceBetweenArrows;
                in float vStartOffsetRatio;
                in float vLengthRatio;
            `,

            'fs:#main-end': `
                float percentFromCenter = abs(vPathPosition.x);
                float offset = vArrowPathOffset;
                float totalLength = vPathLength / vLengthRatio;
                float startDistance = vStartOffsetRatio * totalLength;
                float distanceSoFar = startDistance + vPathPosition.y - offset + percentFromCenter;
                float arrowIndex = mod(distanceSoFar, 30.0);
                float percentOfDistanceBetweenArrows = 1.0 - arrowIndex / 30.0;
                
                if (percentOfDistanceBetweenArrows < 0.5) {
                    float percentBlack = percentOfDistanceBetweenArrows / 0.5 * 0.5;
                    fragColor = vec4(mix(vColor.r, 0.0, percentBlack), mix(vColor.g, 0.0, percentBlack), mix(vColor.b, 0.0, percentBlack), 1.0);
                } else if (percentOfDistanceBetweenArrows < 0.75) {
                    float percentWhite = (1.0 - (percentOfDistanceBetweenArrows - 0.5) * 4.0) * 0.75;
                    fragColor = vec4(mix(vColor.r, 1.0, percentWhite), mix(vColor.g, 1.0, percentWhite), mix(vColor.b, 1.0, percentWhite), 1.0);
                } else {
                    fragColor = vec4(vColor.r, vColor.g, vColor.b, 1.0);
                }
            `
        };
        return {
            modules: [
                {
                    name: 'animatedArrowPath',
                    vs: uniformBlock,
                    fs: uniformBlock,
                    uniformTypes: {
                        time: 'f32'
                    },
                    inject
                } as ShaderModule<any>
            ]
        };
    }
}
