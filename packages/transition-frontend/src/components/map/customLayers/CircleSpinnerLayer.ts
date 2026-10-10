/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import type { Feature } from 'geojson';
import { mat4 } from 'gl-matrix';
import { createBuffer, createProgram, getUniformLocation } from './glUtils';
import { buildNodeInstances, calculateNodeRadiusForZoom, NodeInstances } from './nodeGeometry';

/** Radius bounds in CSS pixels */
const RADIUS_MIN_PIXELS = 2;
const RADIUS_MAX_PIXELS = 50;

/** Rotation speed of the arcs, in radians per second (one turn every PI seconds) */
const ROTATION_SPEED = 2.0;
/**
 * The shader uses the angle for the rotation (period 2*PI) and for the pulse, `sin(angle * 1.5)`
 * (period 4*PI/3). Both repeat after 4*PI radians, so wrapping the clock at 4*PI / ROTATION_SPEED
 * seconds keeps the animation continuous and the float small.
 */
const ANIMATION_PERIOD_SECONDS = (4 * Math.PI) / ROTATION_SPEED;

/** Vertex attribute locations, fixed in the shader with `layout(location = ...)` */
const CORNER_LOCATION = 0;
const POSITION_LOCATION = 1;
const COLOR_LOCATION = 2;

/** Quad corners, drawn as a triangle strip and extruded in screen space */
const QUAD_CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const vertexShader = `#version 300 es
uniform mat4 u_matrix;
uniform vec2 u_viewportPx;
uniform float u_radiusPx;
layout(location = ${CORNER_LOCATION}) in vec2 a_corner;
layout(location = ${POSITION_LOCATION}) in vec2 a_position;
layout(location = ${COLOR_LOCATION}) in vec4 a_color;
out vec2 v_uv;
out vec4 v_color;
void main() {
    // Position within the circle: length 1 is the outer radius.
    v_uv = a_corner;
    v_color = a_color;
    vec4 center = u_matrix * vec4(a_position, 0.0, 1.0);
    gl_Position = center + vec4(a_corner * u_radiusPx * 2.0 / u_viewportPx * center.w, 0.0, 0.0);
}
`;

/*
 * The outer edge needs no extra antialiasing: the arcs already fade out radially before radius 1,
 * and fragments beyond it are discarded.
 * Colors are output with premultiplied alpha, as expected by MapLibre's blending.
 */
const fragmentShader = `#version 300 es
precision highp float;
uniform float u_time;
in vec2 v_uv;
in vec4 v_color;
out vec4 fragColor;
void main() {
    const float PI = 3.14159265359;
    const float TWO_PI = 6.28318530718;

    // Calculate distance from center (normalized to 0-1)
    float dist = length(v_uv);
    if (dist > 1.0) {
        discard;
    }

    // Calculate angle from center for spinning arcs
    float angle = atan(v_uv.y, v_uv.x) + u_time;
    // Normalize angle to 0-2π
    angle = mod(angle + PI, TWO_PI);

    // === EFFECT 1: Pulsing white border (no spinning) ===
    float pulseSpeed = 1.5;
    float pulsePhase = sin(u_time * pulseSpeed) * 0.5 + 0.5; // 0 to 1

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
        // Inside main circle: apply border and keep the node color as background
        vec3 finalColor = mix(v_color.rgb, vec3(1.0, 1.0, 1.0), borderFactor);
        fragColor = vec4(finalColor * v_color.a, v_color.a);
    } else {
        // Outside main circle: transparent background with white arcs/border only
        float whiteFactor = max(borderFactor, maxArcFactor) * 0.7;
        fragColor = vec4(vec3(whiteFactor), whiteFactor);
    }
}
`;

/**
 * GL resources, created on the first `render` and released in `onRemove`. MapLibre caches the GL
 * state (bound buffers, vertex array) and only resets that cache after `render`, so all GL calls
 * that change bindings happen in `render`.
 */
type GlResources = {
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
    buffers: WebGLBuffer[];
    positionBuffer: WebGLBuffer;
    colorBuffer: WebGLBuffer;
    uniforms: {
        matrix: WebGLUniformLocation;
        viewportPx: WebGLUniformLocation;
        radiusPx: WebGLUniformLocation;
        time: WebGLUniformLocation;
    };
};

/**
 * MapLibre custom layer drawing the selected nodes: a disc of the node color with a pulsing
 * white border and three white arcs spinning around it.
 *
 * The radius follows the zoom (`calculateNodeRadiusForZoom`), in CSS pixels. The layer does not
 * handle mouse events: the `transitNodesSelected` circle layer underneath receives them.
 */
export default class CircleSpinnerLayer implements CustomLayerInterface {
    readonly id: string;
    readonly type = 'custom' as const;
    readonly renderingMode = '2d' as const;

