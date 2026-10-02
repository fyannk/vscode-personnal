import assert from 'node:assert/strict';
import test from 'node:test';
import { telemetryDefault, telemetryDefaults } from '../overlay/telemetry-default.mjs';

const descriptions = `"enumDescriptions": [
	localize(1, null),
	localize(2, null)
],
"markdownDescription": getTelemetryLevelSettingDescription(),`;

test('reads esbuild bundles with inlined const enums and renamed setting ids', () => {
	const bundle = `[TELEMETRY_SETTING_ID2]: {
	"type": "string",
	"enum": ["all" /* ON */, "error" /* ERROR */, "crash" /* CRASH */, "off" /* OFF */],
	${descriptions}
	"default": "off" /* OFF */,
	"restricted": true,
	"policy": { name: "TelemetryLevel" }
}`;
	assert.equal(telemetryDefault(bundle), 'off');
});

test('reads minified bundles', () => {
	const bundle = 'x={[Ab]:{type:"string",enum:["all","error","crash","off"],enumDescriptions:[(0,n.localize)(1,null)],markdownDescription:Qe(),default:"off",restricted:!0}}';
	assert.equal(telemetryDefault(bundle), 'off');
});

test('reads the previous gulp bundle format', () => {
	assert.equal(telemetryDefault(`[TELEMETRY_SETTING_ID]: { 'type': 'string', 'enum': ['all', 'error', 'crash', 'off'], 'enumDescriptions': [localize('a', "x")], 'default': 'all' }`), 'all');
});

test('reads bundles that keep the enum object', () => {
	const bundle = `[TELEMETRY_SETTING_ID]: {
	"enum": [TelemetryConfiguration2.ON, TelemetryConfiguration2.ERROR, TelemetryConfiguration2.CRASH, TelemetryConfiguration2.OFF],
	${descriptions}
	"default": TelemetryConfiguration2.OFF,
}`;
	assert.equal(telemetryDefault(bundle), 'off');
	assert.equal(telemetryDefault('{enum:[t.ON,t.ERROR,t.CRASH,t.OFF],enumDescriptions:[],default:t.ON}'), 'all');
});

test('reports every occurrence and rejects conflicting defaults', () => {
	const setting = level => `{enum:["all","error","crash","off"],enumDescriptions:[],default:"${level}"}`;
	assert.deepEqual(telemetryDefaults(setting('off') + setting('all')), ['off', 'all']);
	assert.equal(telemetryDefault(setting('off') + setting('all')), undefined);
});

test('ignores the agent host telemetry level schema', () => {
	const agentHost = `[AgentHostTelemetryLevelConfigKey]: schemaProperty({
	type: "string",
	title: localize(7, null),
	description: localize(8, null),
	enum: ["all" /* ON */, "error" /* ERROR */, "crash" /* CRASH */, "off" /* OFF */],
	default: "all" /* ON */
})`;
	assert.deepEqual(telemetryDefaults(agentHost), []);
	assert.deepEqual(telemetryDefaults('[e]:{type:"string",enum:["all","error","crash","off"],enumDescriptions:[n(1,null)],default:"off"},' + agentHost), ['off']);
});

test('does not match unrelated defaults', () => {
	assert.equal(telemetryDefault('x: { "default": "on" }'), undefined);
	assert.equal(telemetryDefault('x: {enum:["all","error","crash","off"]}, unrelated: { default: "off" }'), undefined);
	assert.equal(telemetryDefault('x: {enum:["on","off"], default: "off"}'), undefined);
});
