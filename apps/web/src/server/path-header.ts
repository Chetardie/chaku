// The request header proxy.ts sets on every page request: the path and query the browser asked
// for. `requireMemberPage()` sends the login page back there. Its own file, so the proxy imports
// nothing else from the server code.
export const pathHeader = 'x-chaku-path';
