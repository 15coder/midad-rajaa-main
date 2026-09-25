---
name: Layering imported themes
description: How to extend this imported static site's appearance without destabilizing its original dark design.
---

Keep additions to the appearance system in a scoped theme layer rather than rewriting the legacy palette broadly.

**Why:** The imported interface mixes theme tokens with many hard-coded dark surfaces, so broad replacements can regress contrast and the established dark appearance.

**How to apply:** Scope refinements by the root theme attribute, load them after the base stylesheet, and include the theme layer in the PWA precache when offline use matters.