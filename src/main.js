"use strict";
new Q5("global");

const pi = Math.PI;

// ============================================================================
// SOFTBODY PHYSICS CLASSES (Mostly Unchanged, with minor tweaks)
// ============================================================================

class Node {
  constructor(pos, fixed = false) {
    this.pos = pos;
    this.vel = new Vector(0, 0);
    this.acc = new Vector(0, 0);
    this.fixed = fixed;
  }
  update(substeps, friction) {
    if (this.fixed) return;
    this.vel.mult(Math.pow(friction, 1 / substeps));
    this.pos.add(Vector.mult(this.vel, 1 / substeps));
    this.acc.mult(0);
  }
}

class Edge {
  constructor(n1, n2, len, amul, rmul) {
    this.n1 = n1;
    this.n2 = n2;
    this.len = len;
    this.amul = amul; // Attraction multiplier
    this.rmul = rmul; // Repulsion multiplier
  }
  update() {
    const sep = Vector.sub(this.n2.pos, this.n1.pos);
    const dist = sep.mag();
    if (dist === 0) return; // Avoid division by zero

    const force = (dist - this.len) * (dist < this.len ? this.rmul : this.amul);

    sep.normalize();
    sep.mult(force);
    this.n1.acc.add(sep);
    sep.mult(-1);
    this.n2.acc.add(sep);
  }
}

// Helper function for collision detection
function distToSegmentSquared(p, v, w) {
  var l2 = v.distSq(w);
  if (l2 == 0) return p.distSq(v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return p.distSq(
    new Vector(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y))
  );
}

// ============================================================================
// NEW JELLYBALL CLASS
// ============================================================================

const JELLO_AMUL = 0.1;   // Attraction: how much it pulls back. Lower = more stretchy.
const JELLO_RMUL = 0.4;   // Repulsion: how much it resists compression.
const JELLO_PRESSURE = 0.00005; // How much it tries to maintain its volume.
const NODE_FRICTION = 0.99; // Damping/friction for nodes.

class JellyBall {
  constructor(x, y, radius, color) {
    this.center = new Vector(x, y);
    this.radius = radius;
    this.color = color;
    this.nodes = [];
    this.edges = [];
    this.isSettled = false;
    this.id = random(100000); // Unique ID for tracking

    // Create the nodes around the circumference
    const numNodes = Math.ceil(radius / 4); // More nodes for bigger balls
    for (let i = 0; i < numNodes; i++) {
      const angle = map(i, 0, numNodes, 0, 2 * pi);
      const pos = new Vector(x + cos(angle) * radius, y + sin(angle) * radius);
      this.nodes.push(new Node(pos));
    }

    // Create edges connecting the nodes
    for (let i = 0; i < numNodes; i++) {
      // Edge to next node
      this.edges.push(new Edge(this.nodes[i], this.nodes[(i + 1) % numNodes], radius * 2 * pi / numNodes, JELLO_AMUL, JELLO_RMUL));
      // Add cross-bracing for stability
      this.edges.push(new Edge(this.nodes[i], this.nodes[(i + Math.floor(numNodes / 2)) % numNodes], radius * 2, JELLO_AMUL, JELLO_RMUL));
    }
    
    this.targetArea = pi * radius * radius;
  }

  // Polygon area calculation from your original script
  getArea() {
    let total = 0;
    const vertices = this.nodes.map(n => n.pos);
    for (let i = 0, l = vertices.length; i < l; i++) {
      let addX = vertices[i].x;
      let addY = vertices[i == vertices.length - 1 ? 0 : i + 1].y;
      let subX = vertices[i == vertices.length - 1 ? 0 : i + 1].x;
      let subY = vertices[i].y;
      total += (addX * addY * 0.5) - (subX * subY * 0.5);
    }
    return Math.abs(total);
  }

