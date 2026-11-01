import { describe, expect, it } from "vitest";
import { APP_IDS, VOCABULARY } from "../../templates";
import { SCREENS } from ".";

describe("the primitive apps (ADR-1766)", () => {
  it("gives every app a screen", () => {
    expect(Object.keys(SCREENS).sort()).toEqual([...APP_IDS].sort());
  });

  it.each(Object.entries(VOCABULARY))("%s installs every primitive app, and files kinds only into apps it has", (_, template) => {
    expect(template.apps).toEqual(APP_IDS);
    for (const kind of template.kinds) if (kind.app) expect(template.apps).toContain(kind.app);
  });
});

