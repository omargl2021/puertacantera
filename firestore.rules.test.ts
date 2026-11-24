import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = fs.existsSync(path.resolve('firestore.rules'))
  ? path.resolve('firestore.rules')
  : path.resolve('DRAFT_firestore.rules');
const blueprintPath = path.resolve('firebase-blueprint.json');

const rules = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
  firestore: Record<string, unknown>;
};

test('Dirty Dozen 1 & 2: default-deny catch-all and verified email check enforced', () => {
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /request\.auth\.token\.email == 'omargarcialeal@gmail\.com'/);
});

test('Dirty Dozen 3 & 4: PII residents collection blocks cross-user reads and non-admin writes', () => {
  const residentsMatch = rules.match(/match \/residents\/\{residentId\}[\s\S]*?\n    \}/);
  assert.ok(residentsMatch, 'residents match block must exist');
  const block = residentsMatch[0];
  assert.match(block, /existing\(\)\.ownerUid == request\.auth\.uid/);
  assert.match(block, /allow create:[\s\S]*isAdmin\(\)/);
  assert.match(block, /allow update:[\s\S]*isAdmin\(\)/);
  assert.match(block, /allow delete:[\s\S]*isAdmin\(\)/);
});

test('Dirty Dozen 5, 6, 7: strict hasOnly schemas, admin bootstrap lock, and isValidId guards', () => {
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
  assert.match(rules, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rules, /match \/admins\/\{uid\}[\s\S]*allow create:[\s\S]*isBootstrapAdmin\(\)/);
});

test('Dirty Dozen 8, 9, 10, 11, 12: terminal state locks, server timestamps, bounded arrays, immutable audit logs', () => {
  assert.match(rules, /incoming\(\)\.status == 'pending'/);
  assert.match(rules, /existing\(\)\.status != 'resolved'/);
  assert.match(rules, /existing\(\)\.status != 'cancelled'/);
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /data\.vehicleQrCodes\.size\(\) <= 10/);
  assert.match(rules, /match \/auditLogs\/\{logId\}[\s\S]*allow update: if false;[\s\S]*allow delete: if false;/);
});

test('Every collection in firebase-blueprint.json has an explicit match block in rules', () => {
  for (const collectionPath of Object.keys(blueprint.firestore)) {
    const topCollection = collectionPath.split('/').filter(Boolean)[0];
    assert.ok(
      rules.includes(`match /${topCollection}/`),
      `Missing match block for collection /${topCollection}`,
    );
  }
});
