/*
 * Copyright 2025, Polytechnique Montreal and contributors
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
  float arrowSpacing;
} animatedArrowPath;
`;

type AnimatedArrowPathProps = {
    time: number;
    arrowSpacing: number;
};

const defaultProps: DefaultProps<_AnimatedArrowPathLayerProps> = {
    time: { type: 'number', value: 0, min: 0, max: 1 },
    arrowSpacing: { type: 'number', value: 30.0, min: 1 },
    disableAnimation: { type: 'boolean', value: false }
};

type _AnimatedArrowPathLayerProps = {
    time: number;
    arrowSpacing: number;
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
    getStartOffsetRatios(this: Layer<_AnimatedArrowPathLayerProps>, path: number[] | number[][]): number[] {
        const result = [0] as number[];
        if (path === undefined || path.length < 2) {
            return result;
        }
        const positionSize = this.props.positionFormat === 'XY' ? 2 : 3;
        const isNested = Array.isArray(path[0]);
        const geometrySize = isNested ? path.length : path.length / positionSize;
        let sumLength = 0;
        let p: number[];
        let prevP: number[] | undefined;
        for (let i = 0; i < geometrySize; i++) {
            p = isNested
                ? (path as number[][])[i]
                : (path as number[]).slice(i * positionSize, i * positionSize + positionSize);
            p = this.projectPosition(p);
            if (i > 0 && prevP !== undefined) {
                const distance = vec3.dist(prevP, p);
                if (i < geometrySize - 1) {
                    result[i] = result[i - 1] + distance;
                }
                sumLength += distance;
            }
            prevP = p;
        }
        if (sumLength === 0) {
            return result;
        }
        for (let i = 0, count = result.length; i < count; i++) {
            result[i] = result[i] / sumLength;
        }
        return result;
    }

    getLengthRatios(this: Layer<AnimatedArrowPathProps>, path: number[] | number[][]): number[] {
        const result = [] as number[];
        if (path === undefined || path.length < 2) {
            return result;
        }
        const positionSize = this.props.positionFormat === 'XY' ? 2 : 3;
        const isNested = Array.isArray(path[0]);
        const geometrySize = isNested ? path.length : path.length / positionSize;
        let sumLength = 0;
        let p: number[];
        let prevP: number[] = this.projectPosition(
            isNested ? (path as number[][])[0] : (path as number[]).slice(0, positionSize)
        );
        for (let i = 1; i < geometrySize; i++) {
            p = isNested
                ? (path as number[][])[i]
                : (path as number[]).slice(i * positionSize, i * positionSize + positionSize);
            p = this.projectPosition(p);
            const distance = vec3.dist(prevP, p);
            sumLength += distance;
            result[i - 1] = distance;
            prevP = p;
        }
        if (sumLength === 0) {
            return result;
        }
        for (let i = 0, count = result.length; i < count; i++) {
            result[i] = result[i] / sumLength;
        }
        result.push(result[0]); // add last point again to make sure closed paths are handled
        return result;
    }

    draw(this: Layer<_AnimatedArrowPathLayerProps>, _params: Record<string, unknown>, _extension: this) {
        const zoom = this.context.viewport?.zoom || 14;

        // Arrow spacing in shader units - this is how far apart arrows are
        const arrowSpacing = this.props.arrowSpacing;

        // Zoom factor calculation
        // Multiplier adjusts for low zoom being too fast visually
        const multiplier = (199 - 9 * zoom) / 19; // 10x slower at zoom 1, 1x at zoom 20
        // See for exact formula: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Resolution_and_Scale
        const zoomFactor = multiplier * Math.pow(2, zoom - 15.6);

        // Original speed calculation to maintain correct visual speed
        const baseSpeed = 0.01; // Shader units per second before zoom adjustment, gives a good average speed
        const adjustedSpeed = baseSpeed / zoomFactor;

        // Fixed cycle duration - there will be a shift every 60 seconds when time wraps
        // The shift amount depends on zoom level and is generally acceptable for this use case
        const cycleDuration = 60.0; // seconds

        // Wrap time at the cycle duration to prevent overflow (performance.now() / 1000 gives seconds)
        const wrappedTime = (performance.now() / 1000) % cycleDuration;

        // Calculate distance traveled in this cycle - this is the animation time value
        const animationTime = this.props.disableAnimation ? 1 : wrappedTime * adjustedSpeed;
        const animatedArrowProps: AnimatedArrowPathProps = {
            time: animationTime,
            arrowSpacing: arrowSpacing
        };
        const model = this.state.model as { shaderInputs?: { setProps: (props: Record<string, unknown>) => void } };
        model?.shaderInputs?.setProps({ animatedArrowPath: animatedArrowProps });
    }

    // See https://deck.gl/docs/developer-guide/custom-layers/picking for more information about picking colors
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
                vArrowPathOffset = animatedArrowPath.time / width.x;
            `,

            'fs:#decl': `
                in float vArrowPathOffset;
                in float vStartOffsetRatio;
                in float vLengthRatio;
            `,

            'fs:#main-end': `
                float percentFromCenter = abs(vPathPosition.x);
                float offset = vArrowPathOffset;
                float totalLength = vPathLength / vLengthRatio;
                float startDistance = vStartOffsetRatio * totalLength;
                // percentFromCenter * 2.0 makes the arrow twice as pointy.
                float distanceSoFar = startDistance + vPathPosition.y - offset + percentFromCenter * 2.0;
                float arrowIndex = mod(distanceSoFar, animatedArrowPath.arrowSpacing);
                float percentOfDistanceBetweenArrows = 1.0 - arrowIndex / animatedArrowPath.arrowSpacing;
                
                // Create white border effect on the edges
                float borderWidth = 0.3; // Adjust this value to control border thickness
                float borderFactor = smoothstep(1.0 - borderWidth, 1.0, percentFromCenter);
                
                vec3 finalColor;
                if (percentOfDistanceBetweenArrows < 0.5) {
                    float percentBlack = percentOfDistanceBetweenArrows / 0.5 * 0.5;
                    finalColor = mix(vColor.rgb, vec3(0.0), percentBlack);
                } else if (percentOfDistanceBetweenArrows < 0.75) {
                    float percentWhite = (1.0 - (percentOfDistanceBetweenArrows - 0.5) * 4.0) * 0.75;
                    finalColor = mix(vColor.rgb, vec3(1.0), percentWhite);
                } else {
                    finalColor = vColor.rgb;
                }
                
                // Apply white border with antialiasing
                finalColor = mix(finalColor, vec3(1.0), borderFactor);
                
                // Required for events to work with picking: Apply deck.gl picking color filtering
                // This ensures that clicking works properly by allowing deck.gl to render picking colors
                // when in picking mode, and our custom colors when in normal rendering mode
                fragColor = picking_filterPickingColor(vec4(finalColor, 1.0));
            `
        };
        return {
            modules: [
                {
                    name: 'animatedArrowPath',
                    vs: uniformBlock,
                    fs: uniformBlock,
                    uniformTypes: {
                        time: 'f32',
                        arrowSpacing: 'f32'
                    },
                    inject
                } as ShaderModule<AnimatedArrowPathProps>
            ]
        };
    }
}
