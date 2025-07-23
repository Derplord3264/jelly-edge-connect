"use strict";
new Q5("global");

const pi = Math.PI;

// ============================================================================
// ORIGINAL SOFTBODY PHYSICS CLASSES (RESTORED)
// ============================================================================

class Node {
  constructor(pos, fixed = false) {
    this.pos = pos;
    this.vel = new Vector(0, 0);
    this.acc = new Vector(0, 0);
    this.fixed = fixed;
  }
  // Restored original update method
  update(substeps) {
    if(this.fixed) return;
    this.vel.mult(Math.pow(0.99, 1 / substeps));
    this.pos.add(Vector.mult(this.vel, 1 / substeps));
    this.acc.mult(0);
  }
}

class Edge {
  // Restored original constructor with 'vavg'
  constructor(n1, n2, len, amul, rmul, vavg = false) {
    this.n1 = n1;
    this.n2 = n2;
    this.len = len;
    this.amul = amul;
    this.rmul = rmul;
    this.vavg = vavg; // Velocity averaging for damping
  }
  // Restored original update method
  update() {
    const sep = Vector.sub(this.n2.pos, this.n1.pos);
    const dist = sep.mag();
    let force;
    // Your original force calculation
    if(dist < this.len) force = min(0, dist - max(6, this.len)) * this.rmul;
    else force = max(0, dist - (this.len)) * this.amul;
    
    if (dist > 0) sep.normalize();
    sep.mult(force);
    this.n1.acc.add(sep);
    sep.mult(-1);
    this.n2.acc.add(sep);
    
    // Your original velocity averaging logic
    if(this.vavg) {
      const veldiff = Vector.sub(this.n2.vel, this.n1.vel);
      this.n1.acc.add(veldiff.mult(0.4));
      this.n2.acc.add(veldiff.mult(-0.4));
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS FROM ORIGINAL SCRIPT
// ============================================================================

function shuffle(a) {
  for(let i = a.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function polygonArea(vertices) {
  let total = 0;
  for(let i = 0, l = vertices.length; i < l; i++) {
    let addX = vertices[i].x;
    let addY = vertices[i == vertices.length - 1 ? 0 : i + 1].y;
    let subX = vertices[i == vertices.length - 1 ? 0 : i + 1].x;
    let subY = vertices[i].y;
    total += (addX * addY * 0.5) - (subX * subY * 0.5);
  }
  return Math.abs(total);
}

// ============================================================================
// NEW SOFTBODY CLASS (Wrapper for your original logic)
// ============================================================================

const AMUL = 0.6; // Original value
const RMUL = 0.6; // Original value
const SUBSTEPS = 10; // Original value
const GRAVITY = new Vector(0, 0.2); // Original value

class SoftBody {
    constructor(x, y, radius, color) {
        this.center = new Vector(x, y);
        this.radius = radius;
        this.color = color;
        this.isSettled = false;
        this.id = random(100000);

        this.nodes = [];
        this.edges = [];
        this.bisectors = [];

        // Create nodes and edges using your original method
        const numNodes = 40; // Hardcoded from original script
        for (let i = 0; i < numNodes; i++) {
            const angle = map(i, 0, numNodes, 0, 2 * pi);
            const pos = new Vector(x + cos(angle) * radius, y + sin(angle) * radius);
            this.nodes.push(new Node(pos));
            this.bisectors.push(new Vector(0, 0));
        }

        const edgeLen = this.nodes[0].pos.dist(this.nodes[1].pos);
        for (let i = 0; i < numNodes; i++) {
            this.edges.push(new Edge(this.nodes[i], this.nodes[(i + 1) % numNodes], edgeLen, AMUL, RMUL, true));
        }

        this.targetArea = polygonArea(this.nodes.map(n => n.pos));
    }

    // This method contains the physics loop from your original script
    updatePhysics() {
        shuffle(this.edges);
        for (const edge of this.edges) {
            edge.update();
        }

        // Pressure force from your original script
        const area = polygonArea(this.nodes.map(node => node.pos));
        const pressureForce = (this.targetArea - area) * 0.001;
        for (let i = 0; i < this.nodes.length; i++) {
            const prv = this.nodes[(i - 1 + this.nodes.length) % this.nodes.length].pos;
            const cur = this.nodes[i].pos;
            const nxt = this.nodes[(i + 1) % this.nodes.length].pos;
            const norm1 = Vector.sub(cur, nxt).rotate(pi / 2).normalize();
            const norm2 = Vector.sub(prv, cur).rotate(pi / 2).normalize();
            this.bisectors[i] = norm1.add(norm2).normalize();
            this.nodes[i].acc.add(this.bisectors[i].copy().mult(pressureForce));
        }
        
        // Apply gravity and update velocity
        let avgVelMag = 0;
        for (const node of this.nodes) {
            node.acc.add(GRAVITY);
            node.vel.add(node.acc);
            avgVelMag += node.vel.mag();
        }
        
        // Check if settled
        avgVelMag /= this.nodes.length;
        this.isSettled = avgVelMag < 0.1;

        // Substep updates from your original script
        for (let i = 0; i < SUBSTEPS; i++) {
            for (const node of this.nodes) {
                node.update(SUBSTEPS);
            }
        }

        // Update center position
        this.center.set(0, 0);
        for (const node of this.nodes) {
            this.center.add(node.pos);
        }
        this.center.div(this.nodes.length);
    }
    
    // Drawing logic from your original script
    draw() {
        let hull = this.nodes.map(node => node.pos);
        fill(this.color);
        noStroke();
        beginShape();
        for(const point of hull) {
            vertex(point.x, point.y);
        }
        endShape(CLOSE);
        
        // The smoothing part from your script to make it look round
        stroke(this.color);
        strokeWeight(8);
        const h = i => hull[(i + hull.length) % hull.length];
        let hull2 = [];
        for(let i = 0; i < hull.length; i++) {
            hull2.push(h(i));
            let num = round(h(i).dist(h(i + 1)) / 5);
            for(let j = 1; j < num; j++) {
                hull2.push(Vector.sub(h(i + 1), h(i)).mult(j / num).add(h(i)));
            }
        }
        hull = hull2;
        for(let _ = 0; _ < 3; _++) {
            hull2 = [];
            for(let i = 0; i < hull.length; i++) {
                hull2.push(Vector.add(Vector.add(h(i), h(i + 1)), h(i - 1)).div(3));
            }
            hull = hull2;
        }
        for(let i = 0; i < hull.length; i++) {
            line(h(i).x, h(i).y, h(i + 1).x, h(i + 1).y);
        }
    }

    // Simplified collision logic for the game
    handleCollisions(box, otherBodies) {
        // Wall collisions
        for (const node of this.nodes) {
            if (node.pos.y > box.bottom - 4) { node.pos.y = box.bottom - 4; node.vel.y *= -0.3; }
            if (node.pos.x < box.left + 4)   { node.pos.x = box.left + 4;   node.vel.x *= -0.3; }
            if (node.pos.x > box.right - 4)  { node.pos.x = box.right - 4;  node.vel.x *= -0.3; }
        }
        // Body-to-body collisions
        for(const other of otherBodies) {
            if (this.id === other.id) continue;
            const distVec = Vector.sub(this.center, other.center);
            const dist = distVec.mag();
            const totalRadius = this.radius + other.radius;
            
            if (dist < totalRadius) {
                const overlap = totalRadius - dist;
                const forceDir = dist > 0 ? distVec.normalize() : Vector.random2D();
                const force = forceDir.mult(overlap * 0.05); // Gentle repulsion
                for(const node of this.nodes) node.acc.add(force);
                for(const node of other.nodes) node.acc.sub(force);
            }
        }
    }
}

// ============================================================================
// GAME LOGIC AND SETUP
// ============================================================================

const COLORS = ['#ff6b6b', '#48dbfb', '#1dd1a1', '#feca57']; // Red, Blue, Green, Yellow
const BOX_WIDTH = 400;
const BOX_HEIGHT = 600;

let gameBox;
let allBodies = [];
let currentBody = null;
let score = 0;
let spawnNextFrame = true;

function setup() {
  createCanvas(BOX_WIDTH, BOX_HEIGHT);
  
  gameBox = { left: 0, right: BOX_WIDTH, bottom: BOX_HEIGHT, top: 0 };
}

function spawnNewBody() {
    const radius = random(25, 45);
    const color = random(COLORS);
    const x = gameBox.right / 2;
    const y = gameBox.top - radius;
    currentBody = new SoftBody(x, y, radius, color);
    allBodies.push(currentBody);
    spawnNextFrame = false;
}

function checkAndClearConnections() {
    const settledBodies = allBodies.filter(b => b.isSettled);
    if (settledBodies.length === 0) return;

    // 1. Build adjacency graph for same-colored, touching bodies
    const adj = new Map(settledBodies.map(b => [b.id, []]));
    for (let i = 0; i < settledBodies.length; i++) {
        for (let j = i + 1; j < settledBodies.length; j++) {
            const b1 = settledBodies[i];
            const b2 = settledBodies[j];
            const touchDist = b1.radius + b2.radius + 10; // Buffer
            if (b1.color === b2.color && b1.center.dist(b2.center) < touchDist) {
                adj.get(b1.id).push(b2.id);
                adj.get(b2.id).push(b1.id);
            }
        }
    }
    
    // 2. Find bodies touching left and right walls
    const leftWallBodies = new Set(settledBodies.filter(b => b.center.x - b.radius < gameBox.left + 10).map(b => b.id));
    const rightWallBodies = new Set(settledBodies.filter(b => b.center.x + b.radius > gameBox.right - 10).map(b => b.id));

    if (leftWallBodies.size === 0 || rightWallBodies.size === 0) return;

    // 3. Use BFS to find all connected groups that span the box
    const bodiesToClear = new Set();
    const visited = new Set();

    for (const startId of leftWallBodies) {
        if (visited.has(startId)) continue;
        
        const q = [startId];
        const component = new Set([startId]);
        visited.add(startId);
        let reachesRightWall = false;

        let head = 0;
        while(head < q.length){
            const currentId = q[head++];
            if(rightWallBodies.has(currentId)) reachesRightWall = true;

            for(const neighborId of adj.get(currentId) || []){
                if(!visited.has(neighborId)){
                    visited.add(neighborId);
                    component.add(neighborId);
                    q.push(neighborId);
                }
            }
        }
        // If this component spans from left to right, mark it for clearing
        if (reachesRightWall) {
            component.forEach(id => bodiesToClear.add(id));
        }
    }

    // 4. Clear the marked bodies
    if (bodiesToClear.size > 0) {
        score += bodiesToClear.size * 10;
        allBodies = allBodies.filter(b => !bodiesToClear.has(b.id));
        if (currentBody && bodiesToClear.has(currentBody.id)) {
            currentBody = null;
        }
    }
}


function draw() {
    background('#383838');

    if (spawnNextFrame) {
        spawnNewBody();
    }
    
    // Player Input
    if (currentBody && !currentBody.isSettled) {
        const moveForce = 0.5;
        if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) {
            for(const node of currentBody.nodes) node.acc.x -= moveForce;
        }
        if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) {
            for(const node of currentBody.nodes) node.acc.x += moveForce;
        }
        if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) {
            for(const node of currentBody.nodes) node.acc.y += moveForce * 0.5;
        }
    }

    // Update, Collide, and Draw
    for (const body of allBodies) {
        body.handleCollisions(gameBox, allBodies);
        body.updatePhysics();
        body.draw();
    }
    
    // Game State Logic
    if (currentBody && currentBody.isSettled) {
        currentBody = null; // The ball has landed
        checkAndClearConnections();
        spawnNextFrame = true;
    } else if (!currentBody && !spawnNextFrame) {
        // If everything has settled, check for clears and spawn next
        spawnNextFrame = allBodies.every(b => b.isSettled);
        if (spawnNextFrame) checkAndClearConnections();
    }
    
    // UI
    fill(255);
    noStroke();
    textSize(24);
    textAlign(CENTER, TOP);
    text(`Score: ${score}`, width / 2, 10);
}
