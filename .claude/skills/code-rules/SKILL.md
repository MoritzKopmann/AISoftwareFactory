---
name: code-rules
description: >
  Code rules for review: naming, modules, immutability, errors, SQL and comments. Use when
  reviewing code for style and correctness-of-form, not for structure.
user-invocable: false
---

## Naming

**Rule:** names state what a thing is or holds. Full English words only.

- **Must:** a class name ends in its type (`…Service`, `…Repository`, `…Error`). An implementation is prefixed with what it's built on: `SqlOrderRepository`.
- **Must:** an interface is named after its role, never `I…` or `…Interface`.
- **Must:** full English words for every name: locals, fields, parameters, constants, callback and destructured names, generic type parameters beyond a single obvious `T`. No abbreviations, no single letters, no truncation. The name states what the value holds.
- **Exception:** a port to another module is `<Thing>Port` and its adapter is `<Provider>Adapter` (`UserPort`, `UsersAdapter`), one each per provider. See project-architecture rule 16.
- **Exception:** a classic numeric `for` loop counter may be `index`. Prefer `for … of` with a real name.

```ts
// Bad
const d = Date.now() - start;
const n = orders.length;
const cfg = loadConfig();
const res = await client.fetch(q);
orders.map((o) => o.id);

// Good
const elapsedMilliseconds = Date.now() - startedAt;
const orderCount = orders.length;
const config = loadConfig();
const orderResponse = await client.fetch(orderQuery);
orders.map((order) => order.id);
```

## Modules

- **Must:** no barrel `index.ts` inside a layer folder.

## Immutability

**Rule:** a domain value never changes. A change produces a new value.

- **Must:** `readonly` fields and `ReadonlyArray`/`ReadonlyMap` collections.
- **Must:** no classes with mutable state in `domain/`. Use plain types, constants and pure functions.
- **Must:** a constant uses `readonly` fields and `ReadonlyArray`/`ReadonlyMap` types.
- **Must:** a type lives in its constant's file while that constant is the type's only production instance. Use as a parameter or in tests doesn't move it. Once a second production instance exists, the type moves out.
- **Must:** a constant private to one function stays in that function's file.

## Errors

- **Must:** callers catch a named error, never a bare `catch` or `Error`.
- **Exception:** a documented "never crash" boundary, like a server's top-level error handler.

```ts
// Bad
try {
  await paymentService.charge(order);
} catch (error) {
  log(error);
}

// Good
try {
  await paymentService.charge(order);
} catch (error) {
  if (!(error instanceof PaymentDeclinedError)) throw error;
  await orderService.markUnpaid(order);
}
```

## SQL

- **Must:** one template string per statement, one clause or column per line.
- **Must:** parameters are bound, never interpolated.

```ts
database.prepare(`
  SELECT id, customer_id, status
  FROM orders
  WHERE customer_id = ?
`);
```

## Comments

**Rule:** code is simple and explains itself. Comments are rare and describe the current code only.

**Must not:**
- **Document history or decisions.** No "changed from X", "previously", "we chose", ticket or PR refs. How we got here lives in git and the tickets.
- **Restate the code.** `// increment counter` above `counter++` is noise.
- **Comment out code.** Delete it. Git has it.
- **Add banners.** No `// ---- Helpers ----`. Split the file instead.
- **Leave a TODO without a ticket.** Use `// TODO(#123): …`, or open an issue.
- **Add a JSDoc block that repeats the name and signature.** Types already document parameters and return values.

**Must:**
- **Rename before commenting.** If a name needs a comment, fix the name first.
- **Comment only when the code can't explain itself:** how a function works when its name and body don't show it, why unusual code is the way it is, or a constraint from outside the code (an API quirk, a protocol rule).
- **Keep comments true.** Change the code, update or delete its comment in the same change.
- **Follow the same rules in tests.** A short comment on a non-obvious arrange step is fine.

```ts
// Bad: history and restating
// Switched to a Set in #123 (was an array)
const seenOrderIds = new Set<number>(); // set of seen ids

// Good: explains an outside constraint
// The vendor returns 304 without a body for an unchanged ETag, so keep the previous page.
if (response.status === 304) return previousPage;
```
