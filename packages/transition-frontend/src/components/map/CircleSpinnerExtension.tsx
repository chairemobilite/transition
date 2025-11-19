/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { DefaultProps, Layer, LayerExtension } from '@deck.gl/core';
import type { ShaderModule } from '@luma.gl/shadertools';

const uniformBlock = `\
uniform circleSpinnerUniforms {
  float time;
  float pulseSpeed;
  float baseRadius;
  float minBorderWidth;
  float maxBorderWidth;
  float arcOuterRadius;
  float arcCount;
  float arcSpacing;
  float segmentWidthRatio;
} circleSpinner;
`;

type CircleSpinnerProps = {
    time: number;
    pulseSpeed: number;
    baseRadius: number;
    minBorderWidth: number;
    maxBorderWidth: number;
    arcOuterRadius: number;
    arcCount: number;
    arcSpacing: number;
    segmentWidthRatio: number;
};

const defaultProps: DefaultProps<_CircleSpinnerLayerProps> = {
    disableAnimation: { type: 'boolean', value: false },
    spinSpeed: { type: 'number', value: 2.0, min: 0 },
    pulseSpeed: { type: 'number', value: 1.5, min: 0 },
    baseRadius: { type: 'number', value: 0.75, min: 0, max: 1 },
    minBorderWidth: { type: 'number', value: 0.15, min: 0 },
    maxBorderWidth: { type: 'number', value: 0.3, min: 0 },
    arcOuterRadius: { type: 'number', value: 1.0, min: 0 },
    arcCount: { type: 'number', value: 3, min: 1, max: 12 },
    arcSpacing: { type: 'number', value: 2.094, min: 0.1 },
    segmentWidthRatio: { type: 'number', value: 0.95, min: 0, max: 1 }
};

type _CircleSpinnerLayerProps = {
    /**
     * Set to `true` to disable animation
     */
    disableAnimation: boolean;
    /**
     * Rotation speed in radians per second (default: 2.0)
     */
    spinSpeed: number;
    /**
     * Pulse animation speed multiplier (default: 1.5)
     */
    pulseSpeed: number;
    /**
     * Main circle radius as fraction of total size (default: 0.75)
     */
    baseRadius: number;
    /**
     * Minimum border width during pulse animation (default: 0.15)
     */
    minBorderWidth: number;
    /**
     * Maximum border width during pulse animation (default: 0.30)
     */
    maxBorderWidth: number;
    /**
     * Outer radius of the spinning arcs ring (default: 1.0)
     */
    arcOuterRadius: number;
    /**
     * Number of spinning arcs (default: 3)
     */
    arcCount: number;
    /**
     * Angular spacing between arcs in radians (default: 2.094 = 120°)
     */
    arcSpacing: number;
    /**
     * Ratio of segment width to spacing, controls arc length (default: 0.95)
     */
    segmentWidthRatio: number;
};

export default class CircleSpinnerExtension extends LayerExtension {
    static extensionName = 'CircleSpinnerExtension';
    static layerName = 'CircleSpinnerLayer';
    static defaultProps = defaultProps;

    draw(this: Layer<_CircleSpinnerLayerProps>, _params: Record<string, unknown>, _extension: this) {
        // Calculate rotation angle based on time and spin speed
        const cycleDuration = 100.0; // seconds - wrap time to prevent overflow
        const wrappedTime = (performance.now() / 1000) % cycleDuration;
        const rotationAngle = this.props.disableAnimation ? 0 : wrappedTime * this.props.spinSpeed;

        const circleSpinnerProps: CircleSpinnerProps = {
            time: rotationAngle,
            pulseSpeed: this.props.pulseSpeed,
            baseRadius: this.props.baseRadius,
            minBorderWidth: this.props.minBorderWidth,
            maxBorderWidth: this.props.maxBorderWidth,
            arcOuterRadius: this.props.arcOuterRadius,
            arcCount: this.props.arcCount,
            arcSpacing: this.props.arcSpacing,
            segmentWidthRatio: this.props.segmentWidthRatio
        };
        const model = this.state.model as { shaderInputs?: { setProps: (props: Record<string, unknown>) => void } };
        model?.shaderInputs?.setProps({ circleSpinner: circleSpinnerProps });
    }

