// Global references from previous scripts (audio.js, generator.js)
// are used directly for offline file:// support.

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimization: opaque canvas

// Reusable offscreen canvas for lighting optimization
const lightingCanvas = document.createElement('canvas');
const lctx = lightingCanvas.getContext('2d');

const STATES = { MENU: 'MENU', PLAYING: 'PLAYING' };
let currentState = STATES.MENU;
let gameMode = 'SPEEDRUN'; // 'SPEEDRUN' or 'CHILL'

let puzzle = null;
let player = { x: 0, y: 0, visualX: 0, visualY: 0 };
let target = { x: 0, y: 0 };
let isMoving = false;
let moveDir = { x: 0, y: 0 };
let particles = [];
let transitionAlpha = 1;
let levelCount = 0;
let shake = 0;
let time = 0;

// Speedrun specific
let maxTime = 20;
let timeLeft = 20;

// Menu specific - Now a horizontal line
const menuGrid = [
    [1, 1, 1, 1, 1, 1, 1]
];
const menuGridSize = { w: 7, h: 1 };
const menuStart = { x: 3, y: 0 };
const menuGoalLeft = { x: 0, y: 0 }; // Speedrun
const menuGoalRight = { x: 6, y: 0 }; // Adventure
let menuPlayer = { x: 3, y: 0, visualX: 3, visualY: 0 };

function init() {
    resize();
    requestAnimationFrame(loop);
}

function startGame(mode) {
    gameMode = mode;
    currentState = STATES.PLAYING;
    levelCount = 0;
    maxTime = 20;
    newLevel();
}

function returnToMenu() {
    currentState = STATES.MENU;
    menuPlayer = { x: menuStart.x, y: menuStart.y, visualX: menuStart.x, visualY: menuStart.y };
    isMoving = false;
    transitionAlpha = 1;
}

function newLevel() {
    const prevGoal = puzzle ? { x: puzzle.goal.x, y: puzzle.goal.y } : null;
    levelCount++;
    const size = gameMode === 'CHILL' ? 50 : 25;
    puzzle = generatePuzzle(size, prevGoal, gameMode);
    player.x = puzzle.start.x;
    player.y = puzzle.start.y;
    player.visualX = player.x;
    player.visualY = player.y;
    transitionAlpha = 1;
    particles = [];
    timeLeft = maxTime;
}

function resize() {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.95;
    canvas.width = size;
    canvas.height = size;
    lightingCanvas.width = size;
    lightingCanvas.height = size;
}

window.addEventListener('resize', resize);

window.addEventListener('keydown', (e) => {
    audio.init();
    const key = e.key.toLowerCase();

    if (key === 'r') {
        returnToMenu();
        return;
    }

    if (isMoving || (currentState === STATES.PLAYING && transitionAlpha > 0.01)) return;

    let dx = 0, dy = 0;
    if (key === 'arrowup' || key === 'w') dy = -1;
    else if (key === 'arrowdown' || key === 's') dy = 1;
    else if (key === 'arrowleft' || key === 'a') dx = -1;
    else if (key === 'arrowright' || key === 'd') dx = 1;

    if (dx !== 0 || dy !== 0) {
        startMove(dx, dy);
    }
});

function startMove(dx, dy) {
    let tx, ty, curX, curY;
    
    if (currentState === STATES.MENU) {
        curX = menuPlayer.x;
        curY = menuPlayer.y;
        tx = curX;
        ty = curY;
        while (isMenuValid(tx + dx, ty + dy)) {
            tx += dx;
            ty += dy;
        }
    } else {
        curX = player.x;
        curY = player.y;
        tx = curX;
        ty = curY;
        while (isGameValid(tx + dx, ty + dy)) {
            tx += dx;
            ty += dy;
        }
    }

    if (tx !== curX || ty !== curY) {
        target.x = tx;
        target.y = ty;
        isMoving = true;
        moveDir = { x: dx, y: dy };
        audio.playMove();
    } else {
        audio.playHit();
        shake = 4;
    }
}

function isMenuValid(x, y) {
    if (x < 0 || x >= menuGridSize.w || y < 0 || y >= menuGridSize.h) return false;
    return menuGrid[y][x] === 1;
}

function isGameValid(x, y) {
    if (x < 0 || x >= puzzle.size || y < 0 || y >= puzzle.size) return false;
    return puzzle.grid[y][x] === 1;
}

