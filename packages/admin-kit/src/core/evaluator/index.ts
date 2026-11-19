/**
 * Safe, sandboxed expression evaluator for `visible_if` conditions.
 *
 * Implements strict zero-eval AST evaluation per docs/ARCHITECTURE.md Section 6.
 * Security & Sandbox Guarantees:
 * - Strictly parses tokenized recursive-descent grammar without code generation.
 * - Zero eval(): No eval(), new Function(), or indirect eval variants exist.
 * - Prototype pollution defense: Blocks lookups for __proto__, constructor, and prototype.
 * - Safe missing property resolution: Undefined fields evaluate cleanly to false/undefined without throwing.
 */

export interface EvaluationContext {
  row?: Record<string, any>;
  user?: {
    id?: string;
    email?: string;
    role?: string;
    roles?: string[];
    permissions?: string[];
    [key: string]: any;
  };
}

const FORBIDDEN_PROPERTIES = new Set(["__proto__", "constructor", "prototype"]);

function isForbiddenProperty(prop: string): boolean {
  return FORBIDDEN_PROPERTIES.has(prop);
}

/**
 * Robust equality comparison supporting loose JSON string/number equivalence
 * while ensuring undefined/null are not mistakenly matched against string literals.
 */
function compareEqual(left: any, right: any): boolean {
  if (left === right) return true;
  // Loose equality between null and undefined matches JS standard behavior
  if ((left === null && right === undefined) || (left === undefined && right === null)) {
    return true;
  }
  // Null or undefined does not match string representations like "undefined" or "null"
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }
  return String(left) === String(right);
}

type TokenType =
  | "IDENTIFIER"
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "NULL"
  | "OPERATOR"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "COMMA"
  | "DOT"
  | "NOT"
  | "EOF";

interface Token {
  type: TokenType;
  value: any;
}

/**
 * Tokenizes a simple conditional expression string.
 */
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // String literals: '...' or "..."
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = "";
      i++;
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === "\\") {
          i++;
          if (i < expr.length) str += expr[i];
        } else {
          str += expr[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: "STRING", value: str });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let numStr = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: parseFloat(numStr) });
      continue;
    }

    // Two-character and multi-character operators
    const twoChars = expr.slice(i, i + 2);
    const threeChars = expr.slice(i, i + 3);

    if (threeChars === "===" || threeChars === "!==") {
      tokens.push({ type: "OPERATOR", value: threeChars });
      i += 3;
      continue;
    }

    if (twoChars === "==" || twoChars === "!=" || twoChars === ">=" || twoChars === "<=" || twoChars === "&&" || twoChars === "||") {
      tokens.push({ type: "OPERATOR", value: twoChars });
      i += 2;
      continue;
    }

    // Single-character operators and punctuation
    if (ch === ">" || ch === "<") {
      tokens.push({ type: "OPERATOR", value: ch });
      i++;
      continue;
    }

    if (ch === "!") {
      tokens.push({ type: "NOT", value: "!" });
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }

    if (ch === "[") {
      tokens.push({ type: "LBRACKET", value: "[" });
      i++;
      continue;
    }

    if (ch === "]") {
      tokens.push({ type: "RBRACKET", value: "]" });
      i++;
      continue;
    }

    if (ch === ",") {
      tokens.push({ type: "COMMA", value: "," });
      i++;
      continue;
    }

    if (ch === ".") {
      tokens.push({ type: "DOT", value: "." });
      i++;
      continue;
    }

    // Identifiers or keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }

      if (ident === "true") {
        tokens.push({ type: "BOOLEAN", value: true });
      } else if (ident === "false") {
        tokens.push({ type: "BOOLEAN", value: false });
      } else if (ident === "null") {
        tokens.push({ type: "NULL", value: null });
      } else if (ident === "undefined") {
        tokens.push({ type: "NULL", value: undefined });
      } else if (ident === "in") {
        tokens.push({ type: "OPERATOR", value: "in" });
      } else {
        tokens.push({ type: "IDENTIFIER", value: ident });
      }
      continue;
    }

    i++;
  }

  tokens.push({ type: "EOF", value: null });
  return tokens;
}

/**
 * Recursive descent AST evaluator without code generation or eval.
 */
class SafeEvaluator {
  private tokens: Token[];
  private current: number = 0;
  private context: EvaluationContext;

