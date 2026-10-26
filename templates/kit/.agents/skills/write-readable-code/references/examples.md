# Copyable shapes

Every snippet below passes the checker. Copy the shape, not the wording.

## Contents

- TypeScript function with a file header
- No inputs, no output, side effects
- Arrow const with a destructured input
- React component
- Class, constructor, and method
- Exported types
- Inline callbacks and tests
- Python function

## TypeScript function with a file header

```ts
// Builds account labels for shared presentation code.
// Isolates fallback rules from interface components.

import type { Account } from './types';



/**
 * Builds a stable account label.
 *
 * Purpose: Centralize display-name fallback behavior.
 *
 * @param account Account fields used for labeling.
 * @returns Stable label for rendering.
 */
export function buildAccountLabel(account: Account): string {
  // Prefer the user-provided account name.
  if (account.name) return account.name;

  // Fall back to the stable account identifier.
  return account.id;
}
```

## No inputs, no output, side effects

Put `Side effects:` before the tags. Hover cards attach any text after a tag line to that tag.

```ts
/**
 * Clears cached board snapshots.
 *
 * Purpose: Force the next read to fetch fresh data.
 *
 * Inputs: None.
 *
 * Side effects: Empties the shared snapshot cache.
 *
 * @returns No value.
 */
export function clearSnapshots(): void {
  // Drop every cached entry at once.
  snapshots.clear();
}
```

## Arrow const with a destructured input

Name destructured inputs once with a `@param` for the whole object.

```ts
/**
 * Formats a count badge.
 *
 * Purpose: Keep plural wording identical across views.
 *
 * @param input Count and singular noun to render.
 * @returns Badge text such as "3 boards".
 */
export const formatCount = ({ count, noun }: { count: number; noun: string }): string => {
  // Pluralize everything except exactly one.
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
};
```

## React component

Components, hooks, and handlers wrapped in `memo`, `forwardRef`, or `useCallback` follow the same shape.

```tsx
/**
 * Renders one account label.
 *
 * Purpose: Show labels with consistent fallback rules.
 *
 * @param props Component props holding the account.
 * @returns Label element.
 */
export function AccountLabel({ account }: { account: Account }) {
  // Delegate fallback rules to the shared builder.
  return <Text fw={500}>{buildAccountLabel(account)}</Text>;
}
```

## Class, constructor, and method

Constructors and setters skip `@returns`. Methods sit three blank lines apart.

```ts
/** Retries rejected gateway submissions. */
export class SubmissionRetrier {
  /**
   * Stores the client used for retries.
   *
   * Purpose: Receive dependencies from composition.
   *
   * @param gateway Client that resubmits requests.
   */
  constructor(private readonly gateway: GatewayClient) {}



  /**
   * Retries one rejected request.
   *
   * Purpose: Recover transient failures without user action.
   *
   * @param requestId Identifier of the rejected request.
   * @returns Receipts from the accepted retry.
   */
  async retry(requestId: string): Promise<Receipt[]> {
    // Resubmit the original immutable request.
    return this.gateway.resubmit(requestId);
  }
}
```

## Exported types

A single summary line is enough for shapes. Document members only when meaning is not obvious.

```ts
/** Dependencies supplied by the composition root. */
export type AccountDependencies = {
  store: AccountStorePort;
  lock: AccountLockPort;
};
```

## Inline callbacks and tests

- Trivial callbacks stay inline: `boards.map((board) => board.id)`.
- Object-literal members that implement a documented interface rely on that interface's cards.
- Extract an inline function into a named, documented one once it holds real logic.
- The checker warns when an inline function reaches three statements without a step comment.
- A test's name is its summary. Add step comments for arrange, act, and assert.

## Python function

```python
# Normalizes board identifiers from webhook payloads.
# Keeps provider quirks out of sync logic.



def normalize_board_id(raw: str | int) -> str:
    """Return a canonical board identifier.

    Purpose:
        Compare boards regardless of payload encoding.

    Inputs:
        raw: Identifier as text or number.

    Output:
        Trimmed decimal identifier.
    """

    # Accept numbers and strings with stray whitespace.
    return str(raw).strip()
```
