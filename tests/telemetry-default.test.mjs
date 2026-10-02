import assert from 'node:assert/strict';
import test from 'node:test';
import { telemetryDefault } from '../overlay/telemetry-default.mjs';

test('reads quoted telemetry defaults', () => {
	assert.equal(telemetryDefault('x[TELEMETRY_SETTING_ID]: {"default": "off"}'), 'off');
});

test('reads unquoted telemetry defaults', () => {
	assert.equal(telemetryDefault('x [ TELEMETRY_SETTING_ID ] : { default : "off" }'), 'off');
});

test('does not match unrelated defaults', () => {
	assert.equal(telemetryDefault('x: { "default": "on" }'), undefined);
	assert.equal(telemetryDefault('x[TELEMETRY_SETTING_ID]: {}, unrelated: { default: "off" }'), undefined);
});
