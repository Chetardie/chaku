// Headers on every response, pages and API alike (D9). The CSP is set per request in proxy.ts.

/** Browser features Chaku doesn't use. Fullscreen is left on for Games (spec §5.4). */
const disabledFeatures = [
  'accelerometer',
  'autoplay',
  'bluetooth',
  'browsing-topics',
  'camera',
  'display-capture',
  'geolocation',
  'gyroscope',
  'hid',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'serial',
  'usb',
  'xr-spatial-tracking',
];

export const securityHeaders: { key: string; value: string }[] = [
  // HTTPS only, for two years, on the app domain and its subdomains (D9 Transport).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Other sites see our origin, never a Chat or Post path.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: disabledFeatures.map((feature) => `${feature}=()`).join(', '),
  },
  // Older browsers that ignore the CSP's frame-ancestors.
  { key: 'X-Frame-Options', value: 'DENY' },
];
