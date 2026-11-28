import assert from "node:assert/strict";
import { test } from "node:test";
import { EVENTS, LAYERS, DEFAULT_ON, eventDays, eventsByDay, upcoming, chip, readLayers } from "./data.js";

test("every event has a valid date, a known layer and a title", () => {
  const ids = new Set(LAYERS.map(l => l.id));
  for (const ev of EVENTS) {
    assert.match(ev.date, /^\d{4}-\d{2}-\d{2}$/, ev.title);
    assert.ok(!Number.isNaN(new Date(ev.date + "T12:00:00").getTime()), ev.title);
    assert.ok(ids.has(ev.layer), ev.title);
    assert.ok(ev.title && ev.title.length < 90, ev.title);
    if (ev.to) assert.ok(ev.to >= ev.date, ev.title);
  }
});

test("known fixed dates", () => {
  const find = (layer, title) => EVENTS.find(e => e.layer === layer && e.title.startsWith(title));
  assert.equal(find("hr", "Uskrs").date, "2027-03-28");
  assert.equal(find("hr", "Tijelovo").date, "2027-05-27"); // Uskrs + 60 dana
  assert.equal(find("faith", "Uskrs (pravoslavni)").date, "2027-05-02");
  assert.equal(find("cn", "Kineska Nova godina").date, "2027-02-06");
  assert.equal(find("ba", "Dan nezavisnosti").date, "2027-03-01");
});

test("multi-day events cover each day", () => {
  assert.deepEqual(eventDays({ date: "2027-01-01", to: "2027-01-02" }), ["2027-01-01", "2027-01-02"]);
  const map = eventsByDay({ ...DEFAULT_ON });
  assert.ok(map.get("2027-02-09").some(e => e.title.startsWith("Kineska Nova godina")));
  assert.ok(!map.has("2027-03-29") || !map.get("2027-03-29").some(e => e.layer === "hr"), "HR is off by default");
});

test("upcoming follows the layers and today", () => {
  const list = upcoming({ ...DEFAULT_ON }, "2026-11-28", 4);
  assert.equal(list.length, 4);
  assert.equal(list[0].date, "2026-12-24");
  assert.ok(list.every(e => e.layer !== "hr"));
  const cnOnly = upcoming({ ba: false, hr: false, cn: true, global: false, faith: false }, "2026-11-28", 2);
  assert.deepEqual(cnOnly.map(e => e.date), ["2027-01-01", "2027-01-10"]);
});

test("chip and stored layers", () => {
  assert.deepEqual(chip("2027-02-06"), { d: "6", m: "feb" });
  const store = { v: '{"hr":true,"faith":false,"x":1}', getItem() { return this.v; } };
  assert.deepEqual(readLayers(store), { ba: true, hr: true, cn: true, global: true, faith: false });
  assert.deepEqual(readLayers({ getItem() { throw new Error("blocked"); } }), DEFAULT_ON);
});