  update(gravity) {
    // 1. Update edges (spring forces)
    for (const edge of this.edges) {
      edge.update();
    }
    
    // 2. Apply pressure force to maintain volume
    const area = this.getArea();
    const pressureForce = (this.targetArea - area) * JELLO_PRESSURE;
    for (let i = 0; i < this.nodes.length; i++) {
        const prv = this.nodes[(i - 1 + this.nodes.length) % this.nodes.length].pos;
        const cur = this.nodes[i].pos;
        const nxt = this.nodes[(i + 1) % this.nodes.length].pos;
        const norm1 = Vector.sub(cur, nxt).rotate(pi / 2).normalize();
        const norm2 = Vector.sub(prv, cur).rotate(pi / 2).normalize();
        const bisector = norm1.add(norm2).normalize();
        this.nodes[i].acc.add(bisector.copy().mult(pressureForce));
    }

    // 3. Apply external forces and update nodes
    let avgVel = new Vector(0,0);
    for (const node of this.nodes) {
      node.acc.add(gravity);
      node.vel.add(node.acc);
      node.update(SUBSTEPS, NODE_FRICTION);
      avgVel.add(node.vel);
    }
    
    // 4. Update the ball's center position
    this.center.set(0, 0);
    for (const node of this.nodes) {
        this.center.add(node.pos);
    }
    this.center.div(this.nodes.length);
    
    // 5. Check if the ball has settled
    avgVel.div(this.nodes.length);
    if (avgVel.mag() < 0.05) {
        this.isSettled = true;
    } else {
        this.isSettled = false;
    }
  }

  draw() {
    // Smoothed hull drawing from your original script
    let hull = this.nodes.map(node => node.pos);
    fill(this.color);
    noStroke();
    
    beginShape();
    for(const point of hull) {
      vertex(point.x, point.y);
    }
    endShape(CLOSE);
  }

  // Simple collision with other jelly balls
  handleBallCollision(otherBall) {
    const distVec = Vector.sub(this.center, otherBall.center);
    const dist = distVec.mag();
    const totalRadius = this.radius + otherBall.radius;
    
    if (dist < totalRadius) {
        const overlap = totalRadius - dist;
        const forceDir = distVec.normalize();
        const forceMagnitude = overlap * 0.1; // Repulsion force
        
        for (const node of this.nodes) {
            node.acc.add(forceDir.copy().mult(forceMagnitude));
        }
        for (const node of otherBall.nodes) {
            node.acc.add(forceDir.copy().mult(-forceMagnitude));
        }
    }
  }

  // Simple collision with the walls
  handleWallCollision(box) {
    for (const node of this.nodes) {
        // Floor
        if (node.pos.y > box.bottom) {
            node.pos.y = box.bottom;
            node.vel.y *= -0.3; // Bounce
        }
        // Left wall
        if (node.pos.x < box.left) {
            node.pos.x = box.left;
            node.vel.x *= -0.3;
        }
        // Right wall
        if (node.pos.x > box.right) {
            node.pos.x = box.right;
            node.vel.x *= -0.3;
        }
    }
  }
}

// ============================================================================
// GAME LOGIC AND SETUP
// ============================================================================

const SUBSTEPS = 5; // Run physics this many times per frame for stability
const GRAVITY = new Vector(0, 0.15);
const COLORS = ['#ff6b6b', '#48dbfb', '#1dd1a1', '#feca57']; // Red, Blue, Green, Yellow
const BOX_WIDTH = 400;
const BOX_HEIGHT = 600;

let gameBox;
let allBalls = [];
let currentBall = null;
let score = 0;
let spawnNextFrame = true;

function setup() {
  createCanvas(BOX_WIDTH, BOX_HEIGHT);
  
  gameBox = {
    left: 0,
    right: BOX_WIDTH,
    bottom: BOX_HEIGHT,
    top: 0
  };
}

function spawnNewBall() {
    const radius = random(20, 40);
    const color = random(COLORS);
    const x = gameBox.right / 2;
    const y = gameBox.top - radius; // Spawn just above the screen
    currentBall = new JellyBall(x, y, radius, color);
    allBalls.push(currentBall);
    spawnNextFrame = false;
}

