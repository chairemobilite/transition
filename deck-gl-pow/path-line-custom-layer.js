import { PathLayer } from '@deck.gl/layers';

class PathLineCustomLayer extends PathLayer {
    getShaders() {
        const shaders = super.getShaders();
        shaders.inject['vs:#decl'] += `\
      uniform float dashStart;`;
        shaders.inject['vs:#main-end'] += `\
      vDashOffset += dashStart;`;
        return shaders;
    }
      
    draw(opts) {
        opts.uniforms.dashStart = this.props.dashStart || 0;
        super.draw(opts);
    }
    /*
    // define: need gapwidth, offset and width
    
    initializeState(params) {
      super.initializeState(params);
  
      const attributeManager = this.getAttributeManager();
      attributeManager.addInstanced({
        radius: {
          size: 1,
          accessor: 'getGapWidth',
          defaultValue: 3
        },
        stroke_width: {
          size: 1,
          accessor: 'getRadius',
          defaultValue: 3
        },
        a_stroke_color: {
          size: 3,
          accessor: 'getLineColor',
          defaultValue: [255,255,255,255]
        },
        a_stroke_opacity: {
          size: 1,
          accessor: 'getRadius',
          defaultValue: 3
        },
        a_color: {
          size: 3,
          accessor: 'getFillColor',
          defaultValue: [255,255,255,255]
        }
      });
    }
  
    getShaders() {
      return {
        inject: {
        'vs:#decl': `\
          #define scale 0.015873016
          attribute vec2 a_pos_normal;
          attribute vec4 a_data;
          attribute float a_linesofar;
          
          uniform mat4 u_matrix;
          uniform mediump float u_ratio;
          uniform vec2 u_units_to_pixels;
          uniform lowp float u_device_pixel_ratio;
          
          varying vec2 v_normal;
          varying vec2 v_width2;
          varying float v_gamma_scale;
          varying float v_linesofar;

          uniform lowp float u_gapwidth_t;
          attribute mediump vec2 a_gapwidth;
          varying mediump float gapwidth;

          uniform lowp float u_offset_t;
          attribute lowp vec2 a_offset;
          varying lowp float offset;

          uniform lowp float u_width_t;
          attribute mediump vec2 a_width;
          varying mediump float width;
        
          // From https://github.com/mapbox/mapbox-gl-js/blob/main/src/shaders/_prelude.vertex.glsl
          float unpack_mix_vec2(const vec2 packedValue, const float t) {
            return mix(packedValue[0], packedValue[1], t);
          }
        `,
  
        'vs:#main-end': `\
          gapwidth = float(1);//unpack_mix_vec2(a_gapwidth, u_gapwidth_t);
          offset = float(1);//unpack_mix_vec2(a_offset, u_offset_t);
          width = float(1);//unpack_mix_vec2(a_width, u_width_t);

          // the distance over which the line edge fades out.
          // Retina devices need a smaller distance to avoid aliasing.
          float ANTIALIASING = 1.0 / project_uDevicePixelRatio / 2.0;
    
          vec2 a_extrude = a_data.xy - 128.0;
          float a_direction = mod(a_data.z, 4.0) - 1.0;
    
          //float linesofar = (floor(a_data.z / 4.0) + a_linesofar * 64.0);
    
          vec2 pos = floor(a_pos_normal * 0.5);
    
          // x is 1 if it's a round cap, 0 otherwise
          // y is 1 if the normal points up, and -1 if it points down
          // We store these in the least significant bit of a_pos_normal
          mediump vec2 normal = a_pos_normal - 2.0 * pos;
          normal.y = normal.y * 2.0 - 1.0;
          v_normal = normal;
    
          // these transformations used to be applied in the JS and native code bases.
          // moved them into the shader for clarity and simplicity.
          gapwidth = gapwidth / 2.0;
          float halfwidth = width / 2.0;
          offset = -1.0 * offset;
    
          float inset = gapwidth + (gapwidth > 0.0 ? ANTIALIASING : 0.0);
          float outset = gapwidth + halfwidth * (gapwidth > 0.0 ? 2.0 : 1.0) + (halfwidth == 0.0 ? 0.0 : ANTIALIASING);
    
          // Scale the extrusion vector down to a normal and then up by the line width
          // of this vertex.
          mediump vec2 dist = outset * a_extrude * scale;
    
          // Calculate the offset when drawing a line that is to the side of the actual line.
          // We do this by creating a vector that points towards the extrude, but rotate
          // it when we're drawing round end points (a_direction = -1 or 1) since their
          // extrude vector points in another direction.
          mediump float u = 0.5 * a_direction;
          mediump float t = 1.0 - abs(u);
          mediump vec2 offset2 = offset * a_extrude * scale * normal.y * mat2(t, -u, u, t);
    
          vec4 projected_extrude = u_matrix * vec4(dist / u_ratio, 0.0, 0.0);
          gl_Position = u_matrix * vec4(pos + offset2 / u_ratio, 0.0, 1.0) + projected_extrude;
    
          // calculate how much the perspective view squishes or stretches the extrude
          float extrude_length_without_perspective = length(dist);
          float extrude_length_with_perspective = length(projected_extrude.xy / gl_Position.w * u_units_to_pixels);
          v_gamma_scale = extrude_length_without_perspective / extrude_length_with_perspective;
    
          v_linesofar = a_linesofar;
    
          v_width2 = vec2(outset, inset);
        `,
  
        'fs:#decl': `\
          uniform lowp float u_device_pixel_ratio;
          uniform highp float u_time;
          
          varying vec2 v_width2;
          varying vec2 v_normal;
          varying float v_gamma_scale;
          varying float v_linesofar;
        `,
  
        'fs:#main-end': `\
          // Calculate the distance of the pixel from the line in pixels.
          float dist = length(v_normal) * v_width2.s;
      
          // Calculate the antialiasing fade factor. This is either when fading in
          // the line in case of an offset line (v_width2.t) or when fading out
          // (v_width2.s)
          float blur2 = (blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
          float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);
      
          float arrow_position = mod((v_linesofar + dist * 15.0 - u_time * 300.0), 500.0);
      
          float amount_of_white = 0.0;
          float amount_of_blue  = 0.0;
      
          if (arrow_position >= 10.0 && arrow_position < 20.0)
          {
              amount_of_white = 0.9;
              gl_FragColor = mix(mix(color, vec4(1.0,1.0,1.0,1.0), amount_of_white) * (alpha * opacity), vec4(0.0,0.0,1.0,1.0), amount_of_blue);
          }
          else if (arrow_position >= 20.0 && arrow_position < 30.0)
          {
              amount_of_white = 0.9 - 0.4 * (1.0 - (30.0 - arrow_position) / 10.0);
              gl_FragColor = mix(mix(color, vec4(1.0,1.0,1.0,1.0), amount_of_white) * (alpha * opacity), vec4(0.0,0.0,1.0,1.0), amount_of_blue);
          }
          else if (arrow_position >= 30.0 && arrow_position < 500.0)
          {
              amount_of_white = 0.5 * (1.0 - arrow_position / 500.0);
              gl_FragColor = mix(mix(color, vec4(0.0,0.0,0.0,1.0), amount_of_white) * (alpha * opacity), vec4(0.0,0.0,1.0,1.0), amount_of_blue);
          }
          else
          {
              gl_FragColor = mix(mix(color, vec4(1.0,1.0,1.0,1.0), 0.0) * (alpha * opacity), vec4(0.0,0.0,1.0,1.0), amount_of_blue);
          }
      
          #ifdef OVERDRAW_INSPECTOR
              gl_FragColor = vec4(1.0);
          #endif
        `}
      }
    }
  
    draw(params) {
      params.uniforms.u_time = (performance.now() / 500) % 100000;
      super.draw(params);
    }*/
  }
  
  export default PathLineCustomLayer;