    private map: MapLibreMap | undefined;
    private resources: GlResources | undefined;
    private instances: NodeInstances = buildNodeInstances([]);
    /** Whether `instances` changed since the last upload to the GPU */
    private instancesDirty = true;
    private animationEnabled: boolean;

    /**
     * @param options.id Unique layer id in the map style
     * @param options.disableAnimation Set to `true` to draw a static spinner, without continuous repaint
     */
    constructor(options: { id: string; disableAnimation?: boolean }) {
        this.id = options.id;
        this.animationEnabled = !options.disableAnimation;
    }

    /**
     * Replace the nodes to draw.
     * @param features GeoJSON Point features, with an optional `color` property
     */
    setData(features: Feature[]): void {
        this.instances = buildNodeInstances(features);
        this.instancesDirty = true;
        this.map?.triggerRepaint();
    }

    /**
     * Start or stop the animation. When stopped, the spinner is drawn at its initial angle.
     * @param enabled Whether the spinner moves
     */
    setAnimationEnabled(enabled: boolean): void {
        this.animationEnabled = enabled;
        this.map?.triggerRepaint();
    }

    onAdd(map: MapLibreMap): void {
        // A style replacement can drop the layer without calling onRemove, then add it again
        this.releaseResources();
        this.map = map;
    }

    onRemove(): void {
        this.releaseResources();
        this.map = undefined;
    }

    render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
        const map = this.map;
        if (!map || this.instances.count === 0) {
            return;
        }
        this.resources ??= this.createResources(gl);
        const resources = this.resources;
        if (this.instancesDirty) {
            this.uploadInstances(resources);
        }

        // Translate the Mercator matrix to the local origin in float64, then convert to float32:
        // the vertex positions stay small and keep their precision at high zoom.
        const [originX, originY] = this.instances.origin;
        const matrix = mat4.translate(new Float64Array(16), options.defaultProjectionData.mainMatrix, [
            originX,
            originY,
            0
        ]);
        const radiusCssPixels = Math.min(
            Math.max(calculateNodeRadiusForZoom(map.getZoom()), RADIUS_MIN_PIXELS),
            RADIUS_MAX_PIXELS
        );
        const time = this.animationEnabled
            ? ((performance.now() / 1000) % ANIMATION_PERIOD_SECONDS) * ROTATION_SPEED
            : 0;

        gl.useProgram(resources.program);
        gl.uniformMatrix4fv(resources.uniforms.matrix, false, Float32Array.from(matrix));
        gl.uniform2f(resources.uniforms.viewportPx, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform1f(resources.uniforms.radiusPx, radiusCssPixels * map.getPixelRatio());
        gl.uniform1f(resources.uniforms.time, time);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.CULL_FACE);

        gl.bindVertexArray(resources.vao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instances.count);
        gl.bindVertexArray(null);

        if (this.animationEnabled) {
            map.triggerRepaint();
        }
    }

    private createResources(gl: WebGL2RenderingContext): GlResources {
        const program = createProgram(gl, vertexShader, fragmentShader);
        const vao = gl.createVertexArray();
        if (!vao) {
            gl.deleteProgram(program);
            throw new Error('Could not create WebGL vertex array');
        }
        const cornerBuffer = createBuffer(gl);
        const positionBuffer = createBuffer(gl);
        const colorBuffer = createBuffer(gl);

        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(CORNER_LOCATION);
        gl.vertexAttribPointer(CORNER_LOCATION, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(POSITION_LOCATION);
        gl.vertexAttribPointer(POSITION_LOCATION, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(POSITION_LOCATION, 1);

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.enableVertexAttribArray(COLOR_LOCATION);
        gl.vertexAttribPointer(COLOR_LOCATION, 4, gl.UNSIGNED_BYTE, true, 0, 0);
        gl.vertexAttribDivisor(COLOR_LOCATION, 1);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return {
            gl,
            program,
            vao,
            buffers: [cornerBuffer, positionBuffer, colorBuffer],
            positionBuffer,
            colorBuffer,
            uniforms: {
                matrix: getUniformLocation(gl, program, 'u_matrix'),
                viewportPx: getUniformLocation(gl, program, 'u_viewportPx'),
                radiusPx: getUniformLocation(gl, program, 'u_radiusPx'),
                time: getUniformLocation(gl, program, 'u_time')
            }
        };
    }

    private uploadInstances(resources: GlResources): void {
        const { gl, positionBuffer, colorBuffer } = resources;
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.instances.positions, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.instances.colors, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        this.instancesDirty = false;
    }

    private releaseResources(): void {
        const resources = this.resources;
        if (!resources) {
            return;
        }
        const { gl } = resources;
        resources.buffers.forEach((buffer) => gl.deleteBuffer(buffer));
        gl.deleteVertexArray(resources.vao);
        gl.deleteProgram(resources.program);
        this.resources = undefined;
        this.instancesDirty = true;
    }
}
