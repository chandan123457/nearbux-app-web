#!/usr/bin/env node
/**
 * Expo ko physical device ke liye start karta hai.
 *
 * Phone ko DO cheezein chahiye jo `localhost` se kabhi nahi milengi:
 *   1. Metro (JS bundle) — REACT_NATIVE_PACKAGER_HOSTNAME se
 *   2. API — EXPO_PUBLIC_API_URL se
 *
 * Expo ka apna LAN detection kabhi-kabhi loopback par gir jaata hai (VPN,
 * container, ya kai interfaces hone par). Tab QR code `exp://127.0.0.1` hota
 * hai, aur phone ke liye 127.0.0.1 khud PHONE hota hai — kuch load hi nahi
 * hota. Isliye IP yahan explicitly detect karke pass karte hain.
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const API_PORT = process.env.PORT ?? '3000';

function detectLanIp() {
  const candidates = [];

  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    // Docker/VM bridges routable lagte hain par phone se reachable nahi hote
    if (/^(docker|br-|veth|virbr|vmnet|utun|tun|tap)/i.test(name)) continue;

    for (const addr of addresses ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      candidates.push({ name, address: addr.address });
    }
  }

  // Home/office networks ko prefer karo Docker ke default ranges ke upar
  const preferred = candidates.find((c) => /^(192\.168\.|10\.)/.test(c.address));
  return preferred ?? candidates[0] ?? null;
}

const lan = detectLanIp();

if (!lan) {
  console.error('\nKoi LAN IP nahi mila. Wi-Fi se connected ho?\n');
  process.exit(1);
}

const apiUrl = `http://${lan.address}:${API_PORT}`;

console.log(`\n  Interface : ${lan.name}`);
console.log(`  Metro     : http://${lan.address}:8081`);
console.log(`  API       : ${apiUrl}`);
console.log(`\n  Phone ko isi Wi-Fi par hona chahiye. Expo Go mein QR scan karo.\n`);

const child = spawn(
  'pnpm',
  ['--filter', '@nearbux/mobile', 'exec', 'expo', 'start', '--lan', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      REACT_NATIVE_PACKAGER_HOSTNAME: lan.address,
      EXPO_PUBLIC_API_URL: apiUrl,
    },
  },
);

child.on('exit', (code) => process.exit(code ?? 0));
