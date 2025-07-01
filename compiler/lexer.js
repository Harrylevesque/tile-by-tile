// TBT Language Lexer: Tokenizes TBT source code
// Usage: const tokens = tokenize(sourceCode);

export function tokenize(input) {
    const tokens = [];
    let i = 0;
    let line = 0;
    const WHITESPACE = /[ \t\r\n]/;
    const NUMBER = /[0-9]/;
    const IDENT = /[a-zA-Z_][a-zA-Z0-9_]*/;

    function skipWhitespace() {
        while (i < input.length && WHITESPACE.test(input[i])) {
            if (input[i] === '\n') line++;
            i++;
        }
    }

    function readWhile(regex) {
        let str = '';
        while (i < input.length && regex.test(input[i])) {
            str += input[i++];
        }
        return str;
    }

    while (i < input.length) {
        skipWhitespace();
        if (i >= input.length) break;
        // Comments
        if (input.slice(i, i+2) === '/-') {
            i += 2;
            while (i < input.length && input.slice(i, i+2) !== '-/') {
                if (input[i] === '\n') line++;
                i++;
            }
            i += 2;
            continue;
        }
        // Numbers
        if (NUMBER.test(input[i])) {
            const num = readWhile(NUMBER);
            tokens.push({ type: 'number', value: Number(num), line });
            continue;
        }
        // Identifiers & keywords
        if (/[a-zA-Z_]/.test(input[i])) {
            const ident = readWhile(/[a-zA-Z0-9_]/);
            tokens.push({ type: 'ident', value: ident, line });
            continue;
        }
        // Operators and special symbols
        if (input[i] === '=') {
            tokens.push({ type: 'equals', value: '=', line });
            i++;
            continue;
        }
        if (input[i] === '(') {
            tokens.push({ type: 'lparen', value: '(', line });
            i++;
            continue;
        }
        if (input[i] === ')') {
            tokens.push({ type: 'rparen', value: ')', line });
            i++;
            continue;
        }
        if (input[i] === '<' || input[i] === '>') {
            tokens.push({ type: 'angle', value: input[i], line });
            i++;
            continue;
        }
        if (input[i] === '.') {
            // ..true, ..false, ...
            let dots = '';
            while (input[i] === '.') { dots += input[i++]; }
            tokens.push({ type: 'dots', value: dots, line });
            continue;
        }
        if (input[i] === ',') {
            tokens.push({ type: 'comma', value: ',', line });
            i++;
            continue;
        }
        if (input[i] === '[') {
            tokens.push({ type: 'lbracket', value: '[', line });
            i++;
            continue;
        }
        if (input[i] === ']') {
            tokens.push({ type: 'rbracket', value: ']', line });
            i++;
            continue;
        }
        // Everything else as single char
        tokens.push({ type: 'char', value: input[i++], line });
    }
    return tokens;
}
