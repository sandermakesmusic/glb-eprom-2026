import {
Engine, Scene, ArcRotateCamera, Vector3, Color4, Color3, 
PointLight, TransformNode, MeshBuilder, StandardMaterial, 
DynamicTexture, Mesh
} from "@babylonjs/core";

import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
//import { SolidParticleSystem } from "@babylonjs/core/Particles/solidParticleSystem";
//import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
//import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Material } from "@babylonjs/core/Materials/material";

import "@babylonjs/loaders/glTF";

const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas, true);

engine.setHardwareScalingLevel(1 / window.devicePixelRatio);

const scene = new Scene(engine);
scene.clearColor = new Color4(0, 0, 0, 1);

scene.imageProcessingConfiguration.exposure = 2;
scene.imageProcessingConfiguration.contrast = 2;

// Environment Texture
const environmentTexture = CubeTexture.CreateFromPrefilteredData(
  "/textures/studio.env",
  scene
);

scene.environmentTexture = environmentTexture;
scene.environmentIntensity = 1;

// Camera
const INITIAL_CAMERA = {
alpha: 2.8387,
beta: 1.422,
radius: 25.5959,
fov: 0.3839724354387525,
target: new Vector3(0.0, 0.0, 0.0)
};

const camera = new ArcRotateCamera(
"camera",
INITIAL_CAMERA.alpha,
INITIAL_CAMERA.beta,
INITIAL_CAMERA.radius,
INITIAL_CAMERA.target.clone(),
scene
);

camera.attachControl(canvas, true);
camera.inertia = 0.96;
camera.wheelPrecision = 100;
camera.minZ = 0.1;
camera.maxZ = 100;
camera.lowerRadiusLimit = 0.01;
camera.upperRadiusLimit = 1000;
camera.fov = INITIAL_CAMERA.fov;

// Rendering pipeline
const pipeline = new DefaultRenderingPipeline(
"defaultPipeline",
true,
scene,
[camera]
);

pipeline.samples = 4;

pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.8;
pipeline.bloomWeight = 0.25;
pipeline.bloomKernel = 64;
pipeline.bloomScale = .5;

// Camera controls
const panel = document.createElement("div");

panel.style.cssText = `  position:fixed;
  top:16px;
  left:16px;
  z-index:1000;
  padding:12px;
  background:rgba(0,0,0,.75);
  color:#fff;
  font:12px/1.5 monospace;
  border-radius:4px;
  user-select:none;`;

panel.innerHTML = ` <b>CAMERA</b><br>
alpha <input id="cam-alpha" type="text" style="width:80px"><br>
beta <input id="cam-beta" type="text" style="width:80px"><br>
radius <input id="cam-radius" type="text" style="width:80px"><br>
FOV ° <input id="cam-fov" type="text" style="width:80px">

  <div style="font-weight:bold;margin:8px 0 4px">TARGET</div>

X <input id="cam-target-x" type="text" style="width:80px"><br>
Y <input id="cam-target-y" type="text" style="width:80px"><br>
Z <input id="cam-target-z" type="text" style="width:80px">

  <div style="margin-top:10px">
    <button id="cam-copy">Copy values</button>
    <button id="cam-reset">Reset</button>
  </div>
`;

document.body.appendChild(panel);

document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "c" && document.activeElement?.tagName !== "INPUT") {
    panel.style.display = panel.style.display === "none" ? "" : "none";
  }
});

const inputs = {
alpha: document.getElementById("cam-alpha"),
beta: document.getElementById("cam-beta"),
radius: document.getElementById("cam-radius"),
fov: document.getElementById("cam-fov"),
x: document.getElementById("cam-target-x"),
y: document.getElementById("cam-target-y"),
z: document.getElementById("cam-target-z")
};

function updatePanel() {
  if (document.activeElement !== inputs.alpha) { inputs.alpha.value = camera.alpha.toFixed(4); }

  if (document.activeElement !== inputs.beta) { inputs.beta.value = camera.beta.toFixed(4); }

  if (document.activeElement !== inputs.radius) { inputs.radius.value = camera.radius.toFixed(4); }

  if (document.activeElement !== inputs.fov) { inputs.fov.value = (camera.fov * 180 / Math.PI).toFixed(2); }

  if (document.activeElement !== inputs.x) { inputs.x.value = camera.target.x.toFixed(4); }

  if (document.activeElement !== inputs.y) { inputs.y.value = camera.target.y.toFixed(4); }

  if (document.activeElement !== inputs.z) { inputs.z.value = camera.target.z.toFixed(4); }
}

function applyCamera() {
  const values = { alpha: Number(inputs.alpha.value), beta: Number(inputs.beta.value), radius: Number(inputs.radius.value), fov: Number(inputs.fov.value) };

  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) {
      continue;
    }


    if (key === "fov") {
      camera[key] = value * Math.PI / 180;
    } else {
      camera[key] = value;
    }
  }

  const target = [ inputs.x.value, inputs.y.value, inputs.z.value ].map(Number);

  if (target.every(Number.isFinite)) {
    camera.target.set(...target);
  }
}

