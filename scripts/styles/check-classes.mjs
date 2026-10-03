#!/usr/bin/env node
/**
 * Read-only class drift check for the ordinary-CSS application.
 * Uses Vue's existing SFC/Babel parsers; does not compile or generate CSS.
 * See README.md in this directory for the deliberately finite analysis contract.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { babelParse, parse as parseSfc } from 'vue/compiler-sfc'

const LIMIT = 512
const markers = JSON.parse(fs.readFileSync(new URL('./unstyled-markers.json', import.meta.url), 'utf8'))
const unknown = reason => [{ kind: 'unknown', reason }]
const union = (...values) => {
  const result = [...new Set(values.flat())]
  return result.length > LIMIT ? unknown(`finite output exceeds ${LIMIT} alternatives`) : result
}
const keyOf = node => node?.name ?? node?.value
const property = (object, name) => object?.properties?.find(p => !p.computed && keyOf(p.key) === name)
const functionNode = node =>
  ['ObjectMethod', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node?.type)
const expression = source => babelParse(`(${source})`, { sourceType: 'module' }).program.body[0].expression
const isMember = node => ['MemberExpression', 'OptionalMemberExpression'].includes(node?.type)
const isCall = node => ['CallExpression', 'OptionalCallExpression'].includes(node?.type)
const isUnknown = value => value && typeof value === 'object' && value.kind === 'unknown'
const primitive = value => value === null || !['object', 'function'].includes(typeof value)
const camel = name => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())

function walkAst(node, visit) {
  if (!node || typeof node !== 'object') return
  if (node.type) visit(node)
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'tokens', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) continue
    if (Array.isArray(value)) for (const child of value) walkAst(child, visit)
    else if (value && typeof value === 'object') walkAst(value, visit)
  }
}

/** CSS identifier tokenization, including escaped ':' '/' '[' and hex escapes.
 * Attribute strings/comments cannot contribute class names. PostCSS handles
 * rules, nesting and media/container at-rules; no CSS is generated here.
 */
export function selectorClasses(selector) {
  const classes = new Set()
  let i = 0
  const readEscape = () => {
    i++
    const start = i
    while (i < selector.length && /[\da-f]/i.test(selector[i]) && i - start < 6) i++
    if (i > start) {
      const point = Number.parseInt(selector.slice(start, i), 16)
      if (/\s/.test(selector[i] || 'x')) i++
      return String.fromCodePoint(point > 0 && point <= 0x10ffff ? point : 0xfffd)
    }
    return selector[i++] || ''
  }
  while (i < selector.length) {
    if (selector.slice(i, i + 2) === '/*') {
      i = selector.indexOf('*/', i + 2)
      if (i < 0) break
      i += 2
    } else if (selector[i] === '"' || selector[i] === "'") {
      const quote = selector[i++]
      while (i < selector.length && selector[i] !== quote) {
        if (selector[i] === '\\') readEscape()
        else i++
      }
      i++
    } else if (selector[i] === '\\') readEscape()
    else if (selector[i++] === '.') {
      let name = ''
      while (i < selector.length) {
        if (selector[i] === '\\') name += readEscape()
        else if (/[\w-]/.test(selector[i]) || selector.charCodeAt(i) >= 128) name += selector[i++]
        else break
      }
      if (name) classes.add(name)
    }
  }
  return classes
}

function cssClasses(source, filename) {
  const classes = new Set()
  const ast = postcss.parse(source, { from: filename })
  ast.walkRules(rule => {
    // A nested rule under @keyframes is a percentage, never a class selector.
    for (const name of selectorClasses(rule.selector)) classes.add(name)
  })
  ast.walkAtRules(rule => {
    if (['apply', 'tailwind', 'config', 'screen'].includes(rule.name)) {
      throw new Error(`${filename}: @${rule.name} requires a removed CSS compiler; write ordinary CSS`)
    }
  })
  return classes
}

function lookup(name, env, context) {
  if (name === 'undefined') return [undefined]
  const binding = env.get(name)
  if (!binding) return unknown(`unresolved identifier ${name}`)
  if (binding.invalidReason) return unknown(binding.invalidReason)
  if (binding.kind === 'lazy') {
    if (context.stack.has(binding)) return unknown(`cyclic binding ${name}`)
    context.stack.add(binding)
    const result = evaluate(binding.node, binding.env, context)
    context.stack.delete(binding)
    return result
  }
  if (binding.kind === 'computed') return callFunction(binding.fn, [], context)
  if (binding.kind === 'prop') return context.resolveProp(binding.model, name, context)
  return binding
}

