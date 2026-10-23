import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDemoDates } from "./seed.js";

describe("demo shop dates", () => {
  it("keeps the Pacific calendar day through UTC midnight", () => {
    for (const instant of ["2026-10-22T23:59:00.000Z", "2026-10-23T00:01:00.000Z", "2026-10-23T06:59:00.000Z"]) {
      const dates = createDemoDates(new Date(instant));
      assert.equal(dates.today, "2026-10-22");
      assert.equal(dates.tomorrow, "2026-10-23");
      assert.equal(dates.nextWeek, "2026-10-29");
      assert.equal(dates.tomorrowMorningStart, "2026-10-23T16:00:00.000Z");
      assert.equal(dates.tomorrowMorningEnd, "2026-10-23T18:00:00.000Z");
    }

    assert.equal(createDemoDates(new Date("2026-10-23T07:00:00.000Z")).today, "2026-10-23");
  });

  it("keeps 9–11 a.m. Pacific when tomorrow crosses a DST change", () => {
    const spring = createDemoDates(new Date("2026-03-08T07:30:00.000Z"));
    assert.equal(spring.tomorrow, "2026-03-08");
    assert.equal(spring.tomorrowMorningStart, "2026-03-08T16:00:00.000Z");
    assert.equal(spring.tomorrowMorningEnd, "2026-03-08T18:00:00.000Z");

    const fall = createDemoDates(new Date("2026-11-01T06:30:00.000Z"));
    assert.equal(fall.tomorrow, "2026-11-01");
    assert.equal(fall.tomorrowMorningStart, "2026-11-01T17:00:00.000Z");
    assert.equal(fall.tomorrowMorningEnd, "2026-11-01T19:00:00.000Z");
  });
});
