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
  let artTexture;
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
      uniform sampler2D u_artAtlas;
      uniform vec2 u_resolution;
      uniform vec3 u_camera;
      uniform float u_yaw;
      uniform float u_pitch;
      uniform float u_fov;
      uniform float u_radius;
      uniform float u_time;
      const float PI = 3.14159265358979323846264;
      void main() {
        float aspect = u_resolution.x / u_resolution.y;
        float scale = tan(u_fov * 0.5);
        vec2 screen = v_uv * 2.0 - 1.0;
        vec3 forward = normalize(vec3(sin(u_yaw) * cos(u_pitch), sin(u_pitch), -cos(u_yaw) * cos(u_pitch)));
        vec3 right = normalize(vec3(cos(u_yaw), 0.0, sin(u_yaw)));
        vec3 up = normalize(cross(right, forward));
        vec3 ray = normalize(forward + right * screen.x * aspect * scale + up * screen.y * scale);
        float b = dot(u_camera, ray);
        float c = dot(u_camera, u_camera) - u_radius * u_radius;
        float discriminant = max(0.0, b * b - c);
        float distanceToShell = -b + sqrt(discriminant);
        vec3 positionOnShell = u_camera + ray * distanceToShell;
        vec3 normal = normalize(positionOnShell);
        float longitude = atan(normal.z, normal.x);
        float latitude = asin(clamp(normal.y, -1.0, 1.0));
        vec2 sphereUV = vec2(longitude / (2.0 * PI) + 0.5, 0.5 + latitude / PI);
        vec3 color = texture2D(u_sphere, sphereUV).rgb;

        // The room is spherical, but each painting is a flat tangent-facing plane.
        // That keeps its original proportions instead of stretching it over the shell.
        float nearestPanel = distanceToShell + 1.0;
        float halfWidth = u_radius * 0.27;
        float halfHeight = halfWidth / 1.5;
        for (int i = 0; i < 12; i++) {
          float index = float(i);
          float angle = (index - 4.0) * (PI / 6.0);
          vec3 panelNormal = normalize(vec3(sin(angle), 0.0, -cos(angle)));
          vec3 panelRight = normalize(vec3(cos(angle), 0.0, sin(angle)));
          vec3 panelCenter = panelNormal * (u_radius - 0.62);
          float denominator = dot(ray, panelNormal);
          if (abs(denominator) > 0.0001) {
            float panelDistance = dot(panelCenter - u_camera, panelNormal) / denominator;
            if (panelDistance > 0.0 && panelDistance < nearestPanel) {
              vec3 panelHit = u_camera + ray * panelDistance - panelCenter;
              vec2 panelUV = vec2(dot(panelHit, panelRight) / (halfWidth * 2.0) + 0.5,
                                  panelHit.y / (halfHeight * 2.0) + 0.5);
              if (panelUV.x >= 0.0 && panelUV.x <= 1.0 && panelUV.y >= 0.0 && panelUV.y <= 1.0) {
                float edge = min(min(panelUV.x, 1.0 - panelUV.x), min(panelUV.y, 1.0 - panelUV.y));
                float alpha = smoothstep(0.0, 0.17, edge);
                float column = mod(index, 4.0);
                float row = floor(index / 4.0);
                vec2 atlasUV = vec2((column + panelUV.x) / 4.0,
                                    1.0 - (row + 1.0 - panelUV.y) / 3.0);
                vec3 panelPaint = texture2D(u_artAtlas, atlasUV).rgb;
                color = mix(color, panelPaint, alpha);
                nearestPanel = panelDistance;
              }
            }
          }
        }

        // A low, warm ambient fill keeps dark passages legible; the slow moving key
        // gives the painted world a gentle change in light as the viewer travels.
        vec3 insideNormal = -normal;
        vec3 keyDirection = normalize(vec3(cos(u_time * 0.055), 0.58 + 0.08 * sin(u_time * 0.07), sin(u_time * 0.055)));
        float key = max(dot(insideNormal, keyDirection), 0.0);
        float bounce = 0.035 * (0.5 + 0.5 * sin(u_time * 0.12 + normal.x * 2.1 + normal.z * 1.7));
        vec3 ambient = vec3(0.58, 0.56, 0.53);
        vec3 warmKey = vec3(0.50, 0.37, 0.23) * key;
        color = color * (ambient + warmKey + vec3(bounce));
        color += vec3(0.06, 0.035, 0.015) * pow(key, 5.0);
        float vignette = 1.0 - 0.10 * dot(screen, screen);
        color = color * vignette;
        color = color / (vec3(0.94) + color * 0.08);
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

  function makeSphereTexture(images) {
    const width = 4096;
    const height = 2048;
    const tileWidth = width / 4;
    const tileHeight = height / 3;
    const map = document.createElement("canvas");
    map.width = width;
    map.height = height;
    const context = map.getContext("2d", { alpha: false });
    context.fillStyle = "#211b16";
    context.fillRect(0, 0, width, height);
    const colors = ["#ae7352", "#c69d63", "#7c7670", "#80645d", "#b9907c", "#bb9157", "#877d75", "#be8568", "#ab945f", "#779084", "#b69a62", "#a78470"];
    images.forEach((image, index) => {
      const x = (index % 4) * tileWidth;
      const y = Math.floor(index / 4) * tileHeight;
      context.fillStyle = colors[index];
      context.fillRect(x, y, tileWidth, tileHeight);
      if (!image) return;
      context.save();
      context.filter = "blur(112px) saturate(1.35) brightness(.62)";
      cover(context, image, x - 64, y - 64, tileWidth + 128, tileHeight + 128);
      context.restore();
    });
    const haze = document.createElement("canvas");
    haze.width = width;
    haze.height = height;
    const hazeContext = haze.getContext("2d");
    hazeContext.filter = "blur(92px)";
    hazeContext.drawImage(map, 0, 0);
    context.globalAlpha = 0.35;
    context.drawImage(haze, 0, 0);
    context.globalAlpha = 1;
    return map;
  }

  function makeArtAtlas(images) {
    const width = 4096;
    const tileWidth = width / 4;
    const tileHeight = 768;
    const atlas = document.createElement("canvas");
    atlas.width = width;
    atlas.height = tileHeight * 3;
    const context = atlas.getContext("2d", { alpha: false });
    context.fillStyle = "#29231f";
    context.fillRect(0, 0, atlas.width, atlas.height);
    images.forEach((image, index) => {
      if (!image) return;
      const x = (index % 4) * tileWidth;
      const y = Math.floor(index / 4) * tileHeight;
      const pad = 12;
      context.save();
      context.filter = "blur(24px) brightness(.7) saturate(1.2)";
      cover(context, image, x - pad, y - pad, tileWidth + pad * 2, tileHeight + pad * 2);
      context.restore();
      contain(context, image, x + pad, y + pad, tileWidth - pad * 2, tileHeight - pad * 2);
    });
    return atlas;
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
      const artAtlas = makeArtAtlas(images);
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pano);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      artTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, artTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artAtlas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, "u_artAtlas"), 1);
      gl.uniform1i(gl.getUniformLocation(program, "u_sphere"), 0);
      gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), canvas.width, canvas.height);
      gl.uniform3f(gl.getUniformLocation(program, "u_camera"), camera[0], camera[1], camera[2]);
      gl.uniform1f(gl.getUniformLocation(program, "u_yaw"), yaw);
      gl.uniform1f(gl.getUniformLocation(program, "u_pitch"), pitch);
      gl.uniform1f(gl.getUniformLocation(program, "u_fov"), Math.PI / 2.35);
      gl.uniform1f(gl.getUniformLocation(program, "u_radius"), radius);
      gl.uniform1f(gl.getUniformLocation(program, "u_time"), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      resize();
      loading.classList.add("done");
      render();
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
    gl.bindTexture(gl.TEXTURE_2D, artTexture);
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
    let closest = Infinity;
    let selected = 0;
    const halfWidth = radius * 0.27;
    const halfHeight = halfWidth / 1.5;
    for (let index = 0; index < 12; index += 1) {
      const angle = (index - 4) * (Math.PI / 6);
      const normal = [Math.sin(angle), 0, -Math.cos(angle)];
      const right = [Math.cos(angle), 0, Math.sin(angle)];
      const center = normal.map(value => value * (radius - 0.62));
      const denominator = ray[0] * normal[0] + ray[2] * normal[2];
      if (Math.abs(denominator) < 0.0001) continue;
      const distance = ((center[0] - camera[0]) * normal[0] + (center[2] - camera[2]) * normal[2]) / denominator;
      if (distance <= 0 || distance >= closest) continue;
      const hit = camera.map((value, axis) => value + ray[axis] * distance - center[axis]);
      const u = (hit[0] * right[0] + hit[2] * right[2]) / (halfWidth * 2) + 0.5;
      const v = hit[1] / (halfHeight * 2) + 0.5;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        closest = distance;
        selected = index;
      }
    }
    return selected;
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
    if (!pointer.moved && entry.classList.contains("leaving")) showWork(artworkAt(event.clientX, event.clientY));
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