function member(values, keys) {
  const result = []
  for (const value of values) {
    if (isUnknown(value)) result.push(value)
    else if (value?.kind === 'record') {
      for (const key of keys) {
        if (isUnknown(key)) result.push(...[...value.fields.values()].flat(), undefined)
        else result.push(...(value.fields.get(String(key)) ?? [undefined]))
      }
    } else if (value === undefined || value === null) result.push(undefined)
    else result.push(...unknown('member lookup on a non-finite object'))
  }
  return union(result)
}

function evaluate(node, env, context) {
  if (!node) return [undefined]
  // Inspect the complete expression before any abstract shortcut (including
  // !, void, comparisons and short-circuit conditions) can hide side effects.
  effects(node, env)
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return [node.value]
    case 'NullLiteral':
      return [null]
    case 'Identifier':
      return lookup(node.name, env, context)
    case 'ObjectMethod':
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return [{ kind: 'function', node, env }]
    case 'ObjectExpression': {
      const fields = new Map()
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') return unknown('object spread needs explicit finite class keys')
        const keys = prop.computed ? evaluate(prop.key, env, context) : [keyOf(prop.key)]
        for (const key of keys) {
          if (!primitive(key)) return unknown('computed object key is not finite')
          fields.set(
            String(key),
            prop.type === 'ObjectMethod' ? evaluate(prop, env, context) : evaluate(prop.value, env, context)
          )
        }
      }
      return [{ kind: 'record', fields }]
    }
    case 'ArrayExpression': {
      if (node.elements.some(n => n?.type === 'SpreadElement'))
        return unknown('array spread needs explicit finite classes')
      return [{ kind: 'array', items: node.elements.map(n => evaluate(n, env, context)) }]
    }
    case 'ConditionalExpression':
      return union(evaluate(node.consequent, new Map(env), context), evaluate(node.alternate, new Map(env), context))
    case 'LogicalExpression': {
      // Conditions may be open-ended; class-valued branches may not.
      const left = evaluate(node.left, env, context)
      const right = evaluate(node.right, env, context)
      if (node.operator === '&&') return union([false], right)
      return union(
        left.filter(value => value || isUnknown(value)),
        right
      )
    }
    case 'BinaryExpression': {
      if (node.operator !== '+') return unknown(`non-class binary operation ${node.operator}`)
      const left = evaluate(node.left, env, context),
        right = evaluate(node.right, env, context)
      if (left.some(v => !primitive(v)) || right.some(v => !primitive(v)))
        return unknown('unresolved dynamically assembled class (+)')
      return union(left.flatMap(a => right.map(b => a + b)))
    }
    case 'TemplateLiteral': {
      let values = [node.quasis[0].value.cooked]
      for (let i = 0; i < node.expressions.length; i++) {
        const part = evaluate(node.expressions[i], env, context)
        if (part.some(v => !primitive(v))) return unknown('unresolved dynamically assembled class (template literal)')
        values = union(values.flatMap(a => part.map(b => `${a}${b}${node.quasis[i + 1].value.cooked}`)))
      }
      return values
    }
    case 'MemberExpression':
    case 'OptionalMemberExpression': {
      if (node.object.type === 'ThisExpression' && !node.computed)
        return lookup(node.property.name, context.model.env, context)
      const keys = node.computed ? evaluate(node.property, env, context) : [keyOf(node.property)]
      return member(evaluate(node.object, env, context), keys)
    }
    case 'CallExpression':
    case 'OptionalCallExpression': {
      const callees = evaluate(node.callee, env, context)
      const args = node.arguments.map(arg => evaluate(arg, env, context))
      return union(
        ...callees.map(callee =>
          callee?.kind === 'function'
            ? callFunction(callee, args, context)
            : unknown('call output is not a local finite helper')
        )
      )
    }
    case 'UnaryExpression':
      if (node.operator === '!') return [true, false]
      if (node.operator === 'void') return [undefined]
      return unknown(`unsupported unary class expression ${node.operator}`)
    default:
      return unknown(`unsupported class expression ${node.type}`)
  }
}

