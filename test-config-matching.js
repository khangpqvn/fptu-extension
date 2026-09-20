#!/usr/bin/env node
/**
 * Test config structure matching logic
 * Simulates what auto-run.js does with the new nested config
 */
import fs from 'fs';
import { join } from 'path';

const config = JSON.parse(fs.readFileSync(join(process.cwd(), 'src/config.json'), 'utf8'));

// Test cases: [domain, pathname, expected action names]
const tests = [
  ['fap.fpt.edu.vn', '/Attendance/EditAttendance.aspx', ['fap-attendance', 'fap-nav-attendance-hook']],
  ['fap.fpt.edu.vn', '/Attendance/ViewAttendance.aspx', ['fap-nav-attendance-hook']],
  ['fap.fpt.edu.vn', '/Teacher.aspx', ['fap-teacher-search-student-hook']],
  ['example.com', '*', ['qr-share-link']],
];

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function normalizePath(value) {
  if (!value || value === '/') return '/';
  const p = value.startsWith('/') ? value : `/${value}`;
  return p.replace(/\/+$/, '') || '/';
}

function escapeRegExp(str) {
  return str.replace(/[|\\{}()[\]^$+?.-]/g, '\\$&');
}

function matchesDomain(pattern, host) {
  return pattern === '*' || (typeof pattern === 'string' && pattern.toLowerCase().replace(/^www\./, '') === host);
}

function matchesEndpoint(pattern, path) {
  if (pattern === '*') return true;
  if (typeof pattern !== 'string') return false;
  const normalized = normalizePath(pattern);
  const expr = escapeRegExp(normalized).replace(/\*/g, '[^/]*');
  return new RegExp(`^${expr}$`).test(path);
}

function getActionIds(config, hostname, pathname) {
  const actionIds = [];
  const seenActionIds = new Set();
  const routes = Array.isArray(config?.routes) ? config.routes : [];

  routes.forEach((route) => {
    if (!route || !matchesDomain(route.domain, hostname)) {
      return;
    }

    const endpoints = Array.isArray(route.endpoints) ? route.endpoints : [];
    endpoints.forEach((endpointObj) => {
      if (!endpointObj || !matchesEndpoint(endpointObj.endpoint, pathname)) {
        return;
      }

      if (!Array.isArray(endpointObj.actions)) {
        return;
      }

      endpointObj.actions.forEach((actionId) => {
        if (typeof actionId !== 'string' || seenActionIds.has(actionId)) {
          return;
        }
        seenActionIds.add(actionId);
        actionIds.push(actionId);
      });
    });
  });

  return actionIds;
}

let passed = 0;
let failed = 0;

console.log('Testing config matching logic:\n');

tests.forEach(([domain, pathname, expected]) => {
  const hostname = normalizeHostname(domain);
  const normalized = normalizePath(pathname);
  const result = getActionIds(config, hostname, normalized);
  const match = JSON.stringify(result) === JSON.stringify(expected);

  const status = match ? '✓ PASS' : '✗ FAIL';
  console.log(`${status}: ${domain}${pathname}`);
  console.log(`  Expected: ${JSON.stringify(expected)}`);
  console.log(`  Got:      ${JSON.stringify(result)}`);

  if (match) passed++;
  else failed++;
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
