// What the global setup hands to the test workers through Vitest's provide/inject.
export interface TestDatabaseContext {
  /** DATABASE_URL: the server, and the database that admin statements connect to. */
  url: string;
  /** The migrated template every worker database is cloned from. */
  template: string;
  /** Every worker database of this package starts with this. */
  prefix: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabase: TestDatabaseContext;
  }
}