function assignmentTargets(node) {
  if (!node) return []
  if (node.type === 'Identifier') return [{ name: node.name, member: false }]
  if (node.type === 'ObjectPattern')
    return node.properties.flatMap(prop => assignmentTargets(prop.type === 'RestElement' ? prop.argument : prop.value))
  if (node.type === 'ArrayPattern') return node.elements.flatMap(assignmentTargets)
  if (node.type === 'RestElement') return assignmentTargets(node.argument)
  if (node.type === 'AssignmentPattern') return assignmentTargets(node.left)
  if (isMember(node)) {
    let root = node
    while (isMember(root)) root = root.object
    return root?.type === 'Identifier' ? [{ name: root.name, member: true }] : []
  }
  return []
}

function namesInPattern(node) {
  return assignmentTargets(node).map(target => target.name)
}

// Unknown effects must never silently leave a previously finite local map valid.
function effects(node, env) {
  const invalidate = name => {
    // Mutable collection aliases must not retain a stale finite value. The
    // supported class helpers use literal maps, not mutating collections.
    for (const [binding, value] of env) {
      if (
        binding === name ||
        (Array.isArray(value) && value.some(item => item?.kind === 'record' || item?.kind === 'array'))
      ) {
        env.set(binding, unknown(`mutation of ${name}`))
      }
    }
  }
  walkAst(node, child => {
    if (child.type === 'AssignmentExpression' || child.type === 'UpdateExpression') {
      for (const target of assignmentTargets(child.left ?? child.argument)) {
        if (env.has(target.name)) invalidate(target.name)
      }
    }
    if (child.type === 'CallExpression' || child.type === 'OptionalCallExpression') {
      const candidates = [...child.arguments, ...(child.callee.object ? [child.callee.object] : [])]
      for (const arg of candidates) {
        for (const target of assignmentTargets(arg)) {
          const value = env.get(target.name)
          if (Array.isArray(value) && value.some(v => v?.kind === 'record' || v?.kind === 'array'))
            invalidate(target.name)
        }
      }
    }
  })
}

function hasLocalFunction(values) {
  return values.some(
    value =>
      value?.kind === 'function' ||
      (value?.kind === 'record' && [...value.fields.values()].some(hasLocalFunction)) ||
      (value?.kind === 'array' && value.items.some(hasLocalFunction))
  )
}

function statements(nodes, initial, context) {
  let live = [initial],
    returned = []
  for (const node of nodes) {
    const next = []
    for (const env of live) {
      if (node.type === 'ReturnStatement') returned = union(returned, evaluate(node.argument, env, context))
      else if (node.type === 'VariableDeclaration') {
        for (const declaration of node.declarations) {
          effects(declaration.init, env)
          const value = evaluate(declaration.init, env, context)
          if (hasLocalFunction(value))
            return { live: [], returned: unknown('nested class helper functions require an explicit finite rewrite') }
          if (declaration.id.type === 'Identifier') env.set(declaration.id.name, value)
          else for (const name of namesInPattern(declaration.id)) env.set(name, unknown(`destructured ${name}`))
        }
        next.push(env)
      } else if (node.type === 'IfStatement') {
        effects(node.test, env)
        for (const branch of [node.consequent, node.alternate]) {
          const result = statements(
            branch ? (branch.type === 'BlockStatement' ? branch.body : [branch]) : [],
            new Map(env),
            context
          )
          next.push(...result.live)
          returned = union(returned, result.returned)
        }
      } else if (node.type === 'BlockStatement') {
        const result = statements(node.body, new Map(env), context)
        next.push(...result.live)
        returned = union(returned, result.returned)
      } else if (node.type === 'ExpressionStatement') {
        const assignment = node.expression
        if (
          assignment.type === 'AssignmentExpression' &&
          assignment.operator === '=' &&
          assignment.left.type === 'Identifier'
        ) {
          const value = evaluate(assignment.right, env, context)
          if (hasLocalFunction(value))
            return { live: [], returned: unknown('nested class helper functions require an explicit finite rewrite') }
          env.set(assignment.left.name, value)
        } else effects(assignment, env)
        next.push(env)
      } else if (node.type === 'FunctionDeclaration') {
        returned = union(returned, unknown('nested class helper functions require an explicit finite rewrite'))
      } else if (node.type === 'EmptyStatement') next.push(env)
      else returned = union(returned, unknown(`helper statement ${node.type} requires an explicit finite rewrite`))
    }
    live = next
    if (live.length > LIMIT) return { live: [], returned: unknown('too many helper branches') }
  }
  return { live, returned }
}

