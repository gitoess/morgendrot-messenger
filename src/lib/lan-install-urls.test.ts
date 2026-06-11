import { describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import { collectLanIpv4Hosts, buildLanInstallUrlPair } from './lan-install-urls.js';

describe('lan-install-urls', () => {
    it('buildLanInstallUrlPair', () => {
        expect(buildLanInstallUrlPair('192.168.0.10', 3341, 3342)).toEqual({
            pwaUrl: 'http://192.168.0.10:3341',
            apiBaseUrl: 'http://192.168.0.10:3342',
        });
    });

    it('collectLanIpv4Hosts filtert loopback', () => {
        vi.spyOn(os, 'networkInterfaces').mockReturnValue({
            eth0: [
                { address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '', mac: '', cidr: null },
                { address: '192.168.1.42', family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null },
            ],
        });
        expect(collectLanIpv4Hosts()).toEqual(['192.168.1.42']);
        vi.restoreAllMocks();
    });
});
