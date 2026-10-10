# Task model tiers

The worker can select two models from the account's existing connections. Configure all four
environment variables together; unset them to use the normal Rakazo model settings:

```dotenv
TASK_READ_MODEL_PROVIDER=example-provider
TASK_READ_MODEL_ID=small-model
TASK_STRONG_MODEL_PROVIDER=example-provider
TASK_STRONG_MODEL_ID=large-model
```

File listing and file reading use the read model. Requests to edit files and other tasks use the
strong model. An explicit model pinned to a run or bot takes precedence. After a filesystem read
fails, the next completion can use the strong model through Rakazo's native fallback mechanism.
Provider failures also use the existing fallback mechanism. Model changes keep the same run,
computer, workspace restrictions and approval policy; completed actions are not replayed.

Models must be available through the authenticated user's connected provider. Keys stay in the
encrypted connection store. These variables contain only provider and model identifiers.
Free models remain subject to their provider's rate limits; a schedule is not a quota exemption.
Tier selection preserves the selected model's connection settings, including reasoning. It does
not disable reasoning on endpoints that require it.

The native worker reconciler checks pending approval cards every five seconds while keeping its
normal full reconciliation interval. After a card has waited more than ten seconds, it adds one
reminder in the same chat and appends metadata to `DATA_DIR/audit.log` with mode `0600`. Tool
arguments, results, prompts and credentials are excluded. Answered or cancelled waits are skipped.

Computer actions publish their latest screenshot as a private native image artifact in the same
chat. Capture or attachment errors are shown separately so they cannot cause a successful click
or typing action to be repeated. Existing **Take control** and return controls use the bot's own
native computer.
