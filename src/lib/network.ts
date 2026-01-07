/**
 * Network configuration for Node.js fetch
 * Fixes IPv6/IPv4 connection issues by forcing IPv4 DNS resolution
 */

import { setGlobalDispatcher, Agent } from "undici";
import dns from "dns";

/**
 * Configure global fetch to use IPv4-only DNS resolution
 * This fixes connection timeouts in Docker and some network configurations
 * where IPv6 is partially configured but not routable
 */
export function configureIPv4OnlyFetch(): void {
  setGlobalDispatcher(
    new Agent({
      connect: {
        lookup: (hostname, _options, callback) => {
          dns.resolve4(hostname, (err, addresses) => {
            if (err) return callback(err, "", 4);
            // undici expects: callback(null, [{ address: ip, family: 4 }])
            callback(
              null,
              addresses.map((addr) => ({ address: addr, family: 4 as const }))
            );
          });
        },
      },
    })
  );
}
