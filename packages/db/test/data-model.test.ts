// CHK-24: `describeDataModelSchema` compares a module's migrated schema with its section of
// docs/architecture/data-model.md. Run here against identity, it must agree with identity's own
// schema test; the doc reader must also handle the types other modules use.
import { describe, expect, it } from 'vitest';

import { dataModelTables, describeDataModelSchema, useTestDatabase } from '../src/testing/index.ts';

const database = useTestDatabase();

describeDataModelSchema('identity', database);

const doc = `
## \`scratch\`

Notes.

#### \`scratch.notes\`

| Column | Type | Notes |
|---|---|---|
| \`id\` | \`uuid\` | PK, default \`uuidv7()\` |
| \`parent_id\` | \`uuid null\` | FK → \`scratch.notes.id\` |
| \`author_id\` | \`uuid\` | ID → \`identity.members.id\` |
| \`likes\`, \`dislikes\` | \`integer\` | counters |
| \`score\` | \`double precision null\` | |
| \`tag_ids\` | \`uuid[]\` | |
| \`written_at\` | \`timestamptz\` | |

Keys and indexes:
- \`notes_pkey\`: primary key (\`id\`)
- \`notes_author_idx\`: (\`author_id\`)
- \`notes_likes_check\`: \`likes >= 0\`

### Erasure

| Table | On \`member.erasure_requested\` |
|---|---|
| \`scratch.notes\` | deleted |

## \`other\`

#### \`other.things\`
`;

describe('dataModelTables', () => {
  it("reads a module's tables, columns, foreign keys and keys from the doc", () => {
    expect(dataModelTables('scratch', doc)).toEqual([
      {
        name: 'notes',
        columns: [
          { name: 'id', type: 'uuid', nullable: false },
          { name: 'parent_id', type: 'uuid', nullable: true, references: 'notes.id' },
          { name: 'author_id', type: 'uuid', nullable: false },
          { name: 'likes', type: 'integer', nullable: false },
          { name: 'dislikes', type: 'integer', nullable: false },
          { name: 'score', type: 'double precision', nullable: true },
          { name: 'tag_ids', type: 'uuid[]', nullable: false },
          { name: 'written_at', type: 'timestamptz', nullable: false },
        ],
        keys: ['notes_pkey', 'notes_author_idx', 'notes_likes_check'],
      },
    ]);
  });

  it('has no tables for a module without a section', () => {
    expect(dataModelTables('missing', doc)).toEqual([]);
  });

  it('reads the real doc', () => {
    expect(dataModelTables('identity').map((table) => table.name)).toContain('members');
    expect(dataModelTables('feed').length).toBeGreaterThan(0);
  });
});
