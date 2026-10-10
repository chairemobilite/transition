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
import { buildPathInstances, PathInstances, SEGMENT_FLOATS } from './pathGeometry';

/** Longest frame interval used to advance the arrows, so they do not jump after a pause (e.g. hidden tab) */
const MAX_FRAME_SECONDS = 0.1;
/**
 * Shortest arrow spacing, as a ratio of `arrowSpacing`. From zoom 12, the spacing on screen
 * doubles within each zoom level, from 90 to 180 CSS pixels with the default values.
 */
const MIN_SPACING_RATIO = 0.5;
/** Length of the arrow, without the plain color before it, as a ratio of the pattern length */
const ARROW_RATIO = 0.75;

/** Width ratio at this zoom and below, to keep the paths readable when zoomed out */
const NARROW_WIDTH_RATIO = 0.5;
const NARROW_WIDTH_ZOOM = 10;
/** Zoom from which the line has its full width, increasing linearly from `NARROW_WIDTH_ZOOM` */
const FULL_WIDTH_ZOOM = 12;

/**
 * Line width ratio for a zoom, from `NARROW_WIDTH_RATIO` to 1.
 *
 * @param zoom The map zoom
 * @returns The ratio to apply to the full line width
 */
const widthRatioForZoom = (zoom: number): number => {
    const progress = Math.min(Math.max((zoom - NARROW_WIDTH_ZOOM) / (FULL_WIDTH_ZOOM - NARROW_WIDTH_ZOOM), 0), 1);
    return NARROW_WIDTH_RATIO + (1 - NARROW_WIDTH_RATIO) * progress;
};

/**
 * Path details smaller than this, in CSS pixels at the integer zoom below the current one, are
 * removed, so short segments do not show their shape when zoomed out.
 */
const SIMPLIFY_TOLERANCE_PX = 1.5;

/** Duration of the crossfade between the arrows of 2 zoom levels, when arrows are added or removed */
const LEVEL_FADE_MS = 300;

/** Zoom below which the arrows get denser on screen, since the paths get short */
const DENSE_ARROWS_ZOOM = 12;
/** Arrows on screen are this many times denser when zoomed out, from about zoom 10.4 */
const MAX_ARROW_DENSITY = 3;

/**
 * Zoom level giving the arrow spacing on the map, `zoom0Spacing / 2^level`. Below
 * `DENSE_ARROWS_ZOOM`, the level stays the same until the arrows are `MAX_ARROW_DENSITY` times
 * closer on screen, then decreases by 1 at each zoom again.
 *
 * @param zoom The map zoom
 * @returns The integer zoom level of the arrow spacing
 */
const arrowZoomLevel = (zoom: number): number => {
    const densityZoomShift = Math.min(Math.max(DENSE_ARROWS_ZOOM - zoom, 0), Math.log2(MAX_ARROW_DENSITY));
    return Math.floor(zoom + densityZoomShift);
};

/**
 * Arrow speed along the path, in CSS pixels per second. It increases with the zoom, since the
 * same speed looks too fast when zoomed out: about 41 px/s at zoom 12, 69 px/s at zoom 16 and
 * 199 px/s at zoom 20. The formula has a pole at zoom 22.1, so the zoom is capped at 20.
 *
 * @param zoom The map zoom
 * @returns The speed in CSS pixels per second
 */
const arrowSpeedCssPixelsPerSecond = (zoom: number): number =>
    (0.004 * Math.pow(2, 15.6) * 19) / (199 - 9 * Math.min(zoom, 20));

/** Vertex attribute locations, fixed in the shader with `layout(location = ...)` */
const CORNER_LOCATION = 0;
const PREVIOUS_LOCATION = 1;
const START_LOCATION = 2;
const END_LOCATION = 3;
const NEXT_LOCATION = 4;
const START_DISTANCE_LOCATION = 5;
const END_DISTANCE_LOCATION = 6;
const COLOR_LOCATION = 7;

/**
 * Corners of the segment quad, drawn as a triangle strip: x is 0 at the segment start and 1 at
 * its end, y is the side of the line (-1 or 1).
 */
const QUAD_CORNERS = new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]);

