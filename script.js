(() => {
  const artwork = Array.from({ length: 12 }, (_, i) => `artwork/${String(i + 1).padStart(2, "0")}.jpg`);
  const skyAssets = Array.from({ length: 12 }, (_, i) => `artwork/pano/${String(i + 1).padStart(2, "0")}.jpg`);
  const canvas = document.getElementById("sky");
  const entry = document.getElementById("entry");
  const enterButton = document.getElementById("enter");
  const loading = document.getElementById("loading");
  const loadingValue = document.querySelector(".loading-value");
  const hint = document.getElementById("world-hint");
  const controls = document.getElementById("controls");
  const positionLabel = document.getElementById("position-value");
  const dialog = document.getElementById("art-viewer");
  const dialogImage = document.getElementById("viewer-image");
  const dialogIndex = document.getElementById("viewer-index");
  const stage = document.getElementById("viewer-stage");
  const modeButton = document.getElementById("mode-button");
  const held = new Set();
  const gl = canvas.getContext("webgl", { alpha: false, antialias: true, powerPreference: "high-performance" });

  if (!gl) {
    loading.innerHTML = '<span>This experience needs a browser with WebGL enabled.</span>';
    return;
  }

  let yaw = 0;
  let pitch = 0;
  let camera = [0, 0, 0];
  let radius = 14;
  let program;
  let texture;
  let artworkTexture;
  let artworkMap;
  let time = 0;
  let lastFrame = 0;
  let lastStamp = performance.now();
  let opened = false;
  let currentWork = 0;
  let pointerStart = null;
  let actualSize = false;

  const sources = [];
  let loaded = 0;
  skyAssets.forEach((url, index) => {
    const image = new Image();
    image.onload = () => {
      loaded += 1;
      loadingValue.textContent = `${String(Math.round((loaded / skyAssets.length) * 100)).padStart(2, "0")}%`;
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
      loadingValue.textContent = `${String(Math.round((loaded / skyAssets.length) * 100)).padStart(2, "0")}%`;
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
      uniform sampler2D u_sphere;
      uniform sampler2D u_artwork;
      uniform vec2 u_resolution;
      uniform vec3 u_camera;
      uniform float u_yaw;
      uniform float u_pitch;
      uniform float u_fov;
      uniform float u_radius;
      uniform float u_time;
      const float PI = 3.14159265358979323846264;
      const float POD_Y = 1.12;
      vec3 panelCenter(int index, float clock) {
        float column = float(index - (index / 4) * 4);
        float row = float(index / 4);
        float baseLongitude = (column - 1.5) * (PI * 0.5);
        float baseLatitude = 0.78 - row * 0.78;
        float speed = 0.035 * (1.0 + 0.08 * sin(float(index) * 1.7));
        float travel = clock * speed + float(index) * 0.025;
        float latitude = mod(baseLatitude - travel + 1.12, 2.24) - 1.12;
        float longitude = baseLongitude - travel * 0.72;
        return normalize(vec3(cos(latitude) * cos(longitude), sin(latitude), cos(latitude) * sin(longitude)));
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
        float c = dot(localCamera, localCamera) - u_radius * u_radius;
        float discriminant = max(0.0, b * b - a * c);
        float distanceToShell = (-b + sqrt(discriminant)) / a;
        vec3 localPositionOnShell = localCamera + localRay * distanceToShell;
        vec3 positionOnShell = vec3(localPositionOnShell.x, localPositionOnShell.y * POD_Y, localPositionOnShell.z);
        vec3 normal = normalize(vec3(localPositionOnShell.x, localPositionOnShell.y / POD_Y, localPositionOnShell.z));
        float longitude = atan(normal.z, normal.x);
        vec2 sphereUV = vec2(longitude / (2.0 * PI) + 0.5, 0.5 + normal.y * 0.5);
        vec3 color = texture2D(u_sphere, sphereUV).rgb;

        // Each work is a separate, undistorted panel sliding over the fixed shell.
        // Intersect the ray with a flat panel at its moving point on the shell.
        for (int i = 0; i < 12; i++) {
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
            vec2 panelUV = panelPoint / vec2(0.66, 0.44) * 0.5 + 0.5;
            float edge = max(abs(panelUV.x * 2.0 - 1.0), abs(panelUV.y * 2.0 - 1.0));
            float opacity = (1.0 - smoothstep(0.86, 1.0, edge)) * step(0.0, panelUV.x) * step(panelUV.x, 1.0) * step(0.0, panelUV.y) * step(panelUV.y, 1.0) * step(0.0, panelDistance);
            float column = float(i - (i / 4) * 4);
            float row = float(i / 4);
            vec2 atlasUV = vec2((column + panelUV.x) * 0.25, 1.0 - (row + (1.0 - panelUV.y)) / 3.0);
            vec3 painting = texture2D(u_artwork, atlasUV).rgb;
            color = mix(color, painting, opacity);
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
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
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

  function cover(ctx, image, x, y, width, height) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
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

  function makeSphereTexture(images) {
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const width = Math.min(4096, Math.floor(maxTextureSize / 8) * 8);
    const height = width / 2;
    const fallback = images.find(Boolean);
    const base = document.createElement("canvas");
    base.width = width / 2;
    base.height = height / 2;
    const baseContext = base.getContext("2d", { alpha: false });
    const baseTileWidth = base.width / 4;
    const baseTileHeight = base.height / 3;

    // Keep the shell's material fixed: this low-detail painting mosaic softly
    // joins the moving high-resolution panels without duplicating them underneath.
    images.forEach((loadedImage, index) => {
      const image = loadedImage || fallback;
      if (!image) return;
      const x = (index % 4) * baseTileWidth;
      const y = Math.floor(index / 4) * baseTileHeight;
      baseContext.save();
      baseContext.filter = "blur(34px) saturate(1.08) brightness(.94)";
      if (index === 0) drawLandscape(baseContext, image, cover, x - 18, y - 18, baseTileWidth + 36, baseTileHeight + 36);
      else cover(baseContext, image, x - 18, y - 18, baseTileWidth + 36, baseTileHeight + 36);
      baseContext.restore();
    });

    const map = document.createElement("canvas");
    map.width = width;
    map.height = height;
    const context = map.getContext("2d", { alpha: false });
    context.filter = `blur(${Math.round(width / 70)}px)`;
    context.drawImage(base, 0, 0, width, height);
    context.filter = "none";

    return map;
  }

  function makeArtworkAtlas(images) {
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const width = Math.min(8192, maxTextureSize);
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

  function loadHighResolutionImage(url) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  async function sharpenSphereArtwork(map) {
    const context = map.getContext("2d", { alpha: false });
    const tileWidth = map.width / 4;
    const tileHeight = map.height / 3;
    for (let index = 0; index < artwork.length; index += 1) {
      const image = await loadHighResolutionImage(artwork[index]);
      if (image) {
        const x = (index % 4) * tileWidth;
        const y = Math.floor(index / 4) * tileHeight;
        context.clearRect(x, y, tileWidth, tileHeight);
        if (index === 0) drawLandscape(context, image, contain, x, y, tileWidth, tileHeight);
        else contain(context, image, x, y, tileWidth, tileHeight);
        image.onload = null;
        image.onerror = null;
        image.removeAttribute("src");
      }
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.activeTexture(gl.TEXTURE0);
  }

  function buildWorld(images) {
    if (opened) return;
    opened = true;
    try {
      program = createProgram();
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const positionAttribute = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(positionAttribute);
      gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);
      const pano = makeSphereTexture(images);
      artworkMap = makeArtworkAtlas(images);
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pano);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      artworkTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artworkMap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.uniform1i(gl.getUniformLocation(program, "u_sphere"), 0);
      gl.uniform1i(gl.getUniformLocation(program, "u_artwork"), 1);
      gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), canvas.width, canvas.height);
      gl.uniform3f(gl.getUniformLocation(program, "u_camera"), camera[0], camera[1], camera[2]);
      gl.uniform1f(gl.getUniformLocation(program, "u_yaw"), yaw);
      gl.uniform1f(gl.getUniformLocation(program, "u_pitch"), pitch);
      gl.uniform1f(gl.getUniformLocation(program, "u_fov"), Math.PI / 2.35);
      gl.uniform1f(gl.getUniformLocation(program, "u_radius"), radius);
      gl.uniform1f(gl.getUniformLocation(program, "u_time"), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
      resize();
      loading.classList.add("done");
      render();
      sharpenSphereArtwork(artworkMap).catch(error => console.warn("High-resolution sphere artwork was unavailable", error));
    } catch (error) {
      console.error("Sphere could not be prepared", error);
      loading.innerHTML = '<span>The sphere could not be opened in this browser.</span>';
      loading.classList.remove("done");
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const width = Math.max(1, Math.round(window.innerWidth * dpr));
    const height = Math.max(1, Math.round(window.innerHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      if (program) gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), width, height);
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform3f(gl.getUniformLocation(program, "u_camera"), camera[0], camera[1], camera[2]);
    gl.uniform1f(gl.getUniformLocation(program, "u_yaw"), yaw);
    gl.uniform1f(gl.getUniformLocation(program, "u_pitch"), pitch);
    gl.uniform1f(gl.getUniformLocation(program, "u_time"), time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  enterButton.addEventListener("click", () => {
    entry.classList.add("leaving");
    hint.hidden = false;
    controls.hidden = false;
    document.getElementById("position").hidden = false;
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
    const podY = 1.12;
    const localCamera = [camera[0], camera[1] / podY, camera[2]];
    const localRay = [ray[0], ray[1] / podY, ray[2]];
    const a = localRay[0] ** 2 + localRay[1] ** 2 + localRay[2] ** 2;
    const b = localCamera[0] * localRay[0] + localCamera[1] * localRay[1] + localCamera[2] * localRay[2];
    const c = localCamera[0] ** 2 + localCamera[1] ** 2 + localCamera[2] ** 2 - radius ** 2;
    const distance = (-b + Math.sqrt(Math.max(0, b * b - a * c))) / a;
    const localHit = localCamera.map((value, axis) => value + localRay[axis] * distance);
    const normalLength = Math.hypot(localHit[0], localHit[2], localHit[1] / podY);
    const surfaceNormal = [localHit[0] / normalLength, (localHit[1] / podY) / normalLength, localHit[2] / normalLength];
    for (let index = 0; index < 12; index += 1) {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const baseLongitude = (column - 1.5) * Math.PI / 2;
      const baseLatitude = 0.78 - row * 0.78;
      const travel = time * 0.035 * (1 + 0.08 * Math.sin(index * 1.7)) + index * 0.025;
      const latitude = ((baseLatitude - travel + 1.12) % 2.24 + 2.24) % 2.24 - 1.12;
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
      const px = (panelOffset[0] * tangentRight[0] + panelOffset[1] * tangentRight[1] + panelOffset[2] * tangentRight[2]) / radius / 0.66;
      const py = (panelOffset[0] * tangentUp[0] + panelOffset[1] * tangentUp[1] + panelOffset[2] * tangentUp[2]) / radius / 0.44;
      if (Math.abs(px) <= 1 && Math.abs(py) <= 1) return index;
    }
    return -1;
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

  document.querySelectorAll("[data-move]").forEach(button => {
    const keyByDirection = { forward: "w", back: "s", left: "a", right: "d" };
    const key = keyByDirection[button.dataset.move];
    button.addEventListener("pointerdown", event => { event.preventDefault(); held.add(key); button.setPointerCapture(event.pointerId); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => button.addEventListener(name, () => held.delete(key)));
  });

  function showWork(index) {
    currentWork = (index + 12) % 12;
    actualSize = false;
    stage.classList.remove("actual-size");
    modeButton.textContent = "100%";
    modeButton.setAttribute("aria-pressed", "false");
    stage.scrollTo(0, 0);
    dialogImage.src = artwork[currentWork];
    dialogImage.alt = `Abstract painting ${String(currentWork + 1).padStart(2, "0")}`;
    dialogIndex.textContent = `${String(currentWork + 1).padStart(2, "0")} / 12`;
    if (!dialog.open) dialog.showModal();
  }

  document.getElementById("close-viewer").addEventListener("click", () => dialog.close());
  document.getElementById("prev").addEventListener("click", () => showWork((currentWork + 11) % 12));
  document.getElementById("next").addEventListener("click", () => showWork((currentWork + 1) % 12));
  modeButton.addEventListener("click", () => {
    actualSize = !actualSize;
    stage.classList.toggle("actual-size", actualSize);
    modeButton.textContent = actualSize ? "FIT" : "100%";
    modeButton.setAttribute("aria-pressed", String(actualSize));
    stage.scrollTo(0, 0);
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