  constructor(tokens: Token[], context: EvaluationContext) {
    this.tokens = tokens;
    this.context = context;
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: "EOF", value: null };
  }

  private advance(): Token {
    const t = this.peek();
    this.current++;
    return t;
  }

  private match(type: TokenType, value?: any): boolean {
    const t = this.peek();
    if (t.type === type && (value === undefined || t.value === value)) {
      this.advance();
      return true;
    }
    return false;
  }

  public parse(): boolean {
    if (this.tokens.length <= 1) return true;
    return Boolean(this.expression());
  }

  // expression := logicalOr
  private expression(): any {
    return this.logicalOr();
  }

  // logicalOr := logicalAnd ( "||" logicalAnd )*
  private logicalOr(): any {
    let left = this.logicalAnd();
    while (this.match("OPERATOR", "||")) {
      const right = this.logicalAnd();
      left = Boolean(left || right);
    }
    return left;
  }

  // logicalAnd := equality ( "&&" equality )*
  private logicalAnd(): any {
    let left = this.equality();
    while (this.match("OPERATOR", "&&")) {
      const right = this.equality();
      left = Boolean(left && right);
    }
    return left;
  }

  // equality := relational ( ("==" | "===" | "!=" | "!==") relational )*
  private equality(): any {
    let left = this.relational();
    while (true) {
      if (this.match("OPERATOR", "==") || this.match("OPERATOR", "===")) {
        const right = this.relational();
        left = compareEqual(left, right);
      } else if (this.match("OPERATOR", "!=") || this.match("OPERATOR", "!==")) {
        const right = this.relational();
        left = !compareEqual(left, right);
      } else {
        break;
      }
    }
    return left;
  }

  // relational := unary ( (">" | "<" | ">=" | "<=" | "in") unary )*
  private relational(): any {
    let left = this.unary();
    while (true) {
      if (this.match("OPERATOR", ">")) {
        const right = this.unary();
        left = Number(left) > Number(right);
      } else if (this.match("OPERATOR", "<")) {
        const right = this.unary();
        left = Number(left) < Number(right);
      } else if (this.match("OPERATOR", ">=")) {
        const right = this.unary();
        left = Number(left) >= Number(right);
      } else if (this.match("OPERATOR", "<=")) {
        const right = this.unary();
        left = Number(left) <= Number(right);
      } else if (this.match("OPERATOR", "in")) {
        const right = this.unary();
        if (isForbiddenProperty(String(left))) {
          left = false;
        } else if (Array.isArray(right)) {
          left = right.includes(left);
        } else if (typeof right === "object" && right !== null) {
          left = Object.prototype.hasOwnProperty.call(right, left);
        } else if (typeof right === "string") {
          left = right.includes(String(left));
        } else {
          left = false;
        }
      } else {
        break;
      }
    }
    return left;
  }

  // unary := ( "!" ) unary | primary
  private unary(): any {
    if (this.match("NOT", "!")) {
      return !this.unary();
    }
    return this.primary();
  }

  // primary := NUMBER | STRING | BOOLEAN | NULL | LPAREN expression RPAREN | LBRACKET list RBRACKET | memberAccess
  private primary(): any {
    const t = this.peek();

    if (this.match("NUMBER")) return t.value;
    if (this.match("STRING")) return t.value;
    if (this.match("BOOLEAN")) return t.value;
    if (this.match("NULL")) return t.value;

    if (this.match("LPAREN")) {
      const val = this.expression();
      this.match("RPAREN");
      return val;
    }

    if (this.match("LBRACKET")) {
      const list: any[] = [];
      if (!this.match("RBRACKET")) {
        do {
          list.push(this.expression());
        } while (this.match("COMMA"));
        this.match("RBRACKET");
      }
      return list;
    }

    return this.memberAccess();
  }

  // memberAccess := IDENTIFIER ( "." IDENTIFIER )*
  private memberAccess(): any {
    const rootToken = this.peek();
    if (!this.match("IDENTIFIER")) {
      // Advance to avoid infinite loop on unrecognized token
      this.advance();
      return undefined;
    }

    const rootName = String(rootToken.value);

    // Prototype pollution guard on root identifier
    if (isForbiddenProperty(rootName)) {
      return undefined;
    }

    let targetObj: any;

    if (rootName === "row") {
      targetObj = this.context.row;
    } else if (rootName === "user") {
      targetObj = this.context.user;
    } else {
      // Check if rootName exists directly in context.row or context.user
      if (this.context.row && Object.prototype.hasOwnProperty.call(this.context.row, rootName)) {
        targetObj = this.context.row[rootName];
      } else if (this.context.user && Object.prototype.hasOwnProperty.call(this.context.user, rootName)) {
        targetObj = this.context.user[rootName];
      } else {
        targetObj = undefined;
      }
    }

    while (this.match("DOT")) {
      const propToken = this.peek();
      if (this.match("IDENTIFIER")) {
        const propName = String(propToken.value);

        // Strict prototype pollution guard: block __proto__, constructor, prototype
        if (isForbiddenProperty(propName)) {
          targetObj = undefined;
          continue;
        }

        if (targetObj !== null && targetObj !== undefined && typeof targetObj === "object") {
          if (Object.prototype.hasOwnProperty.call(targetObj, propName)) {
            targetObj = targetObj[propName];
          } else if (propName in targetObj && !Object.prototype.hasOwnProperty.call(Object.prototype, propName)) {
            targetObj = targetObj[propName];
          } else {
            targetObj = undefined;
          }
        } else {
          // Intermediate property was undefined or null - resolve safely to undefined
          targetObj = undefined;
        }
      }
    }

    return targetObj;
  }
}

/**
 * Safely evaluates a conditional expression without eval() or new Function().
 *
 * @param expression Conditional expression string, e.g. "row.status == 'pending'"
 * @param context Evaluation context containing row and user dictionaries
 * @returns boolean outcome of expression evaluation
 */
export function evaluateExpression(
  expression: string | undefined | null,
  context: EvaluationContext = {}
): boolean {
  if (!expression || !expression.trim()) {
    return true;
  }

  try {
    const tokens = tokenize(expression.trim());
    const evaluator = new SafeEvaluator(tokens, context);
    return Boolean(evaluator.parse());
  } catch (err) {
    console.warn(`[admin-kit/core] Expression evaluation error: "${expression}"`, err);
    return false;
  }
}
