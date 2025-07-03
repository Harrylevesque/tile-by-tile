// TBT Language Parser: Converts tokens to AST
// Usage: const ast = parse(tokens);

export function parse(tokens) {
    let i = 0;
    function peek(offset = 0) { return tokens[i + offset]; }
    function next() { return tokens[i++]; }
    function errorWithLine(msg) {
        const t = tokens[i] || tokens[tokens.length-1];
        const line = t && t.line != null ? t.line + 1 : '?';
        throw new Error(`${msg} (at line ${line})`);
    }
    // Patch expect to use errorWithLine
    function expect(type, value) {
        const t = next();
        if (!t || t.type !== type || (value && t.value !== value)) errorWithLine(`Expected ${type} ${value || ''}`);
        return t;
    }
    function parseNumberOrIdent() {
        const t = peek();
        if (t.type === 'number') return next();
        if (t.type === 'ident') return next();
        throw new Error('Expected number or identifier');
    }
    function parseValue() {
        const t = peek();
        if (!t) throw new Error('Unexpected end of input');
        // Only allow expressions/functions/refs inside brackets
        if (t.type === 'lbracket') {
            next(); // consume [
            const expr = parseBracketedExpression();
            expect('rbracket');
            return expr;
        }
        // Handle ref(name) function calls even when unbracketed
        if (t.type === 'ident' && t.value === 'ref' && peek(1) && peek(1).type === 'lparen') {
            next(); // consume 'ref'
            expect('lparen');
            const varNameToken = expect('ident');
            const varName = { type: 'ident', value: varNameToken.value };
            expect('rparen');
            return { type: 'func', name: 'ref', args: [varName] };
        }
        // Unbracketed: only allow literal numbers
        if (t.type === 'number') return { type: 'number', value: next().value };
        // Unbracketed: treat identifiers as literal (not as variable or function)
        if (t.type === 'ident') return { type: 'ident', value: next().value };
        throw new Error('Expected value (number or [expression])');
    }

    // Parse a function call or variable reference inside brackets
    function parseBracketedExpression() {
        const t = peek();
        if (!t) throw new Error('Unexpected end of input in [ ]');
        if (t.type === 'ident') {
            const funcName = t.value;
            if (["add","sub","mul","div","mod","random","rand"].includes(funcName)) {
                next();
                // Accept optional lparen for function call
                let hasParen = false;
                if (peek() && peek().type === 'lparen') {
                    hasParen = true;
                    next();
                }
                const args = [];
                // Fix: Only parse args if not at rparen/rbracket
                while (peek() && ((hasParen && peek().type !== 'rparen') || (!hasParen && peek().type !== 'rbracket'))) {
                    // If at rparen or rbracket, break (prevents over-consuming after nested calls)
                    if (peek().type === 'rparen' || peek().type === 'rbracket') break;
                    args.push(parseValue());
                    // Skip any commas, but don't require them
                    while (peek() && peek().type === 'comma') next();
                }
                if (hasParen) expect('rparen');
                return { type: 'func', name: funcName === 'rand' ? 'random' : funcName, args };
            } else if (funcName === 'ref' && peek(1) && peek(1).type === 'lparen') {
                next();
                expect('lparen');
                // Fix: Handle identifier arguments directly, not through parseValue
                const varNameToken = expect('ident');
                const varName = { type: 'ident', value: varNameToken.value };
                expect('rparen');
                return { type: 'func', name: 'ref', args: [varName] };
            } else {
                // Variable name (as literal)
                return { type: 'ident', value: next().value };
            }
        } else if (t.type === 'number') {
            return { type: 'number', value: next().value };
        } else if (t.type === 'lbracket') {
            // Nested bracketed expression
            next();
            const expr = parseBracketedExpression();
            expect('rbracket');
            return expr;
        }
        throw new Error('Expected expression or value inside [ ]');
    }

    function parseStatement() {
        const t = peek();
        if (!t) return null;
        // canvas
        if (t.type === 'ident' && t.value === 'canvas') {
            next();
            const width = expect('number').value;
            const height = expect('number').value;
            return { type: 'canvas', width, height };
        }
        if (t.type === 'ident' && t.value === 'ref' && peek(1) && peek(1).type === 'equals') {
            // ref=name assignment: ref=name(value)
            next(); // consume 'ref'
            expect('equals');
            const varName = expect('ident').value;
            expect('lparen');
            const value = parseValue();
            expect('rparen');
            return { type: 'ref_assign', name: varName, value };
        }
        // ref(name) variable reference as value
        if (t.type === 'ident' && t.value === 'ref' && peek(1) && peek(1).type === 'lparen') {
            next();
            expect('lparen');
            const varName = expect('ident').value;
            expect('rparen');
            return { type: 'func', name: 'ref', args: [{ type: 'ident', value: varName }] };
        }
        // spawn command
        if (t.type === 'ident' && t.value === 'spawn') {
            next();
            let id = null, x = null, y = null, state = null;
            while (peek() && peek().type === 'ident') {
                const key = peek().value;
                if (["id","x","y","state"].includes(key)) {
                    next();
                    expect('equals');
                    const val = parseValue();
                    if (key === 'id') id = val;
                    if (key === 'x') x = val;
                    if (key === 'y') y = val;
                    if (key === 'state') state = val;
                } else {
                    break;
                }
            }
            // Default to 0 if not set (so id=0 is valid)
            if (id === null) id = { type: 'number', value: 0 };
            if (x === null) x = { type: 'number', value: 0 };
            if (y === null) y = { type: 'number', value: 0 };
            if (state === null) state = { type: 'number', value: 0 };
            return { type: 'spawn', id, x, y, state };
        }
        // despawn command
        if (t.type === 'ident' && t.value === 'despawn') {
            next();
            expect('ident', 'id');
            expect('equals');
            const id = expect('number').value;
            return { type: 'despawn', id };
        }
        // move command
        if (t.type === 'ident' && t.value === 'move') {
            next();
            let id = null, x = undefined, y = undefined, rel, set = null, swap = false;
            // Parse id=...
            if (peek() && peek().type === 'ident' && peek().value === 'id') {
                next();
                expect('equals');
                id = parseValue();
            }
            // Support shorthand: move id=1 up/left/right/down/over/under or w/a/s/d
            const keyToDir = { w: 'up', a: 'left', s: 'down', d: 'right' };
            if (peek() && peek().type === 'ident') {
                let val = peek().value;
                if (["left","right","up","down","over","under"].includes(val)) {
                    rel = val;
                    next();
                } else if (keyToDir[val]) {
                    rel = keyToDir[val];
                    next();
                }
            }
            // Parse other properties (x, y, set, swap)
            while (peek() && peek().type === 'ident') {
                const key = peek().value;
                if (["x","y"].includes(key)) {
                    next();
                    expect('equals');
                    const val = parseValue();
                    if (key === 'x') x = val;
                    if (key === 'y') y = val;
                } else if (["left","right","up","down","over","under"].includes(key)) {
                    rel = key;
                    next();
                } else if (keyToDir[key]) {
                    rel = keyToDir[key];
                    next();
                } else if (key === 'set') {
                    next();
                    set = parseValue();
                } else if (key === 'swap') {
                    swap = true;
                    next();
                } else {
                    break;
                }
            }
            if (id === null) id = { type: 'number', value: 0 };
            // Only set x/y if defined
            return { type: 'move', id, x, y, rel, set, swap };
        }
        // Standalone math/logic expression as statement
        if (t.type === 'ident' && ["add","sub","mul","div","mod","random","rand","ref"].includes(t.value)) {
            // Normalize 'rand' to 'random'
            const expr = parseValue();
            return { type: 'expr', expr };
        }
        // wait command
        if (t.type === 'ident' && t.value === 'wait') {
            next();
            let duration = null;
            if (peek() && peek().type === 'number') {
                duration = next().value;
            } else {
                errorWithLine('Expected duration (number) after wait');
            }
            return { type: 'wait', duration };
        }
        // repeat command
        if (t.type === 'ident' && t.value === 'repeat') {
            next();
            const delay = expect('number').value;
            let count = null;
            if (peek() && peek().type === 'number') {
                count = next().value;
            } else if (peek() && peek().type === 'ident' && peek().value === 'forever') {
                next();
                count = 'forever';
            }
            // Parse block: . statements until next non-dot or EOF
            const block = [];
            while (peek() && peek().type === 'dots' && peek().value === '.') {
                next();
                const stmt = parseStatement();
                if (stmt) block.push(stmt);
            }
            return { type: 'repeat', delay, count, block };
        }
        // if command
        if (t.type === 'ident' && t.value === 'if') {
            next();
            expect('ident', 'id');
            expect('equals');
            const leftId = parseValue();
            expect('ident', 'is');
            // relation: under, over, left, right, on, is, assigned
            const relationToken = expect('ident');
            const relation = relationToken.value;
            let rightId = null;
            let assignedKey = null;
            if (relation === 'assigned') {
                // if id=1 is assigned w
                const keyToken = expect('ident');
                assignedKey = keyToken.value;
            } else {
                if (relation !== 'assigned') {
                    expect('ident', 'id');
                    expect('equals');
                    rightId = parseValue();
                }
            }
            // Parse .true and .false blocks (each with one dot)
            let trueBlock = [], falseBlock = [];
            // Only parse .true if the next ident is 'true'
            if (peek() && peek().type === 'dots' && peek(1) && peek(1).type === 'ident' && peek(1).value === 'true') {
                next();
                const trueLabel = expect('ident');
                if (trueLabel.value !== 'true') errorWithLine('Expected true after . in if');
                while (peek() && peek().type === 'dots' && (!peek(1) || (peek(1).type !== 'ident' || (peek(1).value !== 'true' && peek(1).value !== 'false')))) {
                    next();
                    const stmt = parseStatement();
                    if (stmt) trueBlock.push(stmt);
                }
            }
            // Only parse .false if the next ident is 'false'
            if (peek() && peek().type === 'dots' && peek(1) && peek(1).type === 'ident' && peek(1).value === 'false') {
                next();
                const falseLabel = expect('ident');
                if (falseLabel.value !== 'false') errorWithLine('Expected false after . in if');
                while (peek() && peek().type === 'dots' && (!peek(1) || (peek(1).type !== 'ident' || (peek(1).value !== 'true' && peek(1).value !== 'false')))) {
                    next();
                    const stmt = parseStatement();
                    if (stmt) falseBlock.push(stmt);
                }
            }
            // Always return both blocks, even if falseBlock is empty
            return {
                type: 'if',
                leftId,
                relation,
                rightId,
                assignedKey,
                trueBlock,
                falseBlock
            };
        }
        // assign command
        if (t.type === 'ident' && t.value === 'assign') {
            next();
            const keyToken = expect('ident');
            const key = keyToken.value;
            expect('ident', 'to');
            // assign ... to ref(name) or assign ... to id=VALUE
            let value = null;
            if (peek() && peek().type === 'ident' && peek().value === 'ref' && peek(1) && peek(1).type === 'lparen') {
                next();
                expect('lparen');
                const varName = expect('ident').value;
                expect('rparen');
                value = { type: 'func', name: 'ref', args: [{ type: 'ident', value: varName }] };
            } else if (peek() && peek().type === 'ident' && peek().value === 'id') {
                next();
                expect('equals');
                value = parseValue(); // Accept any value, not just number
            } else {
                errorWithLine('Expected ref(name) or id=number after to in assign');
            }
            return { type: 'assign', key, value };
        }
        // move, spawn, despawn, assign, repeat, if, etc.
        // For brevity, only canvas and ref= are implemented here.
        // Extend as needed for full language support.
        return null;
    }
    const ast = [];
    while (i < tokens.length) {
        const stmt = parseStatement();
        if (stmt) ast.push(stmt);
        else i++;
    }
    return ast;
}
