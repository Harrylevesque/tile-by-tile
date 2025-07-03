// TBT Language Interpreter: Executes AST
// Usage: interpret(ast)

export function interpret(ast, context = {}) {
    let output = '';
    // Use shared context if provided (for repeat blocks)
    let variables = context.variables || {};
    let canvas = context.canvas || { width: 0, height: 0 };
    let board = context.board || [];
    let objects = context.objects || {};

    // --- ERROR LOGGING FUNCTION ---
    function logError(message, data = null) {
        const errorMsg = `[INTERPRETER ERROR] ${message}`;
        output += `${errorMsg}\n`;
        // Only log actual errors to console, not informational messages
        if (message.includes('Error') || message.includes('Failed') || message.includes('Invalid') || message.includes('Cannot') || message.includes('Warning')) {
            if (typeof console !== 'undefined' && console.error) {
                console.error(errorMsg, data);
            }
            if (typeof window !== 'undefined' && window.console && window.console.error) {
                window.console.error(errorMsg, data);
            }
        }
    }

    function initBoard(width, height) {
        try {
            if (typeof width !== 'number' || typeof height !== 'number') {
                logError(`Invalid board dimensions: width=${width}, height=${height}`);
                return;
            }
            if (width <= 0 || height <= 0) {
                logError(`Board dimensions must be positive: width=${width}, height=${height}`);
                return;
            }
            board = Array.from({ length: height }, () => Array.from({ length: width }, () => []));
            logError(`Board initialized successfully: ${width}x${height}`);
        } catch (e) {
            logError(`Failed to initialize board: ${e.message}`, e);
        }
    }

    function placeObject(obj) {
        try {
            // Accept id=0 and all valid ids
            if (typeof obj.id === 'undefined' || obj.id === null) {
                logError(`Cannot place object with undefined/null id`, obj);
                return;
            }
            obj.id = Number(obj.id);
            if (isNaN(obj.id)) {
                logError(`Object id is NaN`, obj);
                return;
            }

            // Validate coordinates
            if (typeof obj.x !== 'number' || typeof obj.y !== 'number') {
                logError(`Object has invalid coordinates: x=${obj.x}, y=${obj.y}`, obj);
                return;
            }

            // Remove this id from ALL tiles before placing (fixes bug with duplicate spawns)
            for (let row = 0; row < board.length; row++) {
                for (let col = 0; col < board[0].length; col++) {
                    const before = board[row][col].length;
                    board[row][col] = board[row][col].filter(id => Number(id) !== obj.id);
                    const after = board[row][col].length;
                    if (before !== after) {
                        logError(`Removed duplicate id=${obj.id} from tile (${col},${row})`);
                    }
                }
            }

            if (obj.x >= 0 && obj.y >= 0 && obj.y < board.length && obj.x < board[0].length) {
                // Remove ALL other ids from this tile before placing (fixes bug with multiple ids in one tile)
                const prevIds = [...board[obj.y][obj.x]];
                board[obj.y][obj.x] = [];
                board[obj.y][obj.x].push(String(obj.id));
                objects[obj.id] = { ...obj };
                if (prevIds.length > 0) {
                    logError(`Replaced existing objects ${prevIds.join(',')} with id=${obj.id} at (${obj.x},${obj.y})`);
                }
            } else {
                logError(`Object placement out of bounds: id=${obj.id} at (${obj.x},${obj.y}), board size: ${board[0]?.length || 0}x${board.length}`);
            }
        } catch (e) {
            logError(`Error placing object: ${e.message}`, { obj, error: e });
        }
    }

    function removeObject(id) {
        try {
            id = Number(id);
            if (typeof id === 'undefined' || id === null || isNaN(id)) {
                logError(`Cannot remove object with invalid id: ${id}`);
                return;
            }
            const obj = objects[id];
            if (!obj) {
                logError(`Attempted to remove non-existent object id=${id}`);
                return;
            }
            if (obj && board[obj.y] && board[obj.y][obj.x] && board[obj.y][obj.x].includes(String(id))) {
                board[obj.y][obj.x] = board[obj.y][obj.x].filter(oid => String(oid) !== String(id));
                logError(`Removed object id=${id} from board at (${obj.x},${obj.y})`);
            } else {
                logError(`Object id=${id} not found on board at expected location (${obj.x},${obj.y})`);
            }
            delete objects[id];
        } catch (e) {
            logError(`Error removing object id=${id}: ${e.message}`, e);
        }
    }

    function moveObject(cmd) {
        try {
            const id = Number(cmd.id);
            if (typeof id === 'undefined' || id === null || isNaN(id)) {
                logError(`Cannot move object with invalid id: ${cmd.id}`, cmd);
                return;
            }
            const obj = objects[id];
            if (!obj) {
                logError(`Cannot move non-existent object id=${id}`, cmd);
                return;
            }

            let newX = obj.x, newY = obj.y;
            const oldX = obj.x, oldY = obj.y;

            // If x/y are provided, use them (absolute move)
            if (typeof cmd.x === 'number') {
                newX = cmd.x;
                logError(`Absolute move: id=${id} x=${oldX}->${newX}`);
            }
            if (typeof cmd.y === 'number') {
                newY = cmd.y;
                logError(`Absolute move: id=${id} y=${oldY}->${newY}`);
            }

            // If rel is provided, adjust from current position
            if (cmd.rel) {
                logError(`Relative move: id=${id} direction=${cmd.rel} from (${oldX},${oldY})`);
                if (cmd.rel === 'left') newX = obj.x - 1;
                if (cmd.rel === 'right') newX = obj.x + 1;
                if (cmd.rel === 'up') newY = obj.y - 1;
                if (cmd.rel === 'down') newY = obj.y + 1;
                if (cmd.rel === 'over') newY = obj.y - 1;
                if (cmd.rel === 'under') newY = obj.y + 1;
            }

            // Only proceed if new position is valid
            if (typeof newX !== 'number' || typeof newY !== 'number' || isNaN(newX) || isNaN(newY)) {
                logError(`Move failed: invalid coordinates newX=${newX}, newY=${newY}`, cmd);
                return;
            }
            if (newX < 0 || newY < 0 || newY >= board.length || newX >= board[0].length) {
                logError(`Move failed: out of bounds (${newX},${newY}), board size: ${board[0]?.length || 0}x${board.length}`, cmd);
                return;
            }

            // Remove from old position only if move is valid
            const oldTile = board[obj.y][obj.x];
            const oldCount = oldTile.length;
            board[obj.y][obj.x] = board[obj.y][obj.x].filter(oid => String(oid) !== String(obj.id));
            const afterRemove = board[obj.y][obj.x].length;

            if (oldCount === afterRemove) {
                logError(`Warning: object id=${id} was not found at old position (${oldX},${oldY}) during move`);
            }

            obj.x = newX;
            obj.y = newY;
            board[newY][newX].push(String(obj.id));

            if (typeof cmd.set === 'number') {
                const oldState = obj.state;
                obj.state = cmd.set;
                logError(`State change: id=${id} state=${oldState}->${obj.state}`);
            }

            // Always update the object in the objects map
            objects[id] = { ...obj };
            logError(`Move completed: id=${id} (${oldX},${oldY}) -> (${newX},${newY})`);

            // --- NEW: Log to dev console if move is from code (not graph/UI) ---
            if (!cmd.fromGraph) {
                if (typeof window !== 'undefined' && window.console && window.console.log) {
                    window.console.log(`[TBT] Square id=${id} moved by code from (${oldX},${oldY}) to (${newX},${newY})`);
                }
            }
        } catch (e) {
            logError(`Error moving object: ${e.message}`, { cmd, error: e });
        }
    }

    function evalValue(node, depth = 0) {
        try {
            if (depth > 32) {
                logError(`Recursion depth exceeded (${depth}) while evaluating value`, node);
                throw new Error('Too much recursion in value evaluation');
            }
            if (node === undefined || node === null) {
                logError(`Evaluating undefined/null node at depth ${depth}`, node);
                return node;
            }
            if (typeof node === 'number') {
                logError(`Direct number value: ${node}`);
                return node;
            }
            if (typeof node === 'string') {
                const result = Number(node);
                logError(`String to number conversion: "${node}" -> ${result}`);
                return result;
            }
            if (node.type === 'number') {
                logError(`Number node value: ${node.value}`);
                return node.value;
            }
            if (node.type === 'ident') {
                const value = variables.hasOwnProperty(node.value) ? variables[node.value] : 0;
                logError(`Variable lookup: ${node.value} = ${value}`);
                return value;
            }
            if (node.type === 'func') {
                logError(`Function call: ${node.name} with ${node.args?.length || 0} args`);
                // Evaluate all arguments
                const args = node.args.map(arg => evalValue(arg, depth + 1));
                switch (node.name) {
                    case 'add':
                        const addResult = args.reduce((a, b) => a + b, 0);
                        logError(`add(${args.join(',')}) = ${addResult}`);
                        return addResult;
                    case 'sub':
                        const subResult = args.length === 1 ? -args[0] : args.slice(1).reduce((a, b) => a - b, args[0]);
                        logError(`sub(${args.join(',')}) = ${subResult}`);
                        return subResult;
                    case 'mul':
                        const mulResult = args.reduce((a, b) => a * b, 1);
                        logError(`mul(${args.join(',')}) = ${mulResult}`);
                        return mulResult;
                    case 'div':
                        const divResult = args.slice(1).reduce((a, b) => a / b, args[0]);
                        logError(`div(${args.join(',')}) = ${divResult}`);
                        return divResult;
                    case 'mod':
                        const modResult = args.slice(1).reduce((a, b) => a % b, args[0]);
                        logError(`mod(${args.join(',')}) = ${modResult}`);
                        return modResult;
                    case 'random':
                        const randomResult = Math.floor(Math.random() * (args[1] - args[0] + 1)) + args[0];
                        logError(`random(${args[0]}, ${args[1]}) = ${randomResult}`);
                        return randomResult;
                    case 'ref':
                        if (node.args[0].type === 'ident') {
                            const refResult = variables[node.args[0].value] ?? 0;
                            logError(`ref(${node.args[0].value}) = ${refResult}`);
                            return refResult;
                        } else if (typeof args[0] === 'string') {
                            const refResult = variables[args[0]] ?? 0;
                            logError(`ref("${args[0]}") = ${refResult}`);
                            return refResult;
                        } else {
                            const refResult = evalValue(node.args[0], depth + 1);
                            logError(`ref(dynamic) = ${refResult}`);
                            return refResult;
                        }
                    default:
                        logError(`Unknown function: ${node.name}, returning 0`);
                        return 0;
                }
            }
            logError(`Unknown node type: ${node.type || typeof node}, returning 0`, node);
            return 0;
        } catch (e) {
            logError(`Error evaluating value: ${e.message}`, { node, depth, error: e });
            return 0;
        }
    }
    for (const node of ast) {
        try {
            if (node.type === 'canvas') {
                canvas.width = node.width;
                canvas.height = node.height;
                initBoard(canvas.width, canvas.height);
                output += `Canvas initialized: ${canvas.width}x${canvas.height}\n`;
                // --- Real-time grid update ---
                if (typeof window !== 'undefined' && typeof window.parent !== 'undefined' && window.parent !== window && typeof window.parent.postMessage === 'function') {
                    window.parent.postMessage({
                        tbtGridUpdate: true,
                        gridData: {
                            width: canvas.width,
                            height: canvas.height,
                            board: board,
                            objects: objects,
                            output: output
                        }
                    }, '*');
                }
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
                // --- Log spawn info to dev console ---
                if (typeof window !== 'undefined' && window.console && window.console.info) {
                    window.console.info(`[TBT] Spawned: id=${obj.id} at (${obj.x},${obj.y}) state=${obj.state}`, obj);
                }
                // --- Real-time grid update ---
                if (typeof window !== 'undefined' && typeof window.parent !== 'undefined' && window.parent !== window && typeof window.parent.postMessage === 'function') {
                    window.parent.postMessage({
                        tbtGridUpdate: true,
                        gridData: {
                            width: canvas.width,
                            height: canvas.height,
                            board: board,
                            objects: objects,
                            output: output
                        }
                    }, '*');
                }
            } else if (node.type === 'despawn') {
                if (node.id === undefined || node.id === null || isNaN(node.id)) {
                    output += `Error: Invalid id for despawn: ${JSON.stringify(node)}\n`;
                    continue;
                }
                removeObject(node.id);
                output += `Despawned id=${node.id}\n`;
                // --- Real-time grid update ---
                if (typeof window !== 'undefined' && typeof window.parent !== 'undefined' && window.parent !== window && typeof window.parent.postMessage === 'function') {
                    window.parent.postMessage({
                        tbtGridUpdate: true,
                        gridData: {
                            width: canvas.width,
                            height: canvas.height,
                            board: board,
                            objects: objects,
                            output: output
                        }
                    }, '*');
                }
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
                // Save old position for logging
                const oldX = objects[moveCmd.id].x;
                const oldY = objects[moveCmd.id].y;
                moveObject(moveCmd);
                // Get new position after move
                const newObj = objects[moveCmd.id];
                output += `Moved id=${moveCmd.id}`;
                if (typeof newObj.x === 'number' && typeof newObj.y === 'number') {
                    output += ` to (${newObj.x},${newObj.y})`;
                }
                if (moveCmd.rel) {
                    output += ` ${moveCmd.rel}`;
                }
                if (moveCmd.set !== undefined && moveCmd.set !== null) {
                    output += ` set state=${newObj.state}`;
                }
                if (moveCmd.swap) {
                    output += ` with swap`;
                }
                output += `\n`;
                // --- Real-time grid update ---
                if (typeof window !== 'undefined' && typeof window.parent !== 'undefined' && window.parent !== window && typeof window.parent.postMessage === 'function') {
                    window.parent.postMessage({
                        tbtGridUpdate: true,
                        gridData: {
                            width: canvas.width,
                            height: canvas.height,
                            board: board,
                            objects: objects,
                            output: output
                        }
                    }, '*');
                }
            } else if (node.type === 'wait') {
                if (typeof node.duration !== 'number' || isNaN(node.duration)) {
                    output += `Error: Invalid duration for wait: ${JSON.stringify(node)}\n`;
                    continue;
                }
                output += `Waited ${node.duration} ms\n`;
            } else if (node.type === 'repeat') {
                let times;
                if (node.count === 'forever') {
                    times = Infinity;
                } else {
                    times = node.count != null ? node.count : 10;
                }
                if (typeof times !== 'number' && times !== Infinity) {
                    output += `Error: Invalid repeat count: ${JSON.stringify(node)}\n`;
                    continue;
                }
                for (let i = 0; i < times; i++) {
                    output += `Repeat iteration ${i+1}/${times === Infinity ? '∞' : times} (delay ${node.delay} ms)\n`;
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
            } else if (node.type === 'if') {
                // Evaluate both left and right ids
                const leftId = evalValue(node.leftId);
                let condition = false;
                if (node.relation === 'assigned') {
                    // Check if the key is assigned to this id
                    if (!node.assignedKey) {
                        this.logError(`Malformed AST: missing assignedKey in 'assigned' relation`, node);
                    } else if (context.assignments) {
                        condition = context.assignments[node.assignedKey] === leftId;
                    }
                } else {
                    const rightId = evalValue(node.rightId);
                    // Find objects for spatial relations
                    const leftObj = objects[leftId];
                    const rightObj = objects[rightId];
                    switch (node.relation) {
                        case 'is':
                            condition = leftId === rightId;
                            break;
                        case 'on':
                            condition = leftObj && rightObj && leftObj.x === rightObj.x && leftObj.y === rightObj.y;
                            break;
                        case 'under':
                            condition = leftObj && rightObj && leftObj.x === rightObj.x && leftObj.y === rightObj.y + 1;
                            break;
                        case 'over':
                            condition = leftObj && rightObj && leftObj.x === rightObj.x && leftObj.y === rightObj.y - 1;
                            break;
                        case 'left':
                            condition = leftObj && rightObj && leftObj.y === rightObj.y && leftObj.x === rightObj.x - 1;
                            break;
                        case 'right':
                            condition = leftObj && rightObj && leftObj.y === rightObj.y && leftObj.x === rightObj.x + 1;
                            break;
                        default:
                            output += `Unknown relation: ${node.relation}\n`;
                    }
                }
                const block = condition ? node.trueBlock : node.falseBlock;
                output += `If condition (${node.relation}${node.relation === 'assigned' ? ' ' + node.assignedKey : ''}) is ${condition ? 'true' : 'false'}\n`;
                for (const stmt of block) {
                    try {
                        const subResult = interpret([stmt], { variables, board, objects, canvas, assignments: context.assignments });
                        if (subResult && subResult.output) {
                            output += subResult.output;
                        }
                    } catch (e) {
                        output += `Error in if block: ${e.message}\n`;
                    }
                }
            } else if (node.type === 'assign') {
                // Store assignments in context.assignments
                if (!context.assignments) context.assignments = {};
                let assignedValue = null;
                if (node.value.type === 'func' && node.value.name === 'ref') {
                    assignedValue = evalValue(node.value);
                } else if (node.value.type === 'id') {
                    assignedValue = evalValue(node.value); // FIX: always use evalValue to get plain number
                } else if (typeof node.value.value !== 'undefined') {
                    assignedValue = evalValue(node.value); // FIX: always use evalValue to get plain number
                }
                context.assignments[node.key] = assignedValue;
                if (this && this.assignments) {
                    this.assignments[node.key] = assignedValue;
                }
                output += `Assigned key '${node.key}' to value ${assignedValue}\n`;
                // --- INSTANT JUMP: Run all matching if ... is assigned ... true blocks ---
                if (Array.isArray(ast)) {
                    for (const ifNode of ast) {
                        if (
                            ifNode.type === 'if' &&
                            ifNode.relation === 'assigned' &&
                            ifNode.assignedKey === node.key
                        ) {
                            const leftId = evalValue(ifNode.leftId);
                            if (leftId === assignedValue) {
                                output += `(assign-jump) If condition (assigned ${node.key}) is true\n`;
                                for (const stmt of ifNode.trueBlock) {
                                    try {
                                        const subResult = interpret([stmt], { variables, board, objects, canvas, assignments: context.assignments });
                                        if (subResult && subResult.output) {
                                            output += subResult.output;
                                        }
                                    } catch (e) {
                                        output += `Error in assign-jump block: ${e.message}\n`;
                                    }
                                }
                            }
                        }
                    }
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

// --- STEPWISE INTERPRETER FOR REAL-TIME INPUT ---
export class TBTInterpreter {
    constructor(ast) {
        this.ast = ast;
        this.variables = {};
        this.canvas = { width: 0, height: 0 };
        this.board = [];
        this.objects = {};
        this.assignments = {};
        this.output = '';
        this.processes = []; // Each process = { node, state }
        this.initialized = false;
        this.logError(`TBTInterpreter created with ${ast?.length || 0} AST nodes`);
    }

    // --- ERROR LOGGING FUNCTION ---
    logError(message, data = null) {
        const errorMsg = `[TBT-STEPWISE] ${message}`;
        this.output += `${errorMsg}\n`;
        // Only log actual errors to console, not informational messages
        if (message.includes('Error') || message.includes('Failed') || message.includes('Invalid') || message.includes('Cannot') || message.includes('Warning')) {
            if (typeof console !== 'undefined' && console.error) {
                console.error(errorMsg, data);
            }
            if (typeof window !== 'undefined' && window.console && window.console.error) {
                window.console.error(errorMsg, data);
            }
        }
    }

    init() {
        try {
            this.logError(`Initializing TBTInterpreter...`);
            // Run all non-repeat statements (setup, spawn, assign, etc.)
            for (let i = 0; i < this.ast.length; i++) {
                const node = this.ast[i];
                this.logError(`Processing init node ${i}: ${node?.type || 'unknown'}`);

                if (node.type === 'canvas') {
                    this.canvas.width = node.width;
                    this.canvas.height = node.height;
                    if (typeof node.width !== 'number' || typeof node.height !== 'number') {
                        this.logError(`Invalid canvas dimensions: width=${node.width}, height=${node.height}`);
                        continue;
                    }
                    this.board = Array.from({ length: this.canvas.height }, () => Array.from({ length: this.canvas.width }, () => []));
                    this.output += `Canvas initialized: ${this.canvas.width}x${this.canvas.height}\n`;
                    this.logError(`Canvas board created: ${this.canvas.width}x${this.canvas.height}`);
                } else if (node.type === 'spawn') {
                    const obj = {
                        id: node.id?.value !== undefined ? node.id.value : (this.evalValue(node.id) || 0),
                        x: node.x?.value !== undefined ? node.x.value : (this.evalValue(node.x) || 0),
                        y: node.y?.value !== undefined ? node.y.value : (this.evalValue(node.y) || 0),
                        state: node.state?.value !== undefined ? node.state.value : (this.evalValue(node.state) || 0)
                    };
                    this.logError(`Spawning object during init: id=${obj.id}, pos=(${obj.x},${obj.y}), state=${obj.state}`);

                    // Validate object properties
                    if (typeof obj.id !== 'number' || isNaN(obj.id)) {
                        this.logError(`Invalid spawn id: ${obj.id}`, node);
                        continue;
                    }
                    if (typeof obj.x !== 'number' || isNaN(obj.x) || typeof obj.y !== 'number' || isNaN(obj.y)) {
                        this.logError(`Invalid spawn coordinates: x=${obj.x}, y=${obj.y}`, node);
                        continue;
                    }
                    if (obj.x < 0 || obj.y < 0 || obj.y >= this.board.length || obj.x >= this.board[0]?.length) {
                        this.logError(`Spawn out of bounds: (${obj.x},${obj.y}), board: ${this.board[0]?.length || 0}x${this.board.length}`);
                        continue;
                    }

                    // Remove this id from all tiles
                    let removedCount = 0;
                    for (let row = 0; row < this.board.length; row++) {
                        for (let col = 0; col < this.board[0].length; col++) {
                            const before = this.board[row][col].length;
                            this.board[row][col] = this.board[row][col].filter(id => Number(id) !== obj.id);
                            if (this.board[row][col].length < before) removedCount++;
                        }
                    }
                    if (removedCount > 0) {
                        this.logError(`Removed ${removedCount} duplicate instances of id=${obj.id} during spawn`);
                    }

                    this.board[obj.y][obj.x] = [String(obj.id)];
                    this.objects[obj.id] = { ...obj };
                    this.output += `Spawned id=${obj.id} at (${obj.x},${obj.y}) state=${obj.state}\n`;
                    this.logError(`Successfully spawned id=${obj.id} at (${obj.x},${obj.y})`);
                } else if (node.type === 'assign') {
                    if (node.value?.type === 'id') {
                        this.assignments[node.key] = node.value.value;
                        this.logError(`Assignment during init: key=${node.key} -> id=${node.value.value}`);
                    } else {
                        const assignedValue = this.evalValue(node.value);
                        this.assignments[node.key] = assignedValue;
                        this.logError(`Assignment during init: key=${node.key} -> value=${assignedValue}`);
                    }
                } else if (node.type === 'ref_assign') {
                    // Handle ref=name(value) assignments during initialization
                    const value = this.evalValue(node.value);
                    this.variables[node.name] = value;
                    this.output += `Variable ${node.name} set to ${value}\n`;
                    this.logError(`Variable assignment during init: ${node.name} = ${value}`);
                } else {
                    this.logError(`Skipping non-init node type: ${node.type}`);
                }
            }

            // Find all repeat blocks and treat each as a process
            const repeatNodes = this.ast.filter(n => n.type === 'repeat');
            this.processes = repeatNodes.map((node, idx) => ({ node, state: { i: 0 } }));
            this.logError(`Found ${repeatNodes.length} repeat blocks to process`);

            this.initialized = true;
            this.logError(`TBTInterpreter initialization complete`);
        } catch (e) {
            this.logError(`Error during initialization: ${e.message}`, e);
        }
    }

    evalValue(node) {
        try {
            if (node === undefined || node === null) {
                this.logError(`evalValue: undefined/null node`);
                return node;
            }
            if (typeof node === 'number') {
                this.logError(`evalValue: direct number ${node}`);
                return node;
            }
            if (typeof node === 'string') {
                const result = Number(node);
                this.logError(`evalValue: string "${node}" -> ${result}`);
                return result;
            }
            if (node.type === 'number') {
                this.logError(`evalValue: number node ${node.value}`);
                return node.value;
            }
            if (node.type === 'ident') {
                const value = this.variables && this.variables.hasOwnProperty(node.value) ? this.variables[node.value] : 0;
                this.logError(`evalValue: variable ${node.value} = ${value}`);
                return value;
            }
            if (node.type === 'func') {
                this.logError(`evalValue: function ${node.name} with ${node.args?.length || 0} args`);
                const args = node.args.map(arg => this.evalValue(arg));
                switch (node.name) {
                    case 'add':
                        const addResult = args.reduce((a, b) => a + b, 0);
                        this.logError(`add(${args.join(',')}) = ${addResult}`);
                        return addResult;
                    case 'sub':
                        const subResult = args.length === 1 ? -args[0] : args.slice(1).reduce((a, b) => a - b, args[0]);
                        this.logError(`sub(${args.join(',')}) = ${subResult}`);
                        return subResult;
                    case 'mul':
                        const mulResult = args.reduce((a, b) => a * b, 1);
                        this.logError(`mul(${args.join(',')}) = ${mulResult}`);
                        return mulResult;
                    case 'div':
                        const divResult = args.slice(1).reduce((a, b) => a / b, args[0]);
                        this.logError(`div(${args.join(',')}) = ${divResult}`);
                        return divResult;
                    case 'mod':
                        const modResult = args.slice(1).reduce((a, b) => a % b, args[0]);
                        this.logError(`mod(${args.join(',')}) = ${modResult}`);
                        return modResult;
                    case 'random':
                        const randomResult = Math.floor(Math.random() * (args[1] - args[0] + 1)) + args[0];
                        this.logError(`random(${args[0]}, ${args[1]}) = ${randomResult}`);
                        return randomResult;
                    case 'ref':
                        if (node.args[0].type === 'ident') {
                            const refResult = this.variables[node.args[0].value] ?? 0;
                            this.logError(`ref(${node.args[0].value}) = ${refResult}`);
                            return refResult;
                        } else if (typeof args[0] === 'string') {
                            const refResult = this.variables[args[0]] ?? 0;
                            this.logError(`ref("${args[0]}") = ${refResult}`);
                            return refResult;
                        } else {
                            const refResult = this.evalValue(node.args[0]);
                            this.logError(`ref(dynamic) = ${refResult}`);
                            return refResult;
                        }
                    default:
                        this.logError(`Unknown function: ${node.name}, returning 0`);
                        return 0;
                }
            }
            this.logError(`Unknown node type: ${node.type || typeof node}, returning 0`, node);
            return 0;
        } catch (e) {
            this.logError(`Error in evalValue: ${e.message}`, { node, error: e });
            return 0;
        }
    }

    step(assignments = {}) {
        try {
            if (!this.initialized) {
                this.logError(`Step called but not initialized, calling init()`);
                this.init();
            }
            if (!this._prevAssignments) this._prevAssignments = {};

            // Log assignment changes
            for (const key in assignments) {
                if (assignments[key] !== this.assignments[key]) {
                    this.logError(`Assignment change: ${key} ${this.assignments[key]} -> ${assignments[key]}`);
                }
            }

            this.assignments = { ...this.assignments, ...assignments };

            // --- DEBUG: Log that step is running and show assignments ---
            this.logError(`[DEBUG] step() called. assignments: ` + JSON.stringify(this.assignments));
            this.logError(`[DEBUG] processes: ` + JSON.stringify(this.processes.map(p => ({i: p.state.i, count: p.node.count}))));

            // --- INTERRUPT: On keydown edge, for each key pressed, find assign and matching if, run .true block, then resume repeat ---
            try {
                // For each key that is pressed now and was not pressed before
                for (const key in this.assignments) {
                    if (this.assignments[key] === 1 && this._prevAssignments[key] !== 1) {
                        this.logError(`Key press edge detected: ${key}`);
                        // Find all assign statements for this key
                        const assigns = this.ast.filter(n => n.type === 'assign' && n.key === key);
                        this.logError(`Found ${assigns.length} assign statements for key ${key}`);

                        for (const assign of assigns) {
                            // Find all if statements for this key and assigned id
                            const assignId = this.evalValue(assign.value);
                            this.logError(`Assign ${key} maps to id=${assignId}`);

                            const ifs = this.ast.filter(n => n.type === 'if' && n.relation === 'assigned' && n.assignedKey === key);
                            this.logError(`Found ${ifs.length} if-assigned statements for key ${key}`);

                            for (const ifNode of ifs) {
                                const leftId = this.evalValue(ifNode.leftId);
                                this.logError(`If statement: leftId=${leftId}, assignId=${assignId}, match=${leftId === assignId}`);

                                if (leftId === assignId) {
                                    this.logError(`Executing ${ifNode.trueBlock?.length || 0} statements in true block`);
                                    // Run .true block for this if
                                    for (const stmt of ifNode.trueBlock) {
                                        try {
                                            this._exec(stmt);
                                        } catch (e) {
                                            this.logError(`Error in assign-if interrupt: ${e.message}`, e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                this.logError(`Error in assign-if interrupt outer: ${e.message}`, e);
            }

            this._prevAssignments = { ...this.assignments };

            // --- Continue normal repeat loop ---
            let anyActive = false;
            this.logError(`Processing ${this.processes.length} repeat processes`);

            for (const proc of this.processes) {
                const repeatNode = proc.node;
                const maxCount = repeatNode.count === 'forever' ? Infinity : (repeatNode.count || 1);

                if (proc.state.i >= maxCount) {
                    this.logError(`Process ${proc.state.i}/${maxCount} completed`);
                    continue;
                }

                this.logError(`Processing repeat iteration ${proc.state.i + 1}/${maxCount === Infinity ? '∞' : maxCount}`);

                for (const stmt of repeatNode.block) {
                    try {
                        if (stmt.type === 'if') {
                            let condition = false;
                            if (stmt.relation === 'assigned') {
                                // --- FIX: Evaluate assigned key every step, not just on keydown edge ---
                                const leftId = this.evalValue(stmt.leftId);
                                const key = stmt.assignedKey;
                                // FIX: Check if any key is assigned to this id and is currently pressed (assignment value is 1)
                                let assigned = false;
                                for (const k in this.assignments) {
                                    if (this.assignments[k] === 1) {
                                        // Find assign statements for this key
                                        const assigns = this.ast.filter(n => n.type === 'assign' && n.key === k);
                                        for (const assign of assigns) {
                                            const assignId = this.evalValue(assign.value);
                                            if (assignId === leftId && k === key) {
                                                assigned = true;
                                            }
                                        }
                                    }
                                }
                                condition = assigned;
                                this.logError(`Repeat if-assigned: key=${key}, leftId=${leftId}, assigned=${condition}`);
                                const block = condition ? stmt.trueBlock : stmt.falseBlock;
                                this.logError(`Executing ${block?.length || 0} statements in ${condition ? 'true' : 'false'} block`);
                                for (const t of block) {
                                    try {
                                        this._exec(t);
                                    } catch (e) {
                                        this.logError(`Error in repeat if block: ${e.message}`, e);
                                    }
                                }
                                continue;
                            } else {
                                const leftId = this.evalValue(stmt.leftId);
                                const rightId = stmt.rightId && this.evalValue(stmt.rightId);
                                const leftObj = this.objects[leftId];
                                const rightObj = this.objects[rightId];
                                this.logError(`If-spatial check: relation=${stmt.relation}, leftId=${leftId}, rightId=${rightId}`);

                                switch (stmt.relation) {
                                    case 'is':
                                        condition = leftId === rightId;
                                        break;
                                    case 'on':
                                        condition = leftObj && rightObj && leftObj.x === rightObj.x && leftObj.y === rightObj.y;
                                        break;
                                    case 'under':
                                        condition = leftObj && rightObj && leftObj.x === rightObj.x && leftObj.y === rightObj.y + 1;
                                        break;
                                    case 'over':
                                        condition = leftObj && rightObj && leftObj.x === rightObj.x && leftObj.y === rightObj.y - 1;
                                        break;
                                    case 'left':
                                        condition = leftObj && rightObj && leftObj.y === rightObj.y && leftObj.x === rightObj.x - 1;
                                        break;
                                    case 'right':
                                        condition = leftObj && rightObj && leftObj.y === rightObj.y && leftObj.x === rightObj.x + 1;
                                        break;
                                    default:
                                        this.logError(`Unknown relation: ${stmt.relation}`);
                                        condition = false;
                                }
                                this.logError(`Spatial condition result: ${condition}`);

                                const block = condition ? stmt.trueBlock : stmt.falseBlock;
                                this.logError(`Executing ${block?.length || 0} statements in ${condition ? 'true' : 'false'} block`);

                                for (const t of block) {
                                    try {
                                        this._exec(t);
                                    } catch (e) {
                                        this.logError(`Error in repeat if block: ${e.message}`, e);
                                    }
                                }
                            }
                        } else {
                            // Handle all other statement types in repeat blocks (spawn, ref_assign, move, etc.)
                            this.logError(`Executing statement in repeat block: ${stmt.type}`);
                            this._exec(stmt);
                        }
                    } catch (e) {
                        this.logError(`Error in repeat outer: ${e.message}`, e);
                    }
                }
                proc.state.i++;
                anyActive = true;
            }

            this.logError(`Step complete, anyActive=${anyActive}`);
            // Log after every move
            this.logError(`[DEBUG] objects: ` + JSON.stringify(this.objects));
            this.logError(`[DEBUG] board: ` + JSON.stringify(this.board));
            return { done: !anyActive, output: this.output, board: this.board, objects: this.objects, canvas: this.canvas };
        } catch (e) {
            this.logError(`Error in step: ${e.message}`, e);
            return { done: true, output: this.output, board: this.board, objects: this.objects, canvas: this.canvas };
        }
    }

    // Execute a single statement (missing method)
    _exec(stmt) {
        try {
            this.logError(`Executing statement: ${stmt?.type || 'unknown'}`);

            if (stmt.type === 'move') {
                const id = this.evalValue(stmt.id);
                const obj = this.objects[id];
                if (!obj) {
                    this.logError(`Cannot move non-existent object id=${id}`);
                    return;
                }

                let newX = obj.x, newY = obj.y;
                const oldX = obj.x, oldY = obj.y;

                // Handle relative movement
                if (typeof stmt.rel === 'string' && stmt.rel) {
                    this.logError(`Relative move: id=${id} direction=${stmt.rel} from (${oldX},${oldY})`);
                    if (stmt.rel === 'left') newX = obj.x - 1;
                    if (stmt.rel === 'right') newX = obj.x + 1;
                    if (stmt.rel === 'up') newY = obj.y - 1;
                    if (stmt.rel === 'down') newY = obj.y + 1;
                    if (stmt.rel === 'over') newY = obj.y - 1;
                    if (stmt.rel === 'under') newY = obj.y + 1;
                }
                // Handle absolute movement
                if (stmt.x !== undefined) {
                    newX = this.evalValue(stmt.x);
                    this.logError(`Absolute move: id=${id} x=${oldX}->${newX}`);
                }
                if (stmt.y !== undefined) {
                    newY = this.evalValue(stmt.y);
                    this.logError(`Absolute move: id=${id} y=${oldY}->${newY}`);
                }

                // Bounds check
                if (newX >= 0 && newY >= 0 && newY < this.board.length && newX < this.board[0].length) {
                    // Remove from old position
                    const oldTile = this.board[obj.y][obj.x];
                    const oldCount = oldTile.length;
                    this.board[obj.y][obj.x] = this.board[obj.y][obj.x].filter(oid => String(oid) !== String(obj.id));
                    const afterRemove = this.board[obj.y][obj.x].length;

                    if (oldCount === afterRemove) {
                        this.logError(`Warning: object id=${id} was not found at old position (${oldX},${oldY}) during move`);
                    }

                    // Update position
                    obj.x = newX;
                    obj.y = newY;
                    // Add to new position
                    this.board[newY][newX].push(String(obj.id));
                    // Update state if specified
                    if (stmt.set !== undefined) {
                        const oldState = obj.state;
                        obj.state = this.evalValue(stmt.set);
                        this.logError(`State change: id=${id} state=${oldState}->${obj.state}`);
                    }
                    this.objects[id] = { ...obj };
                    this.output += `Moved id=${id} to (${newX},${newY})\n`;
                    this.logError(`Move completed: id=${id} (${oldX},${oldY}) -> (${newX},${newY})`);
                    // --- Log to dev console on movement ---
                    if (typeof window !== 'undefined' && window.console && window.console.log) {
                        window.console.log(`[TBT] Square id=${id} moved from (${oldX},${oldY}) to (${newX},${newY})`);
                    }
                } else {
                    this.logError(`Move failed: out of bounds (${newX},${newY}), board: ${this.board[0]?.length || 0}x${this.board.length}`);
                }
            } else if (stmt.type === 'spawn') {
                const obj = {
                    id: this.evalValue(stmt.id),
                    x: this.evalValue(stmt.x),
                    y: this.evalValue(stmt.y),
                    state: this.evalValue(stmt.state)
                };
                this.logError(`Spawning: id=${obj.id} at (${obj.x},${obj.y}) state=${obj.state}`);

                // Remove this id from all tiles
                let removedCount = 0;
                for (let row = 0; row < this.board.length; row++) {
                    for (let col = 0; col < this.board[0].length; col++) {
                        const before = this.board[row][col].length;
                        this.board[row][col] = this.board[row][col].filter(id => Number(id) !== obj.id);
                        if (this.board[row][col].length < before) removedCount++;
                    }
                }
                if (removedCount > 0) {
                    this.logError(`Removed ${removedCount} duplicate instances of id=${obj.id} during spawn`);
                }

                this.board[obj.y][obj.x] = [String(obj.id)];
                this.objects[obj.id] = { ...obj };
                this.output += `Spawned id=${obj.id} at (${obj.x},${obj.y}) state=${obj.state}\n`;
                this.logError(`Spawn completed: id=${obj.id}`);
            } else if (stmt.type === 'despawn') {
                const id = this.evalValue(stmt.id);
                const obj = this.objects[id];
                this.logError(`Despawning: id=${id}, exists=${!!obj}`);

                if (obj) {
                    this.board[obj.y][obj.x] = this.board[obj.y][obj.x].filter(oid => String(oid) !== String(id));
                    delete this.objects[id];
                    this.output += `Despawned id=${id}\n`;
                    this.logError(`Despawn completed: id=${id}`);
                } else {
                    this.logError(`Cannot despawn non-existent object id=${id}`);
                }
            } else if (stmt.type === 'ref_assign') {
                const oldValue = this.variables[stmt.name];
                this.variables[stmt.name] = this.evalValue(stmt.value);
                this.output += `Variable ${stmt.name} set to ${this.variables[stmt.name]}\n`;
                this.logError(`Variable assignment: ${stmt.name} ${oldValue} -> ${this.variables[stmt.name]}`);
            } else if (stmt.type === 'if') {
                // Evaluate both left and right ids
                const leftId = this.evalValue(stmt.leftId);
                let condition = false;
                if (stmt.relation === 'assigned') {
                    if (!stmt.assignedKey) {
                        this.logError(`Malformed AST: missing assignedKey in 'assigned' relation`, stmt);
                    } else if (this.assignments) {
                        condition = this.assignments[stmt.assignedKey] === leftId;
                    }
                } else {
                    const rightId = this.evalValue(stmt.rightId);
                    const leftObj = this.objects[leftId];
                    const rightObj = this.objects[rightId];
                    switch (stmt.relation) {
                        case 'is':
                            condition = leftId === rightId;
                            break;
                        case 'on':
                            condition = leftObj && rightObj && leftObj.x === rightObj.x && leftObj.y === rightObj.y;
                            break;
                        case 'under':
                            condition = leftObj && rightObj && leftObj.x === rightObj.x && leftObj.y === rightObj.y + 1;
                            break;
                        case 'over':
                            condition = leftObj && rightObj && leftObj.x === rightObj.x && leftObj.y === rightObj.y - 1;
                            break;
                        case 'left':
                            condition = leftObj && rightObj && leftObj.y === rightObj.y && leftObj.x === rightObj.x - 1;
                            break;
                        case 'right':
                            condition = leftObj && rightObj && leftObj.y === rightObj.y && leftObj.x === rightObj.x + 1;
                            break;
                        default:
                            this.logError(`Unknown relation: ${stmt.relation}`);
                    }
                }
                const block = condition ? stmt.trueBlock : stmt.falseBlock;
                this.logError(`If condition (${stmt.relation}${stmt.relation === 'assigned' ? ' ' + stmt.assignedKey : ''}) is ${condition ? 'true' : 'false'}`);
                for (const s of block) {
                    try {
                        this._exec(s);
                    } catch (e) {
                        this.logError(`Error in if block: ${e.message}`, e);
                    }
                }
            } else {
                this.logError(`Unknown statement type in _exec: ${stmt.type}`, stmt);
            }
        } catch (e) {
            this.logError(`Error in _exec: ${e.message}`, { stmt, error: e });
        }
    }

    // Move an object by key and direction (for real-time input)
    moveObjectByKey(key) {
        // Map keys to directions
        const keyDir = { w: 'up', a: 'left', s: 'down', d: 'right' };
        if (!keyDir[key]) return;
        const id = this.assignments[key];
        if (id === undefined || id === null) return;
        if (!this.objects[id]) return;
        // Move the object
        this.moveObject({ id, rel: keyDir[key] });
        this.output += `[TBT] Moved id=${id} ${keyDir[key]} by key '${key}'\n`;
    }
    moveObject(cmd) {
        try {
            const id = Number(cmd.id);
            if (typeof id === 'undefined' || id === null || isNaN(id)) {
                this.logError(`Cannot move object with invalid id: ${cmd.id}`, cmd);
                return;
            }
            const obj = this.objects[id];
            if (!obj) {
                this.logError(`Cannot move non-existent object id=${id}`, cmd);
                return;
            }
            let newX = obj.x, newY = obj.y;
            const oldX = obj.x, oldY = obj.y;
            if (cmd.rel) {
                if (cmd.rel === 'left') newX = obj.x - 1;
                if (cmd.rel === 'right') newX = obj.x + 1;
                if (cmd.rel === 'up') newY = obj.y - 1;
                if (cmd.rel === 'down') newY = obj.y + 1;
            }
            if (newX < 0 || newY < 0 || newY >= this.board.length || newX >= this.board[0].length) {
                this.logError(`Move failed: out of bounds (${newX},${newY}), board size: ${this.board[0]?.length || 0}x${this.board.length}`, cmd);
                return;
            }
            this.board[obj.y][obj.x] = this.board[obj.y][obj.x].filter(oid => String(oid) !== String(obj.id));
            obj.x = newX;
            obj.y = newY;
            this.board[newY][newX].push(String(obj.id));
            this.objects[id] = { ...obj };
            this.logError(`Move completed: id=${id} (${oldX},${oldY}) -> (${newX},${newY})`);
            // --- Log to dev console on movement (for key input) ---
            if (typeof window !== 'undefined' && window.parent && window.parent !== window && window.parent.console && window.parent.console.log) {
                window.parent.console.log(`[TBT] Square id=${id} moved by key from (${oldX},${oldY}) to (${newX},${newY})`);
            } else if (typeof window !== 'undefined' && window.console && window.console.log) {
                window.console.log(`[TBT] Square id=${id} moved by key from (${oldX},${oldY}) to (${newX},${newY})`);
            }
            // --- Real-time grid update after movement by key ---
            if (typeof window !== 'undefined' && typeof window.parent !== 'undefined' && window.parent !== window && typeof window.parent.postMessage === 'function') {
                window.parent.postMessage({
                    tbtGridUpdate: true,
                    gridData: {
                        width: this.canvas.width,
                        height: this.canvas.height,
                        board: this.board,
                        objects: this.objects,
                        output: this.output
                    }
                }, '*');
            }
        } catch (e) {
            this.logError(`Error moving object: ${e.message}`, { cmd, error: e });
        }
    }
}