function callFunction(fn, args, context) {
  if (context.stack.has(fn.node)) return unknown('recursive class helper')
  context.stack.add(fn.node)
  const env = new Map(fn.env)
  for (let i = 0; i < fn.node.params.length; i++) {
    const param = fn.node.params[i]
    if (param.type === 'Identifier') env.set(param.name, args[i] ?? unknown(`parameter ${param.name}`))
    else for (const name of namesInPattern(param)) env.set(name, unknown(`parameter ${name}`))
  }
  let result
  if (fn.node.body.type === 'BlockStatement') {
    const execution = statements(fn.node.body.body, env, context)
    result = union(execution.returned, execution.live.length ? [undefined] : [])
  } else result = evaluate(fn.node.body, env, context)
  context.stack.delete(fn.node)
  return result
}

function classTokens(values) {
  const tokens = new Set(),
    problems = new Set()
  const visit = value => {
    if (isUnknown(value)) problems.add(value.reason)
    else if (typeof value === 'string') for (const token of value.split(/\s+/).filter(Boolean)) tokens.add(token)
    else if (value?.kind === 'array') for (const item of value.items) for (const member of item) visit(member)
    else if (value?.kind === 'record') for (const key of value.fields.keys()) visit(key)
    else if (value !== undefined && value !== null && value !== false && value !== true && value !== 0)
      problems.add('class output must be a finite string, array or keyed object')
  }
  for (const value of values) visit(value)
  return { tokens, problems }
}

function declare(nodes, env) {
  for (const statement of nodes) {
    const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
    if (node?.type === 'FunctionDeclaration') env.set(node.id.name, [{ kind: 'function', node, env }])
    if (node?.type === 'VariableDeclaration')
      for (const declaration of node.declarations) {
        if (declaration.id.type === 'Identifier')
          env.set(declaration.id.name, { kind: 'lazy', node: declaration.init, env })
      }
  }
}

// Lexical scopes for DOM sinks and a conservative refusal of source mutations.
// This is not control-flow execution: reassigned captured bindings are unknown.
function scriptNodes(model) {
  const nodes = []
  const visit = (node, inherited) => {
    if (!node || typeof node !== 'object') return
    let env = inherited
    if (functionNode(node) || node.type === 'BlockStatement' || node.type === 'CatchClause') {
      env = model.sourceScopes.get(node) ?? new Map(inherited)
      if (node.type === 'BlockStatement' && !model.sourceScopes.has(node)) declare(node.body, env)
      for (const parameter of node.params ?? (node.param ? [node.param] : [])) {
        for (const name of namesInPattern(parameter)) env.set(name, unknown(`shadowed parameter ${name}`))
      }
    }
    if (['ForStatement', 'ForOfStatement', 'ForInStatement', 'SwitchStatement'].includes(node.type)) {
      env = new Map(inherited)
      const declarations =
        node.type === 'SwitchStatement' ? node.cases.flatMap(branch => branch.consequent) : [node.init ?? node.left]
      for (const declaration of declarations) {
        const patterns =
          declaration?.type === 'VariableDeclaration'
            ? declaration.declarations.map(item => item.id)
            : declaration?.type === 'FunctionDeclaration'
              ? [declaration.id]
              : []
        for (const pattern of patterns)
          for (const name of namesInPattern(pattern)) {
            env.set(name, unknown(`unsupported control-flow binding ${name}`))
          }
      }
    }
    if (node.type) nodes.push({ node, env })
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'tokens', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) continue
      if (Array.isArray(value)) for (const child of value) visit(child, env)
      else if (value && typeof value === 'object') visit(value, env)
    }
  }
  visit(model.ast, model.env)
  const collection = (binding, seen = new Set()) => {
    if (binding?.kind !== 'lazy' || seen.has(binding)) return false
    seen.add(binding)
    if (['ObjectExpression', 'ArrayExpression'].includes(binding.node?.type)) return true
    return assignmentTargets(binding.node).some(target => collection(binding.env.get(target.name), seen))
  }
  const invalidate = (name, env, collectionWrite) => {
    for (const [key, binding] of env) {
      if (binding && (key === name || (collectionWrite && collection(binding)))) {
        binding.invalidReason = `source mutation of ${name}; use immutable finite class bindings`
      }
    }
  }
  for (const { node, env } of nodes) {
    if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
      for (const target of assignmentTargets(node.left ?? node.argument)) {
        invalidate(target.name, env, target.member)
      }
    }
    if (['ForOfStatement', 'ForInStatement'].includes(node.type) && node.left.type !== 'VariableDeclaration') {
      for (const target of assignmentTargets(node.left)) invalidate(target.name, env, target.member)
    }
    if (isCall(node)) {
      for (const argument of [...node.arguments, ...(isMember(node.callee) ? [node.callee.object] : [])]) {
        for (const target of assignmentTargets(argument)) {
          if (collection(env.get(target.name))) invalidate(target.name, env, true)
        }
      }
    }
  }
  return nodes
}