/*
 * Each segment is a quad in screen space, extended past both ends by the half width so the round
 * caps and joins fit. The fragment shader cuts them round, and cuts each join on the bisector of
 * its two segments, so every pixel of a join is drawn by a single segment.
 */
const vertexShader = `#version 300 es
uniform mat4 u_matrix;
uniform vec2 u_viewportPx;
uniform float u_halfWidthPx;
uniform float u_haloWidthPx;
uniform float u_distanceScale;
layout(location = ${CORNER_LOCATION}) in vec2 a_corner;
layout(location = ${PREVIOUS_LOCATION}) in vec2 a_previous;
layout(location = ${START_LOCATION}) in vec2 a_start;
layout(location = ${END_LOCATION}) in vec2 a_end;
layout(location = ${NEXT_LOCATION}) in vec2 a_next;
layout(location = ${START_DISTANCE_LOCATION}) in float a_startDistance;
layout(location = ${END_DISTANCE_LOCATION}) in float a_endDistance;
layout(location = ${COLOR_LOCATION}) in vec4 a_color;
// Position from the segment start: x along the segment, y across, in physical pixels
out vec2 v_segmentPx;
out float v_segmentLengthPx;
out float v_startDistancePx;
// Distance along the original path per pixel along the segment, which is shorter when simplified
flat out float v_distancePerPx;
out vec4 v_color;
// Normals of the join bisectors at the start and end, pointing forward along the path, in the
// (along, across) frame. Zero when there is no join to cut: path end or U-turn.
flat out vec2 v_startBisector;
flat out vec2 v_endBisector;

vec2 toScreenPx(vec4 clipPosition) {
    return clipPosition.xy / clipPosition.w * 0.5 * u_viewportPx;
}

// Bisector normal of the join between this segment, along x, and a neighbor segment of direction
// (from -> to) in screen pixels
vec2 joinBisector(vec2 fromPx, vec2 toPx, vec2 direction, vec2 normal) {
    vec2 delta = toPx - fromPx;
    float lengthPx = length(delta);
    if (lengthPx < 0.001) {
        return vec2(0.0);
    }
    vec2 neighborDirection = vec2(dot(delta, direction), dot(delta, normal)) / lengthPx;
    vec2 sum = vec2(1.0, 0.0) + neighborDirection;
    return length(sum) < 0.001 ? vec2(0.0) : normalize(sum);
}

void main() {
    vec2 startPx = toScreenPx(u_matrix * vec4(a_start, 0.0, 1.0));
    vec2 endPx = toScreenPx(u_matrix * vec4(a_end, 0.0, 1.0));
    vec2 delta = endPx - startPx;
    float lengthPx = length(delta);
    vec2 direction = lengthPx > 0.0 ? delta / lengthPx : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // One extra pixel leaves room for the antialiased edge
    float extentPx = u_halfWidthPx + u_haloWidthPx + 1.0;
    float along = a_corner.x * lengthPx + (a_corner.x * 2.0 - 1.0) * extentPx;
    float across = a_corner.y * extentPx;
    vec2 positionPx = startPx + direction * along + normal * across;
    gl_Position = vec4(positionPx / (0.5 * u_viewportPx), 0.0, 1.0);

    v_segmentPx = vec2(along, across);
    v_segmentLengthPx = lengthPx;
    v_startDistancePx = a_startDistance * u_distanceScale;
    v_distancePerPx = lengthPx > 0.0 ? (a_endDistance - a_startDistance) * u_distanceScale / lengthPx : 1.0;
    v_color = a_color;
    v_startBisector = joinBisector(toScreenPx(u_matrix * vec4(a_previous, 0.0, 1.0)), startPx, direction, normal);
    v_endBisector = joinBisector(endPx, toScreenPx(u_matrix * vec4(a_next, 0.0, 1.0)), direction, normal);
}
`;

/*
 * The arrow pattern is computed in pattern units, the half width of the line at full width, so it
 * does not change when the line gets narrower. The arrows are fixed on the map while
 * zooming: their spacing on screen doubles within each zoom level, then new arrows appear between
 * them at the next level. When the level changes, the patterns of both levels are crossfaded.
 * Colors are output with premultiplied alpha, as expected by MapLibre's blending.
 */
