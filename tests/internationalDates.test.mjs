import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

// TZ changes the runtime's local clock, matching the Date behavior that caused
// international browser regressions. Exercise real helpers and the real picker.
for (const zone of ['America/Los_Angeles', 'Asia/Tokyo', 'Europe/London', 'Pacific/Honolulu', 'Pacific/Kiritimati']) {
  test(`restaurant calendar and picker remain consistent when viewer is in ${zone}`, () => {
    const code = `
      import assert from 'node:assert/strict';
      import { readFileSync } from 'node:fs';
      import { createRequire } from 'node:module';
      import { runInNewContext } from 'node:vm';
      import React from 'react';
      import { act, create } from 'react-test-renderer';
      import ts from 'typescript';
      import * as dates from './src/utils/dateUtils.ts';
      import * as service from './src/lib/reservations/service.ts';
      import * as availability from './src/lib/reservations/availability.ts';
      assert.equal(dates.getLocalDateString('2026-10-11T01:00:00Z', 'America/Los_Angeles'), '2026-10-10');
      assert.equal(dates.formatDateForDisplay('2026-10-10', 'America/Los_Angeles'), 'October 10, 2026');
      assert.equal(dates.formatReadableDatePST('2026-01-02T07:59:00Z'), 'Thursday, January 1, 2026');
      assert.equal(availability.restaurantClock('America/Los_Angeles', new Date('2026-11-01T09:30:00Z')).minutes, 90);
      const row = service.serviceReservation('fixture', { name: 'Guest', date: { toDate: () => new Date('2026-10-11T01:00:00Z') }, time: '7:00 PM', guests: 2, status: 'confirmed' }, 'America/Los_Angeles');
      assert.equal(service.todaySummary([row], 'America/Los_Angeles', new Date('2026-10-11T01:00:00Z')).expectedCovers, 2);
      assert.deepEqual(service.todayService([row], 'America/Los_Angeles', new Date('2026-10-11T01:30:00Z')).arriving.map(row => row.id), ['fixture']);
      assert.deepEqual(service.todayService([row], 'America/Los_Angeles', new Date('2026-10-11T02:00:00Z')).attention.map(row => row.id), ['fixture']);
      assert.ok(dates.formatBusinessTimestamp('2026-10-11T01:00:00Z', 'America/Los_Angeles').includes('Oct 10, 2026'));
      const selected = new Date(2026, 9, 11, 12);
      assert.equal(availability.calendarDate(selected), '2026-10-11');
      const filename = new URL('./src/components/DatePicker.tsx', import.meta.url);
      const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
      const module = { exports: {} }, normalRequire = createRequire(filename);
      runInNewContext(compiled, { module, exports: module.exports, Date, require: name => {
        if (name === '@/components/ui/calendar') return { Calendar: props => React.createElement('calendar', props) };
        if (name === '@/contexts/TimezoneContext') return { useTimezone: () => ({ timezone: 'America/Los_Angeles' }) };
        if (name === '@/lib/reservations/availability') return { ...availability, restaurantClock: zone => availability.restaurantClock(zone, new Date('2026-10-11T01:00:00Z')) };
        return normalRequire(name);
      }});
      const updates = [], changes = [];
      let renderer;
      act(() => { renderer = create(React.createElement(module.exports.default, {
        date: selected, time: '7:00 PM', availableTimeSlots: [],
        specialDates: [{ date: '2025-10-11', closureType: 'full' }, { date: '2026-10-12', closureType: 'full' }],
        onUpdate: (date, time) => updates.push([availability.calendarDate(date), time]),
        onDateChange: date => changes.push(availability.calendarDate(date)),
      })); });
      const calendar = renderer.root.findByType('calendar').props;
      assert.equal(calendar.disabled(new Date(2026, 9, 9, 12)), true);
      assert.equal(calendar.disabled(new Date(2026, 9, 10, 12)), false);
      assert.equal(calendar.disabled(selected), false);
      assert.equal(calendar.disabled(new Date(2026, 9, 12, 12)), true);
      act(() => calendar.onSelect(selected));
      assert.deepEqual(updates, [['2026-10-11', '']]);
      assert.deepEqual(changes, ['2026-10-11']);
      act(() => renderer.unmount());
    `;
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], {
      cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: zone }, stdio: 'pipe', timeout: 15000,
    }));
  });
}
