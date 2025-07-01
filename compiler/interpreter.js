// TBT Language Interpreter: Executes AST
// Usage: interpret(ast)

export function interpret(ast, context = {}) {
    let output = '';
    // Use shared context if provided (for repeat blocks)
    let variables = context.variables || {};
    let canvas = context.canvas || { width: 0, height: 0 };
    let board = context.board || [];
    let objects = context.objects || {};
    function initBoard(width, height) {
        board = Array.from({ length: height }, () => Array.from({ length: width }, () => []));
    }
    function placeObject(obj) {
        // Accept id=0 and all valid ids
        if (typeof obj.id === 'undefined' || obj.id === null) return;
        obj.id = Number(obj.id);
        // Remove this id from ALL tiles before placing (fixes bug with duplicate spawns)
        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[0].length; col++) {
                board[row][col] = board[row][col].filter(id => Number(id) !== obj.id);
            }
        }
        if (obj.x >= 0 && obj.y >= 0 && obj.y < board.length && obj.x < board[0].length) {
            // Remove ALL other ids from this tile before placing (fixes bug with multiple ids in one tile)
            board[obj.y][obj.x] = [];
            board[obj.y][obj.x].push(String(obj.id));
            objects[obj.id] = { ...obj };
        }
    }
    function removeObject(id) {
        id = Number(id);
        if (typeof id === 'undefined' || id === null) return;
        const obj = objects[id];
        if (obj && board[obj.y][obj.x].includes(String(id))) {
            board[obj.y][obj.x] = board[obj.y][obj.x].filter(oid => String(oid) !== String(id));
        }
        delete objects[id];
    }
    function moveObject(cmd) {
        const id = Number(cmd.id);
        if (typeof id === 'undefined' || id === null) return;
        const obj = objects[id];
        if (!obj) return;
        let newX = obj.x, newY = obj.y;
        if (cmd.rel) {
            if (cmd.rel === 'left') newX--;
            if (cmd.rel === 'right') newX++;
            if (cmd.rel === 'up') newY--;
            if (cmd.rel === 'down') newY++;
            if (cmd.rel === 'over') newY--;
            if (cmd.rel === 'under') newY++;
        }
        if (typeof cmd.x === 'number') newX = cmd.x;
        if (typeof cmd.y === 'number') newY = cmd.y;
        // Only proceed if new position is valid
        if (newX < 0 || newY < 0 || newY >= board.length || newX >= board[0].length) {
            // Do not remove from board or update position if invalid
            return;
        }
        // Remove from old position only if move is valid
        board[obj.y][obj.x] = board[obj.y][obj.x].filter(oid => String(oid) !== String(obj.id));
        obj.x = newX;
        obj.y = newY;
        board[newY][newX].push(String(obj.id));
        if (typeof cmd.set === 'number') obj.state = cmd.set;
    }
    function evalValue(node, depth = 0) {
        if (depth > 32) throw new Error('Too much recursion in value evaluation');
        if (node === undefined || node === null) return node;
        if (typeof node === 'number') return node;
        if (typeof node === 'string') return Number(node);
        if (node.type === 'number') return node.value;
        if (node.type === 'ident') {
            if (variables.hasOwnProperty(node.value)) return variables[node.value];
            return 0;
        }
        if (node.type === 'func') {
            // Evaluate all arguments
            const args = node.args.map(arg => evalValue(arg, depth + 1));
            switch (node.name) {
                case 'add': return args.reduce((a, b) => a + b, 0);
                case 'sub': return args.length === 1 ? -args[0] : args.slice(1).reduce((a, b) => a - b, args[0]);
                case 'mul': return args.reduce((a, b) => a * b, 1);
                case 'div': return args.slice(1).reduce((a, b) => a / b, args[0]);
                case 'mod': return args.slice(1).reduce((a, b) => a % b, args[0]);
                case 'random': return Math.floor(Math.random() * (args[1] - args[0] + 1)) + args[0];
                case 'ref':
                    if (node.args[0].type === 'ident') {
                        return variables[node.args[0].value] ?? 0;
                    } else if (typeof args[0] === 'string') {
                        return variables[args[0]] ?? 0;
                    } else {
                        return evalValue(node.args[0], depth + 1);
                    }
                default: return 0;
            }
        }
        return 0;
    }
    for (const node of ast) {
        try {
            if (node.type === 'canvas') {
                canvas.width = node.width;
                canvas.height = node.height;
                initBoard(canvas.width, canvas.height);
                output += `Canvas initialized: ${canvas.width}x${canvas.height}\n`;
            } else if (node.type === 'ref_assign') {
                variables[node.name] = evalValue(node.value);
                output += `Variable ${node.name} set to ${variables[node.name]}\n`;
            } else if (node.type === 'expr') {
                const val = evalValue(node.expr);
                output += `Result: ${val}\n`;
            } else if (node.type === 'spawn') {
                // Evaluate id, x, y, state if they are expressions
                const obj = {
                    id: evalValue(node.id),
                    x: evalValue(node.x),
                    y: evalValue(node.y),
                    state: evalValue(node.state)
                };
                // Accept id=0 and all valid ids
                if (obj.id === undefined || obj.id === null || isNaN(obj.id)) {
                    output += `Error: Invalid id for spawn: ${JSON.stringify(obj)}\n`;
                    continue;
                }
                placeObject(obj);
                output += `Spawned id=${obj.id} at (${obj.x},${obj.y}) state=${obj.state}\n`;
            } else if (node.type === 'despawn') {
                if (node.id === undefined || node.id === null || isNaN(node.id)) {
                    output += `Error: Invalid id for despawn: ${JSON.stringify(node)}\n`;
                    continue;
                }
                removeObject(node.id);
                output += `Despawned id=${node.id}\n`;
            } else if (node.type === 'move') {
                // Evaluate id, x, y, set if they are expressions
                const moveCmd = {
                    ...node,
                    id: evalValue(node.id),
                    x: node.x !== undefined ? evalValue(node.x) : undefined,
                    y: node.y !== undefined ? evalValue(node.y) : undefined,
                    set: node.set !== undefined ? evalValue(node.set) : undefined
                };
                if (moveCmd.id === undefined || moveCmd.id === null || isNaN(moveCmd.id)) {
                    output += `Error: Invalid id for move: ${JSON.stringify(moveCmd)}\n`;
                    continue;
                }
                if (!objects[moveCmd.id]) {
                    output += `Error: Object with id=${moveCmd.id} does not exist for move.\n`;
                    continue;
                }
                moveObject(moveCmd);
                output += `Moved id=${moveCmd.id}`;
                if (moveCmd.x !== undefined && moveCmd.y !== undefined) {
                    output += ` to (${moveCmd.x},${moveCmd.y})`;
                }
                if (moveCmd.rel) {
                    output += ` ${moveCmd.rel}`;
                }
                if (moveCmd.set !== undefined) {
                    output += ` set state=${moveCmd.set}`;
                }
                if (moveCmd.swap) {
                    output += ` with swap`;
                }
                output += `\n`;
            } else if (node.type === 'wait') {
                if (typeof node.duration !== 'number' || isNaN(node.duration)) {
                    output += `Error: Invalid duration for wait: ${JSON.stringify(node)}\n`;
                    continue;
                }
                output += `Waited ${node.duration} ms\n`;
            } else if (node.type === 'repeat') {
                let times = node.count != null ? node.count : 10;
                if (typeof times !== 'number' || isNaN(times) || times < 0) {
                    output += `Error: Invalid repeat count: ${JSON.stringify(node)}\n`;
                    continue;
                }
                for (let i = 0; i < times; i++) {
                    output += `Repeat iteration ${i+1}/${times} (delay ${node.delay} ms)\n`;
                    for (const stmt of node.block) {
                        try {
                            // Pass shared context so variables/objects persist
                            const subResult = interpret([stmt], { variables, board, objects, canvas });
                            if (subResult && subResult.output) {
                                output += subResult.output;
                            }
                        } catch (e) {
                            output += `Error in repeat block (iteration ${i+1}): ${e.message}\nStack: ${e.stack}\nStatement: ${JSON.stringify(stmt)}\n`;
                        }
                    }
                    output += `Waited ${node.delay} ms\n`;
                }
            } else {
                output += `Unknown statement: ${JSON.stringify(node)}\n`;
            }
        } catch (e) {
            output += `Interpreter Error: ${e.message}\nStack: ${e.stack}\nNode: ${JSON.stringify(node)}\n`;
        }
    }
    // Expose board and objects for grid rendering
    return { output, board, objects, canvas, variables };
}