const fragmentShader = `#version 300 es
precision highp float;
uniform float u_halfWidthPx;
// Halo around the line, not premultiplied. No halo when its width is 0.
uniform float u_haloWidthPx;
uniform vec4 u_haloColor;
uniform float u_patternUnitPx;
// Arrow patterns of the previous and current zoom levels: spacing, pattern length and offset,
// in pattern units. The pattern is at the end of each spacing.
uniform vec3 u_previousPattern;
uniform vec3 u_currentPattern;
// 0 shows the previous pattern, 1 the current one
uniform float u_patternBlend;
in vec2 v_segmentPx;
in float v_segmentLengthPx;
in float v_startDistancePx;
flat in float v_distancePerPx;
in vec4 v_color;
flat in vec2 v_startBisector;
flat in vec2 v_endBisector;
out vec4 fragColor;

// Color of the arrow pattern at a distance along the path, in pattern units
vec3 arrowColor(float distanceSoFar, vec3 pattern) {
    float spacing = pattern.x;
    float arrowLength = pattern.y;
    float arrowIndex = mod(distanceSoFar - pattern.z, spacing);
    // The arrow keeps its length: the extra spacing is plain color before it
    float percentOfDistanceBetweenArrows = 1.0 - max(arrowIndex - (spacing - arrowLength), 0.0) / arrowLength;

    if (percentOfDistanceBetweenArrows < 0.5) {
        float percentBlack = percentOfDistanceBetweenArrows / 0.5 * 0.5;
        return mix(v_color.rgb, vec3(0.0), percentBlack);
    } else if (percentOfDistanceBetweenArrows < 0.75) {
        float percentWhite = (1.0 - (percentOfDistanceBetweenArrows - 0.5) * 4.0) * 0.75;
        return mix(v_color.rgb, vec3(1.0), percentWhite);
    }
    return v_color.rgb;
}

void main() {
    float along = v_segmentPx.x;
    float across = v_segmentPx.y;
    // The other side of a bisector is drawn by the neighbor segment
    if (dot(v_segmentPx, v_startBisector) < 0.0 || dot(v_segmentPx - vec2(v_segmentLengthPx, 0.0), v_endBisector) > 0.0) {
        discard;
    }
    // Distance to the line axis: across the body, to the nearest end in the round caps and joins
    float axisDistancePx = along < 0.0
        ? length(v_segmentPx)
        : along > v_segmentLengthPx ? length(vec2(along - v_segmentLengthPx, across)) : abs(across);
    // Antialiased edges, 1 physical pixel wide
    float outerRadiusPx = u_halfWidthPx + u_haloWidthPx;
    float coverage = 1.0 - smoothstep(outerRadiusPx - 0.5, outerRadiusPx + 0.5, axisDistancePx);
    if (coverage <= 0.0) {
        discard;
    }
    float lineCoverage = 1.0 - smoothstep(u_halfWidthPx - 0.5, u_halfWidthPx + 0.5, axisDistancePx);

    // Radial in the round caps and joins, so the white border follows them
    float percentFromCenter = min(axisDistancePx / u_halfWidthPx, 1.0);
    // percentFromCenter * 2.0 makes the arrow twice as pointy, scaled to keep its angle on narrow lines.
    float distanceSoFar = (v_startDistancePx + along * v_distancePerPx) / u_patternUnitPx
        + percentFromCenter * 2.0 * u_halfWidthPx / u_patternUnitPx;
    vec3 finalColor = u_patternBlend < 1.0
        ? mix(arrowColor(distanceSoFar, u_previousPattern), arrowColor(distanceSoFar, u_currentPattern), u_patternBlend)
        : arrowColor(distanceSoFar, u_currentPattern);

    // Create white border effect on the edges
    float borderWidth = 0.3; // Adjust this value to control border thickness
    float borderFactor = smoothstep(1.0 - borderWidth, 1.0, percentFromCenter);

    // Apply white border with antialiasing
    finalColor = mix(finalColor, vec3(1.0), borderFactor);
    vec4 halo = vec4(u_haloColor.rgb * u_haloColor.a, u_haloColor.a);
    fragColor = mix(halo, vec4(finalColor, 1.0), lineCoverage) * coverage;
}
`;

