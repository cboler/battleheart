# Completed Execution Plans

This directory serves as the historical archive for verified execution plans.

---

## Archival Guidelines

When an execution plan from `docs/exec-plans/active/` is finished:

1. **Verify All Gates**: Ensure all verification tasks (unit tests, linting, formatting, E2E smoke tests, browser verification) are checked off.
2. **Update Status**: Set `- **Status**: Completed` in the plan header and record the completion date.
3. **Move File**: Move the file from `docs/exec-plans/active/` to `docs/exec-plans/completed/`.
4. **Update Documentation**:
   - Check off corresponding roadmap milestones in `docs/ROADMAP.md`.
   - If the implementation introduced a major architectural change or technical trade-off, record an ADR in `docs/DECISIONS.md`.

Archived plans provide historical context, rationale, and traceability for why and how features were built.
