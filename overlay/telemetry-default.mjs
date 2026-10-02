// Finds the `telemetry.telemetryLevel` schema by its distinctive enum
// ["all", "error", "crash", "off"] rather than by identifier names: esbuild
// renames colliding bindings (TELEMETRY_SETTING_ID2) and minification mangles
// them, while const enum members are inlined as strings, optionally followed by
// a `/* ON */` comment. The default must follow in the same object literal.
const comment = String.raw`(?:\s*\/\*[^*]*\*\/)?\s*`;
const key = name => String.raw`(?:["']${name}["']|\b${name})\s*:\s*`;
const value = name => String.raw`["']${name}["']${comment}`;
const telemetryDefaultPattern = new RegExp(
	key('enum') + String.raw`\[\s*` + ['all', 'error', 'crash', 'off'].map(value).join(String.raw`,\s*`) + String.raw`,?\s*\]` +
	String.raw`[^{}]*?` + key('default') + String.raw`["'](\w+)["']`,
	'g'
);

// Every telemetry level default found in the bundle, in order.
export function telemetryDefaults(bundle) {
	return [...bundle.matchAll(telemetryDefaultPattern)].map(match => match[1]);
}

// The bundle's telemetry level default, or undefined when it is missing or ambiguous.
export function telemetryDefault(bundle) {
	const defaults = new Set(telemetryDefaults(bundle));
	return defaults.size === 1 ? [...defaults][0] : undefined;
}