function checkAndClearConnections() {
    const settledBalls = allBalls.filter(b => b.isSettled);
    if (settledBalls.length === 0) return;

    // 1. Build a graph of touching, same-colored balls
    const adj = new Map();
    for (const ball of settledBalls) adj.set(ball.id, []);

    for (let i = 0; i < settledBalls.length; i++) {
        for (let j = i + 1; j < settledBalls.length; j++) {
            const b1 = settledBalls[i];
            const b2 = settledBalls[j];
            const touchDist = b1.radius + b2.radius + 5; // 5px buffer
            if (b1.color === b2.color && b1.center.dist(b2.center) < touchDist) {
                adj.get(b1.id).push(b2.id);
                adj.get(b2.id).push(b1.id);
            }
        }
    }
    
    // 2. Find balls touching left and right walls
    const leftWallBalls = new Set(settledBalls.filter(b => b.center.x - b.radius < gameBox.left + 5).map(b => b.id));
    const rightWallBalls = new Set(settledBalls.filter(b => b.center.x + b.radius > gameBox.right - 5).map(b => b.id));

    if (leftWallBalls.size === 0 || rightWallBalls.size === 0) return;

    // 3. Use Breadth-First Search (BFS) to find a path from left to right
    let ballsToClear = new Set();
    const q = [];
    const visited = new Set();

    // Start BFS from all balls touching the left wall
    for (const startId of leftWallBalls) {
        q.push([startId, [startId]]); // [currentId, path]
        visited.add(startId);
    }
    
    let pathFound = false;
    while (q.length > 0) {
        const [currentId, path] = q.shift();

        if (rightWallBalls.has(currentId)) {
            // Path found! Mark all balls in this path for clearing.
            path.forEach(id => ballsToClear.add(id));
            pathFound = true;
        }

        const neighbors = adj.get(currentId) || [];
        for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                const newPath = [...path, neighborId];
                q.push([neighborId, newPath]);
            }
        }
    }

    // 4. If a connection was found, clear the balls and add score
    if (ballsToClear.size > 0) {
        score += ballsToClear.size * 10;
        allBalls = allBalls.filter(b => !ballsToClear.has(b.id));
        if (currentBall && ballsToClear.has(currentBall.id)) {
            currentBall = null; // Should not happen, but for safety
        }
    }
}


function draw() {
    background('#383838');

    // -- SPAWN LOGIC --
    if (spawnNextFrame) {
        spawnNewBall();
    }
    
    // -- PLAYER INPUT --
    if (currentBall) {
        const moveSpeed = 0.5;
        if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) { // Left or A
            for(const node of currentBall.nodes) node.acc.x -= moveSpeed;
        }
        if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) { // Right or D
            for(const node of currentBall.nodes) node.acc.x += moveSpeed;
        }
        if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) { // Down or S
            for(const node of currentBall.nodes) node.acc.y += moveSpeed * 0.5;
        }
    }

    // -- PHYSICS UPDATE --
    for (let i = 0; i < SUBSTEPS; i++) {
        // Ball-to-ball collisions
        for (let i = 0; i < allBalls.length; i++) {
            for (let j = i + 1; j < allBalls.length; j++) {
                allBalls[i].handleBallCollision(allBalls[j]);
            }
        }
        // Update all balls
        for (const ball of allBalls) {
            ball.update(GRAVITY);
            ball.handleWallCollision(gameBox);
        }
    }

    // -- DRAWING --
    for (const ball of allBalls) {
        ball.draw();
    }
    
    // -- GAME STATE & CLEARING LOGIC --
    if (currentBall && currentBall.isSettled) {
        currentBall = null; // The ball has landed
        checkAndClearConnections();
        spawnNextFrame = true; // Flag to spawn a new ball
    } else if (!currentBall && !spawnNextFrame) {
        // If no ball is falling, and we are not about to spawn one,
        // it means the board is static. Run one more check.
        checkAndClearConnections();
        spawnNextFrame = true;
    }
    
    // -- UI --
    fill(255);
    textSize(24);
    textAlign(CENTER, TOP);
    text(`Score: ${score}`, width / 2, 10);
}
