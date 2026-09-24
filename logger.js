// logger.js
// Prepends a timezone-aware timestamp to every console call.
const LOG_TZ = process.env.LOG_TZ || 'UTC';

const OPTIONS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
};

const raw = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

let zone = LOG_TZ;
let formatter;
try {
  formatter = new Intl.DateTimeFormat('en-US', { timeZone: LOG_TZ, ...OPTIONS });
} catch {
  // Unknown IANA name: fall back to the host's own timezone instead of crashing.
  formatter = new Intl.DateTimeFormat('en-US', OPTIONS);
  zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function stamp(date = new Date()) {
  const p = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value])
  );
  return `[${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}]`;
}

for (const method of Object.keys(raw)) {
  console[method] = (...args) => {
    const prefix = stamp();
    // Merging into the first argument keeps printf-style ('%s') formatting intact.
    if (typeof args[0] === 'string') raw[method](`${prefix} ${args[0]}`, ...args.slice(1));
    else raw[method](prefix, ...args);
  };
}

if (zone !== LOG_TZ) {
  console.error(`[logger] unknown LOG_TZ "${LOG_TZ}", falling back to "${zone}"`);
}
console.log(`[logger] timestamps in ${zone}`);

module.exports = { stamp, raw };
