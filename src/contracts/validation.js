/** Shared validation only; no browser, engine, clock or storage dependencies. */
export function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${label} must be a plain object`);
  }
  return value;
}

export function keysOnly(value, allowed, label) {
  for (const key of Reflect.ownKeys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`${label}: unknown field ${String(key)}`);
  }
}

export function finite(value, label, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new TypeError(`${label} must be finite in [${min}, ${max}]`);
  }
  return value;
}

export function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  finite(value, label, min, max);
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be an integer`);
  return value;
}

export function boolean(value, label) {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be boolean`);
  return value;
}

export function identifier(value, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 128) {
    throw new TypeError(`${label} must be a nonempty string of at most 128 characters`);
  }
  return value;
}

/** Detach and recursively freeze JSON-like data; reject nonfinite values/cycles. */
export function readonlyCopy(value, label = 'value', ancestors = new Set(), depth = 0) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return finite(value, label);
  if (depth > 64 || ancestors.has(value)) throw new TypeError(`${label}: cyclic or excessively nested data`);
  if (typeof value !== 'object') throw new TypeError(`${label} must contain plain data`);
  if (!Array.isArray(value)) record(value, label);
  ancestors.add(value);
  const copy = Array.isArray(value) ? [] : {};
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError(`${label} must contain enumerable data properties`);
    }
    Object.defineProperty(copy, key, {
      enumerable: true, value: readonlyCopy(descriptor.value, `${label}.${key}`, ancestors, depth + 1)
    });
  }
  ancestors.delete(value);
  return Object.freeze(copy);
}
