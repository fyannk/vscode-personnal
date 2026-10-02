// Finds the `telemetry.telemetryLevel` schema by its distinctive enum
// ["all", "error", "crash", "off"] rather than by identifier names: esbuild
// renames colliding bindings (TELEMETRY_SETTING_ID2) and minification mangles
// them. Const enum members are usually inlined as strings, optionally followed
// by a `/* ON */` comment, but a bundler that keeps the enum object emits
// `TelemetryConfiguration.ON`; both forms are accepted. The default must
// follow in the same object literal, after `enumDescriptions`: that tells the
// user setting apart from the agent host's internal schema (1.140+), which
// reuses the enum without descriptions and stays at the clients' level.
const levels = { ON: 'all', ERROR: 'error', CRASH: 'crash', OFF: 'off' };
const comment = String.raw`(?:\s*\/\*[^*]*\*\/)?\s*`;
const key = name => String.raw`(?:["']${name}["']|\b${name})\s*:\s*`;
const level = (member, capture) => {
	const literal = String.raw`["']${capture ? String.raw`(\w+)` : levels[member]}["']`;
	const reference = String.raw`[\w$]+\.${capture ? String.raw`(\w+)` : member}\b`;
	return String.raw`(?:${literal}|${reference})${comment}`;
};
const telemetryDefaultPattern = new RegExp(
	key('enum') + String.raw`\[\s*` + Object.keys(levels).map(member => level(member, false)).join(String.raw`,\s*`) + String.raw`,?\s*\]` +
	String.raw`[^{}]*?` + key('enumDescriptions') + String.raw`[^{}]*?` + key('default') + level(undefined, true),
	'g'
);

// Every telemetry level default found in the source, in order.
export function telemetryDefaults(source) {
	return [...source.matchAll(telemetryDefaultPattern)].map(([, literal, member]) => literal ?? levels[member] ?? member);
}

// The source's telemetry level default, or undefined when it is missing or ambiguous.
export function telemetryDefault(source) {
	const defaults = new Set(telemetryDefaults(source));
	return defaults.size === 1 ? [...defaults][0] : undefined;
}
