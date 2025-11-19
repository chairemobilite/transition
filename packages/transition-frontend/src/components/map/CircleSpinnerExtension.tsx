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
} circleSpinner;
`;

type CircleSpinnerProps = {
    time: number;
};

const defaultProps: DefaultProps<_CircleSpinnerLayerProps> = {
    disableAnimation: { type: 'boolean', value: false }
};

type _CircleSpinnerLayerProps = {
    time: number;
    /**
     * Set to `true` to disable animation
     */
    disableAnimation: boolean;
};

export default class CircleSpinnerExtension extends LayerExtension {
    static extensionName = 'CircleSpinnerExtension';
    static layerName = 'CircleSpinnerLayer';
    static defaultProps = defaultProps;

    draw(this: Layer<_CircleSpinnerLayerProps>, _params: Record<string, unknown>, _extension: this) {
        // Rotation speed in radians per second
        const rotationSpeed = 2.0; // 2 radians per second = ~1 rotation per PI seconds

        // Calculate rotation angle based on time
        const cycleDuration = 100.0; // seconds - wrap time to prevent overflow
        const wrappedTime = (performance.now() / 1000) % cycleDuration;
        const rotationAngle = this.props.disableAnimation ? 0 : wrappedTime * rotationSpeed;

        const circleSpinnerProps: CircleSpinnerProps = {
            time: rotationAngle
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
                float pulseSpeed = 1.5;
                float pulsePhase = sin(circleSpinner.time * pulseSpeed) * 0.5 + 0.5; // 0 to 1
                
                // Border pulses between medium and large
                float minBorderWidth = 0.15; // Medium border
                float maxBorderWidth = 0.30; // Large border
                float borderWidth = mix(minBorderWidth, maxBorderWidth, pulsePhase);
                
                // Border is at the edge of the main circle
                float borderInner = 0.75 - borderWidth;
                float borderOuter = 0.75;
                
                float borderFactor = 0.0;
                if (dist > borderInner && dist < borderOuter) {
                    // Smooth edges for the border
                    borderFactor = smoothstep(borderInner, borderInner + 0.02, dist) * 
                                  smoothstep(borderOuter, borderOuter - 0.02, dist);
                }
                
                // === EFFECT 2: Spinning arcs outside the border (no pulsing) ===
                // Position arcs outside the main circle and border
                float arcsInner = 0.75;
                float arcsOuter = 1.0;
                
                const float segmentSpacing = 2.094; // 120 degrees (360/3)
                // Make segment width extend almost to the next segment for longer fade
                const float segmentWidth = segmentSpacing * 0.95; // ~114 degrees (95% of spacing)
                
                float maxArcFactor = 0.0;
                
                if (dist > arcsInner && dist < arcsOuter) {
                    // Create 3 spinning segments
                    for (int i = 0; i < 3; i++) {
                        float segmentOffset = float(i) * segmentSpacing;
                        float segmentAngle = mod(angle - segmentOffset, 6.28318);
                        
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
                if (dist <= 0.74) {
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
                        time: 'f32'
                    },
                    inject
                } as ShaderModule<CircleSpinnerProps>
            ]
        };
    }
}
