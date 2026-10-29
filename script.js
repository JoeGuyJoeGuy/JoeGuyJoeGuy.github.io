(() => {
  const artwork = Array.from({ length: 12 }, (_, i) => `artwork/${String(i + 1).padStart(2, "0")}.jpg`);
  const compactDevice = window.matchMedia("(max-width: 1024px)").matches;
  const skyAssets = compactDevice ? artwork.map(url => url.replace("artwork/", "artwork/pano/")) : artwork;
  const canvas = document.getElementById("sky");
  const entry = document.getElementById("entry");
  const enterButton = document.getElementById("enter");
  const experienceError = document.getElementById("experience-error");
  const legacyLoading = document.getElementById("loading");
  const showExperienceError = message => {
    let status = experienceError || legacyLoading;
    if (!status) {
      status = document.createElement("div");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      document.body.appendChild(status);
    }
    if (status === legacyLoading) status.className = "experience-error";
    if (!status.isConnected) document.body.appendChild(status);
    status.textContent = message;
    status.hidden = false;
  };
  const hint = document.getElementById("world-hint");
  const controls = document.getElementById("controls");
  const positionLabel = document.getElementById("position-value");
  const dialog = document.getElementById("art-viewer");
  const dialogImage = document.getElementById("viewer-image");
  const dialogIndex = document.getElementById("viewer-index");
  const stage = document.getElementById("viewer-stage");
  const viewerFrame = document.getElementById("viewer-image-frame");
  const zoomOutButton = document.getElementById("zoom-out");
  const zoomInButton = document.getElementById("zoom-in");
  const zoomValue = document.getElementById("zoom-value");
  const fitButton = document.getElementById("fit-button");
  const backgroundMusic = document.getElementById("background-music");
  const held = new Set();
  const gl = canvas.getContext("webgl", { alpha: false, antialias: true, powerPreference: "high-performance" });

  if (!gl) {
    showExperienceError("This experience needs a browser with WebGL enabled.");
    return;
  }

  let yaw = 0;
  let pitch = 0;
  let camera = [0, 0, 0];
  let radius = 14;
  let program;
  let sphereLocations;
  let skyBuffer;
  let skyPositionAttribute;
  let artworkTexture;
  let artworkMap;
  let throneProgram;
  let throneLocations;
  let throneRings = [];
  let throneEye;
  let throneLid;
  let time = 0;
  let lastFrame = 0;
  let lastStamp = performance.now();
  let experienceStarted = false;
  let opened = false;
  let currentWork = 0;
  let pointerStart = null;
  let inspectSwipeStart = null;
  let zoomFactor = 1;

  if (legacyLoading) legacyLoading.remove();

  const sources = [];
  let loaded = 0;
  skyAssets.forEach((url, index) => {
    const image = new Image();
    image.onload = () => {
      loaded += 1;
      if (loaded === skyAssets.length) {
        sources[index] = image;
        buildWorld(sources);
      } else {
        sources[index] = image;
      }
    };
    image.onerror = () => {
      loaded += 1;
      sources[index] = null;
      if (loaded === skyAssets.length) buildWorld(sources);
    };
    image.src = url;
  });

  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || "Could not compile sphere shader");
    }
    return shader;
  }

  function createProgram() {
    const vertex = createShader(gl.VERTEX_SHADER, `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `);
    const fragment = createShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      varying vec2 v_uv;
      uniform sampler2D u_artwork;
      uniform vec2 u_resolution;
      uniform vec3 u_camera;
      uniform float u_yaw;
      uniform float u_pitch;
      uniform float u_fov;
      uniform float u_radius;
      uniform float u_sky_radius;
      uniform float u_render_layer;
      uniform float u_time;
      const float PI = 3.14159265358979323846264;
      const float POD_Y = 1.12;
      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float noise3(vec3 p) {
        vec3 cell = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash31(cell + vec3(0.0, 0.0, 0.0));
        float n100 = hash31(cell + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(cell + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(cell + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(cell + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(cell + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(cell + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(cell + vec3(1.0, 1.0, 1.0));
        float low = mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y);
        float high = mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y);
        return mix(low, high, f.z);
      }
      vec3 panelCenter(int index, float clock) {
        float column = float(index - (index / 6) * 6);
        float row = float(index / 6);
        float baseLongitude = (column - 1.0) * (PI / 3.0) - PI * 0.5;
        float baseLatitude = 1.31 - row * 0.524;
        float speed = 0.0175 * (1.0 + 0.02 * sin(float(index) * 1.7));
        float travel = clock * speed + float(index) * 0.001;
        // Let the spherical coordinates carry panels smoothly through each pole.
        // The cosine naturally turns them onto the opposite side without a reset.
        float latitude = baseLatitude - travel;
        float longitude = baseLongitude - travel * 0.72;
        return normalize(vec3(cos(latitude) * cos(longitude), sin(latitude), cos(latitude) * sin(longitude)));
      }
      float panelPoleFade(int index, float clock) {
        float row = float(index / 6);
        float baseLatitude = 1.31 - row * 0.524;
        float speed = 0.0175 * (1.0 + 0.02 * sin(float(index) * 1.7));
        float travel = clock * speed + float(index) * 0.001;
        float latitude = baseLatitude - travel;
        // Fade each panel out as it approaches either pole, then ease it back
        // in after crossing; the wider window hides the tangent-frame change.
        return smoothstep(0.0, 0.34, abs(cos(latitude)));
      }
      void main() {
        float aspect = u_resolution.x / u_resolution.y;
      float scale = tan(u_fov * 0.5);
        vec2 screen = v_uv * 2.0 - 1.0;
        vec3 forward = normalize(vec3(sin(u_yaw) * cos(u_pitch), sin(u_pitch), -cos(u_yaw) * cos(u_pitch)));
        vec3 right = normalize(vec3(cos(u_yaw), 0.0, sin(u_yaw)));
        vec3 up = normalize(cross(right, forward));
        vec3 ray = normalize(forward + right * screen.x * aspect * scale + up * screen.y * scale);
        // A softly elongated ellipsoid gives the interior a rounded pod shape.
        // Equal-area vertical mapping gives the pole paintings more room.
        vec3 localCamera = vec3(u_camera.x, u_camera.y / POD_Y, u_camera.z);
        vec3 localRay = vec3(ray.x, ray.y / POD_Y, ray.z);
        float a = dot(localRay, localRay);
        float b = dot(localCamera, localRay);
        float c = dot(localCamera, localCamera) - u_sky_radius * u_sky_radius;
        float discriminant = max(0.0, b * b - a * c);
        float distanceToShell = (-b + sqrt(discriminant)) / a;
        vec3 localPositionOnShell = localCamera + localRay * distanceToShell;
        vec3 positionOnShell = vec3(localPositionOnShell.x, localPositionOnShell.y * POD_Y, localPositionOnShell.z);
        vec3 normal = normalize(vec3(localPositionOnShell.x, localPositionOnShell.y / POD_Y, localPositionOnShell.z));
        // Deep, painted space replaces the plain black gaps. Its pigment comes
        // from the paintings themselves, with soft clouding and restrained dust.
        vec3 spaceDirection = normalize(positionOnShell);
        // Sample only color from three paintings, then build a continuous 3D
        // nebula field from those pigments. Direction-space noise has no pole seam.
        vec3 pigmentA = texture2D(u_artwork, vec2(0.125, 0.833)).rgb;
        vec3 pigmentB = texture2D(u_artwork, vec2(0.375, 0.5)).rgb;
        vec3 pigmentC = texture2D(u_artwork, vec2(0.625, 0.167)).rgb;
        float cloud = noise3(spaceDirection * 4.6 + vec3(0.0, 0.0, u_time * 0.003));
        float detail = noise3(spaceDirection * 17.0 + vec3(4.2, -1.7, 0.0));
        float filament = noise3(spaceDirection * 43.0 + vec3(-2.4, 7.1, u_time * 0.002));
        float broadCloud = smoothstep(0.35, 0.78, cloud);
        float fineCloud = smoothstep(0.48, 0.84, detail);
        float polarHaze = smoothstep(0.58, 0.98, abs(spaceDirection.y)) * (0.42 + fineCloud * 0.58);
        float nebula = broadCloud * 0.4 + fineCloud * 0.2 + smoothstep(0.56, 0.9, filament) * 0.09 + polarHaze * 0.36;
        vec3 pigment = mix(pigmentA, pigmentB, fineCloud * 0.7);
        pigment = mix(pigment, pigmentC, broadCloud * 0.46);
        vec3 color = vec3(0.034, 0.036, 0.064) + pigment * nebula * vec3(0.56, 0.48, 0.42);
        color += vec3(0.022, 0.016, 0.048) * nebula;
        color += vec3(0.024, 0.018, 0.052) * polarHaze;
        vec3 starCell = floor(spaceDirection * 140.0);
        vec3 starLocal = fract(spaceDirection * 140.0) - vec3(0.5);
        vec3 starOffset = vec3(hash31(starCell + vec3(1.0, 0.0, 0.0)),
                               hash31(starCell + vec3(0.0, 1.0, 0.0)),
                               hash31(starCell + vec3(0.0, 0.0, 1.0))) - vec3(0.5);
        float star = (1.0 - smoothstep(0.07, 0.2, length(starLocal - starOffset))) * step(0.988, hash31(starCell));
        color += vec3(0.86, 0.67, 0.48) * star * 0.4;

        if (u_render_layer < 0.5) {
          vec3 insideNormal = -normal;
          vec3 keyDirection = normalize(vec3(cos(u_time * 0.055), 0.58 + 0.08 * sin(u_time * 0.07), sin(u_time * 0.055)));
          float key = max(dot(insideNormal, keyDirection), 0.0);
          color *= 1.0 + vec3(0.09, 0.06, 0.03) * key;
          color *= 1.0 - 0.04 * dot(screen, screen);
          gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
          return;
        }
        color = vec3(0.0);
        float panelCoverage = 0.0;

        // Each work is a separate, undistorted panel sliding over the fixed shell.
        // Intersect the ray with a flat panel at its moving point on the shell.
        float nearestPanel = 1.0e6;
        float secondPanel = 1.0e6;
        vec3 panelColor = color;
        vec3 secondColor = color;
        float panelOpacity = 0.0;
        float secondOpacity = 0.0;
        for (int i = 0; i < 36; i++) {
          vec3 center = panelCenter(i, u_time);
          vec3 panelPosition = u_radius * vec3(center.x, center.y * POD_Y, center.z);
          float facing = dot(ray, center);
          if (facing > 0.15) {
            vec3 referenceUp = abs(center.y) > 0.94 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
            vec3 tangentRight = normalize(cross(referenceUp, center));
            vec3 tangentUp = normalize(cross(center, tangentRight));
            float panelDistance = dot(panelPosition - u_camera, center) / facing;
            vec3 panelHit = u_camera + ray * panelDistance;
            vec3 panelOffset = panelHit - panelPosition;
            vec2 panelPoint = vec2(dot(panelOffset, tangentRight), dot(panelOffset, tangentUp)) / u_radius;
        // Generous overlap between undistorted artwork panels hides the dark shell.
        float panelHalfWidth = 0.68;
            float panelHalfHeight = panelHalfWidth * (2.0 / 3.0);
            vec2 panelUV = panelPoint / vec2(panelHalfWidth, panelHalfHeight) * 0.5 + 0.5;
            bool insidePanel = panelUV.x >= 0.0 && panelUV.x <= 1.0 && panelUV.y >= 0.0 && panelUV.y <= 1.0;
            if (panelDistance > 0.0 && insidePanel) {
              float edgeX = 1.0 - smoothstep(0.66, 1.0, abs(panelUV.x * 2.0 - 1.0));
              float edgeY = 1.0 - smoothstep(0.66, 1.0, abs(panelUV.y * 2.0 - 1.0));
              float opacity = edgeX * edgeY * panelPoleFade(i, u_time);
              int workIndex = i - (i / 12) * 12;
              float artColumn = float(workIndex - (workIndex / 4) * 4);
              float artRow = float(workIndex / 4);
              vec2 atlasUV = vec2((artColumn + panelUV.x) * 0.25, 1.0 - (artRow + (1.0 - panelUV.y)) / 3.0);
              vec3 painting = texture2D(u_artwork, atlasUV).rgb;
              if (panelDistance < nearestPanel) {
                secondPanel = nearestPanel;
                secondColor = panelColor;
                secondOpacity = panelOpacity;
                nearestPanel = panelDistance;
                panelColor = painting;
                panelOpacity = opacity;
              } else if (panelDistance < secondPanel) {
                secondPanel = panelDistance;
                secondColor = painting;
                secondOpacity = opacity;
              }
            }
          }
        }
        if (nearestPanel < 1.0e5) {
          if (secondPanel < 1.0e5) {
            // Crossfade overlapping panels as a painted surface, so the top,
            // bottom, left, and right edges blend into each other without dark seams.
            float combinedOpacity = panelOpacity + secondOpacity;
            float panelMix = panelOpacity / max(combinedOpacity, 0.0001);
            vec3 blendedPanels = mix(secondColor, panelColor, panelMix);
            // A little light from the painted nebula passes through the panels,
            // giving the artwork-coated sphere a translucent, layered quality.
            float coverage = 1.0 - (1.0 - panelOpacity) * (1.0 - secondOpacity);
            color = blendedPanels;
            panelCoverage = coverage;
          } else {
            panelCoverage = panelOpacity;
            color = panelColor;
          }
        }

        // A low, warm ambient fill keeps dark passages legible; the slow moving key
        // gives the painted world a gentle change in light as the viewer travels.
        vec3 insideNormal = -normal;
        vec3 keyDirection = normalize(vec3(cos(u_time * 0.055), 0.58 + 0.08 * sin(u_time * 0.07), sin(u_time * 0.055)));
        float key = max(dot(insideNormal, keyDirection), 0.0);
        float bounce = 0.018 * (0.5 + 0.5 * sin(u_time * 0.12 + normal.x * 2.1 + normal.z * 1.7));
        vec3 ambient = vec3(1.0);
        vec3 warmKey = vec3(0.09, 0.06, 0.03) * key;
        color = color * (ambient + warmKey + vec3(bounce));
        color += vec3(0.010, 0.006, 0.003) * pow(key, 5.0);
        float vignette = 1.0 - 0.04 * dot(screen, screen);
        color = color * vignette;
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), panelCoverage);
      }
    `);
    const next = gl.createProgram();
    gl.attachShader(next, vertex);
    gl.attachShader(next, fragment);
    gl.linkProgram(next);
    if (!gl.getProgramParameter(next, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(next) || "Could not link sphere shader");
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return next;
  }

  function createThroneProgram() {
    const vertex = createShader(gl.VERTEX_SHADER, `
      attribute vec3 a_position;
      attribute vec3 a_normal;
      attribute vec3 a_color;
      uniform mat4 u_mvp;
      uniform mat4 u_model;
      varying vec3 v_normal;
      varying vec3 v_world;
      varying vec3 v_color;
      varying vec3 v_local;
      void main() {
        vec4 world = u_model * vec4(a_position, 1.0);
        v_world = world.xyz;
        v_normal = normalize(mat3(u_model) * a_normal);
        v_color = a_color;
        v_local = a_position;
        gl_Position = u_mvp * vec4(a_position, 1.0);
      }
    `);
    const fragment = createShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform vec3 u_camera;
      uniform vec3 u_light;
      uniform float u_render_gain;
      varying vec3 v_normal;
      varying vec3 v_world;
      varying vec3 v_color;
      varying vec3 v_local;
      void main() {
        vec3 normal = normalize(v_normal);
        vec3 viewDirection = normalize(u_camera - v_world);
        vec3 lightDirection = normalize(u_light - v_world);
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float specular = pow(max(dot(reflect(-lightDirection, normal), viewDirection), 0.0), 34.0);
        float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.4);
        // Keep the throne in the shadows behind the art. Tight, restrained
        // highlights preserve the sculpted bronze without pulling focus.
        float eyeSurface = smoothstep(0.34, 0.50, v_color.r) * smoothstep(0.30, 0.46, v_color.g)
          * smoothstep(0.45, 0.62, v_color.b);
        // Use the sclera's cooler blue channel to keep fine red vessels out of the amber iris lighting.
        float irisSurface = smoothstep(0.18, 0.48, v_color.r)
          * (1.0 - smoothstep(0.20, 0.28, v_color.g))
          * (1.0 - smoothstep(0.052, 0.080, v_color.b));
        // Capillary vertex colors carry more blue than the amber iris fibers.
        float vesselSurface = smoothstep(0.42, 0.68, v_color.r)
          * (1.0 - smoothstep(0.30, 0.50, v_color.g))
          * smoothstep(0.10, 0.18, v_color.b)
          * (1.0 - smoothstep(0.32, 0.44, v_color.b));
        float goldSurface = smoothstep(0.16, 0.30, v_color.r)
          * (1.0 - smoothstep(0.30, 0.46, v_color.g))
          * (1.0 - smoothstep(0.12, 0.22, v_color.b));
        float eyeGloss = max(eyeSurface, irisSurface * 0.34);
        float scleraSurface = eyeSurface * smoothstep(0.58, 0.75, v_color.g)
          * smoothstep(0.50, 0.68, v_color.b);
        float scleraGrain = 0.0;
        float scleraBloom = 0.0;
        if (scleraSurface > 0.01) {
          scleraGrain = sin(v_local.x * 91.0 + sin(v_local.y * 35.0) * 2.1)
            * sin(v_local.y * 83.0 + cos(v_local.x * 29.0));
          scleraBloom = sin(v_local.x * 6.0 + v_local.y * 4.0)
            * cos(v_local.y * 5.0 - v_local.x * 3.0);
        }
        vec3 color = v_color * (0.16 + diffuse * 0.22);
        color += vec3(0.30, 0.235, 0.245) * eyeSurface;
        color += vec3(0.010, 0.006, 0.006) * scleraGrain * scleraSurface;
        color += vec3(0.010, 0.003, 0.001) * scleraBloom * scleraSurface;
        color += vec3(0.105, 0.052, 0.010) * irisSurface;
        // Capillaries should sit as soft warm rose beneath the wet surface,
        // not read as dark ink when the phone-sized mesh receives little light.
        color += vec3(0.34, 0.105, 0.095) * vesselSurface;
        color += vec3(0.14, 0.070, 0.024) * goldSurface;
        color += vec3(0.34, 0.20, 0.062) * specular * 0.13 * goldSurface;
        // Fine guilloche engraving on the broad ribbon bands catches a low gold glint.
        float localRadiusSquared = dot(v_local.xy, v_local.xy);
        if (localRadiusSquared > 225.0 && goldSurface > 0.12) {
          float localRadius = sqrt(localRadiusSquared);
          float ringRadius = localRadius < 28.0 ? 24.0 : (localRadius < 38.0 ? 34.0 : 44.0);
          float radialOffset = localRadius - ringRadius;
          float arc = atan(v_local.y, v_local.x) * ringRadius;
          float engraving = sin(arc * 0.82 + sin(arc * 0.39 + radialOffset * 1.1) * 2.2)
            * cos(radialOffset * 2.4 + sin(arc * 1.32) * 0.58);
          color += vec3(0.035, 0.020, 0.006) * engraving * goldSurface;
        }
        color += vec3(0.48, 0.39, 0.29) * specular * 0.26 * eyeGloss;
        color += vec3(0.52, 0.31, 0.12) * specular * 0.035;
        color += vec3(0.12, 0.06, 0.02) * fresnel * 0.02;
        gl_FragColor = vec4(color * u_render_gain, 1.0);
      }
    `);
    const next = gl.createProgram();
    gl.attachShader(next, vertex);
    gl.attachShader(next, fragment);
    gl.linkProgram(next);
    if (!gl.getProgramParameter(next, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(next) || "Could not link throne geometry");
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return next;
  }

  function appendMeshVertex(data, position, normal, color) {
    data.push(position[0], position[1], position[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
  }

  function appendTorus(data, radiusOnPlane, tubeRadius, color, segments, sides) {
    function point(u, v) {
      const a = (u / segments) * Math.PI * 2;
      const b = (v / sides) * Math.PI * 2;
      const normal = [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)];
      const position = [(radiusOnPlane + tubeRadius * Math.cos(b)) * Math.cos(a), (radiusOnPlane + tubeRadius * Math.cos(b)) * Math.sin(a), tubeRadius * Math.sin(b)];
      const engraved = 0.88 + 0.12 * (0.5 + 0.5 * Math.cos(a * 64.0));
      return { position, normal, color: color.map(channel => channel * engraved) };
    }
    const triangle = (a, b, c) => {
      appendMeshVertex(data, a.position, a.normal, a.color);
      appendMeshVertex(data, b.position, b.normal, b.color);
      appendMeshVertex(data, c.position, c.normal, c.color);
    };
    for (let u = 0; u < segments; u += 1) {
      for (let v = 0; v < sides; v += 1) {
        const a = point(u, v), b = point(u + 1, v), c = point(u + 1, v + 1), d = point(u, v + 1);
        triangle(a, b, c);
        triangle(a, c, d);
      }
    }
  }

  function appendTorusBelt(data, radiusOnPlane, halfWidth, halfThickness, color, segments, sides) {
    function point(u, v) {
      const a = (u / segments) * Math.PI * 2;
      const b = (v / sides) * Math.PI * 2;
      const radial = Math.cos(b);
      const normalRaw = [halfThickness * radial * Math.cos(a), halfThickness * radial * Math.sin(a), halfWidth * Math.sin(b)];
      const normalLength = Math.hypot(...normalRaw) || 1;
      const normal = normalRaw.map(value => value / normalLength);
      const position = [(radiusOnPlane + halfWidth * radial) * Math.cos(a), (radiusOnPlane + halfWidth * radial) * Math.sin(a), halfThickness * Math.sin(b)];
      const engraved = 0.68 + 0.20 * (0.5 + 0.5 * Math.cos(a * 24.0)) + 0.12 * (0.5 + 0.5 * Math.cos(a * 72.0 + Math.sin(a * 24.0) * 1.8));
      return { position, normal, color: color.map(channel => channel * engraved) };
    }
    const triangle = (a, b, c) => {
      appendMeshVertex(data, a.position, a.normal, a.color);
      appendMeshVertex(data, b.position, b.normal, b.color);
      appendMeshVertex(data, c.position, c.normal, c.color);
    };
    for (let u = 0; u < segments; u += 1) {
      for (let v = 0; v < sides; v += 1) {
        const a = point(u, v), b = point(u + 1, v), c = point(u + 1, v + 1), d = point(u, v + 1);
        triangle(a, b, c);
        triangle(a, c, d);
      }
    }
  }

  function appendBeltScroll(data, radius, halfWidth, halfThickness, offset, amplitude, waves, color, segments, sides) {
    function point(u, v) {
      const a = u / segments * Math.PI * 2;
      const b = v / sides * Math.PI * 2;
      const weave = offset + amplitude * Math.cos(a * waves);
      const radial = radius + weave;
      const z = halfThickness * Math.sqrt(Math.max(0.05, 1 - (weave / halfWidth) ** 2)) + 0.045;
      const tangentX = -radial * Math.sin(a) - amplitude * waves * Math.sin(a * waves) * Math.cos(a);
      const tangentY = radial * Math.cos(a) - amplitude * waves * Math.sin(a * waves) * Math.sin(a);
      const tangentLength = Math.hypot(tangentX, tangentY) || 1;
      const sideX = -tangentY / tangentLength;
      const sideY = tangentX / tangentLength;
      const radialTube = Math.cos(b);
      const position = [radial * Math.cos(a) + sideX * 0.052 * radialTube,
        radial * Math.sin(a) + sideY * 0.052 * radialTube,
        z + 0.052 * Math.sin(b)];
      const normal = [sideX * radialTube, sideY * radialTube, Math.sin(b)];
      const modulation = 0.82 + 0.18 * (0.5 + 0.5 * Math.cos(a * waves * 2));
      return { position, normal, color: color.map(channel => channel * modulation) };
    }
    for (let u = 0; u < segments; u += 1) {
      for (let v = 0; v < sides; v += 1) {
        const a = point(u, v), b = point(u + 1, v), c = point(u + 1, v + 1), d = point(u, v + 1);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, b.position, b.normal, b.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, d.position, d.normal, d.color);
      }
    }
  }

  function appendEyeEllipsoid(data, center, tangent, up, inward, size, color, latitudes = 6, longitudes = 8) {
    function vertex(latitude, longitude) {
      const phi = (latitude / latitudes) * Math.PI;
      const theta = (longitude / longitudes) * Math.PI * 2;
      const unit = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
      const position = [0, 1, 2].map(axis => center[axis]
        + tangent[axis] * unit[0] * size[0]
        + up[axis] * unit[1] * size[1]
        + inward[axis] * unit[2] * size[2]);
      const normalRaw = [0, 1, 2].map(axis => tangent[axis] * unit[0] / size[0]
        + up[axis] * unit[1] / size[1]
        + inward[axis] * unit[2] / size[2]);
      const length = Math.hypot(...normalRaw) || 1;
      const vertexColor = typeof color === "function" ? color(unit) : color;
      return { position, normal: normalRaw.map(value => value / length), color: vertexColor };
    }
    const triangle = (a, b, c) => {
      appendMeshVertex(data, a.position, a.normal, a.color);
      appendMeshVertex(data, b.position, b.normal, b.color);
      appendMeshVertex(data, c.position, c.normal, c.color);
    };
    for (let lat = 0; lat < latitudes; lat += 1) {
      for (let lon = 0; lon < longitudes; lon += 1) {
        const a = vertex(lat, lon), b = vertex(lat + 1, lon), c = vertex(lat + 1, lon + 1), d = vertex(lat, lon + 1);
        triangle(a, b, c);
        triangle(a, c, d);
      }
    }
  }

  function appendEyeIris(data, compact) {
    const spokes = compact ? 112 : 180;
    const bands = compact ? 10 : 14;
    const innerRadius = 0.17;
    const outerRadius = 0.49;
    function vertex(radius, angle) {
      const fiber = 0.5 + 0.5 * Math.sin(angle * 139.0 + Math.sin(angle * 9.0) * 2.0 + radius * 31.0);
      const crypt = 0.5 + 0.5 * Math.sin(angle * 31.0 + radius * 64.0);
      const innerLight = Math.max(0, 1 - Math.abs(radius - 0.27) / 0.16);
      const limbalShade = Math.max(0, Math.min(1, (radius - 0.365) / 0.055));
      const color = [
        0.42 + fiber * 0.30 + crypt * 0.055 + innerLight * 0.085 - limbalShade * 0.195,
        0.17 + fiber * 0.19 + crypt * 0.050 + innerLight * 0.075 - limbalShade * 0.065,
        0.022 + fiber * 0.045 + crypt * 0.016 + innerLight * 0.012 - limbalShade * 0.014
      ];
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.96;
      // Curve the iris just above the sclera so its full amber ring remains visible.
      const surface = 0.42 * Math.sqrt(Math.max(0.01, 1 - (x / 1.14) ** 2 - (y / 1.02) ** 2));
      const z = surface + 0.012 + 0.014 * (1.0 - radius / outerRadius);
      const normalRaw = [x / (1.14 * 1.14), y / (1.02 * 1.02), surface / (0.42 * 0.42)];
      const normalLength = Math.hypot(...normalRaw) || 1;
      return { position: [x, y, z], normal: normalRaw.map(value => value / normalLength), color };
    }
    for (let band = 0; band < bands; band += 1) {
      const r0 = innerRadius + (outerRadius - innerRadius) * band / bands;
      const r1 = innerRadius + (outerRadius - innerRadius) * (band + 1) / bands;
      for (let spoke = 0; spoke < spokes; spoke += 1) {
        const a0 = spoke / spokes * Math.PI * 2;
        const a1 = (spoke + 1) / spokes * Math.PI * 2;
        const p0 = vertex(r0, a0), p1 = vertex(r1, a0), p2 = vertex(r1, a1), p3 = vertex(r0, a1);
        appendMeshVertex(data, p0.position, p0.normal, p0.color);
        appendMeshVertex(data, p1.position, p1.normal, p1.color);
        appendMeshVertex(data, p2.position, p2.normal, p2.color);
        appendMeshVertex(data, p0.position, p0.normal, p0.color);
        appendMeshVertex(data, p2.position, p2.normal, p2.color);
        appendMeshVertex(data, p3.position, p3.normal, p3.color);
      }
    }
  }

  function appendEyeDetailRing(data, radius, tubeRadius, centerZ, color, segments = 112, sides = 6) {
    function point(segment, side) {
      const angle = segment / segments * Math.PI * 2;
      const around = side / sides * Math.PI * 2;
      const radial = Math.cos(around);
      return {
        position: [(radius + tubeRadius * radial) * Math.cos(angle),
          (radius + tubeRadius * radial) * Math.sin(angle), centerZ + tubeRadius * Math.sin(around)],
        normal: [radial * Math.cos(angle), radial * Math.sin(angle), Math.sin(around)],
        color
      };
    }
    for (let segment = 0; segment < segments; segment += 1) {
      for (let side = 0; side < sides; side += 1) {
        const a = point(segment, side), b = point(segment + 1, side), c = point(segment + 1, side + 1), d = point(segment, side + 1);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, b.position, b.normal, b.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, d.position, d.normal, d.color);
      }
    }
  }

  function appendEyeVessel(data, side, branch, compact, fine = false) {
    const segments = compact ? 10 : 20;
    const tubeSides = 4;
    const vesselRadius = fine ? (compact ? 0.0021 : 0.0028) : (Math.abs(branch) < 0.6 ? 0.0036 : 0.0046);
    const points = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const x = side * (1.06 - (0.48 + Math.abs(branch) * 0.06) * t);
      const y = branch * (0.035 + 0.20 * t)
        + Math.sin(t * Math.PI * 2.7 + side) * 0.028 * t
        + Math.sin(t * Math.PI * 5 + branch) * 0.008 * t;
      const surface = Math.max(0.02, 1 - (x / 1.14) ** 2 - (y / 1.02) ** 2);
      points.push([x, y, 0.42 * Math.sqrt(surface) + 0.009, t]);
    }
    const drawPath = (path, radiusScale = 1, colorScale = 1) => {
      const pathSegments = path.length - 1;
      for (let i = 0; i < pathSegments; i += 1) {
        const previous = path[Math.max(0, i - 1)], next = path[Math.min(pathSegments, i + 1)];
        const dx = next[0] - previous[0], dy = next[1] - previous[1];
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length, ny = dx / length;
        const make = (point, around) => {
          const angle = around / tubeSides * Math.PI * 2;
          const radial = Math.cos(angle);
          const t = point[3] || 0;
          const fade = 1.0 - 0.38 * t;
          const tip = Math.max(0.12, Math.min(1, t / 0.18, (1 - t) / 0.26));
          const radius = vesselRadius * radiusScale * tip;
          return {
            position: [point[0] + nx * radius * radial, point[1] + ny * radius * radial, point[2] + radius * Math.sin(angle)],
            normal: [nx * radial, ny * radial, Math.sin(angle)], color: [0.82 * fade * colorScale, 0.39 * fade * colorScale, 0.33 * fade * colorScale]
          };
        };
        for (let s = 0; s < tubeSides; s += 1) {
          const a = make(path[i], s), b = make(path[i + 1], s), c = make(path[i + 1], s + 1), d = make(path[i], s + 1);
          appendMeshVertex(data, a.position, a.normal, a.color);
          appendMeshVertex(data, b.position, b.normal, b.color);
          appendMeshVertex(data, c.position, c.normal, c.color);
          appendMeshVertex(data, a.position, a.normal, a.color);
          appendMeshVertex(data, c.position, c.normal, c.color);
          appendMeshVertex(data, d.position, d.normal, d.color);
        }
      }
    };
    drawPath(points);
    if (Math.abs(branch) > 0.7) {
      const splitIndex = Math.round(segments * 0.52);
      const origin = points[splitIndex];
      const branchSegments = compact ? 4 : 7;
      const branchPath = [];
      const awayFromTrunk = branch > 0 ? -1 : 1;
      for (let i = 0; i <= branchSegments; i += 1) {
        const t = i / branchSegments;
        const x = origin[0] + side * 0.15 * t;
        const y = origin[1] + awayFromTrunk * (0.11 * t + 0.018 * Math.sin(t * Math.PI));
        const surface = Math.max(0.02, 1 - (x / 1.14) ** 2 - (y / 1.02) ** 2);
        branchPath.push([x, y, 0.42 * Math.sqrt(surface) + 0.011, t]);
      }
      drawPath(branchPath, 0.52, 0.72);

      // A finer fork splits farther in, echoing the small branching vessels
      // visible in the reference while staying below a pixel on most phones.
      const fineOrigin = points[Math.round(segments * 0.76)];
      const finePath = [];
      const fineSegments = compact ? 4 : 7;
      for (let i = 0; i <= fineSegments; i += 1) {
        const t = i / fineSegments;
        const x = fineOrigin[0] + side * 0.10 * t;
        const y = fineOrigin[1] - awayFromTrunk * (0.075 * t + 0.010 * Math.sin(t * Math.PI));
        const surface = Math.max(0.02, 1 - (x / 1.14) ** 2 - (y / 1.02) ** 2);
        finePath.push([x, y, 0.42 * Math.sqrt(surface) + 0.010, t]);
      }
      drawPath(finePath, fine ? 0.34 : 0.42, 0.62);

      // Two short, hairline twigs per feeder create an irregular surface web;
      // their shorter length and tapered radius keep the center over the iris clear.
      for (let fork = 0; fork < 2; fork += 1) {
        const twigOrigin = points[Math.round(segments * (fork === 0 ? 0.34 : 0.66))];
        const twigSegments = compact ? 3 : 5;
        const twigPath = [];
        const direction = (branch > 0 ? -1 : 1) * (fork === 0 ? 1 : -1);
        for (let i = 0; i <= twigSegments; i += 1) {
          const t = i / twigSegments;
          const x = twigOrigin[0] + side * (fine ? 0.045 : 0.070) * t;
          const y = twigOrigin[1] + direction * (0.034 * t + 0.008 * Math.sin(t * Math.PI));
          const surface = Math.max(0.02, 1 - (x / 1.14) ** 2 - (y / 1.02) ** 2);
          twigPath.push([x, y, 0.42 * Math.sqrt(surface) + 0.010, t]);
        }
        drawPath(twigPath, fine ? 0.38 : 0.30, 0.68);
      }
    }
  }

  function appendEyeCapillaries(data, compact) {
    // One hundred static, fine vessels are distributed around the full sclera,
    // each travelling inward toward the limbus. Lower tessellation keeps phones light.
    const count = 100;
    const segments = compact ? 4 : 6;
    const tubeSides = 3;
    const baseRadius = compact ? 0.0021 : 0.0027;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const surfaceZ = (x, y) => 0.42 * Math.sqrt(Math.max(0.02, 1 - (x / 1.14) ** 2 - (y / 1.02) ** 2));
    const emitPath = (path, radiusScale = 1, colorScale = 1) => {
      const pathSegments = path.length - 1;
      for (let i = 0; i < pathSegments; i += 1) {
        const previous = path[Math.max(0, i - 1)], next = path[Math.min(pathSegments, i + 1)];
        const dx = next[0] - previous[0], dy = next[1] - previous[1];
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length, ny = dx / length;
        const make = (point, around) => {
          const angle = around / tubeSides * Math.PI * 2;
          const radial = Math.cos(angle);
          const t = point[3];
          const taper = Math.max(0.16, Math.min(1, 0.26 + t * 3.8, 0.18 + (1 - t) * 2.8));
          const radius = baseRadius * radiusScale * taper;
          const fade = 1 - 0.26 * t;
          return {
            position: [point[0] + nx * radius * radial, point[1] + ny * radius * radial, point[2] + radius * Math.sin(angle)],
            normal: [nx * radial, ny * radial, Math.sin(angle)],
            color: [0.66 * fade * colorScale, 0.31 * fade * colorScale, 0.29 * fade * colorScale]
          };
        };
        for (let side = 0; side < tubeSides; side += 1) {
          const a = make(path[i], side), b = make(path[i + 1], side);
          const c = make(path[i + 1], side + 1), d = make(path[i], side + 1);
          appendMeshVertex(data, a.position, a.normal, a.color);
          appendMeshVertex(data, b.position, b.normal, b.color);
          appendMeshVertex(data, c.position, c.normal, c.color);
          appendMeshVertex(data, a.position, a.normal, a.color);
          appendMeshVertex(data, c.position, c.normal, c.color);
          appendMeshVertex(data, d.position, d.normal, d.color);
        }
      }
    };

    for (let index = 0; index < count; index += 1) {
      const angle = index * goldenAngle;
      const startRadius = 0.94 + ((index * 37) % 13) / 180;
      const endRadius = 0.505 + ((index * 19) % 11) / 220;
      const curve = (((index * 29) % 17) / 16 - 0.5) * 0.32;
      const path = [];
      for (let step = 0; step <= segments; step += 1) {
        const t = step / segments;
        const radius = startRadius + (endRadius - startRadius) * t;
        const direction = angle + curve * t + Math.sin(t * Math.PI) * curve * 0.28;
        const x = 1.14 * radius * Math.cos(direction);
        const y = 1.02 * radius * Math.sin(direction);
        path.push([x, y, surfaceZ(x, y) + 0.012, t]);
      }
      emitPath(path, 0.60 + ((index * 11) % 7) * 0.075, 0.70 + ((index * 7) % 5) * 0.07);

      // A quarter of the fine vessels sprout a short, delicate feeder branch.
      if (index % 4 === 0) {
        const originIndex = Math.round(segments * 0.48);
        const origin = path[originIndex];
        const branchDirection = angle + curve * 0.48 + ((index % 8) < 4 ? -0.22 : 0.22);
        const branchPath = [origin];
        const branchSegments = compact ? 2 : 3;
        const branchStartRadius = Math.hypot(origin[0] / 1.14, origin[1] / 1.02);
        for (let step = 1; step <= branchSegments; step += 1) {
          const t = step / branchSegments;
          const radius = branchStartRadius - 0.055 * t;
          const direction = branchDirection + (((index % 3) - 1) * 0.07 * t);
          const x = 1.14 * radius * Math.cos(direction);
          const y = 1.02 * radius * Math.sin(direction);
          branchPath.push([x, y, surfaceZ(x, y) + 0.013, t]);
        }
        emitPath(branchPath, 0.42, 0.58);
      }
    }
  }

  function appendEyeLidArc(data, start, end, upper, compact) {
    const segments = compact ? 20 : 36;
    const sides = compact ? 4 : 8;
    const tubeRadius = upper ? 0.092 : 0.070;
    function point(segment, side) {
      const angle = start + (end - start) * segment / segments;
      const sideAngle = side / sides * Math.PI * 2;
      const radial = Math.cos(sideAngle);
      const centerX = 1.04 * Math.cos(angle);
      const centerY = 0.90 * Math.sin(angle);
      const raised = (upper ? 1 : -1) * 0.035;
      const surfaceDepth = 0.42 * Math.sqrt(Math.max(0.03, 1 - (centerX / 1.14) ** 2 - (centerY / 1.02) ** 2));
      const position = [centerX + Math.cos(angle) * tubeRadius * radial,
        centerY + Math.sin(angle) * tubeRadius * radial,
        surfaceDepth + 0.035 + raised + tubeRadius * Math.sin(sideAngle)];
      const normalRaw = [Math.cos(angle) * radial, Math.sin(angle) * radial, Math.sin(sideAngle)];
      const length = Math.hypot(...normalRaw) || 1;
      const color = upper ? [0.19, 0.12, 0.095] : [0.21, 0.145, 0.12];
      return { position, normal: normalRaw.map(value => value / length), color };
    }
    for (let segment = 0; segment < segments; segment += 1) {
      for (let side = 0; side < sides; side += 1) {
        const a = point(segment, side), b = point(segment + 1, side), c = point(segment + 1, side + 1), d = point(segment, side + 1);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, b.position, b.normal, b.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, d.position, d.normal, d.color);
      }
    }
  }

  function appendEyeCrease(data, compact) {
    // A soft, shallow upper fold gives the lid a real orbital shape instead of a drawn-on outline.
    const segments = compact ? 24 : 42;
    const sides = compact ? 4 : 8;
    const radius = 0.047;
    function point(segment, side) {
      const angle = Math.PI * (0.12 + 0.76 * segment / segments);
      const around = side / sides * Math.PI * 2;
      const radial = Math.cos(around);
      const x = 1.08 * Math.cos(angle);
      const y = 1.03 * Math.sin(angle) + 0.035;
      const z = 0.42 * Math.sqrt(Math.max(0.025, 1 - (x / 1.14) ** 2 - (Math.min(1.00, y) / 1.02) ** 2)) - 0.025;
      return {
        position: [x + Math.cos(angle) * radius * radial, y + Math.sin(angle) * radius * radial, z + radius * Math.sin(around)],
        normal: [Math.cos(angle) * radial, Math.sin(angle) * radial, Math.sin(around)],
        color: [0.105, 0.049, 0.025]
      };
    }
    for (let segment = 0; segment < segments; segment += 1) {
      for (let side = 0; side < sides; side += 1) {
        const a = point(segment, side), b = point(segment + 1, side), c = point(segment + 1, side + 1), d = point(segment, side + 1);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, b.position, b.normal, b.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, d.position, d.normal, d.color);
      }
    }
  }

  function appendEyeBezel(data, compact) {
    const segments = compact ? 48 : 64;
    const sides = compact ? 4 : 6;
    const tubeRadius = 0.042;
    const radiusX = 1.12;
    const radiusY = 0.99;
    function point(segment, side) {
      const angle = segment / segments * Math.PI * 2;
      const around = side / sides * Math.PI * 2;
      const radial = Math.cos(around);
      const x = radiusX * Math.cos(angle);
      const y = radiusY * Math.sin(angle);
      const surface = 0.42 * Math.sqrt(Math.max(0.012, 1 - (x / 1.14) ** 2 - (y / 1.02) ** 2));
      const glint = 0.5 + 0.5 * Math.cos(segment / segments * Math.PI * 2 * 24);
      const color = [0.30 + glint * 0.15, 0.17 + glint * 0.085, 0.050 + glint * 0.026];
      const position = [x + Math.cos(angle) * tubeRadius * radial,
        y + Math.sin(angle) * tubeRadius * radial,
        surface + 0.026 + tubeRadius * Math.sin(around)];
      const normalRaw = [Math.cos(angle) * radial, Math.sin(angle) * radial, Math.sin(around)];
      const length = Math.hypot(...normalRaw) || 1;
      return { position, normal: normalRaw.map(value => value / length), color };
    }
    for (let segment = 0; segment < segments; segment += 1) {
      for (let side = 0; side < sides; side += 1) {
        const a = point(segment, side), b = point(segment + 1, side), c = point(segment + 1, side + 1), d = point(segment, side + 1);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, b.position, b.normal, b.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, d.position, d.normal, d.color);
      }
    }
  }

  function makeThroneRing(radiusOnPlane, eyeCount, compact) {
    const data = [];
    const segments = compact ? 144 : 224;
    const sides = compact ? 12 : 18;
    const halfWidth = compact ? 8.7 : 9.3;
    const halfThickness = compact ? 1.35 : 1.45;
    // Broad ribbon faces sit just wider than the eyes, with raised borders and braided rococo scrolls.
    appendTorusBelt(data, radiusOnPlane, halfWidth, halfThickness, [0.14, 0.076, 0.029], segments, sides);
    appendTorus(data, radiusOnPlane - halfWidth * 0.91, 0.075, [0.30, 0.18, 0.065], segments, sides);
    appendTorus(data, radiusOnPlane + halfWidth * 0.91, 0.075, [0.24, 0.13, 0.045], segments, sides);
    appendTorus(data, radiusOnPlane - halfWidth * 0.57, 0.045, [0.18, 0.10, 0.034], segments, Math.max(10, sides - 2));
    appendTorus(data, radiusOnPlane + halfWidth * 0.57, 0.045, [0.18, 0.10, 0.034], segments, Math.max(10, sides - 2));
    appendTorus(data, radiusOnPlane, 0.035, [0.32, 0.21, 0.082], segments, Math.max(10, sides - 2));
    const scrollCount = Math.round(radiusOnPlane * 0.64);
    appendBeltScroll(data, radiusOnPlane, halfWidth, halfThickness, -1.85, 1.20, scrollCount, [0.34, 0.20, 0.072], segments, 6);
    appendBeltScroll(data, radiusOnPlane, halfWidth, halfThickness, 1.85, 1.20, scrollCount, [0.34, 0.20, 0.072], segments, 6);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    // Eyes are mounted right at the belt's inner rim, facing into the painting sphere.
    return { buffer, count: data.length / 9, radius: radiusOnPlane, bandHalfWidth: halfWidth, eyeCount, innerEyeRadius: radiusOnPlane - halfWidth + 0.35 };
  }

  function appendEyeSocketStuds(data, compact) {
    const count = compact ? 8 : 12;
    const detail = compact ? [3, 5] : [4, 6];
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2;
      const x = 1.105 * Math.cos(angle);
      const y = 0.978 * Math.sin(angle);
      const surface = 0.42 * Math.sqrt(Math.max(0.012, 1 - (x / 1.14) ** 2 - (y / 1.02) ** 2));
      const center = [x, y, surface + 0.055];
      appendEyeEllipsoid(data, center, [1, 0, 0], [0, 1, 0], [0, 0, 1],
        [0.034, 0.034, 0.018], [0.47, 0.28, 0.085], ...detail);
    }
  }

  function makeThroneEye(compact) {
    const data = [];
    const detail = compact ? [12, 18] : [24, 36];
    const x = [1, 0, 0], y = [0, 1, 0], z = [0, 0, 1];
    appendEyeEllipsoid(data, [0, 0, -0.16], x, y, z, [1.33, 1.17, 0.36], [0.28, 0.15, 0.052], ...detail);
    const scleraColor = unit => {
      const front = Math.max(0, unit[2]);
      const edge = Math.max(0, Math.min(1, (Math.hypot(unit[0], unit[1]) - 0.36) / 0.64)) * front;
      const lowerFlush = Math.max(0, -unit[1]) * front;
      const leftCornerDelta = (unit[0] + 0.88) / 0.16;
      const rightCornerDelta = (unit[0] - 0.88) / 0.16;
      const cornerY = unit[1] / 0.26;
      const cornerFlush = Math.max(Math.exp(-(leftCornerDelta * leftCornerDelta) - cornerY * cornerY),
        Math.exp(-(rightCornerDelta * rightCornerDelta) - cornerY * cornerY)) * front;
      const limbusDelta = (Math.hypot(unit[0], unit[1]) - 0.49) / 0.085;
      const limbus = Math.exp(-(limbusDelta * limbusDelta)) * front;
      const grain = (Math.sin(unit[0] * 43 + unit[1] * 19) + Math.sin(unit[0] * 71 - unit[1] * 31)) * 0.008 * front;
      // Muted rose-pink sclera, with restrained warmth at the limbus and corners.
      return [0.78 + edge * 0.035 + lowerFlush * 0.050 + cornerFlush * 0.035 + limbus * 0.018 + grain,
        0.63 - edge * 0.014 - lowerFlush * 0.018 - cornerFlush * 0.006 + grain * 0.30,
        0.65 - edge * 0.018 - lowerFlush * 0.013 - cornerFlush * 0.004 - limbus * 0.010 + grain * 0.22];
    };
    appendEyeEllipsoid(data, [0, 0, 0], x, y, z, [1.14, 1.02, 0.42], scleraColor, ...detail);
    appendEyeIris(data, compact);
    const ringSegments = compact ? 48 : 112;
    const ringSides = compact ? 4 : 6;
    appendEyeDetailRing(data, 0.497, 0.016, 0.394, [0.035, 0.017, 0.006], ringSegments, ringSides);
    appendEyeDetailRing(data, 0.385, 0.009, 0.413, [0.34, 0.13, 0.025], ringSegments, ringSides);
    appendEyeDetailRing(data, 0.21, 0.010, 0.446, [0.13, 0.065, 0.018], ringSegments, ringSides);
    appendEyeEllipsoid(data, [0, 0, 0.445], x, y, z, [0.155, 0.155, 0.035], [0.006, 0.004, 0.003], ...detail);
    // Subtle limbal depth and a small lower iris catchlight add wet, optical depth without glowing.
    appendEyeDetailRing(data, 0.465, 0.012, 0.411, [0.055, 0.025, 0.008], ringSegments, ringSides);
    // Two restrained corneal reflections sit high on the iris, like wet studio catchlights.
    appendEyeEllipsoid(data, [0.045, -0.035, 0.49], x, y, z, [0.026, 0.032, 0.005], [0.94, 0.89, 0.78], ...detail);
    appendEyeEllipsoid(data, [0.21, -0.035, 0.454], x, y, z, [0.020, 0.024, 0.008], [0.58, 0.55, 0.48], ...detail);
    // Three finely stepped gold lips seat the eye in its metal socket like the reference.
    appendEyeBezel(data, compact);
    appendEyeDetailRing(data, 1.065, 0.022, 0.196, [0.36, 0.205, 0.064], ringSegments, ringSides);
    appendEyeSocketStuds(data, compact);
    appendEyeVessel(data, -1, -1, compact);
    appendEyeVessel(data, -1, 1, compact);
    appendEyeVessel(data, 1, -1, compact);
    appendEyeVessel(data, 1, 1, compact);
    // Fine secondary capillaries add scleral detail while staying inside the same static eye mesh.
    appendEyeVessel(data, -1, -0.48, compact);
    appendEyeVessel(data, -1, 0.48, compact);
    appendEyeVessel(data, 1, -0.48, compact);
    appendEyeVessel(data, 1, 0.48, compact);
    // Extra fine branches fill the outer sclera with small, natural capillaries.
    appendEyeVessel(data, -1, -0.76, compact, true);
    appendEyeVessel(data, -1, 0.76, compact, true);
    appendEyeVessel(data, 1, -0.76, compact, true);
    appendEyeVessel(data, 1, 0.76, compact, true);
    appendEyeCapillaries(data, compact);
    appendEyeLidArc(data, 0, Math.PI, true, compact);
    appendEyeLidArc(data, Math.PI, Math.PI * 2, false, compact);
    appendEyeCrease(data, compact);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, count: data.length / 9 };
  }

  function makeThroneLid(compact) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(0), gl.DYNAMIC_DRAW);
    return { buffer, count: 0, compact };
  }

  function updateThroneLid(mesh, closure) {
    const rows = mesh.compact ? 8 : 16;
    const columns = mesh.compact ? 14 : 28;
    // Finish every blink with a sealed lid so the raised iris and pupil cannot show through.
    const lowerY = 1.02 - closure * 2.04;
    const data = [];
    function vertex(row, column) {
      const v = row / rows;
      const y = 1.02 + (lowerY - 1.02) * v;
      const halfWidth = 1.14 * Math.sqrt(Math.max(0, 1 - (y / 1.02) ** 2));
      const x = ((column / columns) * 2 - 1) * halfWidth;
      const surface = 0.42 * Math.sqrt(Math.max(0.012, 1 - (x / 1.14) ** 2 - (y / 1.02) ** 2));
      // Lift the closing lid in front of the raised iris and pupil so neither
      // can show through during a full blink.
      const depth = surface + 0.10;
      const normalRaw = [x / (1.14 * 1.14), y / (1.02 * 1.02), surface / (0.42 * 0.42)];
      const normalLength = Math.hypot(...normalRaw) || 1;
      const shade = 0.88 + 0.12 * (1 - v);
      return { position: [x, y, depth], normal: normalRaw.map(value => value / normalLength), color: [0.48 * shade, 0.38 * shade, 0.33 * shade] };
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = vertex(row, column), b = vertex(row + 1, column), c = vertex(row + 1, column + 1), d = vertex(row, column + 1);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, b.position, b.normal, b.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, d.position, d.normal, d.color);
      }
    }
    const seamT = Math.max(0, Math.min(1, (closure - 0.80) / 0.20));
    if (seamT > 0) {
      const segments = mesh.compact ? 16 : 28;
      const halfWidth = 0.012 * seamT;
      const seamColor = [0.23 * seamT, 0.17 * seamT, 0.14 * seamT];
      for (let segment = 0; segment < segments; segment += 1) {
        const x0 = -1.04 + segment / segments * 2.08;
        const x1 = -1.04 + (segment + 1) / segments * 2.08;
        const make = (x, side) => {
          const normalizedX = x / 1.14;
          const y = -0.018 + 0.025 * normalizedX * normalizedX + side * halfWidth;
          const surface = 0.42 * Math.sqrt(Math.max(0.012, 1 - normalizedX * normalizedX - (y / 1.02) ** 2));
          const normal = [x / (1.14 * 1.14), y / (1.02 * 1.02), surface / (0.42 * 0.42)];
          const normalLength = Math.hypot(...normal) || 1;
          return { position: [x, y, surface + 0.125], normal: normal.map(value => value / normalLength), color: seamColor };
        };
        const a = make(x0, -1), b = make(x1, -1), c = make(x1, 1), d = make(x0, 1);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, b.position, b.normal, b.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, a.position, a.normal, a.color);
        appendMeshVertex(data, c.position, c.normal, c.color);
        appendMeshVertex(data, d.position, d.normal, d.color);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
    mesh.count = data.length / 9;
  }

  function eyeBlinkAmount(t, ringIndex, eyeIndex) {
    const seed = eyeIndex * 0.73 + ringIndex * 1.91;
    const period = 3.3 + ((eyeIndex * 17 + ringIndex * 13) % 19) * 0.11;
    const phase = (t + seed) % period;
    const duration = 0.22;
    return phase < duration ? Math.sin(Math.PI * phase / duration) : 0;
  }

  function matrixMultiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        out[column * 4 + row] = a[row] * b[column * 4]
          + a[4 + row] * b[column * 4 + 1]
          + a[8 + row] * b[column * 4 + 2]
          + a[12 + row] * b[column * 4 + 3];
      }
    }
    return out;
  }

  function scaleMatrix(value) {
    return new Float32Array([value, 0, 0, 0, 0, value, 0, 0, 0, 0, value, 0, 0, 0, 0, 1]);
  }

  function transformPoint(matrix, point) {
    return [
      matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
      matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
      matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14]
    ];
  }

  function rotationMatrix(x, y, z) {
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    const rx = new Float32Array([1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
    const ry = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
    const rz = new Float32Array([cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return matrixMultiply(matrixMultiply(rx, ry), rz);
  }

  function throneFrame(position, tangent, up, inward) {
    return new Float32Array([
      tangent[0], tangent[1], tangent[2], 0,
      up[0], up[1], up[2], 0,
      inward[0], inward[1], inward[2], 0,
      position[0], position[1], position[2], 1
    ]);
  }

  function throneViewMatrix(dirs) {
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return new Float32Array([
      dirs.right[0], dirs.up[0], -dirs.forward[0], 0,
      dirs.right[1], dirs.up[1], -dirs.forward[1], 0,
      dirs.right[2], dirs.up[2], -dirs.forward[2], 0,
      -dot(dirs.right, camera), -dot(dirs.up, camera), dot(dirs.forward, camera), 1
    ]);
  }

  function throneProjectionMatrix() {
    const near = 0.1, far = 200;
    const f = 1 / Math.tan((Math.PI / 2.35) / 2);
    const aspect = canvas.width / canvas.height;
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0
    ]);
  }

  function drawThrone() {
    if (!experienceStarted || dialog.open || !throneProgram) return;
    const dirs = basis();
    const view = throneViewMatrix(dirs);
    const projection = throneProjectionMatrix();
    const tanHalfFov = Math.tan((Math.PI / 2.35) / 2);
    const aspect = canvas.width / canvas.height;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(throneProgram);
    gl.uniform3f(throneLocations.camera, camera[0], camera[1], camera[2]);
    gl.uniform3f(throneLocations.light, 4.0 + Math.cos(time * 0.08) * 3.0, 8.0, -6.0 + Math.sin(time * 0.08) * 3.0);
    // The artwork panels drift at 0.0175 rad/s; throne movement stays much slower.
    const assemblyRotation = rotationMatrix(0.10, time * 0.0005625, -0.06);
    const stride = 9 * Float32Array.BYTES_PER_ELEMENT;
    const { position: positionAttribute, normal: normalAttribute, color: colorAttribute } = throneLocations;
    gl.enableVertexAttribArray(positionAttribute);
    gl.enableVertexAttribArray(normalAttribute);
    gl.enableVertexAttribArray(colorAttribute);
    const drawMesh = (mesh, model, renderGain = 1) => {
      const mvp = matrixMultiply(projection, matrixMultiply(view, model));
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(normalAttribute, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
      gl.vertexAttribPointer(colorAttribute, 3, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT);
      gl.uniform1f(throneLocations.renderGain, renderGain);
      gl.uniformMatrix4fv(throneLocations.model, false, model);
      gl.uniformMatrix4fv(throneLocations.mvp, false, mvp);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    };
    throneRings.forEach((ring, index) => {
      const speed = [0.0024, -0.0020, 0.0018][index];
      const tilt = [[1.48, 0.00], [1.48, 1.05], [1.34, -1.05]][index];
      const localRotation = rotationMatrix(tilt[0] + time * speed, tilt[1] - time * speed * 0.61, time * speed * 1.7);
      const ringRotation = matrixMultiply(assemblyRotation, localRotation);
      const model = matrixMultiply(ringRotation, scaleMatrix(1));
      drawMesh(ring, model, 1.875);
      const worldUp = [0, 1, 0];
      for (let eyeIndex = 0; eyeIndex < ring.eyeCount; eyeIndex += 1) {
        const angle = (eyeIndex / ring.eyeCount) * Math.PI * 2;
        const eyeRadius = ring.innerEyeRadius;
        const eyeCenter = transformPoint(ringRotation, [Math.cos(angle) * eyeRadius, Math.sin(angle) * eyeRadius, 0]);
        const towardCamera = camera.map((value, axis) => value - eyeCenter[axis]);
        const eyeLength = Math.hypot(...towardCamera) || 1;
        const eyeNormal = towardCamera.map(value => value / eyeLength);
        // Seat each eye deeper inside the opening so its enlarged bezel clears the inner rim.
        eyeCenter.forEach((value, axis) => { eyeCenter[axis] = value + eyeNormal[axis] * 2.1; });
        const toEye = eyeCenter.map((value, axis) => value - camera[axis]);
        const depth = toEye[0] * dirs.forward[0] + toEye[1] * dirs.forward[1] + toEye[2] * dirs.forward[2];
        if (depth <= 0) continue;
        const horizontal = toEye[0] * dirs.right[0] + toEye[1] * dirs.right[1] + toEye[2] * dirs.right[2];
        const vertical = toEye[0] * dirs.up[0] + toEye[1] * dirs.up[1] + toEye[2] * dirs.up[2];
        const eyeMargin = 2.2;
        if (Math.abs(horizontal) > depth * tanHalfFov * aspect + eyeMargin
          || Math.abs(vertical) > depth * tanHalfFov + eyeMargin) continue;
        let eyeRight = [eyeNormal[1] * worldUp[2] - eyeNormal[2] * worldUp[1], eyeNormal[2] * worldUp[0] - eyeNormal[0] * worldUp[2], eyeNormal[0] * worldUp[1] - eyeNormal[1] * worldUp[0]];
        if (Math.hypot(...eyeRight) < 0.001) eyeRight = [1, 0, 0];
        const rightLength = Math.hypot(...eyeRight);
        eyeRight = eyeRight.map(value => value / rightLength);
        const eyeUp = [eyeNormal[1] * eyeRight[2] - eyeNormal[2] * eyeRight[1], eyeNormal[2] * eyeRight[0] - eyeNormal[0] * eyeRight[2], eyeNormal[0] * eyeRight[1] - eyeNormal[1] * eyeRight[0]];
        // Keep the gaze aimed inward, but give each eye a slight individual roll so the veins and glints do not repeat mechanically.
        const eyeRoll = Math.sin(eyeIndex * 5.37 + index * 11.7) * 0.24;
        const rollCos = Math.cos(eyeRoll), rollSin = Math.sin(eyeRoll);
        const rolledRight = eyeRight.map((value, axis) => value * rollCos + eyeUp[axis] * rollSin);
        const rolledUp = eyeUp.map((value, axis) => value * rollCos - eyeRight[axis] * rollSin);
        const eyeFrame = throneFrame(eyeCenter, rolledRight, rolledUp, eyeNormal);
        const eyeScale = 1.15 + 0.08 * (0.5 + 0.5 * Math.sin(eyeIndex * 2.39 + index * 1.47));
        const eyeModel = matrixMultiply(eyeFrame, scaleMatrix(eyeScale));
        drawMesh(throneEye, eyeModel, 0.375);
        const blink = eyeBlinkAmount(time, index, eyeIndex);
        if (blink > 0.015) {
          updateThroneLid(throneLid, blink);
          drawMesh(throneLid, eyeModel, 0.375);
        }
      }
    });
    gl.disable(gl.DEPTH_TEST);
  }

  function contain(ctx, image, x, y, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function drawLandscape(ctx, image, draw, x, y, width, height) {
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(Math.PI / 2);
    draw(ctx, image, -height / 2, -width / 2, height, width);
    ctx.restore();
  }

  function drawPaintingPanel(context, image, index, tileWidth, tileHeight, panel) {
    const x = (index % 4) * tileWidth;
    const y = Math.floor(index / 4) * tileHeight;
    panel.width = Math.round(tileWidth);
    panel.height = Math.ceil(tileHeight);
    const p = panel.getContext("2d");
    p.filter = "blur(28px) brightness(.88) saturate(1.08)";
    if (index === 0) drawLandscape(p, image, cover, -18, -14, tileWidth + 36, tileHeight + 28);
    else cover(p, image, -18, -14, tileWidth + 36, tileHeight + 28);
    p.filter = "none";
    const pad = 8;
    if (index === 0) drawLandscape(p, image, contain, pad, pad, tileWidth - pad * 2, tileHeight - pad * 2);
    else contain(p, image, pad, pad, tileWidth - pad * 2, tileHeight - pad * 2);
    p.globalCompositeOperation = "destination-in";
    const horizontal = p.createLinearGradient(0, 0, tileWidth, 0);
    horizontal.addColorStop(0, "rgba(255,255,255,0)");
    horizontal.addColorStop(0.09, "rgba(255,255,255,1)");
    horizontal.addColorStop(0.91, "rgba(255,255,255,1)");
    horizontal.addColorStop(1, "rgba(255,255,255,0)");
    p.fillStyle = horizontal;
    p.fillRect(0, 0, tileWidth, tileHeight);
    const vertical = p.createLinearGradient(0, 0, 0, tileHeight);
    vertical.addColorStop(0, "rgba(255,255,255,0)");
    vertical.addColorStop(0.11, "rgba(255,255,255,1)");
    vertical.addColorStop(0.89, "rgba(255,255,255,1)");
    vertical.addColorStop(1, "rgba(255,255,255,0)");
    p.fillStyle = vertical;
    p.fillRect(0, 0, tileWidth, tileHeight);
    p.globalCompositeOperation = "source-over";
    context.drawImage(panel, x, y);
  }

  function makeArtworkAtlas(images) {
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const width = Math.min(compactDevice ? 4096 : 8192, maxTextureSize);
    const map = document.createElement("canvas");
    map.width = width;
    map.height = width / 2;
    const context = map.getContext("2d", { alpha: false });
    const fallback = images.find(Boolean);
    const tileWidth = map.width / 4;
    const tileHeight = map.height / 3;
    images.forEach((loadedImage, index) => {
      const image = loadedImage || fallback;
      if (!image) return;
      const x = (index % 4) * tileWidth;
      const y = Math.floor(index / 4) * tileHeight;
      if (index === 0) drawLandscape(context, image, contain, x, y, tileWidth, tileHeight);
      else contain(context, image, x, y, tileWidth, tileHeight);
    });
    return map;
  }

  function buildWorld(images) {
    if (opened) return;
    opened = true;
    try {
      program = createProgram();
      sphereLocations = {
        artwork: gl.getUniformLocation(program, "u_artwork"),
        resolution: gl.getUniformLocation(program, "u_resolution"),
        camera: gl.getUniformLocation(program, "u_camera"),
        yaw: gl.getUniformLocation(program, "u_yaw"),
        pitch: gl.getUniformLocation(program, "u_pitch"),
        fov: gl.getUniformLocation(program, "u_fov"),
        radius: gl.getUniformLocation(program, "u_radius"),
        skyRadius: gl.getUniformLocation(program, "u_sky_radius"),
        renderLayer: gl.getUniformLocation(program, "u_render_layer"),
        time: gl.getUniformLocation(program, "u_time")
      };
      gl.useProgram(program);
      throneProgram = createThroneProgram();
      throneLocations = {
        camera: gl.getUniformLocation(throneProgram, "u_camera"),
        light: gl.getUniformLocation(throneProgram, "u_light"),
        renderGain: gl.getUniformLocation(throneProgram, "u_render_gain"),
        model: gl.getUniformLocation(throneProgram, "u_model"),
        mvp: gl.getUniformLocation(throneProgram, "u_mvp"),
        position: gl.getAttribLocation(throneProgram, "a_position"),
        normal: gl.getAttribLocation(throneProgram, "a_normal"),
        color: gl.getAttribLocation(throneProgram, "a_color")
      };
      throneRings = compactDevice
        ? [makeThroneRing(26.9, 19, true), makeThroneRing(36.9, 24, true), makeThroneRing(46.9, 20, true)]
        : [makeThroneRing(27.1, 29, false), makeThroneRing(37.1, 38, false), makeThroneRing(47.1, 32, false)];
      throneEye = makeThroneEye(compactDevice);
      throneLid = makeThroneLid(compactDevice);
      skyBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      skyPositionAttribute = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(skyPositionAttribute);
      gl.vertexAttribPointer(skyPositionAttribute, 2, gl.FLOAT, false, 0, 0);
      artworkMap = makeArtworkAtlas(images);
      artworkTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artworkMap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      // The GPU now owns the atlas texture. Release its large CPU canvas and
      // the source image decodes so phones keep their memory for the viewer.
      artworkMap.width = 1;
      artworkMap.height = 1;
      artworkMap = null;
      images.forEach((image, index) => {
        if (image) {
          image.onload = null;
          image.onerror = null;
          image.removeAttribute("src");
        }
        images[index] = null;
      });
      gl.uniform1i(sphereLocations.artwork, 0);
      gl.uniform2f(sphereLocations.resolution, canvas.width, canvas.height);
      gl.uniform3f(sphereLocations.camera, camera[0], camera[1], camera[2]);
      gl.uniform1f(sphereLocations.yaw, yaw);
      gl.uniform1f(sphereLocations.pitch, pitch);
      gl.uniform1f(sphereLocations.fov, Math.PI / 2.35);
      gl.uniform1f(sphereLocations.radius, radius);
      gl.uniform1f(sphereLocations.skyRadius, 72);
      gl.uniform1f(sphereLocations.renderLayer, 0);
      gl.uniform1f(sphereLocations.time, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
      resize();
      render();
    } catch (error) {
      console.error("Sphere could not be prepared", error);
      showExperienceError("The sphere could not be opened in this browser.");
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, compactDevice ? 1.25 : 1.6);
    const width = Math.max(1, Math.round(window.innerWidth * dpr));
    const height = Math.max(1, Math.round(window.innerHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      if (program) gl.uniform2f(sphereLocations.resolution, width, height);
    }
  }
  window.addEventListener("resize", resize, { passive: true });

  function basis() {
    const cp = Math.cos(pitch);
    return {
      forward: [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp],
      right: [Math.cos(yaw), 0, Math.sin(yaw)],
      up: [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)]
    };
  }

  function moveCamera(delta) {
    if (!entry.classList.contains("leaving") || dialog.open) return;
    const dirs = basis();
    const boost = held.has("shift") ? 3.0 : 1;
    const step = delta * 4.2 * boost;
    const movement = [0, 0, 0];
    const add = (direction, amount) => {
      movement[0] += direction[0] * amount;
      movement[1] += direction[1] * amount;
      movement[2] += direction[2] * amount;
    };
    if (held.has("w") || held.has("arrowup")) add(dirs.forward, step);
    if (held.has("s") || held.has("arrowdown")) add(dirs.forward, -step);
    if (held.has("a") || held.has("arrowleft")) add(dirs.right, -step);
    if (held.has("d") || held.has("arrowright")) add(dirs.right, step);
    if (held.has("e") || held.has(" ")) movement[1] += step;
    if (held.has("q") || held.has("control")) movement[1] -= step;
    const magnitude = Math.hypot(...movement);
    if (magnitude > step) movement.forEach((_, i) => movement[i] *= step / magnitude);
    let next = camera.map((value, i) => value + movement[i]);
    const distance = Math.hypot(...next);
    const maxDistance = radius * 0.84;
    if (distance > maxDistance) next = next.map(value => value * (maxDistance / distance));
    camera = next;
    const moved = Math.hypot(...camera);
    positionLabel.textContent = moved < 0.5 ? "CENTRE" : `${(moved / radius * 100).toFixed(0)}% INTO THE SPHERE`;
  }

  function render(now = 0) {
    if (!program) return;
    resize();
    const delta = Math.min((now - lastFrame) / 1000 || 0, 0.04);
    lastFrame = now;
    time += delta;
    moveCamera(delta);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
    gl.enableVertexAttribArray(skyPositionAttribute);
    gl.vertexAttribPointer(skyPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
    gl.uniform3f(sphereLocations.camera, camera[0], camera[1], camera[2]);
    gl.uniform1f(sphereLocations.yaw, yaw);
    gl.uniform1f(sphereLocations.pitch, pitch);
    gl.uniform1f(sphereLocations.time, time);
    gl.uniform1f(sphereLocations.renderLayer, 0);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    drawThrone();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
    gl.enableVertexAttribArray(skyPositionAttribute);
    gl.vertexAttribPointer(skyPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(sphereLocations.renderLayer, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    requestAnimationFrame(render);
  }

  document.querySelector(".identity").addEventListener("click", event => {
    event.preventDefault();
    if (!experienceStarted) return;
    entry.classList.remove("leaving");
    hint.hidden = true;
    controls.hidden = true;
    document.getElementById("position").hidden = true;
  });

  enterButton.addEventListener("click", () => {
    experienceStarted = true;
    entry.classList.add("leaving");
    hint.hidden = false;
    controls.hidden = false;
    document.getElementById("position").hidden = false;
    backgroundMusic.volume = 0.22;
    backgroundMusic.play().catch(() => {});
  });

  function rayForScreen(x, y) {
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const scale = Math.tan((Math.PI / 2.35) / 2);
    const screenX = ((x - rect.left) / rect.width * 2 - 1) * aspect * scale;
    const screenY = (1 - (y - rect.top) / rect.height * 2) * scale;
    const dirs = basis();
    const ray = [
      dirs.forward[0] + dirs.right[0] * screenX + dirs.up[0] * screenY,
      dirs.forward[1] + dirs.right[1] * screenX + dirs.up[1] * screenY,
      dirs.forward[2] + dirs.right[2] * screenX + dirs.up[2] * screenY
    ];
    const rayLength = Math.hypot(...ray);
    return ray.map(value => value / rayLength);
  }

  function artworkAt(x, y) {
    const ray = rayForScreen(x, y);
    const rect = canvas.getBoundingClientRect();
    const panelHalfWidth = 0.68;
    const panelHalfHeight = panelHalfWidth * (2 / 3);
    const podY = 1.12;
    const localCamera = [camera[0], camera[1] / podY, camera[2]];
    const localRay = [ray[0], ray[1] / podY, ray[2]];
    const a = localRay[0] ** 2 + localRay[1] ** 2 + localRay[2] ** 2;
    const b = localCamera[0] * localRay[0] + localCamera[1] * localRay[1] + localCamera[2] * localRay[2];
    const c = localCamera[0] ** 2 + localCamera[1] ** 2 + localCamera[2] ** 2 - radius ** 2;
    const distance = (-b + Math.sqrt(Math.max(0, b * b - a * c))) / a;
    const localHit = localCamera.map((value, axis) => value + localRay[axis] * distance);
    let closestWork = -1;
    let closestDistance = Infinity;
    for (let index = 0; index < 36; index += 1) {
      const column = index % 6;
      const row = Math.floor(index / 6);
      const baseLongitude = (column - 1) * Math.PI / 3 - Math.PI / 2;
      const baseLatitude = 1.31 - row * 0.524;
      const travel = time * 0.0175 * (1 + 0.02 * Math.sin(index * 1.7)) + index * 0.001;
      const latitude = baseLatitude - travel;
      const longitude = baseLongitude - travel * 0.72;
      const center = [Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude)];
      const panelPosition = [radius * center[0], radius * center[1] * 1.12, radius * center[2]];
      const facing = ray[0] * center[0] + ray[1] * center[1] + ray[2] * center[2];
      if (facing <= 0.15) continue;
      const referenceUp = Math.abs(center[1]) > 0.94 ? [0, 0, 1] : [0, 1, 0];
      const tangentRight = [referenceUp[1] * center[2] - referenceUp[2] * center[1], referenceUp[2] * center[0] - referenceUp[0] * center[2], referenceUp[0] * center[1] - referenceUp[1] * center[0]];
      const rightLength = Math.hypot(...tangentRight);
      tangentRight.forEach((value, axis) => tangentRight[axis] = value / rightLength);
      const tangentUp = [center[1] * tangentRight[2] - center[2] * tangentRight[1], center[2] * tangentRight[0] - center[0] * tangentRight[2], center[0] * tangentRight[1] - center[1] * tangentRight[0]];
      const panelDistance = ((panelPosition[0] - camera[0]) * center[0] + (panelPosition[1] - camera[1]) * center[1] + (panelPosition[2] - camera[2]) * center[2]) / facing;
      if (panelDistance <= 0) continue;
      const panelHit = camera.map((value, axis) => value + ray[axis] * panelDistance);
      const panelOffset = panelHit.map((value, axis) => value - panelPosition[axis]);
      const px = (panelOffset[0] * tangentRight[0] + panelOffset[1] * tangentRight[1] + panelOffset[2] * tangentRight[2]) / radius / panelHalfWidth;
      const py = (panelOffset[0] * tangentUp[0] + panelOffset[1] * tangentUp[1] + panelOffset[2] * tangentUp[2]) / radius / panelHalfHeight;
      if (Math.abs(px) <= 1 && Math.abs(py) <= 1 && panelDistance < closestDistance) {
        closestDistance = panelDistance;
        closestWork = index % 12;
      }
    }
    return closestWork;
  }

  canvas.addEventListener("pointerdown", event => {
    if (!entry.classList.contains("leaving") || dialog.open) return;
    pointerStart = { x: event.clientX, y: event.clientY, moved: false, id: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) pointerStart.moved = true;
    yaw -= dx * 0.0032;
    pitch = Math.max(-1.48, Math.min(1.48, pitch - dy * 0.0032));
    pointerStart.x = event.clientX;
    pointerStart.y = event.clientY;
  });
  function endPointer(event) {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const pointer = pointerStart;
    pointerStart = null;
    canvas.classList.remove("dragging");
    if (!pointer.moved && entry.classList.contains("leaving")) {
      const work = artworkAt(event.clientX, event.clientY);
      if (work >= 0) showWork(work);
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  document.addEventListener("keydown", event => {
    if (dialog.open) {
      if (event.key === "ArrowLeft") { event.preventDefault(); showWork((currentWork + 11) % 12); }
      if (event.key === "ArrowRight") { event.preventDefault(); showWork((currentWork + 1) % 12); }
      if (event.key === "+" || event.key === "=") { event.preventDefault(); applyZoom(zoomFactor * 1.25, true); }
      if (event.key === "-") { event.preventDefault(); applyZoom(zoomFactor / 1.25, true); }
      return;
    }
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "q", "e", " ", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", "control"].includes(key)) {
      if (key.startsWith("arrow") || key === " ") event.preventDefault();
      held.add(key);
    }
  });
  document.addEventListener("keyup", event => held.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => held.clear());

  document.querySelectorAll("[data-move], [data-flight-key]").forEach(button => {
    const keyByDirection = { forward: "w", back: "s", left: "a", right: "d" };
    const key = button.dataset.flightKey || keyByDirection[button.dataset.move];
    button.addEventListener("pointerdown", event => { event.preventDefault(); held.add(key); button.setPointerCapture(event.pointerId); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => button.addEventListener(name, () => held.delete(key)));
  });

  function showWork(index) {
    currentWork = (index + 12) % 12;
    zoomFactor = 1;
    stage.classList.remove("zoomed");
    viewerFrame.style.width = "";
    viewerFrame.style.height = "";
    viewerFrame.classList.toggle("rotated", currentWork === 0);
    dialogImage.style.width = "";
    dialogImage.style.height = "";
    dialogImage.style.transform = "";
    dialogImage.style.maxWidth = "";
    dialogImage.style.maxHeight = "";
    zoomValue.textContent = "100%";
    stage.scrollTo(0, 0);
    dialogImage.src = artwork[currentWork];
    dialogImage.alt = `Abstract painting ${String(currentWork + 1).padStart(2, "0")}`;
    dialogIndex.textContent = `${String(currentWork + 1).padStart(2, "0")} / 12`;
    if (!dialog.open) dialog.showModal();
  }

  document.getElementById("close-viewer").addEventListener("click", () => dialog.close());
  document.getElementById("prev").addEventListener("click", () => showWork((currentWork + 11) % 12));
  document.getElementById("next").addEventListener("click", () => showWork((currentWork + 1) % 12));
  function applyZoom(nextFactor, preserveCenter = false) {
    if (!dialogImage.naturalWidth || !dialogImage.naturalHeight) return;
    const oldWidth = viewerFrame.getBoundingClientRect().width;
    const oldHeight = viewerFrame.getBoundingClientRect().height;
    const rotatedWork = currentWork === 0;
    const fitWidth = Math.min(stage.clientWidth, window.innerWidth * 0.96, 2400);
    const fitHeight = Math.min(stage.clientHeight, window.innerHeight - 116);
    const visualWidth = rotatedWork ? dialogImage.naturalHeight : dialogImage.naturalWidth;
    const visualHeight = rotatedWork ? dialogImage.naturalWidth : dialogImage.naturalHeight;
    const fitScale = Math.min(fitWidth / visualWidth, fitHeight / visualHeight, 1);
    const maxZoom = 1 / fitScale;
    zoomFactor = Math.max(1, Math.min(maxZoom, nextFactor));
    const displayWidth = visualWidth * fitScale * zoomFactor;
    const displayHeight = visualHeight * fitScale * zoomFactor;
    viewerFrame.style.width = `${displayWidth}px`;
    viewerFrame.style.height = `${displayHeight}px`;
    dialogImage.style.width = `${rotatedWork ? displayHeight : displayWidth}px`;
    dialogImage.style.height = `${rotatedWork ? displayWidth : displayHeight}px`;
    stage.classList.toggle("zoomed", zoomFactor > 1.001);
    zoomValue.textContent = `${Math.round(zoomFactor * 100)}%`;
    if (preserveCenter && oldWidth && oldHeight) {
      stage.scrollLeft = (stage.scrollLeft + stage.clientWidth / 2) * (displayWidth / oldWidth) - stage.clientWidth / 2;
      stage.scrollTop = (stage.scrollTop + stage.clientHeight / 2) * (displayHeight / oldHeight) - stage.clientHeight / 2;
    } else if (zoomFactor === 1) {
      stage.scrollTo(0, 0);
    }
  }
  stage.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" || !dialog.open || zoomFactor > 1.001) return;
    inspectSwipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  });
  stage.addEventListener("pointerup", event => {
    if (!inspectSwipeStart || inspectSwipeStart.pointerId !== event.pointerId) return;
    const dx = event.clientX - inspectSwipeStart.x;
    const dy = event.clientY - inspectSwipeStart.y;
    inspectSwipeStart = null;
    if (zoomFactor <= 1.001 && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      showWork((currentWork + (dx < 0 ? 1 : 11)) % 12);
    }
  });
  stage.addEventListener("pointercancel", () => { inspectSwipeStart = null; });
  dialogImage.addEventListener("load", () => applyZoom(zoomFactor));
  zoomInButton.addEventListener("click", () => applyZoom(zoomFactor * 1.25, true));
  zoomOutButton.addEventListener("click", () => applyZoom(zoomFactor / 1.25, true));
  fitButton.addEventListener("click", () => applyZoom(1));
  stage.addEventListener("wheel", event => {
    if (!event.ctrlKey || !dialog.open) return;
    event.preventDefault();
    applyZoom(zoomFactor * (event.deltaY < 0 ? 1.15 : 1 / 1.15), true);
  }, { passive: false });
  window.addEventListener("resize", () => {
    if (dialog.open && dialogImage.naturalWidth) applyZoom(zoomFactor);
  });
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

  document.getElementById("fullscreen").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) { /* Fullscreen is optional; the sphere remains interactive. */ }
  });

  const closeNames = new Set(["Escape", "Tab"]);
  document.addEventListener("keydown", event => { if (closeNames.has(event.key)) held.clear(); });
})();