function update(dt) {
    time += dt;
    if (transitionAlpha > 0) {
        transitionAlpha -= dt * 1.5;
    }

    if (currentState === STATES.PLAYING && gameMode === 'SPEEDRUN' && !isMoving) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
            returnToMenu();
            audio.playHit();
        }
    }

    if (shake > 0) shake -= dt * 20;

    if (isMoving) {
        const speed = dt * 40;
        let pObj = currentState === STATES.MENU ? menuPlayer : player;
        const dx = target.x - pObj.visualX;
        const dy = target.y - pObj.visualY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < speed) {
            pObj.x = target.x;
            pObj.y = target.y;
            pObj.visualX = pObj.x;
            pObj.visualY = pObj.y;
            isMoving = false;
            audio.playHit();
            shake = 6;
            createParticles(pObj.x, pObj.y, '#fff', currentState === STATES.MENU ? 40 : 1);

            if (currentState === STATES.MENU) {
                if (pObj.x === menuGoalLeft.x && pObj.y === menuGoalLeft.y) {
                    audio.playWin();
                    setTimeout(() => startGame('SPEEDRUN'), 300);
                } else if (pObj.x === menuGoalRight.x && pObj.y === menuGoalRight.y) {
                    audio.playWin();
                    setTimeout(() => startGame('CHILL'), 300);
                }
            } else {
                if (player.x === puzzle.goal.x && player.y === puzzle.goal.y) {
                    audio.playWin();
                    if (gameMode === 'SPEEDRUN') {
                        const ratioRemaining = timeLeft / maxTime;
                        if (ratioRemaining < 0.89) {
                            maxTime *= 0.92;
                        }
                    }
                    setTimeout(newLevel, 600);
                }
            }
        } else {
            pObj.visualX += moveDir.x * speed;
            pObj.visualY += moveDir.y * speed;
        }
    }

    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt;
        return p.life > 0;
    });
}

function createParticles(gx, gy, color, scale = 1) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: gx + 0.5,
            y: gy + 0.5,
            vx: (Math.random() - 0.5) * 0.15 * scale,
            vy: (Math.random() - 0.5) * 0.15 * scale,
            life: 0.6,
            color: color,
            scale: scale
        });
    }
}

function drawMenu() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Logo - Using system monospace with lowercase styling to match aesthetic
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#fff';
    ctx.fillText('perpetua', cx, cy - 100);
    ctx.shadowBlur = 0;

    // Mini Game below title
    const menuCellSize = 40;
    const offsetX = cx - (menuGridSize.w * menuCellSize) / 2;
    const offsetY = cy - 20;

    // Grid
    for (let y = 0; y < menuGridSize.h; y++) {
        for (let x = 0; x < menuGridSize.w; x++) {
            if (menuGrid[y][x] === 1) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(offsetX + x * menuCellSize + 2, offsetY + y * menuCellSize + 2, menuCellSize - 4, menuCellSize - 4);
            }
        }
    }

    // Goals
    const pulse = Math.sin(time * 5) * 0.1 + 0.9;
    
    // Speedrun Goal (Blue)
    ctx.fillStyle = '#0088ff';
    ctx.shadowBlur = 15 * pulse;
    ctx.shadowColor = '#0088ff';
    ctx.fillRect(offsetX + menuGoalLeft.x * menuCellSize + 8, offsetY + menuGoalLeft.y * menuCellSize + 8, menuCellSize - 16, menuCellSize - 16);
    
    // Adventure Goal (Green)
    ctx.fillStyle = '#00ff88';
    ctx.shadowBlur = 15 * pulse;
    ctx.shadowColor = '#00ff88';
    ctx.fillRect(offsetX + menuGoalRight.x * menuCellSize + 8, offsetY + menuGoalRight.y * menuCellSize + 8, menuCellSize - 16, menuCellSize - 16);
    ctx.shadowBlur = 0;

    // Labels - Using system monospace
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.fillStyle = '#0088ff';
    ctx.textAlign = 'center';
    ctx.fillText('SPEEDRUN', offsetX + menuGoalLeft.x * menuCellSize + 20, offsetY + menuGoalLeft.y * menuCellSize + 55);
    
    ctx.fillStyle = '#00ff88';
    ctx.fillText('ADVENTURE', offsetX + menuGoalRight.x * menuCellSize + 20, offsetY + menuGoalRight.y * menuCellSize + 55);

    // Menu Player
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff';
    ctx.fillRect(offsetX + menuPlayer.visualX * menuCellSize + 10, offsetY + menuPlayer.visualY * menuCellSize + 10, menuCellSize - 20, menuCellSize - 20);
    ctx.shadowBlur = 0;

    // Particles (scaled for menu)
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(offsetX + p.x * menuCellSize - 2, offsetY + p.y * menuCellSize - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    // Instructions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '14px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('USE ARROW KEYS TO MOVE', cx, cy + 120);
}