/** Halo drawn around the line, on each side */
export type PathHalo = {
    /** [r, g, b, a], each from 0 to 1 */
    color: [number, number, number, number];
    /** Halo width on each side of the line, in CSS pixels */
    widthPx: number;
};

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
    segmentBuffer: WebGLBuffer;
    colorBuffer: WebGLBuffer;
    uniforms: {
        matrix: WebGLUniformLocation;
        viewportPx: WebGLUniformLocation;
        halfWidthPx: WebGLUniformLocation;
        haloWidthPx: WebGLUniformLocation;
        haloColor: WebGLUniformLocation;
        patternUnitPx: WebGLUniformLocation;
        distanceScale: WebGLUniformLocation;
        previousPattern: WebGLUniformLocation;
        currentPattern: WebGLUniformLocation;
        patternBlend: WebGLUniformLocation;
    };
};

/**
 * MapLibre custom layer drawing paths with round caps and joins, and arrows moving along them.
 * The line width is in CSS pixels, narrower when zoomed out. The layer does not handle mouse events: the
 * MapLibre line layer of the same data receives them.
 */
export default class AnimatedArrowPathLayer implements CustomLayerInterface {
    readonly id: string;
    readonly type = 'custom' as const;
    readonly renderingMode = '2d' as const;

    private readonly widthCssPixels: number;
    private readonly arrowSpacing: number;
    private readonly halo: PathHalo | undefined;
    private map: MapLibreMap | undefined;
    private resources: GlResources | undefined;
    private features: Feature[] = [];
    private instances: PathInstances = buildPathInstances([]);
    /** Integer zoom of the simplification of `instances`, undefined when they must be rebuilt */
    private instancesZoomLevel: number | undefined;
    /** Whether `instances` changed since the last upload to the GPU */
    private instancesDirty = true;
    private animationEnabled: boolean;
    /** Arrow position along the paths, in pixels at zoom 0, in [0, arrow spacing at zoom 0) */
    private arrowOffset = 0;
    /** `performance.now()` of the previous animated frame */
    private previousFrameTime: number | undefined;
    /** Zoom level of the arrow spacing, from `arrowZoomLevel`, and the one before it changed */
    private arrowLevel: number | undefined;
    private previousArrowLevel = 0;
    /** `performance.now()` of the last arrow level change, to crossfade both levels */
    private arrowLevelChangeTime = 0;

    /**
     * @param options.id Unique layer id in the map style
     * @param options.widthPx Line width in CSS pixels from zoom 12, narrower below. Defaults to 12.
     * @param options.arrowSpacing Longest arrow spacing on screen, in half widths of the full width line. It is
     * also the length of the arrow pattern, the arrow being 3/4 of it. Defaults to 30.
     * @param options.halo Halo drawn around the line. Defaults to no halo.
     * @param options.disableAnimation Set to `true` to draw static arrows, without continuous repaint
     */
    constructor(options: {
        id: string;
        widthPx?: number;
        arrowSpacing?: number;
        halo?: PathHalo;
        disableAnimation?: boolean;
    }) {
        this.id = options.id;
        this.widthCssPixels = options.widthPx ?? 12;
        this.arrowSpacing = options.arrowSpacing ?? 30;
        this.halo = options.halo;
        this.animationEnabled = !options.disableAnimation;
    }

    /**
     * Replace the paths to draw.
     * @param features GeoJSON LineString features, with an optional `color` property
     */
    setData(features: Feature[]): void {
        this.features = features;
        this.instancesZoomLevel = undefined;
        this.map?.triggerRepaint();
    }

