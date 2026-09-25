import { Mesh, Program, Renderer, Triangle } from 'https://esm.sh/ogl@1.0.11';

const hexToRgb = hex => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255]
    : [1, 1, 1];
};

const getAnchorAndDirection = (origin, width, height) => {
  const outside = 0.2;
  switch (origin) {
    case 'top-left': return { anchor: [0, -outside * height], direction: [0, 1] };
    case 'top-right': return { anchor: [width, -outside * height], direction: [0, 1] };
    case 'left': return { anchor: [-outside * width, height * 0.5], direction: [1, 0] };
    case 'right': return { anchor: [(1 + outside) * width, height * 0.5], direction: [-1, 0] };
    case 'bottom-left': return { anchor: [0, (1 + outside) * height], direction: [0, -1] };
    case 'bottom-center': return { anchor: [width * 0.5, (1 + outside) * height], direction: [0, -1] };
    case 'bottom-right': return { anchor: [width, (1 + outside) * height], direction: [0, -1] };
    default: return { anchor: [width * 0.5, -outside * height], direction: [0, 1] };
  }
};

const vertexShader = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 rayPos;
uniform vec2 rayDir;
uniform vec3 raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float fadeDistance;
uniform float saturation;
uniform vec2 mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
in vec2 vUv;
out vec4 outputColor;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rayStrength(vec2 source, vec2 referenceDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - source;
  vec2 direction = normalize(sourceToCoord);
  float cosAngle = dot(direction, referenceDirection);
  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );
  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor;
}

void main() {
  vec2 coord = vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y);
  vec2 finalRayDirection = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPosition = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPosition - rayPos);
    finalRayDirection = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 raysOne = vec4(1.0) * rayStrength(rayPos, finalRayDirection, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  vec4 raysTwo = vec4(1.0) * rayStrength(rayPos, finalRayDirection, coord, 22.3991, 18.0234, 1.1 * raysSpeed);
  vec4 color = raysOne * 0.5 + raysTwo * 0.4;

  if (noiseAmount > 0.0) {
    float grain = noise(coord * 0.01 + iTime * 0.1);
    color.rgb *= 1.0 - noiseAmount + noiseAmount * grain;
  }

  float brightness = 1.0 - coord.y / iResolution.y;
  color.r *= 0.1 + brightness * 0.8;
  color.g *= 0.3 + brightness * 0.6;
  color.b *= 0.5 + brightness * 0.5;
  color.rgb *= raysColor;
  outputColor = color;
}`;

const LightRays = (container, options = {}) => {
  const settings = {
    raysOrigin: 'top-center',
    raysColor: '#00ffff',
    raysSpeed: 1.5,
    lightSpread: 0.8,
    rayLength: 1.2,
    followMouse: true,
    mouseInfluence: 0.1,
    noiseAmount: 0.1,
    distortion: 0.05,
    ...options
  };

  const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: true });
  const gl = renderer.gl;
  gl.canvas.className = 'custom-rays';
  gl.canvas.setAttribute('aria-hidden', 'true');
  container.replaceChildren(gl.canvas);

  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: [1, 1] },
    rayPos: { value: [0, 0] },
    rayDir: { value: [0, 1] },
    raysColor: { value: hexToRgb(settings.raysColor) },
    raysSpeed: { value: settings.raysSpeed },
    lightSpread: { value: settings.lightSpread },
    rayLength: { value: settings.rayLength },
    fadeDistance: { value: 1 },
    saturation: { value: 1 },
    mousePos: { value: [0.5, 0.5] },
    mouseInfluence: { value: settings.mouseInfluence },
    noiseAmount: { value: settings.noiseAmount },
    distortion: { value: settings.distortion }
  };

  const mesh = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, { vertex: vertexShader, fragment: fragmentShader, uniforms })
  });
  const mouse = { x: 0.5, y: 0.5 };
  let animationFrame;
  let activeTheme = '';

  const resize = () => {
    renderer.dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(container.clientWidth, container.clientHeight);
    const width = container.clientWidth * renderer.dpr;
    const height = container.clientHeight * renderer.dpr;
    uniforms.iResolution.value = [width, height];
    const placement = getAnchorAndDirection(settings.raysOrigin, width, height);
    uniforms.rayPos.value = placement.anchor;
    uniforms.rayDir.value = placement.direction;
  };

  const onPointerMove = event => {
    const bounds = container.getBoundingClientRect();
    mouse.x = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
    mouse.y = (event.clientY - bounds.top) / Math.max(bounds.height, 1);
  };

  const render = time => {
    uniforms.iTime.value = time * 0.001;
    const theme = document.documentElement.dataset.theme || 'dark';
    if (theme !== activeTheme) {
      uniforms.raysColor.value = hexToRgb(theme === 'light' ? '#075985' : '#00ffff');
      activeTheme = theme;
    }
    if (settings.followMouse) {
      uniforms.mousePos.value[0] += (mouse.x - uniforms.mousePos.value[0]) * 0.08;
      uniforms.mousePos.value[1] += (mouse.y - uniforms.mousePos.value[1]) * 0.08;
    }
    renderer.render({ scene: mesh });
    animationFrame = requestAnimationFrame(render);
  };

  window.addEventListener('resize', resize);
  if (settings.followMouse) window.addEventListener('pointermove', onPointerMove, { passive: true });
  resize();
  animationFrame = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('resize', resize);
    if (settings.followMouse) window.removeEventListener('pointermove', onPointerMove);
  };
};

const container = document.querySelector('.light-rays-container');
if (container) LightRays(container);

export default LightRays;