function componentModel(filename, source) {
  const isScript = /\.[cm]?js$/.test(filename)
  const isHtml = filename.endsWith('.html')
  const { descriptor, errors } = isScript
    ? { descriptor: { script: { content: source }, styles: [] }, errors: [] }
    : parseSfc(isHtml ? `<template>${source}</template>` : source, { filename })
  if (errors.length) throw new Error(`${filename}: ${errors.join('; ')}`)
  const script = descriptor.scriptSetup ?? descriptor.script
  const ast = script
    ? babelParse(script.content, { sourceType: 'module', plugins: script.lang === 'ts' ? ['typescript'] : [] }).program
    : { body: [] }
  const model = {
    filename,
    source,
    descriptor,
    ast,
    env: new Map(),
    imports: new Map(),
    components: new Map(),
    props: new Map(),
    elements: [],
    scopedClasses: new Set(),
    sourceScopes: new Map()
  }
  if (isHtml) {
    const visit = node => {
      if (node.type === 1 && ['script', 'style'].includes(node.tag)) {
        const content = node.children.map(child => child.content ?? '').join('')
        const type = node.props.find(prop => prop.type === 6 && prop.name === 'type')?.value?.content
        if (node.tag === 'style') descriptor.styles.push({ content, scoped: false })
        else if (!type || ['module', 'text/javascript', 'application/javascript'].includes(type)) {
          ast.body.push(...babelParse(content, { sourceType: 'module', startLine: node.loc.start.line }).program.body)
        }
      }
      for (const child of node.children ?? []) visit(child)
    }
    visit(descriptor.template.ast)
  }
  declare(ast.body, model.env)
  for (const node of ast.body)
    if (node.type === 'ImportDeclaration' && node.source.value.endsWith('.vue')) {
      for (const specifier of node.specifiers)
        model.imports.set(
          specifier.local.name,
          node.source.value.startsWith('@/')
            ? path.posix.normalize(`src/${node.source.value.slice(2)}`)
            : path.posix.normalize(path.posix.join(path.posix.dirname(filename), node.source.value))
        )
    }
  let options = ast.body.find(node => node.type === 'ExportDefaultDeclaration')?.declaration
  if (options?.type === 'CallExpression' && options.callee.name === 'defineComponent') options = options.arguments[0]
  for (const group of ['methods', 'computed']) {
    const object = property(options, group)?.value
    for (const prop of object?.properties ?? []) {
      const node = prop.type === 'ObjectMethod' ? prop : prop.value
      if (!functionNode(node) || prop.computed) continue
      const fn = { kind: 'function', node, env: model.env }
      model.env.set(keyOf(prop.key), group === 'computed' ? { kind: 'computed', fn } : [fn])
    }
  }
  for (const prop of property(options, 'props')?.value?.properties ?? []) {
    const name = keyOf(prop.key)
    model.props.set(name, property(prop.value, 'default')?.value)
    model.env.set(name, { kind: 'prop', model })
  }
  for (const prop of property(options, 'components')?.value?.properties ?? []) {
    const imported = model.imports.get(prop.value?.name)
    if (imported) model.components.set(camel(keyOf(prop.key)).toLowerCase(), imported)
  }
  if (descriptor.scriptSetup)
    for (const [name, imported] of model.imports) model.components.set(camel(name).toLowerCase(), imported)
  const setup = property(options, 'setup')
  if (setup?.body?.body) {
    const env = new Map(model.env)
    declare(setup.body.body, env)
    model.sourceScopes.set(setup.body, env)
    // Only actual setup return bindings are exposed in the template.
    for (const statement of setup.body.body)
      if (statement.type === 'ReturnStatement' && statement.argument?.type === 'ObjectExpression') {
        for (const prop of statement.argument.properties)
          if (prop.type === 'ObjectProperty' && !prop.computed)
            model.env.set(keyOf(prop.key), { kind: 'lazy', node: prop.value, env })
      }
  }
  model.scriptNodes = scriptNodes(model)
  return model
}