    getShaders(this: Layer<_CircleSpinnerLayerProps>) {
        const inject = {
            'vs:#decl': `
                out vec2 vCirclePosition;
            `,

            'vs:#main-end': `
                // Pass normalized position to fragment shader
                // geometry.uv contains the normalized position within the circle
                vCirclePosition = geometry.uv;
            `,

            'fs:#decl': `
                in vec2 vCirclePosition;
            `,

            'fs:#main-end': `

                const float PI = 3.14159265359;
                const float TWO_PI = 6.28318530718;
                // Calculate angle from center for spinning arcs
                float angle = atan(vCirclePosition.y, vCirclePosition.x) + circleSpinner.time;
                // Normalize angle to 0-2π
                angle = mod(angle + PI, TWO_PI);

                // Calculate distance from center (normalized to 0-1)
                float dist = length(vCirclePosition);

                // === EFFECT 1: Pulsing white border (no spinning) ===
                float pulsePhase = sin(circleSpinner.time * circleSpinner.pulseSpeed) * 0.5 + 0.5; // 0 to 1

                // Border pulses between min and max width
                float borderWidth = mix(circleSpinner.minBorderWidth, circleSpinner.maxBorderWidth, pulsePhase);

                // Border is at the edge of the main circle
                float borderInner = circleSpinner.baseRadius - borderWidth;
                float borderOuter = circleSpinner.baseRadius;

                float borderFactor = 0.0;
                if (dist > borderInner && dist < borderOuter) {
                    // Smooth edges for the border
                    borderFactor = smoothstep(borderInner, borderInner + 0.02, dist) *
                                  smoothstep(borderOuter, borderOuter - 0.02, dist);
                }

                // === EFFECT 2: Spinning arcs outside the border (no pulsing) ===
                // Position arcs outside the main circle and border
                float arcsInner = circleSpinner.baseRadius;
                float arcsOuter = circleSpinner.arcOuterRadius;

                // Segment width extends based on ratio of spacing
                float segmentWidth = circleSpinner.arcSpacing * circleSpinner.segmentWidthRatio;

                float maxArcFactor = 0.0;

                if (dist > arcsInner && dist < arcsOuter) {
                    // Create spinning segments (up to arcCount)
                    for (int i = 0; i < 12; i++) {
                        if (float(i) >= circleSpinner.arcCount) break;
                        float segmentOffset = float(i) * circleSpinner.arcSpacing;
                        float segmentAngle = mod(angle - segmentOffset, TWO_PI);

                        if (segmentAngle < segmentWidth) {
                            float normalizedPos = segmentAngle / segmentWidth;

                            // Linear fade from 100% to 0% across the entire segment
                            float angleFade = 1.0 - normalizedPos;

                            // Small smooth start to avoid hard edge at the beginning
                            angleFade *= smoothstep(0.0, 0.02, normalizedPos);

                            // Radial fade
                            float radialFade = smoothstep(arcsInner, arcsInner + 0.02, dist) *
                                             smoothstep(arcsOuter, arcsOuter - 0.02, dist);

                            float arcFactor = angleFade * radialFade;
                            maxArcFactor = max(maxArcFactor, arcFactor);
                        }
                    }
                }

                // Apply effects based on distance
                // (0.74 instead of baseRadius to overlap slightly and avoid thin artifacts)
                float innerThreshold = circleSpinner.baseRadius - 0.01;
                if (dist <= innerThreshold) {
                    // Inside main circle: apply border and keep blue background
                    vec3 finalColor = mix(fragColor.rgb, vec3(1.0, 1.0, 1.0), borderFactor);
                    fragColor = vec4(finalColor, fragColor.a);
                } else {
                    // Outside main circle: transparent background with white arcs/border only
                    float whiteFactor = max(borderFactor, maxArcFactor) * 0.7;
                    fragColor = vec4(1.0, 1.0, 1.0, whiteFactor);
                }
            `
        };
        return {
            modules: [
                {
                    name: 'circleSpinner',
                    vs: uniformBlock,
                    fs: uniformBlock,
                    uniformTypes: {
                        time: 'f32',
                        pulseSpeed: 'f32',
                        baseRadius: 'f32',
                        minBorderWidth: 'f32',
                        maxBorderWidth: 'f32',
                        arcOuterRadius: 'f32',
                        arcCount: 'f32',
                        arcSpacing: 'f32',
                        segmentWidthRatio: 'f32'
                    },
                    inject
                } as ShaderModule<CircleSpinnerProps>
            ]
        };
    }
}
