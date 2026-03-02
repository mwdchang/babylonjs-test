// TODO
// Treeshaking: https://doc.babylonjs.com/setup/frameworkPackages/es6Support
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { GridMaterial } from "@babylonjs/materials/grid";
import { GroundMesh } from "@babylonjs/core/Meshes/groundMesh";
import { Curve3 } from "@babylonjs/core/Maths/math.path";
import { PointerEventTypes } from "@babylonjs/core";
import { TextBlock, AdvancedDynamicTexture, Control } from "@babylonjs/gui";

const text = new TextBlock();

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);

const CAMERA_POS = new Vector3(20, 20, 20);
const GRID_COLOR = new Color3(0.5, 0.5, 0.5);
const GOAL_COLOR = new Color3(0.2, 0.9, 0.1);

const NUM_BLOCKS = 60;
const RIBBON_WIDTH = 0.2;

let tempMaterial: StandardMaterial;
let tempColor: Color3;
let tempX = 0;
let tempY = 0;
let isDragging = true;
const PICKED_COLOR = new Color3(0.9, 0.9, 0.1);

const addRibbon = (points: { x: number, y: number, z: number }[], color: Color3, scene: Scene) => {
  const vector3Points = points.map(p => new Vector3(p.x, p.y, p.z));
  const curve = Curve3.CreateCatmullRomSpline(vector3Points, 10, false);
  const pathPoints = curve.getPoints();

  const ribbonWidth = RIBBON_WIDTH;
  const path1: Vector3[] = [];
  const path2: Vector3[] = [];

  for (let i = 0; i < pathPoints.length; i++) {
    let tangent: Vector3;
    if (i < pathPoints.length - 1) {
      tangent = pathPoints[i + 1].subtract(pathPoints[i]).normalize();
    } else {
      tangent = pathPoints[i].subtract(pathPoints[i - 1]).normalize();
    }

    // Calculate a perpendicular vector in the XZ plane
    const perpendicular = new Vector3(-tangent.z, 0, tangent.x).normalize();

    path1.push(pathPoints[i].add(perpendicular.scale(ribbonWidth / 2)));
    path2.push(pathPoints[i].subtract(perpendicular.scale(ribbonWidth / 2)));
  }

  const ribbon = MeshBuilder.CreateRibbon("ribbon", { pathArray: [path1, path2] }, scene);
  const material = new StandardMaterial("ribbonMaterial", scene);
  material.diffuseColor = color;
  material.alpha = 0.8;
  material.backFaceCulling = false;

  ribbon.material = material;
  return ribbon;
}

const createScene = (): Scene => {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 1);

  const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 4, 75, new Vector3(0, 5, 0), scene);
  camera.setPosition(CAMERA_POS);
  camera.attachControl(canvas, true);

  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 1.2;

  const gridSize = 20;

  const grid: GroundMesh = MeshBuilder.CreateGround("grid", {
    width: gridSize,
    height: gridSize,
    subdivisions: gridSize
  }, scene);
  const gridMaterial = new GridMaterial("gridMaterial", scene);
  gridMaterial.majorUnitFrequency = 5;
  gridMaterial.minorUnitVisibility = 0.5;
  gridMaterial.mainColor = new Color3(0.1, 0.1, 0.1);
  gridMaterial.lineColor = GRID_COLOR;
  gridMaterial.backFaceCulling = false; // Disable back-face culling for the grid
  grid.material = gridMaterial;


  const ribbonPoints = [];

  const dupes = new Set<string>();

  for (let i = 0; i < NUM_BLOCKS; i++) {
    const blockMaterial = new StandardMaterial("blockMaterial", scene);
    blockMaterial.diffuseColor = new Color3(0.8, 0.8, 0.8);
    blockMaterial.alpha = 0.9;


    let height = Math.random() * 5 + 1;

    const x = Math.floor(Math.random() * gridSize) - gridSize / 2 + 0.5;
    const z = Math.floor(Math.random() * gridSize) - gridSize / 2 + 0.5;

    const key = `${x}:${z}`;
    if (dupes.has(key)) {
      console.log(key);
      continue;
    } else {
      dupes.add(key);
    }

    if (Math.abs(x) < 3 && Math.abs(z) < 3) {
      height = Math.random() * 12 + 3;
    }
    const block = MeshBuilder.CreateBox("box", { size: 0.5, height: height }, scene);
    block.metadata = {
      id: i,
      height: height
    };

    block.position = new Vector3(x, height / 2, z);
    block.material = blockMaterial;

    if (height > 5) {
      blockMaterial.diffuseColor = GOAL_COLOR;
      ribbonPoints.push({
        x, y: height, z
      });
    }
  }

  ribbonPoints.sort((a, b) => {
    return b.y - a.y;
  });

  addRibbon(ribbonPoints, GOAL_COLOR, scene);


  // Picking logic
  scene.onPointerObservable.add((pointerInfo) => {
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERDOWN:
        tempX = pointerInfo.event.clientX;
        tempY = pointerInfo.event.clientY;
        isDragging = false;
        break;
      case PointerEventTypes.POINTERMOVE:
        const dx = pointerInfo.event.clientX - tempX;
        const dy = pointerInfo.event.clientY - tempY;

        if (Math.sqrt(dx * dx + dy * dy) > 5.0) {
          isDragging = true;
        }
        break;
      case PointerEventTypes.POINTERUP:
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit && pickResult.pickedMesh && isDragging === false) {

          const metadata = pickResult.pickedMesh.metadata;
          if (metadata) {
            console.log(metadata);
            text.text = `block ${metadata.id}, height = ${metadata.height.toFixed(2)}`;
          } else {
            text.text = '';
          }

          if (tempMaterial) {
            (tempMaterial as StandardMaterial).diffuseColor = tempColor;
          }

          const pickedMaterial = pickResult.pickedMesh.material;
          if (pickedMaterial) {
            tempColor = (pickedMaterial as StandardMaterial).diffuseColor;
            (pickedMaterial as StandardMaterial).diffuseColor = PICKED_COLOR;
            tempMaterial = pickedMaterial as StandardMaterial;
          }

          /*
          const pickedMesh = pickResult.pickedMesh as Mesh & { _blockIndex?: number };
          if (pickedMesh._blockIndex !== undefined) {
            console.log("Block clicked: Index =", pickedMesh._blockIndex, "Name =", pickedMesh.name);
          }
          */
        } else {
          if (tempMaterial) {
            (tempMaterial as StandardMaterial).diffuseColor = tempColor;
            text.text = '';
          }
        }
        break;
    }
  });

  const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
  // Create text
  text.text = "";
  text.color = "white";
  text.fontSize = 16;
  text.top = "-45%";   // position
  text.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  text.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

  advancedTexture.addControl(text);

  return scene;
};

const scene = createScene();



engine.runRenderLoop(function () {
  scene.render();
});

window.addEventListener("resize", function () {
  engine.resize();
});
