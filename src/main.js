import * as THREE from 'three'
import  * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import GUI from 'lil-gui'
import * as CANNON from 'cannon-es'

// const gui = new GUI()

const physicsWorld = new CANNON.World({
    gravity: new CANNON.Vec3(0, -50, 0)
})
physicsWorld.defaultContactMaterial.restitution = .3;
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

const canvas = document.querySelector("canvas.webGl")
console.log(canvas)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(40, sizes.width/sizes.height, 1, 10000)
camera.position.set(0,12,20)
camera.tar

scene.add(camera)

// LIGHTING
const ambient = new THREE.AmbientLight(0xffffff, .1)
const point01 = new THREE.PointLight('#ffffff', 12,20,1)
point01.position.set(3, 4.2, 1.2)
const point02 = new THREE.PointLight('#ffffff', 10,20,1)
point02.position.set(-1.2, 3, -1.2)
point01.castShadow = true
point02.castShadow = true
scene.add(point01,point02, ambient)

function createFloor() {
    
    // Three.js (visible) object
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.MeshStandardMaterial({
           color:0x20,
           roughness:.8,
           metalness:.2
        })
    )
    floor.receiveShadow = true;
    floor.quaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI * .5);
    scene.add(floor);

    // Cannon-es (physical) object
    const floorBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
    });
    floorBody.position.copy(floor.position);
    floorBody.quaternion.copy(floor.quaternion);
    physicsWorld.addBody(floorBody);
}
createFloor()


const params = { 
    segments: 68,
    edgeRadius: 0.04,
    notchRadius: 0.1,
    notchDepth: 0.09

}

function createDiceGeometry() {
    let boxGeometry = new THREE.BoxGeometry(1, 1, 1, params.segments, params.segments, params.segments);
    const positionAttribute = boxGeometry.attributes.position;
    const subCubeHalfSize = .5 - params.edgeRadius;


    //I don't really understand this math much but we're essentially clipping a cosine wave
    const notchWave = (v) => {
        v = (1 / params.notchRadius) * v;
        v = Math.PI * Math.max(-1, Math.min(1, v));
        return params.notchDepth * (Math.cos(v) + 1.);
    }
    const notch = (pos) => notchWave(pos[0]) * notchWave(pos[1]);


    for (let i = 0; i < positionAttribute.count; i++) {

        let position = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
        const subCube = new THREE.Vector3(
            Math.sign(position.x),
            Math.sign(position.y),
            Math.sign(position.z)
        ).multiplyScalar(subCubeHalfSize);

        const offset = .25;

        const addition = new THREE.Vector3().subVectors(position, subCube)

        // modify position.x, position.y and position.z
        if(Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize){
            //position is close to box vertex
            addition.normalize().multiplyScalar(params.edgeRadius);
            position = subCube.add(addition)

         } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize ){
            addition.z = 0;
            addition.normalize().multiplyScalar(params.edgeRadius)
            position.x = subCube.x + addition.x
            position.y = subCube.y + addition.y
        } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.y = 0;
            addition.normalize().multiplyScalar(params.edgeRadius)
            position.x = subCube.x + addition.x
            position.z = subCube.z + addition.z
        } else if (Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
            addition.x = 0;
            addition.normalize().multiplyScalar(params.edgeRadius)
            position.y = subCube.y + addition.y
            position.z = subCube.z + addition.z
        }

        if (position.y === .5) {
            position.y -= notch([position.x, position.z]);
        } else if (position.x === .5) {
            position.x -= notch([position.y + offset, position.z + offset]);
            position.x -= notch([position.y - offset, position.z - offset]);
        } else if (position.z === .5) {
            position.z -= notch([position.x - offset, position.y + offset]);
            position.z -= notch([position.x, position.y]);
            position.z -= notch([position.x + offset, position.y - offset]);
        } else if (position.z === -.5) {
            position.z += notch([position.x + offset, position.y + offset]);
            position.z += notch([position.x + offset, position.y - offset]);
            position.z += notch([position.x - offset, position.y + offset]);
            position.z += notch([position.x - offset, position.y - offset]);
        } else if (position.x === -.5) {
            position.x += notch([position.y + offset, position.z + offset]);
            position.x += notch([position.y + offset, position.z - offset]);
            position.x += notch([position.y, position.z]);
            position.x += notch([position.y - offset, position.z + offset]);
            position.x += notch([position.y - offset, position.z - offset]);
        } else if (position.y === -.5) {
            position.y += notch([position.x + offset, position.z + offset]);
            position.y += notch([position.x + offset, position.z]);
            position.y += notch([position.x + offset, position.z - offset]);
            position.y += notch([position.x - offset, position.z + offset]);
            position.y += notch([position.x - offset, position.z]);
            position.y += notch([position.x - offset, position.z - offset]);
        }

        positionAttribute.setXYZ(i, position.x, position.y, position.z);
    }


    boxGeometry.deleteAttribute('normal')
    boxGeometry = BufferGeometryUtils.mergeVertices(boxGeometry)
    boxGeometry.computeVertexNormals()
    return boxGeometry;
}

function createInnerGeometry() {
    
    // keep the plane size equal to flat surface of cube
    const innerGeometry = new THREE.BoxGeometry(.96, .96,.96)
    return innerGeometry
}

function createDiceMesh() {
    const diceMaterialOuter = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: .1,
        metalness: .1,
    })
    const diceMaterialInner = new THREE.MeshStandardMaterial({
        color: 0x0f0f0f,
        roughness: .1,
        metalness: .9,
    })

    const diceMesh = new THREE.Group()
    const innerMesh = new THREE.Mesh(createInnerGeometry(), diceMaterialInner)
    const outerMesh = new THREE.Mesh(createDiceGeometry(), diceMaterialOuter)

    outerMesh.castShadow = true

    diceMesh.add(outerMesh, innerMesh)
    return diceMesh
}
const diceArray = []

const diceMesh = createDiceMesh()
for (let i = 0; i < 2; i++) {
    diceArray.push(createDice());
}

function createDice() {
    const mesh = diceMesh.clone();
    scene.add(mesh);

    const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(.5, .5, .5)),
    });
    physicsWorld.addBody(body);

    return {mesh, body};
}


const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.setSize(sizes.width, sizes.height)
renderer.shadowMap.enabled = true

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
console.log(controls)

throwDice()
const tick = () =>{
    physicsWorld.fixedStep()

    for (const dice of diceArray) {
        dice.mesh.position.copy(dice.body.position)
        dice.mesh.quaternion.copy(dice.body.quaternion);
    }

    controls.update()
    renderer.render(scene,camera)
    requestAnimationFrame(tick)
}
tick()
function throwDice() {
    diceArray.forEach((d, dIdx) => {

        d.body.velocity.setZero();
        d.body.angularVelocity.setZero();

        d.body.position = new CANNON.Vec3(5, 5+dIdx * 1.2, 0); // the floor is placed at y = -7
        d.mesh.position.copy(d.body.position);

        d.mesh.rotation.set(2 * Math.PI * Math.random(), 0, 2 * Math.PI * Math.random())
        d.body.quaternion.copy(d.mesh.quaternion);

        const force = 3 + 5 * Math.random();
        d.body.applyImpulse(
            new CANNON.Vec3(-force, force, 0)
        );
    });
}

const button = document.querySelector(".rollbutton")
button.addEventListener('click', throwDice)
