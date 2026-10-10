/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/** Prefix each line of a shader source with its number, to match the line numbers of the GLSL compiler log */
const numberLines = (source: string): string =>
    source
        .split('\n')
        .map((line, i) => `${String(i + 1).padStart(4)}: ${line}`)
        .join('\n');

const compileShader = (gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader => {
    const shader = gl.createShader(type);
    if (!shader) {
        throw new Error('Could not create WebGL shader');
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        const stage = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
        throw new Error(`Could not compile ${stage} shader: ${log}\n${numberLines(source)}`);
    }
    return shader;
};

/**
 * Compile and link a WebGL2 program. Compilation and link errors throw with the GLSL log,
 * and the numbered shader source for compilation errors.
 *
 * @param gl The WebGL2 context
 * @param vertexSource GLSL source of the vertex shader
 * @param fragmentSource GLSL source of the fragment shader
 * @returns The linked program. The shaders are detached and deleted.
 */
export const createProgram = (
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string
): WebGLProgram => {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    let fragmentShader: WebGLShader;
    try {
        fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    } catch (error) {
        gl.deleteShader(vertexShader);
        throw error;
    }
    const program = gl.createProgram();
    if (!program) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error('Could not create WebGL program');
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Could not link WebGL program: ${log}`);
    }
    return program;
};

/**
 * Create a WebGL buffer, throwing if the context cannot create it (e.g. context lost).
 * @param gl The WebGL2 context
 * @returns The new buffer
 */
export const createBuffer = (gl: WebGL2RenderingContext): WebGLBuffer => {
    const buffer = gl.createBuffer();
    if (!buffer) {
        throw new Error('Could not create WebGL buffer');
    }
    return buffer;
};

/**
 * Get the location of a uniform, throwing if the program does not use it,
 * so a typo or a uniform optimized away by the compiler is caught right away.
 *
 * @param gl The WebGL2 context
 * @param program The linked program
 * @param name The uniform name in the GLSL source
 * @returns The uniform location
 */
export const getUniformLocation = (
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    name: string
): WebGLUniformLocation => {
    const location = gl.getUniformLocation(program, name);
    if (location === null) {
        throw new Error(`Uniform ${name} not found in the WebGL program`);
    }
    return location;
};