    /**
     * Start or stop the arrows. When stopped, the arrows stay where they are.
     * @param enabled Whether the arrows move
     */
    setAnimationEnabled(enabled: boolean): void {
        this.animationEnabled = enabled;
        this.previousFrameTime = undefined;
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
        if (!map) {
            return;
        }
        const zoom = map.getZoom();
        this.updateInstances(Math.floor(zoom));
        if (this.instances.count === 0) {
            return;
        }
        this.resources ??= this.createResources(gl);
        const resources = this.resources;
        if (this.instancesDirty) {
            this.uploadInstances(resources);
        }
        const pixelRatio = map.getPixelRatio();
        this.advanceArrows(zoom);

        // Translate the Mercator matrix to the local origin in float64, then convert to float32:
        // the vertex positions stay small and keep their precision at high zoom.
        const [originX, originY] = this.instances.origin;
        const matrix = mat4.translate(new Float64Array(16), options.defaultProjectionData.mainMatrix, [
            originX,
            originY,
            0
        ]);

        gl.useProgram(resources.program);
        gl.uniformMatrix4fv(resources.uniforms.matrix, false, Float32Array.from(matrix));
        gl.uniform2f(resources.uniforms.viewportPx, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform1f(resources.uniforms.halfWidthPx, (this.widthCssPixels / 2) * widthRatioForZoom(zoom) * pixelRatio);
        gl.uniform1f(resources.uniforms.patternUnitPx, (this.widthCssPixels / 2) * pixelRatio);
        gl.uniform1f(resources.uniforms.haloWidthPx, (this.halo?.widthPx ?? 0) * pixelRatio);
        gl.uniform4fv(resources.uniforms.haloColor, this.halo?.color ?? [0, 0, 0, 0]);
        // Distances are in pixels at zoom 0: scale them to physical pixels at the current zoom
        gl.uniform1f(resources.uniforms.distanceScale, Math.pow(2, zoom) * pixelRatio);
        const arrowLevel = arrowZoomLevel(zoom);
        const patternBlend = this.updateArrowLevel(arrowLevel);
        gl.uniform3fv(resources.uniforms.previousPattern, this.arrowPattern(this.previousArrowLevel, zoom));
        gl.uniform3fv(resources.uniforms.currentPattern, this.arrowPattern(arrowLevel, zoom));
        gl.uniform1f(resources.uniforms.patternBlend, patternBlend);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.CULL_FACE);

        gl.bindVertexArray(resources.vao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instances.count);
        gl.bindVertexArray(null);

        if (this.animationEnabled || patternBlend < 1) {
            map.triggerRepaint();
        }
    }

    /**
     * Rebuild the segments, simplified for the zoom level, when the data or the level changes.
     * @param zoomLevel Integer zoom
     */
    private updateInstances(zoomLevel: number): void {
        if (zoomLevel === this.instancesZoomLevel) {
            return;
        }
        this.instances = buildPathInstances(this.features, SIMPLIFY_TOLERANCE_PX / Math.pow(2, zoomLevel));
        this.instancesZoomLevel = zoomLevel;
        this.instancesDirty = true;
    }

    /**
     * Follow the arrow zoom level, and start a crossfade from the previous level when it changes.
     * @param level The current zoom level of the arrow spacing, from `arrowZoomLevel`
     * @returns The crossfade progress, from 0 (previous level) to 1 (current level)
     */
    private updateArrowLevel(level: number): number {
        const now = performance.now();
        if (this.arrowLevel === undefined) {
            this.arrowLevel = level;
            this.previousArrowLevel = level;
        } else if (level !== this.arrowLevel) {
            this.previousArrowLevel = this.arrowLevel;
            this.arrowLevel = level;
            this.arrowLevelChangeTime = now;
        }
        return Math.min((now - this.arrowLevelChangeTime) / LEVEL_FADE_MS, 1);
    }

    /**
     * Arrow pattern of a zoom level, for the shader. Arrows are spaced on the map by a power of 2
     * of the zoom 0 spacing, so the arrows of a zoom level stay in place at the next one, where new
     * arrows are added between them.
     * @param level Zoom level of the arrow spacing
     * @param zoom The map zoom
     * @returns Spacing, pattern length and offset on screen, in pattern units
     */
    private arrowPattern(level: number, zoom: number): [number, number, number] {
        const spacingOnMap = this.zoom0Spacing() / Math.pow(2, level);
        const offset = ((this.arrowOffset % spacingOnMap) * Math.pow(2, zoom)) / (this.widthCssPixels / 2);
        const spacing = MIN_SPACING_RATIO * this.arrowSpacing * Math.pow(2, zoom - level);
        // Shorter pattern when the arrows are close, so they touch without overlapping
        return [spacing, Math.min(this.arrowSpacing, spacing / ARROW_RATIO), offset];
    }