const RANDOM_CAMERA_DURATION = 300;

let randomCameraAnimation = null;

function randomRange(min, max) { return min + Math.random() * (max - min); }

function easeInOutCubic(value) {
  if (value < 0.5) { return 4 * value * value * value; }
  return 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function randomCameraView() {
  const start = { alpha: camera.alpha, beta: camera.beta, radius: camera.radius };

  const end = { alpha: randomRange(0, Math.PI * 2), beta: randomRange(70 * Math.PI / 180, 110 * Math.PI / 180), radius: randomRange(5, 30) };

  const startTime = performance.now();

  if (randomCameraAnimation !== null) {
    cancelAnimationFrame(randomCameraAnimation);
  }

  function animate(now) {
    const progress = Math.min( 1, (now - startTime) / RANDOM_CAMERA_DURATION );
    const eased = easeInOutCubic(progress);
    camera.alpha = start.alpha + (end.alpha - start.alpha) * eased;
    camera.beta = start.beta + (end.beta - start.beta) * eased;
    camera.radius = start.radius + (end.radius - start.radius) * eased;
    if (progress < 1) {
      randomCameraAnimation = requestAnimationFrame(animate);
    } else {
      randomCameraAnimation = null;
    }

    updatePanel();
  }

  randomCameraAnimation = requestAnimationFrame(animate);
}

for (const input of Object.values(inputs)) {
  input.addEventListener("input", applyCamera);

  input.addEventListener("change", () => { applyCamera(); updatePanel();});

  input.addEventListener("blur", updatePanel);
}

document.getElementById("cam-reset").addEventListener("click", () => {
  camera.alpha = INITIAL_CAMERA.alpha;
  camera.beta = INITIAL_CAMERA.beta;
  camera.radius = INITIAL_CAMERA.radius;
  camera.fov = INITIAL_CAMERA.fov;
  camera.target.copyFrom(INITIAL_CAMERA.target);

  updatePanel();  
});

document.getElementById("cam-copy").addEventListener("click", async () => {
const text = `camera.alpha = ${camera.alpha};
camera.beta = ${camera.beta};
camera.radius = ${camera.radius};
camera.fov = ${camera.fov};

camera.target = new Vector3( ${camera.target.x}, ${camera.target.y}, ${camera.target.z} );`;

try {
await navigator.clipboard.writeText(text);
} catch {
console.log(text);
}
});

const randomButton = document.createElement("button");

randomButton.textContent = "RANDOM VIEW";

randomButton.style.cssText = `  position:fixed;
  left:16px;
  bottom:16px;
  z-index:1000;
  padding:10px 14px;
  background:rgba(0,0,0,.75);
  color:#fff;
  border:1px solid rgba(255,255,255,.35);
  border-radius:4px;
  font:12px monospace;
  cursor:pointer;`;

randomButton.addEventListener("click", () => {
  stopRotation();
  randomCameraView();
});

document.body.appendChild(randomButton);


// Kelvin → RGB
function kelvinToColor3(kelvin) {
const temperature = Math.max(1000, Math.min(40000, kelvin)) / 100;

let red;
let green;
let blue;

if (temperature <= 66) {
  red = 255;
  green = 99.4708025861 * Math.log(temperature) - 161.1195681661;
  blue = temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
  } else {
  red = 329.698727446 * Math.pow(temperature - 60, -0.1332047592);
  green = 288.1221695283 * Math.pow(temperature - 60, -0.0755148492);
  blue = 255;
}

return new Color3(
  Math.max(0, Math.min(255, red)) / 255, Math.max(0, Math.min(255, green)) / 255, Math.max(0, Math.min(255, blue)) / 255
  );
}

// Model
const MODEL_SCALE = 20;
const MODEL_ROTATION_SPEED = 0.025;
const ROTATION_RESUME_DELAY = 3000;
const ROTATION_ACCELERATION = 3;

// Lights
const LIGHT_TEMPERATURE = 7600;
const LIGHT_INTENSITY = 10;
const LIGHT_RANGE = 30;

// Visible bulb
const LIGHT_BULB_SIZE = 0.35;
const LIGHT_BULB_EMISSIVE = 8;

let modelRoot = null;
let rotationSpeed = 0;
let rotationTarget = MODEL_ROTATION_SPEED;
let rotationResumeTimer = null;

function stopRotation() {
rotationTarget = 0;

if (rotationResumeTimer !== null) {
  clearTimeout(rotationResumeTimer);
}

rotationResumeTimer = setTimeout(() => {
rotationTarget = MODEL_ROTATION_SPEED;
rotationResumeTimer = null;
}, ROTATION_RESUME_DELAY);
}

canvas.addEventListener("pointerdown", stopRotation);

// Dust Setup

TransformNode.BillboardUseParentOrientation = true;
const DUST_COUNT = 500;
const DUST_OPACITY = 0.05;

// Texture Creation
const dustTexture = new DynamicTexture("dustMoteTexture", { width: 64, height: 64 }, scene, false);
const dustContext = dustTexture.getContext();

dustContext.clearRect(0, 0, 64, 64);

const dustGradient = dustContext.createRadialGradient(32, 32, 0, 32, 32, 32);
dustGradient.addColorStop(0, "rgba(255,255,255," + DUST_OPACITY + ")");
dustGradient.addColorStop(0.25, "rgba(255,255,255," + (DUST_OPACITY * 0.87) + ")");
dustGradient.addColorStop(0.55, "rgba(255,255,255," + (DUST_OPACITY * 0.77) + ")");
dustGradient.addColorStop(0.8, "rgba(255,255,255," + (DUST_OPACITY * 0.074) + ")");
dustGradient.addColorStop(1, "rgba(255,255,255,0)");

dustContext.fillStyle = dustGradient;

dustContext.fillRect(0, 0, 64, 64);
dustTexture.update();

// Material
const dustMaterial = new StandardMaterial("dustMoteMaterial", scene);
dustMaterial.diffuseTexture = dustTexture;
dustMaterial.diffuseTexture.hasAlpha = true;
dustMaterial.useAlphaFromDiffuseTexture = true;
dustMaterial.diffuseColor = new Color3(1, 1, 1);
dustMaterial.emissiveColor = new Color3(0.78, 0.75, 0.71);
dustMaterial.disableLighting = true;
dustMaterial.backFaceCulling = false;
dustMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;

// Load Model
async function loadModel() {
  const result = await ImportMeshAsync(
  "/models/scene-opt-webp.glb",
  scene
  );

  const sticker8 = scene.getMeshByName("Sticker8");

  if (sticker8?.material) {
    console.log("found sticker8 material.");
    sticker8.material.alphaIndex = 100;
    sticker8.renderingGroupId = 1;
  }

  //scene.getMeshByName("Sticker11")?.forceSharedVertices();
  //scene.getMeshByName("Sticker5")?.forceSharedVertices();
/*
  const sticker3 = scene.getMeshByName("Sticker3");

  if (sticker3?.material) {
    sticker3.material.alphaIndex = 99;
    sticker3.renderingGroupId = 1;
  }*/

  for (const texture of scene.textures) {
  texture.updateSamplingMode(3);
  texture.anisotropicFilteringLevel = 4;
  }

  // Overhead lights
  const lightColor = kelvinToColor3(LIGHT_TEMPERATURE);

  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
    const position = new Vector3( x * 8, 8, z * 8 );

      // Actual light source
      const light = new PointLight( `pointLight_${x}_${z}`, position.clone(), scene );

      light.diffuse = lightColor;
      light.specular = lightColor;
      light.intensity = LIGHT_INTENSITY;
      light.range = LIGHT_RANGE;

      // Visible bulb
      const bulb = MeshBuilder.CreateSphere( `lightBulb_${x}_${z}`, { diameter: LIGHT_BULB_SIZE, segments: 16 }, scene );
      bulb.position.copyFrom(position);
      const bulbMaterial = new StandardMaterial( `lightBulbMaterial_${x}_${z}`, scene );

      bulbMaterial.disableLighting = true;
      bulbMaterial.emissiveColor = lightColor.scale(LIGHT_BULB_EMISSIVE);
      bulbMaterial.specularColor = new Color3(0, 0, 0);

      bulb.material = bulbMaterial;
    }
  }

  // Rotation + Scaling
  modelRoot = new TransformNode( "modelRotationRoot", scene );

  const roots = result.meshes.filter( mesh => mesh.parent === null );

  for (const root of roots) {
    root.parent = modelRoot;
    root.scaling.scaleInPlace(MODEL_SCALE);
  }

  // Dust
  for (let i = 0; i < DUST_COUNT; i++) {
    const mote = MeshBuilder.CreatePlane(`dustMote_${i}`, { size: 1 }, scene);

    mote.parent = modelRoot;

    mote.position.x = -10 + Math.random() * 20;
    mote.position.y = -10 + Math.random() * 20;
    mote.position.z = -10 + Math.random() * 20;

    const size = 0.018 + Math.random() * 0.037;
    mote.scaling.set(size, size, size);

    mote.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mote.material = dustMaterial;
    mote.isPickable = false;
  }

  //console.log("Dust meshes:", scene.meshes.filter(m => m.name.indexOf("dustMote_") === 0).length);

  camera.alpha = INITIAL_CAMERA.alpha;
  camera.beta = INITIAL_CAMERA.beta;
  camera.radius = INITIAL_CAMERA.radius;
  camera.fov = INITIAL_CAMERA.fov;
  camera.target.copyFrom(INITIAL_CAMERA.target);

  updatePanel();
}

loadModel().catch(error => { console.error("Failed to load GLB:", error); });

engine.runRenderLoop(() => {
  const delta = engine.getDeltaTime() / 1000;

  rotationSpeed += (rotationTarget - rotationSpeed) * Math.min(1, ROTATION_ACCELERATION * delta);

  if (modelRoot) {
    modelRoot.rotation.y += rotationSpeed * delta;
  }

  updatePanel();
  scene.render();
});

window.addEventListener("resize", () => {
  engine.resize(); engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
});