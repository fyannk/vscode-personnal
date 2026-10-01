const telemetryDefaultPattern = /\[\s*TELEMETRY_SETTING_ID\s*\]\s*:\s*\{[^]*?(?:["']default["']|default)\s*:\s*["'](\w+)["']/;

export function telemetryDefault(bundle) {
	return bundle.match(telemetryDefaultPattern)?.[1];
}
