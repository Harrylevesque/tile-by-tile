// main.js: Connects lexer, parser, interpreter, and UI
import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { interpret } from './interpreter.js';

function colorFrom8Bit(state) {
    // 8-bit: RRR GGG BB (3+3+2 bits)
    // R: bits 5-7, G: bits 2-4, B: bits 0-1
    const r = ((state >> 5) & 0b111) * 36; // 0-252
    const g = ((state >> 2) & 0b111) * 36; // 0-252
    const b = (state & 0b11) * 85;         // 0, 85, 170, 255
    return `rgb(${r},${g},${b})`;
}

function generateTileGridHTML(width, height, board, objects) {
    let grid = '<style>\n.grid { display: grid; grid-template-columns: repeat(' + width + ', 32px); grid-template-rows: repeat(' + height + ', 32px); gap: 2px; }\n.tile { width: 32px; height: 32px; background: #e0e0e0; border: 1px solid #bbb; display: flex; align-items: center; justify-content: center; font-size: 14px; font-family: monospace; box-sizing: border-box; }\n</style>';
    grid += '<div class="grid">';
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const stack = board && board[y] ? board[y][x] : null;
            if (stack && stack.length > 0 && objects) {
                if (stack.length === 1) {
                    // Single object: fill the tile
                    const obj = objects[Number(stack[0])];
                    const color = colorFrom8Bit(obj.state || 0);
                    grid += `<div class="tile" title="id=${obj.id} state=${obj.state}" style="background:${color};color:#fff;">${obj.id}</div>`;
                } else {
                    // Multiple objects: show stack as bars
                    grid += '<div class="tile" style="padding:0;flex-direction:column;">';
                    for (let i = 0; i < stack.length; i++) {
                        const obj = objects[Number(stack[i])];
                        if (obj) {
                            const color = colorFrom8Bit(obj.state || 0);
                            grid += `<div title="id=${obj.id} state=${obj.state}" style="background:${color};color:#fff;width:100%;height:12px;line-height:12px;font-size:10px;overflow:hidden;">${obj.id}</div>`;
                        }
                    }
                    grid += '</div>';
                }
            } else {
                grid += `<div class="tile" title="(${x},${y})"></div>`;
            }
        }
    }
    grid += '</div>';
    return grid;
}

window.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('tbt-input');
    const runBtn = document.getElementById('run-btn');
    const output = document.getElementById('tbt-output');

    runBtn.addEventListener('click', () => {
        try {
            const code = input.value;
            const tokens = tokenize(code);
            const ast = parse(tokens);
            const result = interpret(ast);
            // Log everything to the console for debugging
            console.log('TBT code:', code);
            console.log('Tokens:', tokens);
            console.log('AST:', ast);
            console.log('Interpreter result:', result);
            output.textContent = result.output || result;
            // Find canvas node in AST
            const canvasNode = ast.find(n => n.type === 'canvas');
            if (canvasNode && result.board && result.objects) {
                // Open or reuse a window named 'view' and load view.html
                let win = window.open('view.html', 'view');
                if (win) {
                    // Wait for the window to load, then set grid data and errors
                    const gridData = {
                        width: canvasNode.width,
                        height: canvasNode.height,
                        board: result.board,
                        objects: result.objects,
                        output: result.output // Pass output log as well
                    };
                    const gridErrors = result.errors || null;
                    // Use a timer to wait for the window to be ready
                    const sendData = () => {
                        if (win && win.document && win.document.readyState === 'complete') {
                            win.gridData = gridData;
                            win.gridErrors = gridErrors;
                            if (typeof win.showGridAndErrors === 'function') {
                                win.showGridAndErrors();
                            } else {
                                // Fallback: reload the window to trigger onload
                                win.location.reload();
                            }
                        } else {
                            setTimeout(sendData, 50);
                        }
                    };
                    sendData();
                } else {
                    alert('Popup blocked! Please allow popups for this site.');
                }
            }
        } catch (e) {
            output.textContent = 'Error: ' + e.message;
            console.error('TBT Error:', e);
        }
    });
});

export { tokenize, parse, interpret };
