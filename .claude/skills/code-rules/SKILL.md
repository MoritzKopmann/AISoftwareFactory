---
name: code-rules
description: >
  Code rules for review: naming, functions, conditions, layout, modules, immutability, errors, SQL
  and comments. Use when reviewing code for style and correctness-of-form, not for structure.
user-invocable: false
---

## Scope

Style and correctness-of-form rules for review, not structure (that is `project-architecture`).

Done: you can check a diff against each rule by its ID.

## General rules

- GR1. **Must:** apply these rules to test code too.

## Naming (NA)

Names state what a thing is or holds. Full English words only.

- NA1. **Must:** a class name ends in its type (`…Service`, `…Repository`, `…Error`). An implementation is prefixed with what it's built on: `SqlOrderRepository`.
- NA2. **Must:** an interface is named after its role, never `I…` or `…Interface`.
- NA3. **Must:** full English words for every name: locals, fields, parameters, constants, callback and destructured names, generic type parameters beyond a single obvious `T`. No abbreviations, no single letters, no truncation. The name states what the value holds.
  - **Exception:** a port to another module is `<Thing>Port` and its adapter is `<Provider>Adapter` (`UserPort`, `UsersAdapter`), one each per provider. See project-architecture BU3.
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

- NA4. **Must:** one word per concept. Pick `fetch`, `get` or `load` for an act and use it everywhere. One word never means two things.
- NA5. **Must:** no noise words. `Data`, `Info`, `Manager`, `Helper`, `Object` and a `the` prefix add nothing: `OrderData` vs `OrderInfo` says no difference.
- NA6. **Must:** a function name is a verb (`placeOrder`). A boolean reads as a question (`isActive`, `hasRuns`, `canRetry`).
- NA7. **Must:** a name never lies about its type. `orderList` is not a `Set`.
- NA8. **Must:** no magic numbers or strings. A literal with hidden meaning becomes a named constant.

  ```ts
  // Bad
  setTimeout(retry, 30000);

  // Good
  setTimeout(retry, RETRY_DELAY_MILLISECONDS);
  ```

## Functions (FN)

A function does one thing, and its name says all of it.

- FN1. **Must:** do one thing. If you can extract a function whose name isn't a restatement, it does more than one.
- FN2. **Must:** one level of abstraction per function. High-level steps don't sit next to string or index fiddling.
- FN3. **Must:** no flag arguments. A boolean parameter means two functions: `renderForPrint()` and `renderForScreen()`, not `render(true)`.
- FN4. **Must:** no hidden side effects. `checkPassword()` doesn't also start a session.
- FN5. **Must:** stepdown order. A file reads top-down: a caller sits above its callees. In a class, public methods come first, each private helper below its first caller.
- FN6. **Should:** three or more related parameters become one options object.
- FN7. **Should:** a function either changes state or answers a question, not both.

## Conditions (CO)

An `if` reads as what it checks, not how.

- CO1. **Must:** a condition that combines checks, or whose purpose the code doesn't show, is a helper function named after what it checks. The `if` then reads as a sentence.

  ```ts
  // Bad
  if ((event.kind === 'entry' || event.kind === 'text-delta') && !promptPulled) {

  // Good
  function goesOnFeed(event: SessionEvent): boolean {
    return event.kind === 'entry' || event.kind === 'text-delta';
  }

  if (goesOnFeed(event) && !promptPulled) {
  ```

- CO2. **Must:** the helper's name states the question it answers (`goesOnFeed`, `isOverdue`), not the fields it reads.
- CO3. **Must:** booleans are named positively. `!isReady` is fine; `isNotReady` is not, since `!isNotReady` is a double negative.
- CO4. **Should:** a dense expression gets a named local that says what it means: `const isStale = now - fetchedAt > CACHE_LIFETIME_MILLISECONDS;`, then `if (isStale)`.

## Layout (LA)

Prettier owns spacing and wrapping. These are the parts it leaves alone.

- LA1. **Must:** a local is declared right before its first use, not at the top of the function.
- LA2. **Should:** related lines sit together. A blank line marks the next step.

## Modules (MO)

- MO1. **Must:** no barrel `index.ts` inside a layer folder.

## Immutability (IM)

A domain value never changes. A change produces a new value.

- IM1. **Must:** `readonly` fields and `ReadonlyArray`/`ReadonlyMap` collections.
- IM2. **Must:** no classes with mutable state in `domain/`. Use plain types, constants and pure functions.
- IM3. **Must:** a constant uses `readonly` fields and `ReadonlyArray`/`ReadonlyMap` types.
- IM4. **Must:** a type lives in its constant's file while that constant is the type's only production instance. Use as a parameter or in tests doesn't move it. Once a second production instance exists, the type moves out.
- IM5. **Must:** a constant private to one function stays in that function's file.

## Errors (ER)

- ER1. **Must:** callers catch a named error, never a bare `catch` or `Error`.
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

- ER2. **Must:** an error message says what failed and on what input: `Ticket #42: label update rejected (403)`, not `write failed`.
- ER3. **Should:** a `try` body is one call. The work lives in its own function.

## SQL (SQ)

- SQ1. **Must:** one template string per statement, one clause or column per line.

  ```ts
  database.prepare(`
    SELECT id, customer_id, status
    FROM orders
    WHERE customer_id = ?
  `);
  ```

- SQ2. **Must:** parameters are bound, never interpolated.

## Comments (CM)

Code is simple and explains itself. Comments are rare and describe the current code only.

- CM1. **Must not:** document history or decisions. No "changed from X", "previously", "we chose", ticket or PR refs. How we got here lives in git and the tickets.
- CM2. **Must not:** restate the code. `// increment counter` above `counter++` is noise.
- CM3. **Must not:** comment out code. Delete it. Git has it.
- CM4. **Must not:** add banners. No `// ---- Helpers ----`. Split the file instead.
- CM5. **Must not:** leave a TODO without a ticket. Use `// TODO(#123): …`, or open an issue.
- CM6. **Must not:** add a JSDoc block that repeats the name and signature. Types already document parameters and return values.
- CM7. **Must not:** describe code elsewhere. A comment covers the code next to it, not a far-off default or caller. It goes stale when that code changes.
- CM8. **Must:** rename before commenting. If a name needs a comment, fix the name first.
- CM9. **Must:** comment only when the code can't explain itself: how a function works when its name and body don't show it, why unusual code is the way it is, a constraint from outside the code (an API quirk, a protocol rule), or a warning of consequences (`// Not reentrant: call only from the worker loop.`).
- CM10. **Must:** keep comments true. Change the code, update or delete its comment in the same change.
- CM11. **Must:** in tests, a short comment on a non-obvious arrange step is fine.

  ```ts
  // Bad: history and restating
  // Switched to a Set in #123 (was an array)
  const seenOrderIds = new Set<number>(); // set of seen ids

  // Good: explains an outside constraint
  // The vendor returns 304 without a body for an unchanged ETag, so keep the previous page.
  if (response.status === 304) return previousPage;
  ```
