# Elite Phase 2: Governance and Approval Control

## Purpose

Elite Phase 2 turns Organisation Command into a controlled operating layer for larger and multi-site organisations. It adds accountability, separation of duties and executive oversight without removing Pro's complete day-to-day scheduling product.

## Elite-only capabilities

### Approval workflows

Elite can require approval of the exact saved snapshot before:

- a matchweek is published to history;
- a coach-message batch is sent through a web provider;
- a funding evidence pack is treated as approved;
- an executive report is issued, when that optional policy is enabled.

Each request records its entity key, title, summary, requester, decision, timestamps, expiry and source snapshot. A changed schedule or message produces a different key and therefore requires a new approval.

Separation of duties is enabled by default: the requester cannot approve their own item.

### Delegated site responsibility

Organisation owners and administrators can assign a club member as:

- Site lead
- Site administrator
- Reviewer / approver
- Executive viewer

Assignments can be scoped to a configured site and are included in the governance audit trail. They grant approval responsibility within Elite governance; existing Ground Control workspace roles remain the underlying application-data security boundary.

### Communications governance

Elite administrators can maintain controlled subjects and message copy for confirmed fixtures, postponements and cancellations. Active templates are applied to the reviewed coach-message queue and the same subject/body snapshot is included in approval and duplicate-protection checks.

### Organisation-wide funding oversight

Organisation Command summarises projects, active applications, requested and awarded amounts, tasks and monitoring obligations. Funding-pack approval requests can be raised from the same governance workspace.

### Enhanced audit

Requests, decisions, role assignments, policy changes and template updates are written to the existing club audit stream. Provider delivery events remain separate from approval decisions.

## Server authority

Approval is enforced on the server for:

- `save_matchweek_history` on Elite workspaces when matchweek approval is required;
- `/api/communications/dispatch` through `assert_elite_communication_approval` when communication approval is required.

Core and Pro retain their existing behaviour and cannot access Elite governance tables or controls.

## Deliberate limits

This phase does not claim full site-level row isolation across all existing club data. Site assignments define accountability and approval scope. A future data-partitioning phase would be required before a site administrator could be technically restricted to viewing only their assigned venue across every Ground Control module.

The phase also does not advertise support SLAs, managed grant writing or named account management. Those remain commercial-service decisions rather than software claims.