    /** Spacing between arrows on the map, in pixels at zoom 0 */
    private zoom0Spacing(): number {
        return (MIN_SPACING_RATIO * this.arrowSpacing * this.widthCssPixels) / 2;
    }

    /**
     * Move the arrows by the time elapsed since the previous frame. The offset is accumulated in
     * float64, in map units, so the arrows stay in place when the zoom changes. It is wrapped on
     * the zoom 0 spacing, a multiple of the spacing at any higher zoom level.
     */
    private advanceArrows(zoom: number): void {
        if (!this.animationEnabled) {
            return;
        }
        const now = performance.now();
        const elapsedSeconds =
            this.previousFrameTime === undefined
                ? 0
                : Math.min((now - this.previousFrameTime) / 1000, MAX_FRAME_SECONDS);
        this.previousFrameTime = now;
        const zoom0PixelsPerSecond = arrowSpeedCssPixelsPerSecond(zoom) / Math.pow(2, zoom);
        this.arrowOffset = (this.arrowOffset + elapsedSeconds * zoom0PixelsPerSecond) % this.zoom0Spacing();
    }

    private createResources(gl: WebGL2RenderingContext): GlResources {
        const program = createProgram(gl, vertexShader, fragmentShader);
        const vao = gl.createVertexArray();
        if (!vao) {
            gl.deleteProgram(program);
            throw new Error('Could not create WebGL vertex array');
        }
        const cornerBuffer = createBuffer(gl);
        const segmentBuffer = createBuffer(gl);
        const colorBuffer = createBuffer(gl);
        const segmentStride = SEGMENT_FLOATS * Float32Array.BYTES_PER_ELEMENT;

        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(CORNER_LOCATION);
        gl.vertexAttribPointer(CORNER_LOCATION, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, segmentBuffer);
        const segmentAttributes: [location: number, size: number, offsetFloats: number][] = [
            [PREVIOUS_LOCATION, 2, 0],
            [START_LOCATION, 2, 2],
            [END_LOCATION, 2, 4],
            [NEXT_LOCATION, 2, 6],
            [START_DISTANCE_LOCATION, 1, 8],
            [END_DISTANCE_LOCATION, 1, 9]
        ];
        for (const [location, size, offsetFloats] of segmentAttributes) {
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(
                location,
                size,
                gl.FLOAT,
                false,
                segmentStride,
                offsetFloats * Float32Array.BYTES_PER_ELEMENT
            );
            gl.vertexAttribDivisor(location, 1);
        }

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
            buffers: [cornerBuffer, segmentBuffer, colorBuffer],
            segmentBuffer,
            colorBuffer,
            uniforms: {
                matrix: getUniformLocation(gl, program, 'u_matrix'),
                viewportPx: getUniformLocation(gl, program, 'u_viewportPx'),
                halfWidthPx: getUniformLocation(gl, program, 'u_halfWidthPx'),
                haloWidthPx: getUniformLocation(gl, program, 'u_haloWidthPx'),
                haloColor: getUniformLocation(gl, program, 'u_haloColor'),
                patternUnitPx: getUniformLocation(gl, program, 'u_patternUnitPx'),
                distanceScale: getUniformLocation(gl, program, 'u_distanceScale'),
                previousPattern: getUniformLocation(gl, program, 'u_previousPattern'),
                currentPattern: getUniformLocation(gl, program, 'u_currentPattern'),
                patternBlend: getUniformLocation(gl, program, 'u_patternBlend')
            }
        };
    }

    private uploadInstances(resources: GlResources): void {
        const { gl, segmentBuffer, colorBuffer } = resources;
        gl.bindBuffer(gl.ARRAY_BUFFER, segmentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.instances.segments, gl.DYNAMIC_DRAW);
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