function templateElements(model) {
  const visit = (node, parentEnv) => {
    const env = new Map(parentEnv)
    if (node.type === 1) {
      const loop = node.props.find(prop => prop.type === 7 && prop.name === 'for')?.forParseResult
      if (loop?.value) {
        const context = { model, stack: new Set(), resolveProp: () => unknown('v-for prop is not finite') }
        const source = evaluate(expression(loop.source.content), env, context)
        const entries = union(
          ...source.map(value =>
            value?.kind === 'array' ? value.items.flat() : unknown('v-for source is not a literal array')
          )
        )
        env.set(loop.value.content, entries)
        if (loop.key) env.set(loop.key.content, unknown('v-for key'))
        if (loop.index) env.set(loop.index.content, unknown('v-for index'))
      }
      model.elements.push({ node, env })
    }
    for (const child of node.children ?? []) visit(child, env)
  }
  if (model.descriptor.template?.ast) visit(model.descriptor.template.ast, model.env)
}

const classAttribute = name => name === 'class' || /^(?:enter|leave|appear)-(?:from|active|to)-class$/.test(name)

/** Pure entry point used by mutation tests. Keys are POSIX project-relative paths. */
export function analyzeClasses(files) {
  const errors = [],
    bindings = [],
    globalClasses = new Set(),
    retainedClasses = new Set()
  const models = new Map()
  for (const [filename, source] of files) {
    try {
      if (filename.endsWith('.css')) {
        const classes = cssClasses(source, filename)
        for (const name of classes) globalClasses.add(name)
        if (/\/retained-[^/]+\.css$/.test(filename)) for (const name of classes) retainedClasses.add(name)
      }
      if (/\.(?:vue|html|[cm]?js)$/.test(filename)) models.set(filename, componentModel(filename, source))
    } catch (error) {
      errors.push(error.message)
    }
  }
  const inventoryText = files.get('src/styles/retained-utilities.classes.json')
  if (inventoryText) {
    try {
      const inventory = JSON.parse(inventoryText)
      for (const name of inventory)
        if (!retainedClasses.has(name)) errors.push(`retained class inventory has no CSS selector: ${name}`)
    } catch (error) {
      errors.push(`retained class inventory: ${error.message}`)
    }
  }
  for (const model of models.values()) {
    try {
      for (const style of model.descriptor.styles) {
        const target = style.scoped ? model.scopedClasses : globalClasses
        for (const name of cssClasses(style.content, model.filename)) target.add(name)
      }
      templateElements(model)
    } catch (error) {
      errors.push(`${model.filename}: ${error.message}`)
    }
  }
  const resolvingProps = new Set()
  const resolveProp = (model, name, parentContext) => {
    const key = `${model.filename}:${name}`
    if (resolvingProps.has(key)) return unknown(`recursive class prop ${name}`)
    resolvingProps.add(key)
    const context = { ...parentContext, model }
    let values = model.props.get(name) ? evaluate(model.props.get(name), model.env, context) : [undefined]
    for (const parent of models.values())
      for (const { node, env } of parent.elements) {
        if (parent.components.get(camel(node.tag).toLowerCase()) !== model.filename) continue
        for (const prop of node.props) {
          if (prop.type === 7 && prop.name === 'bind' && (!prop.arg || !prop.arg.isStatic))
            values = union(
              values,
              unknown(`unresolved prop spread/dynamic key at ${parent.filename}:${prop.loc.start.line}`)
            )
          const attribute = prop.type === 6 ? prop.name : prop.arg?.content
          if (camel(attribute ?? '') !== name) continue
          const provided =
            prop.type === 6
              ? [prop.value?.content ?? '']
              : prop.exp
                ? evaluate(expression(prop.exp.content), env, { ...context, model: parent })
                : unknown(`empty class prop ${name}`)
          values = union(values, provided)
        }
      }
    resolvingProps.delete(key)
    return values
  }
  const check = (model, node, values, kind, source) => {
    const { tokens, problems } = classTokens(values)
    const location = `${model.filename}:${node.loc?.start.line ?? 1}`
    for (const problem of problems)
      errors.push(`${location}: unresolved ${kind}: ${problem}. Use explicit finite class strings/maps.`)
    for (const token of tokens)
      if (
        !globalClasses.has(token) &&
        !model.scopedClasses.has(token) &&
        !markers.some(marker => marker.class === token && marker.files.includes(model.filename))
      )
        errors.push(
          `${location}: unsupported class "${token}". Define ordinary application CSS or use a retained class.`
        )
    bindings.push({ file: model.filename, line: node.loc?.start.line ?? 1, kind, source, classes: [...tokens].sort() })
  }
  for (const model of models.values()) {
    for (const { node, env } of model.elements)
      for (const prop of node.props) {
        try {
          if (prop.type === 6 && classAttribute(prop.name))
            check(model, prop, [prop.value?.content ?? ''], 'static', prop.loc.source)
          if (prop.type === 7 && prop.name === 'bind') {
            if (!prop.arg || !prop.arg.isStatic) {
              errors.push(
                `${model.filename}:${prop.loc.start.line}: unresolved class-capable v-bind spread/dynamic key; use explicit attributes`
              )
            } else if (classAttribute(prop.arg.content)) {
              const source = prop.exp?.content ?? prop.arg.content
              check(
                model,
                prop,
                evaluate(expression(source), env, { model, stack: new Set(), resolveProp }),
                'dynamic',
                source
              )
            }
          }
        } catch (error) {
          errors.push(`${model.filename}:${prop.loc.start.line}: ${error.message}`)
        }
      }
    for (const { node, env } of model.scriptNodes) {
      if (
        isCall(node) &&
        isMember(node.callee) &&
        isMember(node.callee.object) &&
        keyOf(node.callee.object.property) === 'classList'
      ) {
        const method = keyOf(node.callee.property)
        if (!['add', 'remove', 'replace', 'toggle'].includes(method)) continue
        const args = method === 'toggle' ? node.arguments.slice(0, 1) : node.arguments
        for (const arg of args)
          check(model, node, evaluate(arg, env, { model, stack: new Set(), resolveProp }), 'classList', method)
      }
      if (
        isCall(node) &&
        isMember(node.callee) &&
        keyOf(node.callee.property) === 'setAttribute' &&
        node.arguments[0]?.value === 'class'
      )
        check(
          model,
          node,
          evaluate(node.arguments[1], env, { model, stack: new Set(), resolveProp }),
          'setAttribute(class)',
          'class'
        )
      if (
        node.type === 'AssignmentExpression' &&
        node.left.type === 'MemberExpression' &&
        keyOf(node.left.property) === 'className'
      )
        check(
          model,
          node,
          evaluate(node.right, env, { model, stack: new Set(), resolveProp }),
          'className',
          'assignment'
        )
    }
  }
  return {
    errors: [...new Set(errors)],
    bindings,
    components: [...models.keys()].filter(filename => filename.endsWith('.vue')).length,
    retainedClasses: retainedClasses.size
  }
}

