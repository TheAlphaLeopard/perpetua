/**
 * generatePuzzle - Procedural level generator
 * No external dependencies.
 */
function generatePuzzle(size = 25, startPos = null, mode = 'SPEEDRUN') {
    let grid, start, goal;
    let attempts = 0;
    const moveHistory = [];
    const currentSize = size;

    while (attempts < 1000) {
        moveHistory.length = 0;
        grid = Array(currentSize).fill().map(() => Array(currentSize).fill(0));
        
        if (startPos) {
            start = {
                x: Math.max(2, Math.min(currentSize - 3, startPos.x)),
                y: Math.max(2, Math.min(currentSize - 3, startPos.y))
            };
        } else {
            start = {
                x: Math.floor(currentSize / 2),
                y: Math.floor(currentSize / 2)
            };
        }

        grid[start.y][start.x] = 1;
        let current = { ...start };
        let currentAxis = Math.random() < 0.5 ? 0 : 1; 
        let success = true;
        const stoppers = new Set(); // To protect walls that stop the player

        let numSteps;
        if (mode === 'CHILL') {
            numSteps = 17 + Math.floor(Math.random() * 4); // 17 to 20 steps
        } else {
            numSteps = 7 + Math.floor(Math.random() * 5); // 7 to 11 steps
        }

        for (let i = 0; i < numSteps; i++) {
            const directions = currentAxis === 0 ? 
                [{ dx: 1, dy: 0, label: 'RIGHT' }, { dx: -1, dy: 0, label: 'LEFT' }] : 
                [{ dx: 0, dy: 1, label: 'DOWN' }, { dx: 0, dy: -1, label: 'UP' }];
            
            directions.sort(() => Math.random() - 0.5);

            let moved = false;
            for (let move of directions) {
                const dist = 1 + Math.floor(Math.random() * 8);
                const nx = current.x + move.dx * dist;
                const ny = current.y + move.dy * dist;
                const sx = nx + move.dx;
                const sy = ny + move.dy;

                if (nx >= 1 && nx < currentSize - 1 && ny >= 1 && ny < currentSize - 1 &&
                    sx >= 0 && sx < currentSize && sy >= 0 && sy < currentSize) {
                    
                    if (grid[sy][sx] === 1) continue;

                    for (let d = 1; d <= dist; d++) {
                        grid[current.y + move.dy * d][current.x + move.dx * d] = 1;
                    }
                    
                    stoppers.add(`${sx},${sy}`);
                    moveHistory.push(`${move.label} ${dist}`);
                    current.x = nx;
                    current.y = ny;
                    currentAxis = 1 - currentAxis;
                    moved = true;
                    break;
                }
            }

            if (!moved) {
                success = false;
                break;
            }
        }

        if (success && (current.x !== start.x || current.y !== start.y)) {
            goal = { ...current };
            return { grid, start, goal, size: currentSize, moveHistory };
        }
        attempts++;
    }

    return generatePuzzle(size, null, mode);
}