import assert from "node:assert/strict";
import { validateInvite } from "./validate.ts";

Deno.test("accepts a valid invite and normalises it", () => {
  assert.deepEqual(
    validateInvite({ email: " Somchai@Example.com ", full_name: " Somchai ", role: "staff" }),
    { email: "somchai@example.com", full_name: "Somchai", role: "staff" },
  );
  assert.deepEqual(
    validateInvite({ email: "m@example.com", full_name: "Manager", role: "manager" }),
    { email: "m@example.com", full_name: "Manager", role: "manager" },
  );
});

Deno.test("rejects missing or bad fields", () => {
  assert.equal(validateInvite(null), null);
  assert.equal(validateInvite({ full_name: "A", role: "staff" }), null);
  assert.equal(validateInvite({ email: "not-an-email", full_name: "A", role: "staff" }), null);
  assert.equal(validateInvite({ email: "a@example.com", full_name: "  ", role: "staff" }), null);
  assert.equal(validateInvite({ email: "a@example.com", full_name: "A", role: "admin" }), null);
});