export function readProject(root) {
  const files = new Map()
  const visit = directory => {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = path.posix.join(directory, entry.name)
      if (entry.isDirectory() && !['__tests__', '__mocks__', 'tests'].includes(entry.name)) visit(relative)
      else if (
        entry.isFile() &&
        /\.(?:vue|css|[cm]?js)$/.test(entry.name) &&
        !/\.(?:spec|test)\.[cm]?js$/.test(entry.name)
      )
        files.set(relative, fs.readFileSync(path.join(root, relative), 'utf8'))
    }
  }
  visit('src')
  if (fs.existsSync(path.join(root, 'index.html')))
    files.set('index.html', fs.readFileSync(path.join(root, 'index.html'), 'utf8'))
  const inventory = 'src/styles/retained-utilities.classes.json'
  if (fs.existsSync(path.join(root, inventory)))
    files.set(inventory, fs.readFileSync(path.join(root, inventory), 'utf8'))
  return files
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'))
  const result = analyzeClasses(readProject(root))
  if (result.errors.length) {
    process.stderr.write(`CSS class drift check failed:\n${result.errors.map(error => `- ${error}`).join('\n')}\n`)
    process.exitCode = 1
  } else {
    const dynamic = result.bindings.filter(binding => binding.kind === 'dynamic')
    process.stdout.write(
      `CSS class drift check passed: ${result.components} Vue files, ${dynamic.length} finite :class bindings in ${new Set(dynamic.map(binding => binding.file)).size} files, ${result.retainedClasses} retained selector classes.\n`
    )
  }
}
