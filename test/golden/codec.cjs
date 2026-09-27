'use strict';
// TEMPLATE (package-modernize): the golden files' encoding, shared by the capture script and golden.test.js so the two cannot drift.
// Copy it next to the capture script in the scratch project and to test/golden/ in the repository; commit it unchanged.
//
// JSON cannot hold undefined, NaN, Infinity, -0, a BigInt, a wrapper object, a Set, a Map or a thrown error, and a
// JSON round trip silently turns NaN and Infinity into null and -0 into 0: exactly the edge inputs a capture exists to record.
// Arguments are stored encoded and decoded fresh for every call (so a method that mutates its input cannot leak into the next
// call); results are encoded and compared in that form.
//
// Thrown errors record the class and the message. The message of an error the engine raised (a TypeError from reading a
// property of null) is V8's wording; it holds on every Node line from 16.9 but not in Bun, so the golden suite runs on Node only.

const wrappers = {String, Number, Boolean};

function encode(value) {
  if (value === undefined) {
    return {$undefined: true};
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return {$number: 'NaN'};
    }

    if (value === Number.POSITIVE_INFINITY || value === Number.NEGATIVE_INFINITY) {
      return {$number: String(value)};
    }

    return Object.is(value, -0) ? {$number: '-0'} : value;
  }

  if (typeof value === 'bigint') {
    return {$bigint: String(value)};
  }

  if (typeof value === 'symbol' || typeof value === 'function') {
    throw new TypeError(`The golden codec cannot encode a ${typeof value}; describe it in the case instead`);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  for (const [name, Wrapper] of Object.entries(wrappers)) {
    if (value instanceof Wrapper) {
      return {$new: name, value: encode(value.valueOf())};
    }
  }

  if (value instanceof Set) {
    return {$new: 'Set', value: Array.from(value, item => encode(item))};
  }

  if (value instanceof Map) {
    return {$new: 'Map', value: Array.from(value, pair => pair.map(item => encode(item)))};
  }

  if (Array.isArray(value)) {
    // Array.from reads holes as undefined, which encode keeps.
    return Array.from(value, item => encode(item));
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
}

function decode(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => decode(item));
  }

  if (value.$undefined === true) {
    return undefined;
  }

  if ('$number' in value) {
    return value.$number === '-0' ? -0 : Number(value.$number);
  }

  if ('$bigint' in value) {
    return BigInt(value.$bigint);
  }

  if ('$new' in value) {
    const inner = decode(value.value);
    switch (value.$new) {
      case 'Set': {
        return new Set(inner);
      }

      case 'Map': {
        return new Map(inner);
      }

      default: {
        // eslint-disable-next-line no-new-wrappers, unicorn/new-for-builtins
        return new wrappers[value.$new](inner);
      }
    }
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
}

// Calls fn and returns its result encoded, or the error it threw as {$throws: message, $error: class name}.
function capture(fn) {
  try {
    return encode(fn());
  } catch (error) {
    return {$throws: error instanceof Error ? error.message : String(error), $error: error instanceof Error ? error.name : typeof error};
  }
}

module.exports = {encode, decode, capture};
