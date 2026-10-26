Closes #

## What changed

## End-to-end test
<!-- Numbered steps a person follows in the real product to see this work, including how it interacts with neighboring features. -->
1.

## What could go wrong for users
<!-- Assume confused or careless users: empty states, wrong input, double clicks, slow networks, missing permissions. Say what is handled and what is not. -->
-

## Verification
<!-- Run it right before opening this PR. The master's `npm run cc -- verify` adds its own dated result as a comment before merging. -->
Ran `npm run cc -- check` at <YYYY-MM-DD HH:MM> on <commit>: <pass, with time, or what failed>.
- [ ] Exercised in a running copy of the app at `<commit>` (UI or behavior changes only)

## Needs {{owner}}'s review
<!-- Any ticked box: the master labels this PR needs-human-review and waits. -->
- [ ] Database schema or migration
- [ ] Shared contracts used by several parts
- [ ] Auth, permissions, billing, or account data
- [ ] Production config, deployment, CI, or agent rules
- [ ] Removes or renames a user-visible feature
- [ ] Adds a module, external service, or significant dependency