function drawGame() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    const swayX = Math.sin(time * 0.5) * 2;
    const swayY = Math.cos(time * 0.4) * 2;
    ctx.translate(swayX, swayY);

    const cellSize = canvas.width / puzzle.size;
    const padding = cellSize * 0.08;

    for (let y = 0; y < puzzle.size; y++) {
        for (let x = 0; x < puzzle.size; x++) {
            if (puzzle.grid[y][x] === 1) {
                ctx.fillStyle = getTileColor(x, y);
                ctx.fillRect(x * cellSize + padding, y * cellSize + padding, cellSize - padding * 2, cellSize - padding * 2);
            }
        }
    }

    // Goal
    const goal = puzzle.goal;
    const pulse = Math.sin(time * 5) * 0.1 + 0.9;
    ctx.fillStyle = '#ffcc00';
    ctx.shadowBlur = 20 * pulse;
    ctx.shadowColor = '#ffcc00';
    ctx.fillRect(goal.x * cellSize + cellSize * 0.2, goal.y * cellSize + cellSize * 0.2, cellSize * 0.6, cellSize * 0.6);
    ctx.shadowBlur = 0;

    // Player
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#fff';
    ctx.fillRect(player.visualX * cellSize + cellSize * 0.25, player.visualY * cellSize + cellSize * 0.25, cellSize * 0.5, cellSize * 0.5);
    ctx.shadowBlur = 0;

    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x * cellSize - 2, p.y * cellSize - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    ctx.restore();

    // Lighting (Optimized: Reusing canvas and simplifying)
    lctx.fillStyle = 'rgba(5, 5, 7, 0.85)';
    lctx.fillRect(0, 0, canvas.width, canvas.height);
    lctx.globalCompositeOperation = 'destination-out';
    const pX = (player.visualX + 0.5) * cellSize + swayX;
    const pY = (player.visualY + 0.5) * cellSize + swayY;
    
    const pGrad = lctx.createRadialGradient(pX, pY, 0, pX, pY, cellSize * 5);
    pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    pGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    lctx.fillStyle = pGrad;
    lctx.beginPath();
    lctx.arc(pX, pY, cellSize * 5, 0, Math.PI * 2);
    lctx.fill();

    const gX = (goal.x + 0.5) * cellSize + swayX;
    const gY = (goal.y + 0.5) * cellSize + swayY;
    const gGrad = lctx.createRadialGradient(gX, gY, 0, gX, gY, cellSize * 4);
    gGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    lctx.fillStyle = gGrad;
    lctx.beginPath();
    lctx.arc(gX, gY, cellSize * 4, 0, Math.PI * 2);
    lctx.fill();
    lctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(lightingCanvas, 0, 0);

    // Mode Specific UI
    if (gameMode === 'SPEEDRUN') {
        // Steps - Using system monospace
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '700 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        const stepsText = puzzle.moveHistory.join(' | ');
        ctx.fillText(stepsText, canvas.width / 2, 25);

        // Timer bar
        const timerWidth = canvas.width * 0.6;
        const progress = Math.max(0, timeLeft / maxTime);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(canvas.width/2 - timerWidth/2, 45, timerWidth, 4);
        ctx.fillStyle = timeLeft < 4 ? '#ff3300' : '#fff';
        ctx.fillRect(canvas.width/2 - timerWidth/2, 45, timerWidth * progress, 4);
    }
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('PRESS R TO MENU', canvas.width - 10, canvas.height - 15);
}

function draw() {
    if (currentState === STATES.MENU) {
        drawMenu();
    } else {
        drawGame();
    }

    if (transitionAlpha > 0.01) {
        ctx.fillStyle = `rgba(5, 5, 5, ${transitionAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function getTileColor(x, y) {
    const variant = (Math.sin(x * 12.3 + y * 4.5) * 0.5 + 0.5) * 10;
    return `rgb(${25 + variant}, ${25 + variant}, ${30 + variant})`;
}

let lastTime = 0;
function loop(t) {
    const dt = Math.min((t - lastTime) / 1000, 0.1);
    lastTime = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

init();

let touchStartX = 0, touchStartY = 0;
window.addEventListener('touchstart', e => {
    audio.init();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, {passive: false});

window.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const minSwipe = 30;
    
    if (isMoving || (currentState === STATES.PLAYING && transitionAlpha > 0.01)) return;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > minSwipe) startMove(dx > 0 ? 1 : -1, 0);
    } else {
        if (Math.abs(dy) > minSwipe) startMove(dy > 0 ? 1 : -1, 0);
    }
}, {passive: false});