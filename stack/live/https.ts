// HTTPS requests to the stack's sites that trust only Caddy's root certificate, the way a browser
// does after the one-time trust step. They never use Node's default CA list, so the developer's
// Node settings don't change the results.
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import tls, { type TLSSocket } from 'node:tls';

export interface Response {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  /** The DNS names the server's certificate is valid for. */
  certificateNames: string[];
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /**
   * PEM certificates to trust. Default: Node's bundled Mozilla list (`tls.rootCertificates`), the
   * public roots that a machine without the trust step has. Not Node's default list: with
   * `NODE_USE_SYSTEM_CA` or `NODE_EXTRA_CA_CERTS` it holds this machine's roots too, Caddy's among
   * them after the trust step (CHK-39).
   */
  ca?: string;
}

/**
 * Browsers and curl resolve every `*.localhost` name to the loopback address themselves; Node.js on
 * Windows doesn't, so the lookup is done here. TLS still checks the certificate against the name.
 */
const loopback: LookupFunction = (hostname, options, callback) => {
  if (!hostname.endsWith('.localhost')) throw new Error(`Not a stack site: ${hostname}`);
  if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
  else callback(null, '127.0.0.1', 4);
};

export function request(url: string, options: RequestOptions = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: options.method ?? 'GET',
        headers: options.headers,
        ca: options.ca ?? [...tls.rootCertificates],
        lookup: loopback,
        agent: false,
      },
      (res) => {
        const socket = res.socket as TLSSocket;
        const certificateNames = (socket.getPeerCertificate().subjectaltname ?? '')
          .split(', ')
          .filter((name) => name.startsWith('DNS:'))
          .map((name) => name.slice('DNS:'.length));
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body, certificateNames });
        });
      },
    );
    req.on('error', reject);
    req.end(options.body);
  });
}
