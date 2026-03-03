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

// Configurations
const GRID_SIZE = 20;
const CAMERA_POS = new Vector3(20, 20, 20);
const GRID_COLOR = new Color3(0.5, 0.5, 0.5);
const GOAL_COLOR = new Color3(0.2, 0.9, 0.1);
const NUM_BLOCKS = 20;
const RIBBON_WIDTH = 0.1;


// Interaction
const selectedBlock = {
  material: StandardMaterial,
  color: Color3
};

let tempMaterial: StandardMaterial;
let tempColor: Color3;

let tempX = 0;
let tempY = 0;
let isDragging = true;
const PICKED_COLOR = new Color3(0.9, 0.9, 0.1);


function randomNumbers(len: number) {
  let values = Array.from({ length: len }, () => Math.random());

  // Normalize so they sum to 1
  const sum = values.reduce((a, b) => a + b, 0);
  return values.map(v => v / sum);
}


// Add a ribbon that runs along points
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

// Create scene graph
const createScene = (): Scene => {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 1);

  const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 4, 75, new Vector3(0, 5, 0), scene);
  camera.setPosition(CAMERA_POS);
  camera.attachControl(canvas, true);

  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 1.2;


  const grid: GroundMesh = MeshBuilder.CreateGround("grid", {
    width: GRID_SIZE,
    height: GRID_SIZE,
    subdivisions: GRID_SIZE 
  }, scene);
  const gridMaterial = new GridMaterial("gridMaterial", scene);
  gridMaterial.majorUnitFrequency = 5;
  gridMaterial.minorUnitVisibility = 0.5;
  gridMaterial.mainColor = new Color3(0.1, 0.1, 0.1);
  gridMaterial.lineColor = GRID_COLOR;
  gridMaterial.backFaceCulling = false; // Disable back-face culling for the grid
  grid.material = gridMaterial;
  grid.position.y = -0.001;


  const ribbonPoints = [];

  const dupes = new Set<string>();

  for (let i = 0; i < NUM_BLOCKS; i++) {
    let height = Math.random() * 5 + 1;

    const x = Math.floor(Math.random() * GRID_SIZE) - GRID_SIZE / 2 + 0.5;
    const z = Math.floor(Math.random() * GRID_SIZE) - GRID_SIZE / 2 + 0.5;

    const key = `${x}:${z}`;
    if (dupes.has(key)) {
      continue;
    } else {
      dupes.add(key);
    }

    if (Math.abs(x) < 3 && Math.abs(z) < 3) {
      height = Math.random() * 12 + 3;
    }

    const blockMaterial = new StandardMaterial("blockMaterial", scene);
    blockMaterial.diffuseColor = height > 5 ? GOAL_COLOR : new Color3(0.8, 0.8, 0.8);
    blockMaterial.alpha = 0.9;


    // Tapered block (top is smaller)
    const ratios = randomNumbers(4)
    let posY = 0;

    for (let i = 0; i < ratios.length; i++) {
      const ratio = ratios[i];

      // anchored at center
      if (i === 0) {
        posY = 0.5 * (height * ratio);
      } else {
        posY += 0.5 * (height * ratios[i - 1]) + 0.5 * (height * ratio);
      }

      const block = MeshBuilder.CreateCylinder("taperedCube", {
          height: height * ratio,
          diameterTop: 0.2 + Math.random() * 0.8,
          diameterBottom: 0.2 + Math.random() * 0.8,
          tessellation: 6
      }, scene);
      block.position = new Vector3(x, posY, z);
      block.material = blockMaterial;
    }

    
    /*
    const testRandom = 0.75;
    const block = MeshBuilder.CreateCylinder("taperedCube", {
        height: height * (testRandom),
        diameterTop: 0.25,
        diameterBottom: 0.75,
        tessellation: 6
    }, scene);
    // block.position = new Vector3(x, height / 2, z);
    block.position = new Vector3(x, (height * testRandom) / 2, z);
    block.material = blockMaterial;


    
    const block2 = MeshBuilder.CreateCylinder("taperedCube", {
        height: height * (1 - testRandom),
        diameterTop: 0.55,
        diameterBottom: 0.75,
        tessellation: 6
    }, scene);
    // block2.position = new Vector3(x, height / 2, z);
    block2.position = new Vector3(x, (height / 2) + 1.5 * (height * (1 - testRandom)), z);
    block2.material = blockMaterial;
    */
   




    // Regular block
    // const block = MeshBuilder.CreateBox("box", { size: 0.5, height: height }, scene);
    // block.position = new Vector3(x, height / 2, z);
    // block.metadata = {
    //   id: i,
    //   height: height
    // };


    if (height > 5) {
      ribbonPoints.push({
        x, y: height, z
      });
    }
  }

  // Sort from highest to lowest
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
