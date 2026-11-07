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
  const dialog = document.getElementById("art-viewer");
  const dialogImage = document.getElementById("viewer-image");
  const dialogIndex = document.getElementById("viewer-index");
  const stage = document.getElementById("viewer-stage");
  const viewerFrame = document.getElementById("viewer-image-frame");
  const zoomOutButton = document.getElementById("zoom-out");
  const zoomInButton = document.getElementById("zoom-in");
  const zoomValue = document.getElementById("zoom-value");
  const fitButton = document.getElementById("fit-button");
  const detailLayer = document.createElement("div");
  detailLayer.className = "viewer-detail";
  detailLayer.setAttribute("aria-hidden", "true");
  viewerFrame.appendChild(detailLayer);
  let detailManifest = null;
  let detailFrame = 0;
  fetch("artwork/detail/manifest.json").then(response => response.ok ? response.json() : null).then(manifest => {
    detailManifest = manifest;
    if (dialog.open && dialogImage.complete) applyZoom(zoomFactor);
  }).catch(() => {});
  const backgroundMusic = document.getElementById("background-music");
  const eyeOffer = document.getElementById("eye-offer");
  const starPrompt = document.getElementById("star-prompt");
  const lookHint = document.getElementById("look-hint");
  const interactionHint = document.getElementById("interaction-hint");
  const mouseCamera = matchMedia("(hover: hover) and (pointer: fine)").matches && !!canvas.requestPointerLock;
  let canLockMouse = mouseCamera;
  let fallbackMouseLook = false;
  if (!mouseCamera) { lookHint.textContent = "DRAG TO LOOK"; interactionHint.textContent = "PINCH TO ZOOM · TAP TO INSPECT"; }
  const offeringAmounts = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
  const offeringCurrencies = ["GBP", "USD", "EUR", "AUD", "CAD", "CHF", "CZK", "DKK", "HKD", "HUF", "ILS", "JPY", "MXN", "NOK", "NZD", "PHP", "PLN", "SEK", "SGD", "THB", "TWD"];
  let offeringCurrency = "GBP";
  let offeringIndex = 0;
  let customOfferingPence = null;
  let offeringRates = null;
  let offeringRateDate = "";
  const offeringRateDates = {};
  let offeringRatesPending = false;
  const held = new Set();
  const gl = canvas.getContext("webgl", { alpha: false, antialias: true, powerPreference: "high-performance" });

  if (!gl) {
    showExperienceError("This experience needs a browser with WebGL enabled.");
    return;
  }

  let yaw = 0;
  let pitch = 0;
  const defaultFov = Math.PI / 2.35;
  let cameraFov = defaultFov;
  let targetFov = defaultFov;
  const skyPointers = new Map();
  let skyPinch = null;
  let skyPinchUsed = false;
  const joystickVector = [0, 0];
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
  let seraphim;
  let wingTexture;
  let seraphCore;
  let seraphEye;
  let newtBody;
  let newtShellTexture;
  let newtShellTextureReady = false;
  let newtStart = null;
  const visitorFact = document.getElementById("visitor-fact");
  const visitorFacts = [
    "A password manager can create a different password for each account.",
    "Multi-factor authentication adds another layer of protection to an account.",
    "Updates often fix security vulnerabilities as well as adding features.",
    "Phishing messages can look like they come from someone you trust.",
    "A backup kept separately can help recover files after a ransomware attack.",
    "A passkey can let you sign in without typing a password."
  ];
  let visitorArrivedAt = null;
  let visitorFactIndex = -1;
  let newtState = null;
  let newtAgent = null;
  let constellationDirection = null;
  let constellationGuide = null;
  let constellationRight = null;
  let constellationUp = null;
  let constellationProgram = null;
  let constellationBuffer = null;
  let constellationLabelTexture = null;
  let constellationLocations = null;
  let constellationStars = [];
  let constellationLineCount = 0;
  let focusedStar = -1;
  let seraphApproachStart = null;
  let throneEyeTexture;
  let throneEyeTextureReady = false;
  let seraphEyeTexture;
  let seraphEyeTextureReady = false;
  let angelPigment = null;
  let time = 0;
  let lastFrame = 0;
  let qualityScale = 1;
  let qualityWindowStart = 0;
  let qualityFrames = 0;
  let qualityStableWindows = 0;
  let qualityWakeAt = 0;
  let lastStamp = performance.now();
  let experienceStarted = false;
  let opened = false;
  let currentWork = 0;
  let pointerStart = null;
  let inspectSwipeStart = null;
  const inspectTouches = new Map();
  let pinchDistance = 0;
  let pinchUsed = false;
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
      float starField(vec3 direction, float density, float seed, float threshold) {
        vec3 position = direction * density + vec3(seed);
        vec3 cell = floor(position);
        vec3 local = fract(position) - 0.5;
        float random = hash31(cell + vec3(11.1, 5.7, 3.4));
        vec3 offset = (fract(random * vec3(17.17, 41.73, 73.11)) - 0.5) * 0.65;
        float radius = length(local - offset);
        float star = 1.0 - smoothstep(0.07, 0.32, radius);
        return star * step(threshold, random);
      }
      vec3 panelCenter(int index, float clock) {
        float column = float(index - (index / 6) * 6);
        float row = float(index / 6);
        float baseLongitude = (column - 1.0) * (PI / 3.0) - PI * 0.5;
        float baseLatitude = 1.31 - row * 0.524;
        float speed = 0.01225 * (1.0 + 0.02 * sin(float(index) * 1.7));
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
        float speed = 0.01225 * (1.0 + 0.02 * sin(float(index) * 1.7));
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
        if (u_render_layer < 0.5) {
          // A distant, continuous sky uses the paintings' colours as a restrained
          // nebula. The distant stars shift gently during flight.
          vec3 spaceDirection = normalize(positionOnShell);
          vec3 pigmentA = texture2D(u_artwork, vec2(0.125, 0.833)).rgb;
          vec3 pigmentB = texture2D(u_artwork, vec2(0.375, 0.5)).rgb;
          float cloud = noise3(spaceDirection * 4.6);
          float detail = noise3(spaceDirection * 17.0 + vec3(4.2, -1.7, 0.0));
          float filament = noise3(spaceDirection * 43.0 + vec3(-2.4, 7.1, 2.0));
          float broadCloud = smoothstep(0.40, 0.79, cloud);
          float dust = smoothstep(0.40, 0.84, detail);
          float galacticBand = 1.0 - smoothstep(0.03, 0.54, abs(dot(spaceDirection, normalize(vec3(0.35, 0.83, -0.43)))));
          float nebula = broadCloud * 0.28 + galacticBand * (0.13 + dust * 0.22)
            + smoothstep(0.58, 0.89, filament) * galacticBand * 0.10;
          vec3 pigment = mix(pigmentA, pigmentB, dust * 0.7);
          vec3 color = vec3(0.010, 0.015, 0.038) + pigment * nebula * vec3(0.38, 0.30, 0.32);
          color += vec3(0.025, 0.018, 0.058) * nebula;
          // Stars are fixed in the distant sky when the viewer flies.
          vec3 farStars = normalize(ray);
          float fineStars = starField(farStars, 180.0, 7.0, 0.935);
          color += vec3(0.64, 0.72, 0.88) * fineStars * 0.65;
          vec3 insideNormal = -normal;
          vec3 keyDirection = normalize(vec3(cos(u_time * 0.055), 0.58 + 0.08 * sin(u_time * 0.07), sin(u_time * 0.055)));
          float key = max(dot(insideNormal, keyDirection), 0.0);
          color *= 1.0 + vec3(0.09, 0.06, 0.03) * key;
          color *= 1.0 - 0.04 * dot(screen, screen);
          gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
          return;
        }
        vec3 color = vec3(0.0);
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

  function createConstellationProgram() {
    const vertex = createShader(gl.VERTEX_SHADER, `
      attribute vec3 a_position;
      attribute float a_index;
      uniform vec3 u_forward;
      uniform vec3 u_right;
      uniform vec3 u_up;
      uniform float u_aspect;
      uniform float u_scale;
      uniform float u_point_size;
      uniform float u_focus;
      varying float v_focus;
      varying float v_index;
      varying float v_visibility;
      void main() {
        float depth = dot(a_position, u_forward);
        gl_Position = vec4(dot(a_position, u_right) / (u_aspect * u_scale),
          dot(a_position, u_up) / u_scale, depth, depth);
        v_focus = 1.0 - step(0.25, abs(a_index - u_focus));
        v_index = a_index;
        // Keep the inner stars bright enough to pick out without zooming;
        // preserve the glowing focus as the viewer moves closer.
        float separation = 0.0234 * pow(1.618034, max(0.0, a_index)) / max(0.003, u_scale);
        v_visibility = max(smoothstep(0.004, 0.03, separation), max(v_focus, 1.0 - step(0.5, a_index)));
        gl_PointSize = u_point_size * mix(1.0, 1.55, v_focus);
      }
    `);
    const fragment = createShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform float u_points;
      uniform sampler2D u_labels;
      varying float v_focus;
      varying float v_index;
      varying float v_visibility;
      void main() {
        if (u_points < 0.5) {
          gl_FragColor = vec4(0.86, 0.71, 0.48, 0.38);
        } else if (u_points > 1.5) {
          if (v_focus < 0.5) discard;
          vec2 uv = vec2(gl_PointCoord.x, (v_index + gl_PointCoord.y) / 12.0);
          vec4 label = texture2D(u_labels, uv);
          gl_FragColor = vec4(label.rgb * mix(0.85, 1.0, v_focus), label.a);
        } else {
          float r = length(gl_PointCoord - vec2(0.5));
          float halo = (1.0 - smoothstep(0.05, 0.50, r)) * 0.45;
          float core = 1.0 - smoothstep(0.03, 0.16, r);
          float alpha = clamp(halo + core * 0.85, 0.0, 1.0) * mix(0.70, 1.0, v_focus) * v_visibility;
          gl_FragColor = vec4(mix(vec3(0.86, 0.72, 0.51), vec3(1.0, 0.91, 0.70), v_focus), alpha);
        }
      }
    `);
    const next = gl.createProgram();
    gl.attachShader(next, vertex); gl.attachShader(next, fragment); gl.linkProgram(next);
    if (!gl.getProgramParameter(next, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(next) || "Could not link constellation shader");
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    return next;
  }

  function createThroneProgram() {
    const vertex = createShader(gl.VERTEX_SHADER, `
      attribute vec3 a_position;
      attribute vec3 a_normal;
      attribute vec3 a_color;
      uniform mat4 u_mvp;
      uniform mat4 u_model;
      uniform mat4 u_view_projection;
      uniform mediump float u_seraph_wrap;
      uniform float u_seraph_eye_wrap;
      uniform float u_newt_animated;
      uniform highp float u_newt_time;
      uniform float u_newt_entry;
      varying vec3 v_normal;
      varying vec3 v_world;
      varying vec3 v_seraph_world;
      varying vec3 v_color;
      varying vec3 v_local;
      void main() {
        vec3 animatedPosition = a_position;
        if (u_newt_animated > 0.5) {
          // The flagellum grows from behind the eye along the body's depth,
          // so the eye leads the creature rather than sitting beside its tail.
          float tailLength = max(0.0, -a_position.z - 0.53);
          float tail = smoothstep(0.04, 2.2, tailLength);
          float swim = u_newt_time * 4.0 - tailLength * 2.8;
          float clearance = 1.0 - 0.78 * u_newt_entry;
          animatedPosition.x += sin(swim) * 0.30 * tail * clearance;
          animatedPosition.y += sin(swim - 1.2) * 0.14 * tail * clearance;
        }
        vec4 world = u_model * vec4(animatedPosition, 1.0);
        if (u_seraph_wrap > 0.001) {
          vec3 right = normalize(u_model[0].xyz);
          vec3 up = normalize(u_model[1].xyz);
          vec3 inward = normalize(u_model[2].xyz);
          float longitude = clamp(a_position.x / 36.0, -1.0, 1.0) * 3.08;
          float latitude = clamp(a_position.y / 29.0, -1.0, 1.0) * 1.53;
          vec3 wrappedDirection = normalize(right * sin(longitude) * cos(latitude)
            + up * sin(latitude) - inward * cos(longitude) * cos(latitude));
          vec3 startDirection = normalize(world.xyz);
          vec3 blendedDirection = normalize(mix(startDirection, wrappedDirection, u_seraph_wrap));
          // Bend the full-size wings onto a vast shell outside Throne.
          float radius = max(6800.0, mix(length(world.xyz), 7200.0 + a_position.z * 100.0, u_seraph_wrap));
          world = vec4(blendedDirection * radius, 1.0);
        } else if (u_seraph_eye_wrap > 0.001) {
          vec3 right = normalize(u_model[0].xyz);
          vec3 up = normalize(u_model[1].xyz);
          vec3 inward = normalize(u_model[2].xyz);
          float longitude = clamp(a_position.x / 1.14, -1.2, 1.2) * 0.92;
          float latitude = clamp(a_position.y / 1.02, -1.2, 1.2) * 0.72;
          vec3 wrappedDirection = normalize(right * sin(longitude) * cos(latitude)
            + up * sin(latitude) - inward * cos(longitude) * cos(latitude));
          vec3 blendedDirection = normalize(mix(normalize(world.xyz), wrappedDirection, u_seraph_eye_wrap));
          float radius = max(5700.0, mix(length(world.xyz), 6100.0 - a_position.z * 400.0, u_seraph_eye_wrap));
          world = vec4(blendedDirection * radius, 1.0);
        }
        v_world = world.xyz;
        v_seraph_world = world.xyz * 0.0001;
        v_normal = normalize(mat3(u_model) * a_normal);
        v_color = a_color;
        v_local = a_position;
        gl_Position = max(u_seraph_wrap, u_seraph_eye_wrap) > 0.001
          ? u_view_projection * world : u_mvp * vec4(animatedPosition, 1.0);
      }
    `);
    const fragment = createShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform vec3 u_camera;
      uniform vec3 u_light;
      uniform float u_render_gain;
      uniform float u_ring_radius;
      uniform float u_band_half_width;
      uniform sampler2D u_eye_texture;
      uniform float u_eye_texture_ready;
      uniform float u_eye_uv_scale;
      uniform float u_seraph_blink;
      uniform float u_feather_detail;
      uniform sampler2D u_wing_painting;
      uniform sampler2D u_newt_shell_texture;
      uniform float u_newt_shell;
      uniform float u_newt_panel_pass;
      uniform float u_newt_panel_radius;
      uniform highp float u_newt_time;
      uniform mediump float u_seraph_wrap;
      uniform vec3 u_seraph_eye_forward;
      uniform vec3 u_seraph_eye_right;
      uniform vec3 u_seraph_eye_up;
      varying vec3 v_normal;
      varying vec3 v_world;
      varying vec3 v_seraph_world;
      varying vec3 v_color;
      varying vec3 v_local;
      // Match the moving, flat painting panels when deciding which pieces of
      // the visitor belong in front of or behind them. This is only evaluated
      // for the visitor, not for the much larger angel meshes.
      bool paintingInFront(vec3 point) {
        vec3 offset = point - u_camera;
        float visitorDistance = length(offset);
        vec3 ray = offset / max(visitorDistance, 0.001);
        for (int i = 0; i < 36; i++) {
          float column = float(i - (i / 6) * 6);
          float row = float(i / 6);
          float travel = u_newt_time * 0.01225 * (1.0 + 0.02 * sin(float(i) * 1.7)) + float(i) * 0.001;
          float latitude = 1.31 - row * 0.524 - travel;
          float longitude = (column - 1.0) * 1.0471975512 - 1.5707963268 - travel * 0.72;
          vec3 center = normalize(vec3(cos(latitude) * cos(longitude), sin(latitude), cos(latitude) * sin(longitude)));
          float facing = dot(ray, center);
          if (facing > 0.15) {
            vec3 panelPosition = u_newt_panel_radius * vec3(center.x, center.y * 1.12, center.z);
            float distance = dot(panelPosition - u_camera, center) / facing;
            if (distance > 0.0 && distance < visitorDistance) {
              vec3 referenceUp = abs(center.y) > 0.94 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
              vec3 right = normalize(cross(referenceUp, center));
              vec3 up = normalize(cross(center, right));
              vec3 panelOffset = u_camera + ray * distance - panelPosition;
              vec2 uv = abs(vec2(dot(panelOffset, right), dot(panelOffset, up)) / u_newt_panel_radius / vec2(0.68, 0.68 * (2.0 / 3.0)));
              float opacity = (1.0 - smoothstep(0.66, 1.0, uv.x)) * (1.0 - smoothstep(0.66, 1.0, uv.y)) * smoothstep(0.0, 0.34, abs(cos(latitude)));
              if (opacity > 0.001) return true;
            }
          }
        }
        return false;
      }
      void main() {
        if (u_newt_panel_pass > 0.5) {
          bool behindPainting = paintingInFront(v_world);
          if ((u_newt_panel_pass < 1.5 && !behindPainting) || (u_newt_panel_pass > 1.5 && behindPainting)) discard;
        }
        if (u_seraph_wrap > 0.72) {
          // Leave a clean opening behind the curved eye as the wings wrap.
          // This prevents feather tips from crossing its socket at the end
          // of the approach, including when the viewer moves off centre.
          vec3 ray = normalize(v_seraph_world - u_camera * 0.0001);
          float forward = dot(ray, u_seraph_eye_forward);
          float longitude = atan(dot(ray, u_seraph_eye_right), forward);
          float latitude = asin(clamp(dot(ray, u_seraph_eye_up), -1.0, 1.0));
          float clearance = smoothstep(0.72, 1.0, u_seraph_wrap);
          vec2 eyeOpening = vec2(longitude / 0.98, latitude / 0.84);
          if (forward > 0.0 && length(eyeOpening) < clearance) discard;
        }
        vec3 normal = normalize(v_normal);
        // Giant wings can be tens of thousands of units away. Normalize a
        // scaled vector on those fragments to avoid mediump overflow on phones.
        vec3 viewDirection = u_feather_detail > 0.5
          ? normalize(u_camera * 0.0001 - v_seraph_world) : normalize(u_camera - v_world);
        vec3 lightDirection = u_feather_detail > 0.5
          ? normalize(u_light * 0.0001 - v_seraph_world) : normalize(u_light - v_world);
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float specular = pow(max(dot(reflect(-lightDirection, normal), viewDirection), 0.0), 34.0);
        if (u_feather_detail > 0.5) {
          // The very large wrapped wings need a steady ambient contribution;
          // a moving point light produces harsh flashes at this scale.
          diffuse = 0.48;
          specular = 0.0;
        }
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
        float eyeRadius = length(v_local.xy * vec2(1.0 / 1.14, 1.0 / 1.02));
        float irisDetail = (1.0 - smoothstep(0.47, 0.51, length(v_local.xy)))
          * smoothstep(0.08, 0.18, v_color.r) * (1.0 - smoothstep(0.08, 0.16, v_color.b));
        if (u_eye_texture_ready > 0.5 && u_ring_radius == 0.0 && vesselSurface > 0.12 && eyeRadius < 1.02) discard;
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
        color += vec3(0.080, 0.038, 0.007) * irisSurface;
        // Capillaries should sit as soft warm rose beneath the wet surface,
        // not read as dark ink when the phone-sized mesh receives little light.
        color += vec3(0.34, 0.105, 0.095) * vesselSurface;
        color += vec3(0.14, 0.070, 0.024) * goldSurface;
        color += vec3(0.34, 0.20, 0.062) * specular * 0.13 * goldSurface;
        // Layered engraving follows each individual band around its full circumference.
        float localRadiusSquared = dot(v_local.xy, v_local.xy);
        if (u_ring_radius > 0.0 && localRadiusSquared > 225.0 && goldSurface > 0.12) {
          float localRadius = sqrt(localRadiusSquared);
          float radialOffset = localRadius - u_ring_radius;
          float arc = atan(v_local.y, v_local.x) * u_ring_radius;
          float bandAcross = abs(radialOffset) > u_band_half_width - 0.8 ? v_local.z * 3.2 : radialOffset;
          float scroll = sin(arc * 1.10 + sin(bandAcross * 0.8) * 1.5)
            * cos(bandAcross * 1.7 + sin(arc * 0.55) * 1.2);
          float fineCut = sin(arc * 4.0 + sin(radialOffset * 2.2))
            * sin(bandAcross * 4.5 + cos(arc * 0.8));
          float bead = pow(max(0.0, cos(arc * 2.8)), 10.0);
          float borders = exp(-abs(abs(radialOffset) - (u_band_half_width - 0.6)) * 2.4);
          color += vec3(0.027, 0.015, 0.004) * scroll * goldSurface;
          color += vec3(0.012, 0.007, 0.002) * fineCut * goldSurface;
          color += vec3(0.050, 0.029, 0.008) * bead * borders * goldSurface;
        }
        if (u_feather_detail > 0.5) {
          // A small baked luminance map preserves the paint's cracks and
          // brushwork without importing the painting's colours to the wings.
          // One continuous projection across the wing assembly avoids the
          // repeated square tiles visible in the earlier texture.
          vec2 pigmentUV = clamp((v_local.xy + vec2(47.0, 39.0)) / vec2(94.0, 78.0), 0.001, 0.999);
          float pigmentGrain = texture2D(u_wing_painting, pigmentUV).r;
          color *= 0.58 + 0.84 * pigmentGrain;
        }
        if (u_newt_shell > 0.5) {
          // The visitor shares the wings' warm, painted bronze palette while
          // retaining soft highlights across its curved 3D surface.
          float sheen = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.0);
          float organicGrain = sin(v_local.x * 47.0 + sin(v_local.y * 19.0)) * sin(v_local.z * 39.0 - v_local.y * 25.0);
          color = v_color * (0.35 + diffuse * 0.50) + vec3(0.14, 0.075, 0.026) * sheen;
          color += vec3(0.40, 0.25, 0.11) * specular * 0.30 + organicGrain * 0.012;
        }
        color += vec3(0.48, 0.39, 0.29) * specular * 0.26 * eyeGloss;
        color += vec3(0.52, 0.31, 0.12) * specular * 0.035;
        color += vec3(0.12, 0.06, 0.02) * fresnel * 0.02;
        if (u_eye_texture_ready > 0.5 && u_ring_radius == 0.0 && v_local.z > 0.04) {
          vec2 eyeUv = v_local.xy / vec2(2.28, 2.04) * u_eye_uv_scale + 0.5;
          // Mirror the outer sclera for the larger texture rather than
          // stretching its edge into visible streaks at the socket.
          if (u_eye_uv_scale > 1.01) eyeUv = 1.0 - abs(mod(eyeUv, 2.0) - 1.0);
          vec3 referenceEye = texture2D(u_eye_texture, clamp(eyeUv, 0.0, 1.0)).rgb;
          float referenceMask = max(eyeSurface, irisDetail) * (1.0 - smoothstep(0.94, 1.0, eyeRadius));
          color = mix(color, referenceEye * 1.05, referenceMask * 0.92);
        }
        // Shade the lid on the eye itself: it follows the curved surface and
        // cannot intersect the iris or expose the pupil during a blink.
        if (u_seraph_blink > 0.001 && v_local.z > 0.04) {
          float lidEdge = 1.02 - u_seraph_blink * 2.08;
          float lid = smoothstep(lidEdge - 0.012, lidEdge + 0.012, v_local.y)
            * (1.0 - smoothstep(0.98, 1.01, eyeRadius));
          float fold = exp(-abs(v_local.y - lidEdge) * 24.0);
          vec3 lidColor = vec3(0.23, 0.16, 0.145) * (0.78 + 0.22 * diffuse)
            - vec3(0.045, 0.030, 0.026) * fold;
          color = mix(color, lidColor, lid);
        }
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

  function applyAngelPatina(data, feather = false) {
    if (!angelPigment) return;
    // Bake pigment from the paintings into the existing mesh once, avoiding
    // a texture lookup for every animated pixel on mobile devices.
    for (let i = 0; i < data.length; i += 9) {
      const x = data[i], y = data[i + 1];
      const u = ((Math.floor(x * 3.7 + y * 0.8) % 64) + 64) % 64;
      const v = ((Math.floor(y * 3.7 - x * 0.5) % 64) + 64) % 64;
      const pixel = (v * 64 + u) * 4;
      const grain = 0.87 + 0.12 * (0.5 + 0.5 * Math.sin(x * 7.3 + y * 11.1));
      const strength = feather ? 0.09 : 0.055;
      for (let channel = 0; channel < 3; channel += 1) {
        data[i + 6 + channel] = Math.min(1, data[i + 6 + channel] * grain + angelPigment[pixel + channel] / 255 * strength);
      }
    }
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

  function appendEyeIris(data, compact, textureDetailOnly = false) {
    const spokes = compact ? (textureDetailOnly ? 40 : 112) : 180;
    const bands = compact ? (textureDetailOnly ? 4 : 10) : 14;
    const innerRadius = 0.17;
    const outerRadius = 0.49;
    function vertex(radius, angle) {
      const fiber = 0.5 + 0.5 * Math.sin(angle * 139.0 + Math.sin(angle * 9.0) * 2.0 + radius * 31.0);
      const crypt = 0.5 + 0.5 * Math.sin(angle * 31.0 + radius * 64.0);
      const innerLight = Math.max(0, 1 - Math.abs(radius - 0.27) / 0.16);
      const limbalShade = Math.max(0, Math.min(1, (radius - 0.37) / 0.10));
      const color = [
        0.42 + fiber * 0.30 + crypt * 0.055 + innerLight * 0.085 - limbalShade * 0.195,
        0.17 + fiber * 0.19 + crypt * 0.050 + innerLight * 0.075 - limbalShade * 0.065,
        0.022 + fiber * 0.045 + crypt * 0.016 + innerLight * 0.012 + limbalShade * 0.026
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

  function appendSeraphEyeBezel(data, compact) {
    // A separate, slightly larger elliptical rim remains outside the sclera
    // when the eye bends around the viewer.
    const segments = compact ? 48 : 80;
    const sides = compact ? 4 : 6;
    function point(segment, side) {
      const a = segment / segments * Math.PI * 2;
      const b = side / sides * Math.PI * 2;
      const radial = 0.038 * Math.cos(b);
      const position = [(1.20 + radial) * Math.cos(a), (1.08 + radial) * Math.sin(a), -0.035 + 0.038 * Math.sin(b)];
      const normal = [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)];
      const glint = 0.5 + 0.5 * Math.cos(a * 24);
      return { position, normal, color: [0.30 + 0.12 * glint, 0.17 + 0.065 * glint, 0.05 + 0.02 * glint] };
    }
    for (let segment = 0; segment < segments; segment += 1) {
      for (let side = 0; side < sides; side += 1) {
        const a = point(segment, side), b = point(segment + 1, side);
        const c = point(segment + 1, side + 1), d = point(segment, side + 1);
        for (const v of [a, b, c, a, c, d]) appendMeshVertex(data, v.position, v.normal, v.color);
      }
    }
  }

  function makeThroneRing(radiusOnPlane, eyeCount, compact, bandThicknessScale = 1) {
    const data = [];
    const segments = compact ? 144 : 224;
    const sides = compact ? 12 : 18;
    // Keep each ring and its eyes inside a separate radial shell. The
    // inward-facing ribbon below supplies the visible width of the band.
    const halfWidth = 2.8;
    const halfThickness = (compact ? 1.35 : 1.45) * bandThicknessScale;
    // Broad ribbon faces sit just wider than the eyes, with raised borders and braided rococo scrolls.
    appendTorusBelt(data, radiusOnPlane, halfWidth, halfThickness, [0.14, 0.076, 0.029], segments, sides);
    // A broad inward-facing ribbon gives the eye sockets a continuous metal backing.
    // Its inner surface remains behind the eyes as they turn toward the camera.
    appendTorusBelt(data, radiusOnPlane - halfWidth + 0.78, 0.42, 1.80,
      [0.23, 0.128, 0.046], segments, sides);
    appendTorus(data, radiusOnPlane - halfWidth * 0.91, 0.075, [0.30, 0.18, 0.065], segments, sides);
    appendTorus(data, radiusOnPlane + halfWidth * 0.91, 0.075, [0.24, 0.13, 0.045], segments, sides);
    appendTorus(data, radiusOnPlane - halfWidth * 0.57, 0.045, [0.18, 0.10, 0.034], segments, Math.max(10, sides - 2));
    appendTorus(data, radiusOnPlane + halfWidth * 0.57, 0.045, [0.18, 0.10, 0.034], segments, Math.max(10, sides - 2));
    appendTorus(data, radiusOnPlane, 0.035, [0.32, 0.21, 0.082], segments, Math.max(10, sides - 2));
    const scrollCount = Math.round(radiusOnPlane * 0.64);
    appendBeltScroll(data, radiusOnPlane, halfWidth, halfThickness, -1.30, 0.85, scrollCount, [0.34, 0.20, 0.072], segments, 6);
    appendBeltScroll(data, radiusOnPlane, halfWidth, halfThickness, 1.30, 0.85, scrollCount, [0.34, 0.20, 0.072], segments, 6);
    applyAngelPatina(data);
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

  function makeThroneEye(compact, textureDetailOnly = false) {
    const data = [];
    const detail = textureDetailOnly ? (compact ? [18, 28] : [32, 48]) : (compact ? [12, 18] : [24, 36]);
    const x = [1, 0, 0], y = [0, 1, 0], z = [0, 0, 1];
    appendEyeEllipsoid(data, [0, 0, textureDetailOnly ? -0.50 : -0.16], x, y, z, [1.33, 1.17, 0.36], [0.28, 0.15, 0.052], ...detail);
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
    // The large eye's photograph already includes its iris, pupil, and wet
    // reflections. Extra meshes there intersect the image as it wraps.
    if (!textureDetailOnly) appendEyeIris(data, compact);
    const ringSegments = compact ? 48 : 112;
    const ringSides = compact ? 4 : 6;
    if (!textureDetailOnly) {
      appendEyeDetailRing(data, 0.497, 0.016, 0.394, [0.035, 0.017, 0.006], ringSegments, ringSides);
      appendEyeDetailRing(data, 0.385, 0.009, 0.413, [0.34, 0.13, 0.025], ringSegments, ringSides);
      appendEyeDetailRing(data, 0.21, 0.010, 0.446, [0.13, 0.065, 0.018], ringSegments, ringSides);
      appendEyeDetailRing(data, 0.465, 0.012, 0.411, [0.055, 0.025, 0.008], ringSegments, ringSides);
    }
    if (!textureDetailOnly) {
      appendEyeEllipsoid(data, [0, 0, 0.445], x, y, z, [0.155, 0.155, 0.035], [0.006, 0.004, 0.003], ...detail);
      // Restrained corneal reflections sit high on the smaller eyes.
      appendEyeEllipsoid(data, [0.045, -0.035, 0.49], x, y, z, [0.026, 0.032, 0.005], [0.94, 0.89, 0.78], ...detail);
      appendEyeEllipsoid(data, [0.21, -0.035, 0.454], x, y, z, [0.020, 0.024, 0.008], [0.58, 0.55, 0.48], ...detail);
    }
    if (textureDetailOnly) {
      appendSeraphEyeBezel(data, compact);
    } else {
      // Three finely stepped gold lips seat the smaller eyes in their sockets.
      appendEyeBezel(data, compact);
      appendEyeDetailRing(data, 1.065, 0.022, 0.196, [0.36, 0.205, 0.064], ringSegments, ringSides);
      appendEyeDetailRing(data, 1.16, 0.025, 0.065, [0.30, 0.17, 0.054], ringSegments, ringSides);
      appendEyeSocketStuds(data, compact);
    }
    if (!textureDetailOnly) {
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
    }
    // The large curved eye uses its own moving lid; the small fixed eyelid
    // meshes intersect its surface when projected around the sphere.
    if (!textureDetailOnly) {
      appendEyeLidArc(data, 0, Math.PI, true, compact);
      appendEyeLidArc(data, Math.PI, Math.PI * 2, false, compact);
      appendEyeCrease(data, compact);
    }
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

  function makeSeraphim(compact) {
    const data = [];
    const segments = compact ? 6 : 10;
    // The six wings share one static mesh and one draw call.
    function feather(root, direction, length, width, shade) {
      const perpendicular = [-direction[1], direction[0]];
      function vertex(t, side) {
        const spread = Math.pow(Math.sin(Math.PI * t), 0.72) * width * 1.22;
        const curve = Math.sin(Math.PI * t) * 0.75;
        const p = [1.48 * (root[0] + direction[0] * length * t + perpendicular[0] * spread * side),
          1.48 * (root[1] + direction[1] * length * t + perpendicular[1] * spread * side),
          root[2] + curve + (1 - Math.abs(side)) * 1.05 - Math.pow(Math.abs(root[0]) / 20, 2) * 3.6];
        const n = [-perpendicular[0] * side * 0.34, -perpendicular[1] * side * 0.34, 1];
        const edge = 1 - Math.abs(side) * 0.28;
        const tip = 0.75 + 0.25 * Math.sin(Math.PI * t);
        return { p, n, c: [0.38 * shade * edge * tip, 0.22 * shade * edge * tip, 0.075 * shade * edge * tip] };
      }
      for (let i = 0; i < segments; i += 1) {
        for (const side of [-1, 0]) {
          const a = vertex(i / segments, side), b = vertex((i + 1) / segments, side);
          const c = vertex((i + 1) / segments, side + 1), d = vertex(i / segments, side + 1);
          for (const v of [a, b, c, a, c, d]) appendMeshVertex(data, v.p, v.n, v.c);
        }
      }
    }
    for (const side of [-1, 1]) {
      for (let pair = 0; pair < 3; pair += 1) {
        const rise = [0.88, 0.13, -0.68][pair];
        const rootY = [2.7, 0, -2.7][pair];
        const count = compact ? 12 : 20;
        // Layered long feathers radiate from an arched leading edge; smaller
        // coverts sit above them and soften the join to the core.
        for (let i = 0; i < count; i += 1) {
          const u = i / (count - 1);
          const baseX = side * (3.3 + 15.5 * u);
          const baseY = rootY + rise * 12.0 * u + 2.0 * Math.sin(Math.PI * u);
          const angle = rise * 0.5 - 0.90 + u * 0.48;
          const d = [side * Math.cos(angle), Math.sin(angle)];
          feather([baseX, baseY, -0.36 + pair * 0.18], d, 6.8 + 4.0 * Math.sin(Math.PI * u),
            0.85 + 0.55 * Math.sin(Math.PI * u), 0.82 + 0.16 * Math.sin(i * 2.3 + pair));
          if (i % 2 === 0) feather([baseX, baseY + 0.55, 0.05 + pair * 0.18], d,
            3.2 + 1.5 * Math.sin(Math.PI * u), 0.70, 1.05);
          if (i % 2 === 1) feather([baseX * 0.78, baseY - 0.35, 0.65 + pair * 0.18], d,
            4.0 + 1.2 * Math.sin(Math.PI * u), 0.82, 0.92);
        }
      }
    }
    applyAngelPatina(data, true);
    // Keep only the positions for a one-time sky-clearance search; the
    // detailed surface stays in its existing GPU mesh.
    const occlusionPositions = new Float32Array(data.length / 3);
    for (let src = 0, dst = 0; src < data.length; src += 9) {
      occlusionPositions[dst++] = data[src];
      occlusionPositions[dst++] = data[src + 1];
      occlusionPositions[dst++] = data[src + 2];
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, count: data.length / 9, occlusionPositions };
  }

  function makeSeraphCore(compact) {
    const data = [];
    appendEyeEllipsoid(data, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
      [4.3, 4.8, 1.55], [0.25, 0.14, 0.055], ...(compact ? [10, 14] : [18, 26]));
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, count: data.length / 9 };
  }

  function makeEyeNewt(compact) {
    const data = [];
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const skin = unit => {
      const flecks = 0.5 + 0.5 * Math.sin(unit[0] * 28 + unit[1] * 17) * Math.sin(unit[1] * 32 - unit[2] * 11);
      const glow = Math.max(0, unit[1]);
      return [0.34 + flecks * 0.07 + glow * 0.035, 0.19 + flecks * 0.05, 0.065 + flecks * 0.018];
    };
    const detail = compact ? [16, 24] : [28, 42];
    // A spherical mechanical eye with a single continuous flagellum.
    appendEyeEllipsoid(data, [0, 0, 0], ...axes, [0.55, 0.52, 0.65], skin, ...detail);
    appendEyeDetailRing(data, 0.49, 0.035, 0.34, [0.22, 0.12, 0.04], compact ? 40 : 72, compact ? 4 : 6);
    appendEyeDetailRing(data, 0.44, 0.018, 0.46, [0.38, 0.22, 0.075], compact ? 40 : 72, compact ? 4 : 6);
    for (let i = 0; i < 12; i += 1) {
      const angle = i * Math.PI * 2 / 12;
      appendEyeEllipsoid(data, [Math.cos(angle) * 0.49, Math.sin(angle) * 0.49, 0.36], ...axes,
        [0.027, 0.027, 0.016], [0.38, 0.22, 0.075], ...(compact ? [4, 5] : [6, 8]));
    }
    const segments = compact ? 28 : 50, sides = compact ? 6 : 10;
    function tailVertex(step, side) {
      const t = step / segments, angle = side / sides * Math.PI * 2;
      const thickness = 0.13 * (1 - t) ** 1.25 + 0.006;
      return { position: [Math.cos(angle) * thickness, Math.sin(angle) * thickness, -0.53 - 3.0 * t],
        normal: [Math.cos(angle), Math.sin(angle), 0.04], color: [0.34 + 0.04 * (1 - t), 0.19 + 0.03 * (1 - t), 0.07] };
    }
    for (let step = 0; step < segments; step += 1) for (let side = 0; side < sides; side += 1) {
      const a = tailVertex(step, side), b = tailVertex(step + 1, side), c = tailVertex(step + 1, side + 1), d = tailVertex(step, side + 1);
      for (const v of [a, b, c, a, c, d]) appendMeshVertex(data, v.position, v.normal, v.color);
    }
    applyAngelPatina(data, true);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, count: data.length / 9 };
  }

  function updateThroneLid(mesh, closure, seraph = false) {
    const rows = seraph ? (mesh.compact ? 16 : 24) : (mesh.compact ? 8 : 16);
    const columns = seraph ? (mesh.compact ? 28 : 40) : (mesh.compact ? 14 : 28);
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
      const depth = seraph ? Math.max(surface + 0.14, 0.55) : surface + 0.10;
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
          return { position: [x, y, seraph ? Math.max(surface + 0.165, 0.575) : surface + 0.125], normal: normal.map(value => value / normalLength), color: seamColor };
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

  function throneProjectionMatrix(near = 0.5) {
    const far = 160000;
    const f = 1 / Math.tan(cameraFov / 2);
    const aspect = canvas.width / canvas.height;
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0
    ]);
  }

  function seraphProgress() {
    if (seraphApproachStart === null) return 0;
    return Math.min(1, Math.max(0, (time - seraphApproachStart) / 120));
  }

  function drawThrone() {
    if (!experienceStarted || dialog.open || !throneProgram) return;
    const dirs = basis();
    const view = throneViewMatrix(dirs);
    let projection = throneProjectionMatrix();
    const tanHalfFov = Math.tan(cameraFov / 2);
    const aspect = canvas.width / canvas.height;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    // Reserve separate depth ranges for the near rings and distant angel.
    gl.depthRange(0, 0.45);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(throneProgram);
    gl.uniformMatrix4fv(throneLocations.viewProjection, false, matrixMultiply(projection, view));
    gl.uniform1f(throneLocations.newtAnimated, 0);
    gl.uniform1f(throneLocations.newtShell, 0);
    gl.uniform1f(throneLocations.newtPanelPass, 0);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, wingTexture);
    gl.uniform1i(throneLocations.wingPainting, 3);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, throneEyeTexture);
    gl.uniform1i(throneLocations.eyeTexture, 1);
    gl.uniform1f(throneLocations.eyeTextureReady, throneEyeTextureReady ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform3f(throneLocations.camera, camera[0], camera[1], camera[2]);
    gl.uniform3f(throneLocations.light, 4.0 + Math.cos(time * 0.08) * 3.0, 8.0, -6.0 + Math.sin(time * 0.08) * 3.0);
    // The artwork panels drift at 0.01225 rad/s; throne movement stays much slower.
    const assemblyRotation = rotationMatrix(0.10, time * 0.0005625, -0.06);
    const stride = 9 * Float32Array.BYTES_PER_ELEMENT;
    const { position: positionAttribute, normal: normalAttribute, color: colorAttribute } = throneLocations;
    gl.enableVertexAttribArray(positionAttribute);
    gl.enableVertexAttribArray(normalAttribute);
    gl.enableVertexAttribArray(colorAttribute);
    const drawMesh = (mesh, model, renderGain = 1, ringRadius = 0, bandHalfWidth = 0, seraphWrap = 0, eyeUvScale = 1, eyeWrap = 0, seraphBlink = 0, featherDetail = 0) => {
      const mvp = matrixMultiply(projection, matrixMultiply(view, model));
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(normalAttribute, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
      gl.vertexAttribPointer(colorAttribute, 3, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT);
      gl.uniform1f(throneLocations.renderGain, renderGain);
      gl.uniform1f(throneLocations.ringRadius, ringRadius);
      gl.uniform1f(throneLocations.bandHalfWidth, bandHalfWidth);
      gl.uniform1f(throneLocations.seraphWrap, seraphWrap);
      gl.uniform1f(throneLocations.seraphEyeWrap, eyeWrap);
      gl.uniform1f(throneLocations.eyeUvScale, eyeUvScale);
      gl.uniform1f(throneLocations.seraphBlink, seraphBlink);
      gl.uniform1f(throneLocations.featherDetail, featherDetail);
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
      drawMesh(ring, model, 1.875, ring.radius, ring.bandHalfWidth);
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
        // Short, independent tremors give each eye a watchful twitch without
        // turning its gaze away from the viewer.
        const twitchSeed = eyeIndex * 1.73 + index * 4.19;
        const twitchPeriod = 4.8 + ((eyeIndex * 13 + index * 7) % 19) * 0.21;
        const twitchTime = (time + twitchSeed) % twitchPeriod;
        const twitch = Math.exp(-twitchTime * twitchTime * 15) * Math.sin(twitchTime * 38) * 0.045;
        const eyeRoll = Math.sin(eyeIndex * 5.37 + index * 11.7) * 0.24 + twitch;
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
    // A distant-only projection gives overlapping feather surfaces much more
    // depth precision. The reserved range keeps the near rings in front.
    projection = throneProjectionMatrix(100);
    gl.uniformMatrix4fv(throneLocations.viewProjection, false, matrixMultiply(projection, view));
    gl.depthRange(0.5, 1);
    // The seraphim orbits beyond all three rings and stays within the skybox.
    // Its inward-facing frame keeps the central eye fixed on the viewer.
    const orbit = 0.22 + time * 0.0035;
    const approach = seraphProgress();
    const easedApproach = approach * approach * (3 - 2 * approach);
    // Start three times farther away, at a 45-degree elevation, and descend
    // toward the gallery over the same two-minute approach.
    const seraphOrbitRadius = 63450 - 53450 * easedApproach;
    const horizontalRadius = seraphOrbitRadius * Math.SQRT1_2;
    const seraphPosition = [Math.sin(orbit) * horizontalRadius, horizontalRadius, -Math.cos(orbit) * horizontalRadius];
    // The body has its own world-space orientation. Only the eye turns to
    // follow the viewer; flight never drags the wings around with the camera.
    const bodyNormal = seraphPosition.map(value => -value / seraphOrbitRadius);
    const viewToSeraph = seraphPosition.map((value, axis) => value - camera[axis]);
    const seraphDepth = viewToSeraph.reduce((sum, value, axis) => sum + value * dirs.forward[axis], 0);
    const seraphHorizontal = viewToSeraph.reduce((sum, value, axis) => sum + value * dirs.right[axis], 0);
    const seraphVertical = viewToSeraph.reduce((sum, value, axis) => sum + value * dirs.up[axis], 0);
    const seraphMargin = 80000;
    if (seraphDepth > -seraphMargin
      && Math.abs(seraphHorizontal) < Math.max(0, seraphDepth) * tanHalfFov * aspect + seraphMargin
      && Math.abs(seraphVertical) < Math.max(0, seraphDepth) * tanHalfFov + seraphMargin) {
      const facingFrame = normal => {
        let right = [-normal[2], 0, normal[0]];
        const rightLength = Math.hypot(...right) || 1;
        right = right.map(value => value / rightLength);
        const up = [normal[1] * right[2] - normal[2] * right[1],
          normal[2] * right[0] - normal[0] * right[2],
          normal[0] * right[1] - normal[1] * right[0]];
        return { right, up };
      };
      const bodyAxes = facingFrame(bodyNormal);
      const frame = throneFrame(seraphPosition, bodyAxes.right, bodyAxes.up, bodyNormal);
      // Keep Seraphim at one physical scale throughout the approach. The
      // wings bend around the gallery rather than shrinking towards it.
      const seraphScale = 1200;
      const coreScale = Math.max(0, 1 - Math.max(0, (easedApproach - 0.45) / 0.55));
      if (coreScale > 0.005) drawMesh(seraphCore, matrixMultiply(frame, scaleMatrix(seraphScale * coreScale)), 1.45);
      const eyePosition = seraphPosition.map((value, axis) => value + bodyNormal[axis] * 3.3 * seraphScale);
      const toCamera = camera.map((value, axis) => value - eyePosition[axis]);
      const eyeDistance = Math.hypot(...toCamera) || 1;
      const eyeNormal = toCamera.map(value => value / eyeDistance);
      const eyeAxes = facingFrame(eyeNormal);
      const eyeFrame = throneFrame(eyePosition, eyeAxes.right, eyeAxes.up, eyeNormal);
      gl.uniform3f(throneLocations.seraphEyeForward, -eyeNormal[0], -eyeNormal[1], -eyeNormal[2]);
      gl.uniform3f(throneLocations.seraphEyeRight, ...eyeAxes.right);
      gl.uniform3f(throneLocations.seraphEyeUp, ...eyeAxes.up);
      const eyeModel = matrixMultiply(eyeFrame, scaleMatrix(3 * seraphScale));
      if (seraphEyeTextureReady) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, seraphEyeTexture);
        gl.uniform1f(throneLocations.eyeTextureReady, 1);
        gl.activeTexture(gl.TEXTURE0);
      }
      // Seraphim keeps an unbroken gaze; the small visitor may still blink.
      drawMesh(seraphEye, eyeModel, 0.50, 0, 0, 0, seraphEyeTextureReady ? 1.4 : 1, easedApproach, 0);
      // The eye writes depth first, so no wing can draw over its surface.
      // Throne's previously written depth remains in front of both.
      gl.depthMask(true);
      gl.depthFunc(gl.LESS);
      drawMesh(seraphim, matrixMultiply(frame, scaleMatrix(seraphScale)), 1.45, 0, 0, easedApproach, 1, 0, 0, 1);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
    }
    gl.depthRange(0, 1);
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
      constellationProgram = createConstellationProgram();
      constellationBuffer = gl.createBuffer();
      constellationLabelTexture = gl.createTexture();
      constellationLocations = {
        position: gl.getAttribLocation(constellationProgram, "a_position"),
        index: gl.getAttribLocation(constellationProgram, "a_index"),
        forward: gl.getUniformLocation(constellationProgram, "u_forward"),
        right: gl.getUniformLocation(constellationProgram, "u_right"),
        up: gl.getUniformLocation(constellationProgram, "u_up"),
        aspect: gl.getUniformLocation(constellationProgram, "u_aspect"),
        scale: gl.getUniformLocation(constellationProgram, "u_scale"),
        pointSize: gl.getUniformLocation(constellationProgram, "u_point_size"),
        focus: gl.getUniformLocation(constellationProgram, "u_focus"),
        points: gl.getUniformLocation(constellationProgram, "u_points"),
        labels: gl.getUniformLocation(constellationProgram, "u_labels")
      };
      throneLocations = {
        camera: gl.getUniformLocation(throneProgram, "u_camera"),
        light: gl.getUniformLocation(throneProgram, "u_light"),
        renderGain: gl.getUniformLocation(throneProgram, "u_render_gain"),
        ringRadius: gl.getUniformLocation(throneProgram, "u_ring_radius"),
        bandHalfWidth: gl.getUniformLocation(throneProgram, "u_band_half_width"),
        seraphWrap: gl.getUniformLocation(throneProgram, "u_seraph_wrap"),
        seraphEyeWrap: gl.getUniformLocation(throneProgram, "u_seraph_eye_wrap"),
        viewProjection: gl.getUniformLocation(throneProgram, "u_view_projection"),
        eyeTexture: gl.getUniformLocation(throneProgram, "u_eye_texture"),
        eyeTextureReady: gl.getUniformLocation(throneProgram, "u_eye_texture_ready"),
        eyeUvScale: gl.getUniformLocation(throneProgram, "u_eye_uv_scale"),
        seraphBlink: gl.getUniformLocation(throneProgram, "u_seraph_blink"),
        featherDetail: gl.getUniformLocation(throneProgram, "u_feather_detail"),
        wingPainting: gl.getUniformLocation(throneProgram, "u_wing_painting"),
        newtAnimated: gl.getUniformLocation(throneProgram, "u_newt_animated"),
        newtTime: gl.getUniformLocation(throneProgram, "u_newt_time"),
        newtEntry: gl.getUniformLocation(throneProgram, "u_newt_entry"),
        newtShell: gl.getUniformLocation(throneProgram, "u_newt_shell"),
        newtPanelPass: gl.getUniformLocation(throneProgram, "u_newt_panel_pass"),
        newtPanelRadius: gl.getUniformLocation(throneProgram, "u_newt_panel_radius"),
        newtShellTexture: gl.getUniformLocation(throneProgram, "u_newt_shell_texture"),
        seraphEyeForward: gl.getUniformLocation(throneProgram, "u_seraph_eye_forward"),
        seraphEyeRight: gl.getUniformLocation(throneProgram, "u_seraph_eye_right"),
        seraphEyeUp: gl.getUniformLocation(throneProgram, "u_seraph_eye_up"),
        model: gl.getUniformLocation(throneProgram, "u_model"),
        mvp: gl.getUniformLocation(throneProgram, "u_mvp"),
        position: gl.getAttribLocation(throneProgram, "a_position"),
        normal: gl.getAttribLocation(throneProgram, "a_normal"),
        color: gl.getAttribLocation(throneProgram, "a_color")
      };
      const pigmentSource = images.find(Boolean);
      if (pigmentSource) {
        const pigmentCanvas = document.createElement("canvas");
        pigmentCanvas.width = pigmentCanvas.height = 64;
        const pigmentContext = pigmentCanvas.getContext("2d", { willReadFrequently: true });
        pigmentContext.drawImage(pigmentSource, 0, 0, 64, 64);
        angelPigment = pigmentContext.getImageData(0, 0, 64, 64).data;
      }
      // Bake a compact monochrome relief from the crackled part of work 07.
      // This runs once, and the original painting files remain untouched.
      const wingSource = images[6] || pigmentSource;
      const wingCanvas = document.createElement("canvas");
      const wingSize = compactDevice ? 512 : 1024;
      wingCanvas.width = wingCanvas.height = wingSize;
      const wingContext = wingCanvas.getContext("2d", { willReadFrequently: true });
      if (wingSource) {
        wingContext.drawImage(wingSource, wingSource.naturalWidth * 0.38, wingSource.naturalHeight * 0.16,
          wingSource.naturalWidth * 0.30, wingSource.naturalHeight * 0.58, 0, 0, wingSize, wingSize);
        const detail = wingContext.getImageData(0, 0, wingSize, wingSize);
        const original = new Uint8ClampedArray(detail.data);
        const luminance = i => (original[i] * 0.2126 + original[i + 1] * 0.7152 + original[i + 2] * 0.0722);
        for (let y = 0; y < wingSize; y += 1) for (let x = 0; x < wingSize; x += 1) {
          const i = (y * wingSize + x) * 4;
          const right = (y * wingSize + Math.min(wingSize - 1, x + 3)) * 4;
          const down = (Math.min(wingSize - 1, y + 3) * wingSize + x) * 4;
          const value = luminance(i);
          const local = (luminance(right) + luminance(down)) * 0.5;
          const relief = Math.max(0, Math.min(255, 128 + (value - 150) * 0.65 + (value - local) * 2.1));
          detail.data[i] = detail.data[i + 1] = detail.data[i + 2] = relief;
          detail.data[i + 3] = 255;
        }
        wingContext.putImageData(detail, 0, 0);
      } else {
        wingContext.fillStyle = "#808080";
        wingContext.fillRect(0, 0, wingSize, wingSize);
      }
      wingTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, wingTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wingCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      wingCanvas.width = wingCanvas.height = 1;
      gl.activeTexture(gl.TEXTURE0);
      throneRings = compactDevice
        ? [makeThroneRing(26.9, 19, true, 0.86), makeThroneRing(36.9, 24, true), makeThroneRing(46.9, 20, true)]
        : [makeThroneRing(27.1, 29, false, 0.86), makeThroneRing(37.1, 38, false), makeThroneRing(47.1, 32, false)];
      throneEye = makeThroneEye(compactDevice);
      seraphEye = makeThroneEye(compactDevice, true);
      throneLid = makeThroneLid(compactDevice);
      seraphim = makeSeraphim(compactDevice);
      seraphCore = makeSeraphCore(compactDevice);
      newtBody = makeEyeNewt(compactDevice);
      newtShellTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, newtShellTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([120, 85, 60, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const newtReference = new Image();
      newtReference.onload = () => {
        const texture = document.createElement("canvas");
        texture.width = texture.height = 512;
        texture.getContext("2d").drawImage(newtReference, newtReference.naturalWidth * 0.73, newtReference.naturalHeight * 0.04,
          newtReference.naturalWidth * 0.18, newtReference.naturalHeight * 0.22, 0, 0, 512, 512);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, newtShellTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture);
        gl.activeTexture(gl.TEXTURE0);
        newtShellTextureReady = true;
      };
      newtReference.src = "artwork/reference/sperm-eye-v1.png";
      gl.activeTexture(gl.TEXTURE0);
      throneEyeTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, throneEyeTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 100, 96, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const reference = new Image();
      reference.onload = () => {
        const detail = document.createElement("canvas");
        detail.width = 512;
        detail.height = 512;
        detail.getContext("2d").drawImage(reference, 540, 520, 176, 121, 0, 0, 512, 512);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, throneEyeTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, detail);
        gl.activeTexture(gl.TEXTURE0);
        throneEyeTextureReady = true;
        detail.width = 1;
        detail.height = 1;
      };
      reference.src = "artwork/reference/throne.png";
      seraphEyeTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, seraphEyeTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 100, 96, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const highResolutionEye = new Image();
      highResolutionEye.onload = () => {
        const detail = document.createElement("canvas");
        const size = compactDevice ? 768 : 1254;
        detail.width = size;
        detail.height = size;
        detail.getContext("2d").drawImage(highResolutionEye, 0, 0, size, size);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, seraphEyeTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, detail);
        gl.activeTexture(gl.TEXTURE0);
        seraphEyeTextureReady = true;
        detail.width = 1;
        detail.height = 1;
      };
      highResolutionEye.src = "artwork/reference/seraph-eye-hd.png";
      gl.activeTexture(gl.TEXTURE0);
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
      gl.uniform1f(sphereLocations.fov, cameraFov);
      gl.uniform1f(sphereLocations.radius, radius);
      gl.uniform1f(sphereLocations.skyRadius, 650);
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
    const dpr = Math.min(window.devicePixelRatio || 1, compactDevice ? 1.25 : 1.6) * qualityScale;
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
    add(dirs.right, joystickVector[0] * step);
    add(dirs.forward, -joystickVector[1] * step);
    if (held.has("e") || held.has(" ")) movement[1] += step;
    if (held.has("q") || held.has("control")) movement[1] -= step;
    const magnitude = Math.hypot(...movement);
    if (magnitude > step) movement.forEach((_, i) => movement[i] *= step / magnitude);
    let next = camera.map((value, i) => value + movement[i]);
    const distance = Math.hypot(...next);
    const maxDistance = radius * 0.84;
    if (distance > maxDistance) next = next.map(value => value * (maxDistance / distance));
    camera = next;
  }

  function normalizeVector(v) {
    const length = Math.hypot(...v) || 1;
    return v.map(value => value / length);
  }

  function gapIsClear(surface, direction, lookAhead = 0) {
    const reference = Math.abs(direction[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const tangent = normalizeVector([reference[1] * direction[2] - reference[2] * direction[1], reference[2] * direction[0] - reference[0] * direction[2], reference[0] * direction[1] - reference[1] * direction[0]]);
    const up = [direction[1] * tangent[2] - direction[2] * tangent[1], direction[2] * tangent[0] - direction[0] * tangent[2], direction[0] * tangent[1] - direction[1] * tangent[0]];
    for (const [a, b] of [[0, 0], [0.47, 0], [-0.47, 0], [0, 0.47], [0, -0.47]]) {
      const point = surface.map((value, axis) => value + tangent[axis] * a + up[axis] * b);
      const ray = normalizeVector(point.map((value, axis) => value - camera[axis]));
      if (artworkAlongRay(ray, true, time + lookAhead) > 0.08) return false;
    }
    return true;
  }

  function findNaturalGap(position) {
    let best = null, bestDistance = Infinity;
    const count = 1200, goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const y = 1 - 2 * (i + 0.5) / count;
      const ring = Math.sqrt(1 - y * y), angle = i * goldenAngle;
      const direction = [ring * Math.cos(angle), y, ring * Math.sin(angle)];
      const surface = [direction[0] * radius, direction[1] * radius * 1.12, direction[2] * radius];
      const centerRay = normalizeVector(surface.map((value, axis) => value - camera[axis]));
      if (artworkAlongRay(centerRay, true) > 0.08 || !gapIsClear(surface, direction) || !gapIsClear(surface, direction, 2.5)) continue;
      const distance = Math.hypot(...surface.map((value, axis) => value - position[axis]));
      if (distance < bestDistance) { best = { surface, direction }; bestDistance = distance; }
    }
    return best;
  }

  function gapOpenForPassage(surface, direction) {
    return [0, 0.5, 1, 1.5, 2, 2.5].every(offset => gapIsClear(surface, direction, offset));
  }

  function updateEyeNewt(now) {
    if (newtStart === null || !experienceStarted || !entry.classList.contains("leaving")) { visitorFact.hidden = true; return null; }
    const elapsed = (now - newtStart) / 1000;
    if (!newtAgent) newtAgent = { phase: "seek", position: [0, 2, -180], velocity: [0, 0, 0], entryPose: 0, lastNow: now, nextSearch: now, target: null };
    const agent = newtAgent;
    const dt = Math.min(0.05, Math.max(0, (now - agent.lastNow) / 1000));
    agent.lastNow = now;
    const moveToward = (target, speed) => {
      const offset = target.map((value, axis) => value - agent.position[axis]);
      const distance = Math.hypot(...offset);
      if (distance > 0.0001) {
        // Ease into turns and slow down as he reaches a target, instead of
        // snapping instantly from one direction to the next.
        const desiredSpeed = speed * Math.min(1, distance / 2.0);
        const blend = 1 - Math.exp(-4.5 * dt);
        agent.velocity = agent.velocity.map((value, axis) => value + (offset[axis] / distance * desiredSpeed - value) * blend);
        const step = agent.velocity.map(value => value * dt);
        if (step.reduce((sum, value, axis) => sum + value * offset[axis], 0) >= distance * distance) {
          agent.position = target.slice();
          agent.velocity = [0, 0, 0];
        } else {
          agent.position = agent.position.map((value, axis) => value + step[axis]);
        }
      }
      return distance;
    };
    if (agent.phase === "seek") {
      // A long, measured journey towards the shell; wait for a genuine gap.
      const approach = Math.min(1, elapsed / 55);
      const orbitRadius = 180 - approach * 161;
      const angle = 0.12 + elapsed * 0.006;
      const orbitTarget = [Math.sin(angle) * orbitRadius, Math.sin(elapsed * 0.16) * 1.2 + 2.5, -Math.cos(angle) * orbitRadius];
      if (elapsed < 55) agent.position = orbitTarget;
      else moveToward(orbitTarget, 3);
      if (elapsed >= 55 && now >= agent.nextSearch) {
        agent.nextSearch = now + 900;
        agent.target = findNaturalGap(agent.position);
        if (agent.target) agent.phase = "approach";
      }
    } else if (agent.phase === "approach") {
      const { surface, direction } = agent.target;
      const outside = surface.map((value, axis) => value + direction[axis] * 1.2);
      if (now >= agent.nextSearch) {
        agent.nextSearch = now + 600;
        if (!gapIsClear(surface, direction) || !gapIsClear(surface, direction, 2.5)) { agent.phase = "seek"; agent.target = null; }
      }
      if (agent.phase === "approach" && moveToward(outside, 9) < 0.08 && agent.entryPose > 0.96 && gapOpenForPassage(surface, direction)) {
        agent.position = outside;
        agent.velocity = [0, 0, 0];
        agent.phase = "cross";
        agent.crossStart = now;
      }
    } else if (agent.phase === "cross") {
      const progress = Math.min(1, (now - agent.crossStart) / 2200);
      if (!gapIsClear(agent.target.surface, agent.target.direction)) {
        agent.phase = "retreat";
      } else {
        const easedProgress = progress * progress * (3 - 2 * progress);
        const offset = 1.2 - 2.4 * easedProgress;
        agent.position = agent.target.surface.map((value, axis) => value + agent.target.direction[axis] * offset);
        if (progress >= 1) agent.phase = "inside";
      }
    } else if (agent.phase === "retreat") {
      const outside = agent.target.surface.map((value, axis) => value + agent.target.direction[axis] * 1.2);
      if (moveToward(outside, 7) < 0.1) { agent.phase = "seek"; agent.target = null; }
    } else if (agent.phase === "inside") {
      const dirs = basis();
      const hover = Math.sin(time * 1.3) * 0.09 + Math.sin(time * 0.57) * 0.035;
      // Derive the offset from the view so the visitor stays in the lower
      // right on portrait phones as well as widescreen displays.
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      const halfHeight = 3.8 * Math.tan(cameraFov / 2);
      const rightOffset = Math.min(1.8, halfHeight * aspect * 0.65);
      const target = camera.map((value, axis) => value + dirs.forward[axis] * 3.8 + dirs.right[axis] * rightOffset + dirs.up[axis] * (-halfHeight * 0.58 + hover));
      const distance = moveToward(target, 6);
      if (elapsed >= 60 && distance < 0.65 && visitorArrivedAt === null) visitorArrivedAt = now;
    }
    const showFact = visitorArrivedAt !== null && agent.phase === "inside" && !dialog.open && !eyeOffer.open && entry.classList.contains("leaving");
    if (showFact) {
      const sinceArrival = Math.max(0, (now - visitorArrivedAt) / 1000);
      const factNumber = Math.floor(sinceArrival / 40);
      if (factNumber !== visitorFactIndex) {
        visitorFactIndex = factNumber;
        visitorFact.textContent = visitorFacts[factNumber % visitorFacts.length];
      }
      // Project the visitor's actual world position into screen coordinates,
      // so the words travel with him instead of sticking to a screen corner.
      const dirs = basis();
      const offset = agent.position.map((value, axis) => value - camera[axis]);
      const depth = offset.reduce((sum, value, axis) => sum + value * dirs.forward[axis], 0);
      const horizontal = offset.reduce((sum, value, axis) => sum + value * dirs.right[axis], 0);
      const vertical = offset.reduce((sum, value, axis) => sum + value * dirs.up[axis], 0);
      const rect = canvas.getBoundingClientRect();
      const scale = Math.tan(cameraFov / 2);
      const screenX = rect.left + rect.width / 2 + horizontal / Math.max(depth, 0.001) / scale * rect.height / 2;
      const screenY = rect.top + rect.height / 2 - vertical / Math.max(depth, 0.001) / scale * rect.height / 2;
      const inView = depth > 0.5 && screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom;
      const halfLabel = Math.min(130, rect.width * 0.27);
      visitorFact.style.left = `${Math.max(rect.left + halfLabel, Math.min(rect.right - halfLabel, screenX))}px`;
      visitorFact.style.top = `${Math.max(rect.top + 70, screenY - 25)}px`;
      visitorFact.hidden = !inView || sinceArrival % 40 >= 10;
    } else visitorFact.hidden = true;
    const desiredPose = ["approach", "cross", "retreat"].includes(agent.phase) ? 1 : 0;
    agent.entryPose += (desiredPose - agent.entryPose) * (1 - Math.exp(-3.5 * dt));
    const ray = normalizeVector(agent.position.map((value, axis) => value - camera[axis]));
    return { ray, position: agent.position, entryPose: agent.entryPose };
  }

  function translationMatrix(x, y, z) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }

  function drawEyeNewt(state, foreground) {
    if (!state || dialog.open || !newtBody) return;
    const dirs = basis();
    const normal = state.ray.map(value => -value);
    let right = [normal[2] * -1, 0, normal[0]];
    const rightLength = Math.hypot(...right) || 1;
    right = right.map(value => value / rightLength);
    const up = [normal[1] * right[2] - normal[2] * right[1], normal[2] * right[0] - normal[0] * right[2], normal[0] * right[1] - normal[1] * right[0]];
    const position = state.position;
    const frame = throneFrame(position, right, up, normal);
    // Small turns expose the volume of the head and tail instead of keeping
    // the creature like a flat image facing the viewer at all times.
    const roll = 0.12 + Math.sin(time * 1.75) * 0.10 + Math.sin(time * 0.57) * 0.04;
    const tilt = Math.sin(time * 1.15 + 0.7) * 0.12;
    const turn = 0.20 + Math.sin(time * 0.93) * 0.20;
    const bodyFrame = matrixMultiply(frame, matrixMultiply(rotationMatrix(tilt, turn, roll), scaleMatrix(0.72)));
    const viewProjection = matrixMultiply(throneProjectionMatrix(), throneViewMatrix(dirs));
    // Match Throne's near depth range, retaining its depth across both passes.
    gl.depthRange(0, 0.45);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(throneProgram);
    gl.uniformMatrix4fv(throneLocations.viewProjection, false, viewProjection);
    gl.uniform3f(throneLocations.camera, ...camera);
    gl.uniform3f(throneLocations.light, 4, 8, -6);
    gl.uniform1i(throneLocations.eyeTexture, 1);
    gl.uniform1f(throneLocations.ringRadius, 0);
    gl.uniform1f(throneLocations.bandHalfWidth, 0);
    gl.uniform1f(throneLocations.seraphWrap, 0);
    gl.uniform1f(throneLocations.seraphEyeWrap, 0);
    gl.uniform1f(throneLocations.eyeUvScale, 1);
    gl.uniform1f(throneLocations.featherDetail, 0);
    gl.uniform1f(throneLocations.newtTime, time);
    gl.uniform1f(throneLocations.newtEntry, state.entryPose);
    gl.uniform1f(throneLocations.newtPanelPass, foreground ? 2 : 1);
    gl.uniform1f(throneLocations.newtPanelRadius, radius);
    gl.uniform1i(throneLocations.newtShellTexture, 2);
    const stride = 9 * Float32Array.BYTES_PER_ELEMENT;
    for (const loc of [throneLocations.position, throneLocations.normal, throneLocations.color]) gl.enableVertexAttribArray(loc);
    const draw = (mesh, model, gain, eye = false) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      gl.vertexAttribPointer(throneLocations.position, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(throneLocations.normal, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
      gl.vertexAttribPointer(throneLocations.color, 3, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT);
      gl.uniformMatrix4fv(throneLocations.model, false, model);
      gl.uniformMatrix4fv(throneLocations.mvp, false, matrixMultiply(viewProjection, model));
      gl.uniform1f(throneLocations.renderGain, gain);
      gl.uniform1f(throneLocations.eyeTextureReady, eye && seraphEyeTextureReady ? 1 : 0);
      gl.uniform1f(throneLocations.seraphBlink, 0);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    };
    const part = (x, y, z, angle, size) => matrixMultiply(bodyFrame, matrixMultiply(translationMatrix(x, y, z), matrixMultiply(rotationMatrix(0, 0, angle), scaleMatrix(size))));
    gl.uniform1f(throneLocations.newtAnimated, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, newtShellTexture);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(throneLocations.newtShell, 1);
    draw(newtBody, bodyFrame, 1.10);
    gl.uniform1f(throneLocations.newtAnimated, 0);
    gl.uniform1f(throneLocations.newtShell, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, seraphEyeTexture);
    gl.activeTexture(gl.TEXTURE0);
    draw(seraphEye, part(0, 0, 0.53, 0, 0.38), 0.75, true);
    gl.uniform1f(throneLocations.newtPanelPass, 0);
    gl.depthRange(0, 1);
    gl.disable(gl.DEPTH_TEST);
  }

  // Quarter-circle arcs are laid out in adjacent Fibonacci squares.  The
  // sample points retain their true relative radii before a uniform scale is
  // applied to fit the currently visible part of the very large spiral.
  function fibonacciSpiralWindow(page, full = false) {
    const radii = [1, ...offeringAmounts];
    const arcs = [];
    let endpoint = [1, 0];
    radii.forEach((radiusValue, index) => {
      const start = index * Math.PI / 2;
      const center = [endpoint[0] - radiusValue * Math.cos(start), endpoint[1] - radiusValue * Math.sin(start)];
      const samples = [];
      for (let segment = 0; segment <= 16; segment += 1) {
        const angle = start + segment * Math.PI / 32;
        samples.push([center[0] + radiusValue * Math.cos(angle), center[1] + radiusValue * Math.sin(angle)]);
      }
      endpoint = samples[samples.length - 1];
      arcs.push(samples);
    });
    const start = full ? 0 : page * 5;
    const selected = arcs.slice(start + 1, full ? undefined : start + 6);
    const all = selected.flat();
    const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]));
    const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
    // Anchor the full spiral on its first two coin stars and give them enough
    // angular separation to aim at without zooming. The outer arcs extend
    // much farther across the sky rather than compressing the inner spiral.
    const factor = full ? 0.025 : 1.32 / Math.max(maxX - minX, maxY - minY);
    const middleX = full ? 0 : (minX + maxX) / 2;
    const middleY = full ? -1 : (minY + maxY) / 2;
    const map = p => [(p[0] - middleX) * factor, (p[1] - middleY) * factor];
    return selected.map((arc, index) => ({ index: start + index, value: offeringAmounts[start + index], points: arc.map(map) }));
  }

  function skyAxes(direction) {
    const reference = Math.abs(direction[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    const right = normalizeVector([reference[1] * -direction[2] + reference[2] * direction[1],
      reference[2] * -direction[0] + reference[0] * direction[2], reference[0] * -direction[1] + reference[1] * direction[0]]);
    const up = [right[1] * direction[2] - right[2] * direction[1], right[2] * direction[0] - right[0] * direction[2], right[0] * direction[1] - right[1] * direction[0]];
    return { right, up };
  }

  function skyDirection(center, axes, point) {
    return normalizeVector(center.map((value, axis) => value + axes.right[axis] * point[0] + axes.up[axis] * point[1]));
  }

  function ringObstructsSky(ray) {
    if (!throneRings.length) return false;
    const assembly = rotationMatrix(0.10, time * 0.0005625, -0.06);
    const speeds = [0.0024, -0.0020, 0.0018];
    const tilts = [[1.48, 0], [1.48, 1.05], [1.34, -1.05]];
    return throneRings.some((ring, index) => {
      const speed = speeds[index], tilt = tilts[index];
      const rotation = matrixMultiply(assembly, rotationMatrix(tilt[0] + time * speed, tilt[1] - time * speed * 0.61, time * speed * 1.7));
      const normal = transformPoint(rotation, [0, 0, 1]);
      const b = camera.reduce((sum, value, axis) => sum + value * ray[axis], 0);
      const c = camera.reduce((sum, value) => sum + value * value, 0) - ring.radius * ring.radius;
      const distance = -b + Math.sqrt(Math.max(0, b * b - c));
      const point = camera.map((value, axis) => value + ray[axis] * distance);
      return Math.abs(point.reduce((sum, value, axis) => sum + value * normal[axis], 0)) < 4.3;
    });
  }

  function seraphSkyOcclusion() {
    if (!seraphim || !seraphim.occlusionPositions) return { cones: [], eye: [0, 1, 0], eyeLimit: 2 };
    const approach = seraphProgress();
    const wrap = approach * approach * (3 - 2 * approach);
    const orbit = 0.22 + time * 0.0035;
    const radius = 63450 - 53450 * wrap;
    const horizontal = radius * Math.SQRT1_2;
    const position = [Math.sin(orbit) * horizontal, horizontal, -Math.cos(orbit) * horizontal];
    const inward = position.map(value => -value / radius);
    const axes = skyAxes(inward);
    axes.up = axes.up.map(value => -value);
    const source = seraphim.occlusionPositions;
    const transform = offset => {
      const x = source[offset], y = source[offset + 1], z = source[offset + 2];
      const world = position.map((value, axis) => value + 1200 * (axes.right[axis] * x + axes.up[axis] * y + inward[axis] * z));
      if (wrap <= 0.001) return normalizeVector(world.map((value, axis) => value - camera[axis]));
      const longitude = Math.max(-1, Math.min(1, x / 36)) * 3.08;
      const latitude = Math.max(-1, Math.min(1, y / 29)) * 1.53;
      const c = Math.cos(latitude), start = normalizeVector(world);
      const wrapped = normalizeVector(start.map((_, axis) => axes.right[axis] * Math.sin(longitude) * c
        + axes.up[axis] * Math.sin(latitude) - inward[axis] * Math.cos(longitude) * c));
      const direction = normalizeVector(start.map((value, axis) => value * (1 - wrap) + wrapped[axis] * wrap));
      const distance = Math.max(6800, Math.hypot(...world) * (1 - wrap) + (7200 + z * 100) * wrap);
      return normalizeVector(direction.map((value, axis) => value * distance - camera[axis]));
    };
    const cones = [];
    // Each feather quad has two triangles (six vertices); bound all four
    // corners by one conservative angular cone rather than testing each mesh
    // triangle while the scene is animating.
    for (let offset = 0; offset + 17 < source.length; offset += 18) {
      const corners = [transform(offset), transform(offset + 3), transform(offset + 6), transform(offset + 15)];
      const center = normalizeVector([0, 1, 2].map(axis => corners.reduce((sum, p) => sum + p[axis], 0)));
      let limit = 1;
      corners.forEach(p => { limit = Math.min(limit, center.reduce((sum, value, axis) => sum + value * p[axis], 0)); });
      cones.push(center[0], center[1], center[2], Math.max(-0.1, limit - 0.002));
    }
    const eyePosition = position.map((value, axis) => value + inward[axis] * 3960 - camera[axis]);
    return { cones, eye: normalizeVector(eyePosition), eyeLimit: Math.cos(0.18 + wrap * 0.78) };
  }

  function seraphObstructsSky(ray, occlusion) {
    if (ray.reduce((sum, value, axis) => sum + value * occlusion.eye[axis], 0) > occlusion.eyeLimit) return true;
    for (let i = 0; i < occlusion.cones.length; i += 4) {
      if (ray[0] * occlusion.cones[i] + ray[1] * occlusion.cones[i + 1] + ray[2] * occlusion.cones[i + 2] > occlusion.cones[i + 3]) return true;
    }
    return false;
  }

  function buildConstellationGeometry() {
    if (!constellationDirection || !constellationProgram || !constellationBuffer) return;
    const arcs = fibonacciSpiralWindow(0, true);
    const axes = { right: constellationRight, up: constellationUp };
    const data = [];
    const append = (direction, index) => data.push(direction[0], direction[1], direction[2], index);
    arcs.forEach(arc => {
      for (let i = 1; i < arc.points.length; i += 1) {
        append(skyDirection(constellationDirection, axes, arc.points[i - 1]), -2);
        append(skyDirection(constellationDirection, axes, arc.points[i]), -2);
      }
    });
    constellationLineCount = data.length / 4;
    constellationStars = arcs.map((arc, index) => ({ index: arc.index, value: arc.value,
      direction: skyDirection(constellationDirection, axes, arc.points[arc.points.length - 1]), slot: index }));
    constellationStars.forEach((star, slot) => append(star.direction, slot));
    gl.bindBuffer(gl.ARRAY_BUFFER, constellationBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    // Labels share the same sky layer and depth test as the stars.
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 128; labelCanvas.height = 64 * constellationStars.length;
    const context = labelCanvas.getContext("2d");
    context.fillStyle = "#f3ddba"; context.font = "24px Georgia, serif";
    context.textAlign = "center"; context.textBaseline = "middle";
    constellationStars.forEach((star, slot) => context.fillText(`£${star.value}`, 64, slot * 64 + 49));
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, constellationLabelTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, labelCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0);
  }

  function updateConstellationView() {
    const visible = !!constellationDirection && experienceStarted && entry.classList.contains("leaving") && !dialog.open && !eyeOffer.open;
    if (!visible) { focusedStar = -1; starPrompt.hidden = true; return; }
    const dirs = basis(), width = window.innerWidth, height = window.innerHeight;
    const scale = Math.tan(cameraFov / 2);
    let nearest = -1, nearestDot = Math.cos(Math.min(0.075, cameraFov * 0.09));
    constellationStars.forEach((star, slot) => {
      const depth = star.direction.reduce((sum, value, axis) => sum + value * dirs.forward[axis], 0);
      if (depth > nearestDot) { nearest = slot; nearestDot = depth; }
    });
    if (nearest >= 0 && artworkAlongRay(constellationStars[nearest].direction, true) > 0.85) nearest = -1;
    focusedStar = nearest;
    starPrompt.hidden = nearest < 0;
    if (nearest >= 0) starPrompt.textContent = `£${constellationStars[nearest].value} · ${mouseCamera ? "CLICK OR ENTER" : "TAP"} TO CHOOSE · ${mouseCamera ? "SCROLL" : "PINCH"} TO LOOK CLOSER`;
  }

  function drawConstellation() {
    if (!constellationDirection || !constellationStars.length || !experienceStarted || !entry.classList.contains("leaving")) return;
    const dirs = basis(), loc = constellationLocations;
    gl.useProgram(constellationProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, constellationBuffer);
    gl.enableVertexAttribArray(loc.position); gl.enableVertexAttribArray(loc.index);
    gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(loc.index, 1, gl.FLOAT, false, 16, 12);
    gl.uniform3f(loc.forward, ...dirs.forward); gl.uniform3f(loc.right, ...dirs.right); gl.uniform3f(loc.up, ...dirs.up);
    gl.uniform1f(loc.aspect, canvas.width / canvas.height);
    gl.uniform1f(loc.scale, Math.tan(cameraFov / 2));
    gl.uniform1f(loc.pointSize, 24 * canvas.width / Math.max(1, window.innerWidth));
    gl.uniform1f(loc.focus, focusedStar);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.uniform1f(loc.points, 0); gl.drawArrays(gl.LINES, 0, constellationLineCount);
    gl.uniform1f(loc.points, 1); gl.drawArrays(gl.POINTS, constellationLineCount, constellationStars.length);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, constellationLabelTexture);
    gl.uniform1i(loc.labels, 4);
    gl.uniform1f(loc.pointSize, 72 * canvas.width / Math.max(1, window.innerWidth));
    gl.uniform1f(loc.points, 2); gl.drawArrays(gl.POINTS, constellationLineCount, constellationStars.length);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND);
  }

  function openConstellation(guideCamera = false) {
    if (constellationDirection) return;
    // Keep the inner stars high overhead, nudged away from the direction
    // Seraphim approaches, without shifting the camera or the stars themselves.
    const approachAngle = 0.22 + ((seraphApproachStart === null ? time : seraphApproachStart) + 120) * 0.0035;
    const tilt = 0.23;
    constellationDirection = [-Math.sin(approachAngle) * Math.sin(tilt), Math.cos(tilt), Math.cos(approachAngle) * Math.sin(tilt)];
    const axes = skyAxes(constellationDirection);
    constellationRight = axes.right;
    constellationUp = axes.up;
    buildConstellationGeometry();
    constellationGuide = null;
  }

  function chooseConstellationStar(slot) {
    const star = constellationStars[slot];
    if (!star || eyeOffer.open || dialog.open) return;
    offeringIndex = star.index;
    customOfferingPence = null;
    document.getElementById("custom-offering").value = "";
    document.getElementById("custom-offering").setCustomValidity("");
    updateOffering();
    releaseCameraMouse();
    eyeOffer.show();
  }

  function releaseCameraMouse() {
    fallbackMouseLook = false;
    canvas.classList.remove("mouse-camera");
    lookHint.textContent = mouseCamera ? "CLICK TO LOOK" : "DRAG TO LOOK";
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  function render(now = 0) {
    if (!program) return;
    const rawFrameTime = now - lastFrame;
    // On compact devices, adjust only the 3D canvas resolution when sustained
    // frame drops occur. Full-size painting images remain untouched.
    if (compactDevice) {
      if (!experienceStarted || dialog.open || document.hidden || rawFrameTime > 250 || rawFrameTime <= 0) {
        qualityWindowStart = 0;
        qualityFrames = 0;
        qualityStableWindows = 0;
        qualityWakeAt = now + 4000;
      } else if (now >= qualityWakeAt) {
        if (!qualityWindowStart) qualityWindowStart = now;
        qualityFrames += 1;
        const elapsed = now - qualityWindowStart;
        if (elapsed >= 3000) {
          const fps = qualityFrames * 1000 / elapsed;
          if (fps < 56) {
            qualityScale = Math.max(0.65, qualityScale - 0.12);
            qualityStableWindows = 0;
          } else if (fps >= 59 && qualityScale < 1) {
            qualityStableWindows += 1;
            if (qualityStableWindows >= 4) {
              qualityScale = Math.min(1, qualityScale + 0.06);
              qualityStableWindows = 0;
            }
          } else {
            qualityStableWindows = 0;
          }
          qualityWindowStart = now;
          qualityFrames = 0;
        }
      }
    }
    resize();
    const delta = Math.min((now - lastFrame) / 1000 || 0, 0.04);
    lastFrame = now;
    time += delta;
    cameraFov += (targetFov - cameraFov) * (1 - Math.exp(-10 * delta));
    if (constellationGuide && !pointerStart) {
      const progress = Math.min(1, (now - constellationGuide.start) / 1800);
      const eased = progress * progress * (3 - 2 * progress);
      pitch = constellationGuide.from + (constellationGuide.to - constellationGuide.from) * eased;
      const yawDelta = Math.atan2(Math.sin(constellationGuide.toYaw - constellationGuide.fromYaw), Math.cos(constellationGuide.toYaw - constellationGuide.fromYaw));
      yaw = constellationGuide.fromYaw + yawDelta * eased;
      if (progress >= 1) constellationGuide = null;
    }
    if (experienceStarted && seraphApproachStart === null) seraphApproachStart = time;
    if (experienceStarted && !constellationDirection && entry.classList.contains("leaving")) openConstellation(false);
    if (experienceStarted && newtStart === null) newtStart = now;
    moveCamera(delta);
    newtState = updateEyeNewt(now);
    updateConstellationView();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
    gl.enableVertexAttribArray(skyPositionAttribute);
    gl.vertexAttribPointer(skyPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
    gl.uniform3f(sphereLocations.camera, camera[0], camera[1], camera[2]);
    gl.uniform1f(sphereLocations.yaw, yaw);
    gl.uniform1f(sphereLocations.pitch, pitch);
    gl.uniform1f(sphereLocations.fov, cameraFov);
    gl.uniform1f(sphereLocations.time, time);
    gl.uniform1f(sphereLocations.renderLayer, 0);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    drawConstellation();
    drawThrone();
    drawEyeNewt(newtState, false);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
    gl.enableVertexAttribArray(skyPositionAttribute);
    gl.vertexAttribPointer(skyPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(sphereLocations.renderLayer, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    drawEyeNewt(newtState, true);
    requestAnimationFrame(render);
  }

  document.querySelector(".identity").addEventListener("click", event => {
    event.preventDefault();
    if (!experienceStarted) return;
    releaseCameraMouse();
    entry.classList.remove("leaving");
    hint.hidden = true;
    controls.hidden = true;
  });

  enterButton.addEventListener("click", () => {
    experienceStarted = true;
    entry.classList.add("leaving");
    hint.hidden = false;
    controls.hidden = false;
    backgroundMusic.volume = 0.22;
    backgroundMusic.play().catch(() => {});
  });

  const conversationSteps = [...document.querySelectorAll("[data-offer-step]")];
  function showConversationStep(name) {
    conversationSteps.forEach(step => { step.hidden = step.dataset.offerStep !== name; });
    eyeOffer.scrollTop = 0;
    const firstChoice = eyeOffer.querySelector(`[data-offer-step="${name}"] button:not(:disabled)`);
    if (firstChoice) firstChoice.focus({ preventScroll: true });
  }
  eyeOffer.querySelectorAll("[data-offer-next]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById("custom-offering");
      if (button.dataset.offerNext === "currency" && !input.checkValidity()) { input.reportValidity(); return; }
      showConversationStep(button.dataset.offerNext);
    });
  });
  const customOfferingInput = document.getElementById("custom-offering");
  customOfferingInput.addEventListener("input", () => {
    const value = customOfferingInput.value;
    const valid = value === "" || (/^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) >= 1 && Number(value) <= 9999.99);
    customOfferingInput.setCustomValidity(valid ? "" : "Choose an amount from £1 to £9,999.99, with up to two decimal places.");
    customOfferingPence = value && valid ? Math.round(Number(value) * 100) : null;
    updateOffering();
  });
  function updateOffering() {
    const pounds = customOfferingPence === null ? offeringAmounts[offeringIndex] : customOfferingPence / 100;
    const totalPounds = pounds;
    const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: Number.isInteger(pounds) ? 0 : 2 }).format(pounds);
    document.getElementById("offering-value").textContent = customOfferingPence === null ? `${pounds} ${pounds === 1 ? "coin" : "coins"} · ${amount}` : `Your offering · ${amount}`;
    if (constellationDirection) buildConstellationGeometry();
    const currency = offeringCurrency;
    const estimate = document.getElementById("currency-estimate");
    const total = document.getElementById("offering-total");
    document.getElementById("currency-pounds").textContent = amount;
    document.getElementById("currency-caption").textContent = currency;
    document.getElementById("currency-selected-coin").src = `artwork/currencies/${currency}.svg?v=coins-163`;
    document.querySelectorAll("#currency-tokens button").forEach(button => {
      const selected = button.dataset.currency === currency;
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    if (currency === "GBP") {
      estimate.textContent = amount;
      total.textContent = amount;
    } else if (offeringRates && offeringRates[currency]) {
      const digits = ["HUF", "JPY", "TWD"].includes(currency) ? 0 : 2;
      const converted = new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(totalPounds * offeringRates[currency]);
      estimate.textContent = converted;
      total.textContent = `${amount} (approximately ${converted})`;
    } else {
      estimate.textContent = offeringRatesPending ? "Finding rate…" : "Rate unavailable";
      total.textContent = amount;
    }
  }
  async function loadOfferingRates() {
    if (offeringRates || offeringRatesPending) return;
    offeringRatesPending = true;
    updateOffering();
    try {
      const response = await fetch("https://api.frankfurter.dev/v1/latest?base=GBP");
      if (!response.ok) throw new Error("rate unavailable");
      const data = await response.json();
      offeringRates = data.rates;
      offeringRateDate = data.date;
      Object.keys(offeringRates).forEach(code => { offeringRateDates[code] = data.date; });
    } catch (_) {
      // Keep the GBP scale usable if the rate service is unavailable.
    } finally {
      offeringRatesPending = false;
      updateOffering();
    }
  }
  async function loadSelectedOfferingRate(currency) {
    if (!offeringRates) await loadOfferingRates();
    if (!offeringRates || offeringRates[currency] || currency === "GBP" || offeringRatesPending) return;
    offeringRatesPending = true;
    updateOffering();
    try {
      const response = await fetch(`https://api.frankfurter.dev/v2/rate/GBP/${encodeURIComponent(currency)}`);
      if (!response.ok) throw new Error("rate unavailable");
      const data = await response.json();
      if (!Number.isFinite(data.rate) || data.rate <= 0) throw new Error("invalid rate");
      offeringRates[currency] = data.rate;
      offeringRateDates[currency] = data.date;
    } catch (_) {
      // An unavailable reference rate does not affect any GBP selection.
    } finally {
      offeringRatesPending = false;
      updateOffering();
    }
  }
  const currencyTokens = document.getElementById("currency-tokens");
  offeringCurrencies.forEach(currency => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.currency = currency;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-label", currency);
    const image = document.createElement("img");
    image.src = `artwork/currencies/${currency}.svg?v=coins-163`;
    image.alt = "";
    button.appendChild(image);
    const code = document.createElement("span");
    code.className = "currency-token-code";
    code.textContent = currency;
    button.appendChild(code);
    button.addEventListener("click", () => {
      offeringCurrency = currency;
      updateOffering();
      if (currency !== "GBP") loadSelectedOfferingRate(currency);
    });
    currencyTokens.appendChild(button);
  });
  currencyTokens.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = offeringCurrencies.indexOf(offeringCurrency);
    const next = event.key === "Home" ? 0 : event.key === "End" ? offeringCurrencies.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + offeringCurrencies.length) % offeringCurrencies.length;
    const button = currencyTokens.children[next];
    button.focus();
    button.click();
  });
  updateOffering();
  document.getElementById("eye-offer-close").addEventListener("click", () => eyeOffer.close());
  document.getElementById("eye-offer-dismiss").addEventListener("click", () => eyeOffer.close());
  eyeOffer.addEventListener("click", event => { if (event.target === eyeOffer) eyeOffer.close(); });
  eyeOffer.addEventListener("close", () => { constellationGuide = null; showConversationStep("offering"); });

  function rayForScreen(x, y) {
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const scale = Math.tan(cameraFov / 2);
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

  function artworkAt(x, y, coverageOnly = false) {
    return artworkAlongRay(rayForScreen(x, y), coverageOnly);
  }

  function artworkAlongRay(ray, coverageOnly = false, sampleTime = time) {
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
    let secondDistance = Infinity;
    let firstOpacity = 0, secondOpacity = 0;
    const smooth = (a, b, n) => { const t = Math.max(0, Math.min(1, (n - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let index = 0; index < 36; index += 1) {
      const column = index % 6;
      const row = Math.floor(index / 6);
      const baseLongitude = (column - 1) * Math.PI / 3 - Math.PI / 2;
      const baseLatitude = 1.31 - row * 0.524;
      const travel = sampleTime * 0.01225 * (1 + 0.02 * Math.sin(index * 1.7)) + index * 0.001;
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
      if (Math.abs(px) <= 1 && Math.abs(py) <= 1) {
        const opacity = (1 - smooth(0.66, 1, Math.abs(px))) * (1 - smooth(0.66, 1, Math.abs(py)))
          * smooth(0, 0.34, Math.abs(Math.cos(latitude)));
        if (panelDistance < closestDistance) {
          secondDistance = closestDistance;
          secondOpacity = firstOpacity;
          closestDistance = panelDistance;
          firstOpacity = opacity;
          closestWork = index % 12;
        } else if (panelDistance < secondDistance) {
          secondDistance = panelDistance;
          secondOpacity = opacity;
        }
      }
    }
    return coverageOnly ? 1 - (1 - firstOpacity) * (1 - secondOpacity) : closestWork;
  }

  canvas.addEventListener("pointerdown", event => {
    if (!entry.classList.contains("leaving") || dialog.open) return;
    constellationGuide = null;
    if (event.pointerType === "touch") {
      skyPointers.set(event.pointerId, [event.clientX, event.clientY]);
      canvas.setPointerCapture(event.pointerId);
      if (skyPointers.size >= 2) {
        const [a, b] = [...skyPointers.values()];
        skyPinch = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), fov: targetFov };
        skyPinchUsed = true;
        pointerStart = null;
        return;
      }
    }
    if (event.pointerType === "mouse" && mouseCamera) {
      if (document.pointerLockElement !== canvas && !fallbackMouseLook) {
        if (!canLockMouse) {
          fallbackMouseLook = true;
          canvas.classList.add("mouse-camera");
          lookHint.textContent = "MOVE MOUSE TO LOOK";
        } else {
          const activateFallback = () => {
            canLockMouse = false; fallbackMouseLook = true;
            canvas.classList.add("mouse-camera"); lookHint.textContent = "MOVE MOUSE TO LOOK";
          };
          try {
            const request = canvas.requestPointerLock();
            if (request && request.catch) request.catch(activateFallback);
          } catch (_) { activateFallback(); }
        }
      } else if (focusedStar >= 0 && constellationDirection && !eyeOffer.open) {
        chooseConstellationStar(focusedStar);
      } else if (!eyeOffer.open) {
        const rect = canvas.getBoundingClientRect();
        const work = artworkAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (work >= 0) { releaseCameraMouse(); showWork(work); }
      }
      return;
    }
    pointerStart = { x: event.clientX, y: event.clientY, moved: false, id: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", event => {
    if (event.pointerType === "touch" && skyPointers.has(event.pointerId)) {
      skyPointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (skyPinch && skyPointers.size >= 2) {
        const [a, b] = [...skyPointers.values()];
        const distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (distance > 1 && skyPinch.distance > 1) targetFov = Math.max(0.006, Math.min(defaultFov, skyPinch.fov * skyPinch.distance / distance));
        return;
      }
    }
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) pointerStart.moved = true;
    const sensitivity = 0.0032 * Math.max(0.006, cameraFov / defaultFov);
    yaw += dx * sensitivity;
    pitch = Math.max(-1.48, Math.min(1.48, pitch - dy * sensitivity));
    pointerStart.x = event.clientX;
    pointerStart.y = event.clientY;
  });
  function endPointer(event) {
    if (event.pointerType === "touch") {
      skyPointers.delete(event.pointerId);
      if (skyPinchUsed) {
        pointerStart = null;
        if (!skyPointers.size) { skyPinch = null; skyPinchUsed = false; canvas.classList.remove("dragging"); }
        return;
      }
    }
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const pointer = pointerStart;
    pointerStart = null;
    canvas.classList.remove("dragging");
    if (!pointer.moved && entry.classList.contains("leaving")) {
      if (constellationDirection && !eyeOffer.open) {
        const ray = rayForScreen(event.clientX, event.clientY);
        let nearest = -1, nearestDot = Math.cos(Math.min(0.085, cameraFov * 0.12));
        constellationStars.forEach((star, slot) => {
          const dot = ray.reduce((sum, value, axis) => sum + value * star.direction[axis], 0);
          if (dot > nearestDot) { nearestDot = dot; nearest = slot; }
        });
        if (nearest >= 0 && artworkAlongRay(ray, true) <= 0.85) { chooseConstellationStar(nearest); return; }
      }
      const work = artworkAt(event.clientX, event.clientY);
      if (work >= 0) showWork(work);
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  document.addEventListener("mousemove", event => {
    if ((document.pointerLockElement !== canvas && !fallbackMouseLook) || dialog.open || eyeOffer.open) return;
    if (event.movementX || event.movementY) constellationGuide = null;
    const sensitivity = 0.0032 * Math.max(0.006, cameraFov / defaultFov);
    yaw += event.movementX * sensitivity;
    pitch = Math.max(-1.48, Math.min(1.48, pitch - event.movementY * sensitivity));
  });
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    canvas.classList.toggle("mouse-camera", locked);
    lookHint.textContent = mouseCamera ? (locked || fallbackMouseLook ? "MOVE MOUSE TO LOOK" : "CLICK TO LOOK") : "DRAG TO LOOK";
  });
  document.addEventListener("pointerlockerror", () => {
    canLockMouse = false; fallbackMouseLook = true;
    canvas.classList.add("mouse-camera"); lookHint.textContent = "MOVE MOUSE TO LOOK";
  });

  canvas.addEventListener("wheel", event => {
    if (!constellationDirection || dialog.open || eyeOffer.open) return;
    event.preventDefault();
    targetFov = Math.max(0.006, Math.min(defaultFov, targetFov * Math.exp(event.deltaY * 0.0015)));
  }, { passive: false });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && fallbackMouseLook) { releaseCameraMouse(); event.preventDefault(); return; }
    if (eyeOffer.open) return;
    if (dialog.open) {
      if (event.key === "ArrowLeft") { event.preventDefault(); showWork((currentWork + 11) % 12); }
      if (event.key === "ArrowRight") { event.preventDefault(); showWork((currentWork + 1) % 12); }
      if (event.key === "+" || event.key === "=") { event.preventDefault(); applyZoom(zoomFactor * 1.25, true); }
      if (event.key === "-") { event.preventDefault(); applyZoom(zoomFactor / 1.25, true); }
      return;
    }
    if (event.key === "Enter" && experienceStarted && entry.classList.contains("leaving")) {
      event.preventDefault();
      if (focusedStar >= 0 && constellationDirection) chooseConstellationStar(focusedStar);
      else {
        const rect = canvas.getBoundingClientRect();
        const work = artworkAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (work >= 0) { releaseCameraMouse(); showWork(work); }
      }
      return;
    }
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "q", "e", " ", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", "control"].includes(key)) {
      if (key.startsWith("arrow") || key === " ") event.preventDefault();
      held.add(key);
    }
  });
  document.addEventListener("keyup", event => held.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => {
    held.clear();
    joystickVector[0] = joystickVector[1] = 0;
    skyPointers.clear(); skyPinch = null; skyPinchUsed = false; pointerStart = null;
    joystickPointer = null; joystickKnob.style.transform = "translate(0, 0)";
  });

  document.querySelectorAll("[data-move], [data-flight-key]").forEach(button => {
    const keyByDirection = { forward: "w", back: "s", left: "a", right: "d" };
    const key = button.dataset.flightKey || keyByDirection[button.dataset.move];
    button.addEventListener("pointerdown", event => { event.preventDefault(); held.add(key); button.setPointerCapture(event.pointerId); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => button.addEventListener(name, () => held.delete(key)));
  });

  const flightJoystick = document.getElementById("flight-joystick");
  const joystickKnob = document.getElementById("joystick-knob");
  let joystickPointer = null;
  function updateJoystick(event) {
    const rect = flightJoystick.getBoundingClientRect();
    const radius = rect.width * 0.36;
    let x = (event.clientX - rect.left - rect.width / 2) / radius;
    let y = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    if (length < 0.08) x = y = 0;
    joystickVector[0] = x; joystickVector[1] = y;
    joystickKnob.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
  }
  flightJoystick.addEventListener("pointerdown", event => {
    if (joystickPointer !== null) return;
    event.preventDefault(); joystickPointer = event.pointerId;
    flightJoystick.setPointerCapture(event.pointerId); updateJoystick(event);
  });
  flightJoystick.addEventListener("pointermove", event => { if (event.pointerId === joystickPointer) updateJoystick(event); });
  function releaseJoystick(event) {
    if (event.pointerId !== joystickPointer) return;
    joystickPointer = null; joystickVector[0] = joystickVector[1] = 0;
    joystickKnob.style.transform = "translate(0, 0)";
  }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => flightJoystick.addEventListener(name, releaseJoystick));

  function showWork(index) {
    currentWork = (index + 12) % 12;
    zoomFactor = 1;
    stage.classList.remove("zoomed");
    viewerFrame.style.width = "";
    viewerFrame.style.height = "";
    viewerFrame.classList.remove("rotated");
    detailLayer.replaceChildren();
    inspectTouches.clear();
    inspectSwipeStart = null;
    pinchDistance = 0;
    pinchUsed = false;
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
    // On phones, turn each whole painting to match the device's orientation.
    // Keep the established desktop presentation on larger screens.
    const mobileViewer = /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
      || window.matchMedia("(pointer: coarse) and (max-width: 900px) and (max-height: 900px)").matches;
    const devicePortrait = window.matchMedia("(orientation: portrait)").matches;
    const imageLandscape = dialogImage.naturalWidth > dialogImage.naturalHeight;
    const rotatedWork = mobileViewer ? (devicePortrait === imageLandscape) : !imageLandscape;
    viewerFrame.classList.toggle("rotated", rotatedWork);
    fitButton.textContent = mobileViewer ? "FILL" : "FIT";
    document.querySelector(".viewer-foot span:first-child").textContent = mobileViewer ? "DRAG TO EXPLORE" : "FULL WORK";
    document.querySelector(".viewer-foot span:last-child").textContent = mobileViewer ? "PINCH TO ZOOM" : "FIT TO SCREEN · 100% TO INSPECT PIXEL DETAIL";
    const fitWidth = mobileViewer ? stage.clientWidth : Math.min(stage.clientWidth, window.innerWidth * 0.96, 2400);
    const fitHeight = mobileViewer ? stage.clientHeight : Math.min(stage.clientHeight, window.innerHeight - 116);
    const visualWidth = rotatedWork ? dialogImage.naturalHeight : dialogImage.naturalWidth;
    const visualHeight = rotatedWork ? dialogImage.naturalWidth : dialogImage.naturalHeight;
    const fitScale = mobileViewer ? Math.max(fitWidth / visualWidth, fitHeight / visualHeight) : Math.min(fitWidth / visualWidth, fitHeight / visualHeight, 1);
    const detailImage = detailManifest && detailManifest.images[currentWork];
    const detailRatio = detailImage ? detailImage.width / dialogImage.naturalWidth : 1;
    const maxZoom = Math.max(1, detailRatio / fitScale);
    zoomFactor = Math.max(1, Math.min(maxZoom, nextFactor));
    const displayWidth = visualWidth * fitScale * zoomFactor;
    const displayHeight = visualHeight * fitScale * zoomFactor;
    viewerFrame.style.width = `${displayWidth}px`;
    viewerFrame.style.height = `${displayHeight}px`;
    dialogImage.style.width = `${rotatedWork ? displayHeight : displayWidth}px`;
    dialogImage.style.height = `${rotatedWork ? displayWidth : displayHeight}px`;
    detailLayer.style.width = dialogImage.style.width;
    detailLayer.style.height = dialogImage.style.height;
    stage.classList.toggle("zoomed", mobileViewer || zoomFactor > 1.001);
    zoomValue.textContent = `${Math.round(zoomFactor * 100)}%`;
    if (preserveCenter && oldWidth && oldHeight) {
      stage.scrollLeft = (stage.scrollLeft + stage.clientWidth / 2) * (displayWidth / oldWidth) - stage.clientWidth / 2;
      stage.scrollTop = (stage.scrollTop + stage.clientHeight / 2) * (displayHeight / oldHeight) - stage.clientHeight / 2;
    } else if (zoomFactor === 1) {
      stage.scrollTo(Math.max(0, (displayWidth - stage.clientWidth) / 2), Math.max(0, (displayHeight - stage.clientHeight) / 2));
    }
    queueDetailUpdate();
  }
  function queueDetailUpdate() {
    cancelAnimationFrame(detailFrame);
    detailFrame = requestAnimationFrame(updateVisibleDetail);
  }
  function updateVisibleDetail() {
    const info = detailManifest && detailManifest.images[currentWork];
    if (!dialog.open || !info || !dialogImage.naturalWidth) return;
    const imageRect = detailLayer.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const rotated = viewerFrame.classList.contains("rotated");
    const cssWidth = rotated ? imageRect.height : imageRect.width;
    const needsDetail = cssWidth * (window.devicePixelRatio || 1) > dialogImage.naturalWidth * 0.6;
    if (!needsDetail) { detailLayer.replaceChildren(); return; }
    const size = detailManifest.tileSize;
    const scale = cssWidth / info.width;
    const wanted = new Set();
    const margin = 128;
    for (let y = 0; y < info.height; y += size) {
      for (let x = 0; x < info.width; x += size) {
        const w = Math.min(size, info.width - x), h = Math.min(size, info.height - y);
        const left = imageRect.left + (rotated ? info.height - y - h : x) * scale;
        const top = imageRect.top + (rotated ? x : y) * scale;
        const width = (rotated ? h : w) * scale, height = (rotated ? w : h) * scale;
        if (left + width < stageRect.left - margin || left > stageRect.right + margin
          || top + height < stageRect.top - margin || top > stageRect.bottom + margin) continue;
        const key = `${x / size}-${y / size}`;
        wanted.add(key);
        if (detailLayer.querySelector(`[data-tile="${key}"]`)) continue;
        const tile = document.createElement("img");
        tile.alt = "";
        tile.draggable = false;
        tile.dataset.tile = key;
        tile.style.left = `${x / info.width * 100}%`;
        tile.style.top = `${y / info.height * 100}%`;
        tile.style.width = `${w / info.width * 100}%`;
        tile.style.height = `${h / info.height * 100}%`;
        tile.src = `artwork/detail/${String(currentWork + 1).padStart(2, "0")}/${key}.jpg`;
        detailLayer.appendChild(tile);
      }
    }
    for (const tile of [...detailLayer.children]) if (!wanted.has(tile.dataset.tile)) tile.remove();
  }
  stage.addEventListener("scroll", queueDetailUpdate, { passive: true });
  stage.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" || !dialog.open) return;
    event.preventDefault();
    stage.setPointerCapture(event.pointerId);
    inspectTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (inspectTouches.size === 1) {
      pinchUsed = false;
      inspectSwipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, left: stage.scrollLeft, top: stage.scrollTop };
    } else if (inspectTouches.size === 2) {
      const [a, b] = [...inspectTouches.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      pinchUsed = true;
      inspectSwipeStart = null;
    }
  });
  stage.addEventListener("pointermove", event => {
    const previous = inspectTouches.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    inspectTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (inspectTouches.size === 2) {
      const [a, b] = [...inspectTouches.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      const before = viewerFrame.getBoundingClientRect();
      const anchorX = (x - before.left) / before.width;
      const anchorY = (y - before.top) / before.height;
      if (pinchDistance > 0) applyZoom(zoomFactor * distance / pinchDistance);
      const after = viewerFrame.getBoundingClientRect();
      stage.scrollLeft += after.left + anchorX * after.width - x;
      stage.scrollTop += after.top + anchorY * after.height - y;
      pinchDistance = distance;
    } else if (inspectTouches.size === 1 && (zoomFactor > 1.001 || stage.scrollWidth > stage.clientWidth + 1 || stage.scrollHeight > stage.clientHeight + 1)) {
      stage.scrollLeft -= event.clientX - previous.x;
      stage.scrollTop -= event.clientY - previous.y;
    }
  });
  const endInspectPointer = event => {
    if (!inspectTouches.has(event.pointerId)) return;
    inspectTouches.delete(event.pointerId);
    if (event.type === "pointerup" && !pinchUsed && inspectSwipeStart && inspectSwipeStart.pointerId === event.pointerId) {
      const dx = event.clientX - inspectSwipeStart.x;
      const dy = event.clientY - inspectSwipeStart.y;
      const panned = Math.abs(stage.scrollLeft - inspectSwipeStart.left) > 2 || Math.abs(stage.scrollTop - inspectSwipeStart.top) > 2;
      if (!panned && zoomFactor <= 1.001 && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        showWork((currentWork + (dx < 0 ? 1 : 11)) % 12);
      }
    }
    inspectSwipeStart = null;
    pinchDistance = 0;
  };
  stage.addEventListener("pointerup", endInspectPointer);
  stage.addEventListener("pointercancel", endInspectPointer);
  dialogImage.addEventListener("load", () => applyZoom(zoomFactor));
  zoomInButton.addEventListener("click", () => applyZoom(zoomFactor * 1.25, true));
  zoomOutButton.addEventListener("click", () => applyZoom(zoomFactor / 1.25, true));
  fitButton.addEventListener("click", () => applyZoom(1));
  stage.addEventListener("wheel", event => {
    if (!event.ctrlKey || !dialog.open) return;
    event.preventDefault();
    applyZoom(zoomFactor * (event.deltaY < 0 ? 1.15 : 1 / 1.15), true);
  }, { passive: false });
  let viewerResizeFrame = 0;
  window.addEventListener("resize", () => {
    if (!dialog.open || !dialogImage.naturalWidth) return;
    cancelAnimationFrame(viewerResizeFrame);
    viewerResizeFrame = requestAnimationFrame(() => {
      viewerResizeFrame = requestAnimationFrame(() => applyZoom(zoomFactor));
    });
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
