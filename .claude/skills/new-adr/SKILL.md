---
name: new-adr
description: Record an architecture decision as a new ADR in docs/adr/, in this repo's format, and wire it into the spec and amended ADRs. Use when a decision about structure, technology, data ownership, protocols or security is made or changed, or the user says "write an ADR" or "/new-adr".
---

# New ADR

1. **Number:** next free number in `docs/adr/` (4 digits). **File:** `NNNN-short-kebab-title.md`.
2. **Format:** match the existing ADRs.

   ```markdown
   ---
   status: accepted            # or proposed
   date: YYYY-MM-DD
   amends: ADR-000X            # only if it changes an earlier ADR
   ---

   # Title as a statement of the decision

   The decision in plain words: what we do, concretely.

   ## Why
   The forces and the reasoning.

   ## Considered options
   - **Option:** why not.

   ## Consequences
   - What follows, including follow-up work and risks.
   ```

   Write plainly and briefly. Use CONTEXT.md terms. Name concrete libraries, values and limits.
3. **If it amends an earlier ADR:**
   - add `amended-by: ADR-NNNN` to that ADR's frontmatter
   - add an inline italic note to each changed paragraph: `_(Amended by ADR-NNNN: …)_`

   Never leave stale text unmarked (D45).
4. **Spec:** add a decision `Dn` to §9 of `docs/messenger-app-spec.md` that points to the ADR, and update any spec section it changes, with an inline "(Revised by Dn …)" on older decisions.
5. **Glossary:** if the ADR introduces or changes a domain term, update `CONTEXT.md`.
6. Update the ADR range in `docs/README.md`.
