import {LayerExtension} from '@deck.gl/core';

class ScatterplotCustomLayer extends LayerExtension {
  initializeState(params) {
    super.initializeState(params);

    const attributeManager = this.getAttributeManager();
    attributeManager.addInstanced({
      radius: {
        size: 1,
        accessor: 'getRadius',
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
        uniform highp float u_time;
        attribute float radius;
        attribute float stroke_width;
        attribute vec4 a_stroke_color;
        attribute float a_stroke_opacity;
        attribute vec4 a_color;

        varying vec4 v_color;
        varying vec4 v_stroke_color;
        varying float v_stroke_opacity;
        varying vec3 v_data;
        varying float v_visibility;
      `,

      'vs:#main-end': `\
        vec2 extrude = vec2(geometry.uv);
        lowp float antialiasblur = 1.0 / project_uDevicePixelRatio / (radius + stroke_width);
        v_data = vec3(extrude.x, extrude.y, antialiasblur);
        v_stroke_color = a_stroke_color;
        v_stroke_opacity = a_stroke_opacity;
        v_color = a_color;
      `,

      'fs:#decl': `\
        uniform highp float u_time;

        varying vec4 v_color;
        varying vec4 v_stroke_color;
        varying float v_stroke_opacity;
        varying vec3 v_data;
        varying float v_visibility;

        #define TPI 6.28318530718
        #define PI 3.141562843
        #define HPI 1.57079632679
      `,

      'fs:#main-end': `\
        vec2 extrude = v_data.xy;
        float extrude_length = length(extrude);
    
        lowp float antialiasblur = v_data.z;
        float antialiased_blur = -max(1.0, antialiasblur);
    
        float opacity_t = smoothstep(0.0, antialiased_blur, extrude_length - 1.0);
    
        int u_integer      = int(u_time/2.0);
        int u_integer_angle = int(u_time/5.0);
        float decimal_time = u_time/2.0 - float(u_integer);
        float angle_decimal_time = u_time/5.0 - float(u_integer_angle);
        
        
        float angle = 0.0;
        //vec4 test_color = vec4(0.0,0.0,0.0,1.0);
        vec2 vtx = vec2(extrude[0], -extrude[1]);
        
        float arc = TPI / 3.0;
        
        if (vtx.x >= 0.0 && vtx.y >= 0.0) // red, first quadrant
        {
          //test_color = vec4(1.0,0.0,0.0,1.0);
          if (vtx.y == 0.0)
          {
            angle = 0.0;
          }
          else
          {
            angle = atan( vtx.y / vtx.x );
          }
        }
        else if (vtx.x <= 0.0 && vtx.y >= 0.0) // green
        {
          //test_color = vec4(0.0,1.0,0.0,1.0);
          if (vtx.y == 0.0)
          {
            angle = PI;
          }
          else
          {
            angle = PI + atan( vtx.y / vtx.x );
          }
        }
        else if (vtx.x <= 0.0 && vtx.y < 0.0) // blue
        {
          //test_color = vec4(0.0,0.0,1.0,1.0);
          if (vtx.y == 0.0)
          {
            angle = PI;
          }
          else
          {
            angle = PI + atan( vtx.y / vtx.x );
          }
        }
        else if(vtx.x >= 0.0 && vtx.y < 0.0) // yellow
        {
          //test_color = vec4(1.0,1.0,0.0,1.0);
          if (vtx.y == 0.0)
          {
            angle = 0.0;
          }
          else
          {
            angle = TPI + atan( vtx.y / vtx.x );
          }
        }
    
        float main_rotating_angle_min = TPI * angle_decimal_time;
        float rotating_angle_min = 0.0;
        float rotating_angle_max = 0.0;
        
        int draw_border = 0;
        float f_stroke_opacity = v_stroke_opacity;
        
        for (int i = 0; i < 3; i++)
        {
          rotating_angle_min = (TPI * float(i) / 3.0) + main_rotating_angle_min;
          if (rotating_angle_min > TPI)
          {
            rotating_angle_min = rotating_angle_min - TPI;
          }
          rotating_angle_max = arc + rotating_angle_min;
          
          
          if ((rotating_angle_max > TPI && angle >= 0.0 && angle < rotating_angle_max - TPI) || (angle >= rotating_angle_min && angle < rotating_angle_max))
          {
            if (angle < rotating_angle_min)
            {
              f_stroke_opacity = v_stroke_opacity * (angle + TPI - rotating_angle_min) / (arc);
            }
            else
            {
              f_stroke_opacity = v_stroke_opacity * (angle - rotating_angle_min) / (arc);
            }
            draw_border = 1;
          }
        }
        
        if (draw_border == 0)
        {
          f_stroke_opacity = 0.0;
        }
        
        float first_step   = 0.40 + 0.05 * sin(main_rotating_angle_min);
        float second_step  = 0.8;//0.65 + 0.05 * sin(main_rotating_angle_min);
        float third_step   = 1.0;//0.9 + 0.05 * sin(main_rotating_angle_min);
        if (extrude_length <= first_step)
        {
          opacity_t = smoothstep(1.0 - first_step, 1.0 - first_step - antialiased_blur, -extrude_length + 1.0);
          gl_FragColor = opacity_t * v_color;
        }
        else if (extrude_length <= second_step)
        {
          opacity_t = smoothstep(1.0 - second_step, 1.0 - second_step - antialiased_blur, -extrude_length + 1.0) - smoothstep(1.0 - first_step + antialiased_blur, 1.0 - first_step, -extrude_length + 1.0);
          gl_FragColor = opacity_t * vec4(1.0,1.0,1.0,1.0);
        }
        else if (extrude_length <= third_step)
        {
          opacity_t = smoothstep(0.0, 0.0 - antialiased_blur, -extrude_length + 1.0) - smoothstep(1.0 - second_step + antialiased_blur, 1.0 - second_step, -extrude_length + 1.0);
          gl_FragColor = opacity_t * v_stroke_color * f_stroke_opacity * 0.5;
        }
        else
        {
          gl_FragColor = vec4(0.0);//opacity_t * test_color;
        }
      `}
    }
  }

  draw(params) {
    params.uniforms.u_time = (performance.now() / 500) % 100000;
    super.draw(params);
  }
}

export default ScatterplotCustomLayer;