import assert from 'node:assert/strict';
import test from 'node:test';
import { SEED_DATABASE } from '../data/seedData';
import {
  addHouse,
  buildBalancesCsv,
  buildPaymentsCsv,
  buildQrMatrix,
  cancelVisitPass,
  checkInVisitPass,
  commentAndUpdateReport,
  computeHouseBalance,
  createReport,
  createVisitPass,
  formatMxnWhole,
  formatShortDateEs,
  inviteUser,
  publishNotice,
  reviewPayment,
  submitPayment,
  updateFeeSchedule,
  updateUserAccess,
  validateLoginInput,
} from './portalLogic';

test('formatMxnWhole and formatShortDateEs match Puerta Cantera Spanish formatting', () => {
  assert.equal(formatMxnWhole(400), '$400');
  assert.equal(formatMxnWhole(2200), '$2,200');
  assert.equal(formatMxnWhole(4200), '$4,200');
  assert.equal(formatShortDateEs('2026-11-09', true), '9 nov 2026');
  assert.equal(formatShortDateEs('2026-11-16', false), '16 nov');
});

test('validateLoginInput rejects bad email or short password', () => {
  assert.ok(validateLoginInput('invalido', '123456'));
  assert.ok(validateLoginInput('admin@puertacantera.com', '12'));
  assert.equal(validateLoginInput('admin@puertacantera.com', 'cantera2026'), null);
});

test('computeHouseBalance starts De Las Flores #389 with 1 month owed ($400) and settles after approved payment', () => {
  const house = SEED_DATABASE.houses[0];
  const initial = computeHouseBalance(house, SEED_DATABASE.feeHistory, SEED_DATABASE.payments, '2026-11-21');
  assert.equal(initial.status, 'debt');
  assert.equal(initial.monthsOwed, 1);
  assert.equal(initial.debtMxn, 400);
  assert.equal(initial.paidUntilLabel, '—');

  const daniel = SEED_DATABASE.users[1];
  const submitted = submitPayment(
    SEED_DATABASE,
    {
      periodLabel: 'Noviembre 2026',
      monthsCovered: 1,
      amountMxn: 400,
      method: 'Transferencia SPEI',
      reference: 'SPEI-38901',
    },
    daniel,
    '2026-11-21T10:15:00',
  );
  assert.equal(submitted.error, undefined);
  assert.ok(submitted.payment);

  // Pending payment does not settle balance yet
  const whilePending = computeHouseBalance(house, submitted.db.feeHistory, submitted.db.payments, '2026-11-21');
  assert.equal(whilePending.monthsOwed, 1);
  assert.equal(whilePending.pendingCount, 1);

  const reviewed = reviewPayment(
    submitted.db,
    submitted.payment.id,
    'approved',
    400,
    'Verificado en estado de cuenta',
    'Admin',
    '2026-11-21T10:30:00',
  );
  assert.equal(reviewed.error, undefined);

  const settled = computeHouseBalance(house, reviewed.db.feeHistory, reviewed.db.payments, '2026-11-21');
  assert.equal(settled.status, 'ok');
  assert.equal(settled.monthsOwed, 0);
  assert.equal(settled.debtMxn, 0);
  assert.equal(settled.paidUntilLabel, 'nov 2026');
  assert.equal(reviewed.db.auditLog[0].action, 'Aprobó un pago');
});

test('updateFeeSchedule validates dueDay and prepends fee history with audit log', () => {
  const invalid = updateFeeSchedule(
    SEED_DATABASE,
    {
      monthlyMxn: 450,
      semiannualMxn: 2400,
      annualMxn: 4600,
      dueDay: 31,
      billingStartMonth: '2026-11',
      effectiveFrom: '2026-12-01',
    },
    'Admin',
  );
  assert.ok(invalid.error);

  const valid = updateFeeSchedule(
    SEED_DATABASE,
    {
      monthlyMxn: 450,
      semiannualMxn: 2400,
      annualMxn: 4600,
      dueDay: 12,
      billingStartMonth: '2026-11',
      effectiveFrom: '2026-12-01',
    },
    'Admin',
    '2026-11-21T11:00:00',
  );
  assert.equal(valid.error, undefined);
  assert.equal(valid.db.feeHistory.length, 2);
  assert.equal(valid.db.feeHistory[0].monthlyMxn, 450);
  assert.equal(valid.db.auditLog[0].action, 'Cambió las cuotas');
});

test('publishNotice, createReport, and commentAndUpdateReport update state and audit trail', () => {
  const pub = publishNotice(
    SEED_DATABASE,
    {
      title: 'Corte programado de agua',
      body: 'El viernes de 9:00 a 13:00 se dará mantenimiento a la cisterna.',
      category: 'mantenimiento',
      urgent: true,
      pinned: true,
      sendPush: true,
    },
    'Admin',
  );
  assert.equal(pub.error, undefined);
  assert.equal(pub.db.notices.length, 1);

  const daniel = SEED_DATABASE.users[1];
  const created = createReport(
    pub.db,
    {
      title: 'Luminaria apagada en acceso',
      category: 'Alumbrado',
      description: 'La lámpara frente al parque no enciende desde anoche.',
      location: 'Acceso principal',
    },
    daniel,
  );
  assert.equal(created.error, undefined);
  assert.equal(created.report?.folio, '#R-0002');

  const replied = commentAndUpdateReport(
    created.db,
    created.report!.id,
    'Ya se turnó al electricista.',
    'in_progress',
    'Admin',
    true,
  );
  assert.equal(replied.error, undefined);
  const updatedRep = replied.db.reports.find((r) => r.id === created.report!.id);
  assert.equal(updatedRep?.status, 'in_progress');
  assert.equal(updatedRep?.comments.length, 1);
});

test('visit pass lifecycle (create, check-in, cancel) and deterministic QR matrix', () => {
  const daniel = SEED_DATABASE.users[1];
  const res = createVisitPass(
    SEED_DATABASE,
    {
      visitorName: 'Laura Méndez',
      plate: 'MCH-410-B',
      companions: 1,
      accessType: 'single',
      validFrom: '2026-11-21',
      validUntil: '2026-11-21',
    },
    daniel,
  );
  assert.equal(res.error, undefined);
  assert.ok(res.pass);

  const checked = checkInVisitPass(res.db, res.pass.id, 'Caseta norte', '2026-11-21T14:20:00');
  const updatedPass = checked.passes.find((p) => p.id === res.pass!.id);
  assert.equal(updatedPass?.status, 'used');
  assert.equal(updatedPass?.entries.length, 1);

  const cancelled = cancelVisitPass(res.db, res.pass.id, 'Daniel Cruz');
  assert.equal(cancelled.passes.find((p) => p.id === res.pass!.id)?.status, 'cancelled');

  const qr1 = buildQrMatrix(res.pass.code);
  const qr2 = buildQrMatrix(res.pass.code);
  assert.equal(qr1.length, 21);
  assert.deepEqual(qr1, qr2);
});

test('addHouse (Número Interior), inviteUser (QR personal + QR por auto), updateUserAccess, and CSV exports work end-to-end', () => {
  const added = addHouse(
    SEED_DATABASE,
    { street: 'De Los Robles', number: '104', interiorNumber: '2B', familyName: 'Familia Hernández' },
    'Admin',
  );
  assert.equal(added.error, undefined);
  assert.equal(added.db.houses.length, 2);
  assert.equal(added.house?.interiorNumber, '2B');

  const inv = inviteUser(
    added.db,
    {
      email: 'vecino@ejemplo.com',
      name: 'Carlos Hernández',
      role: 'resident',
      houseId: added.house!.id,
      carCount: 3,
    },
    'Admin',
  );
  assert.equal(inv.error, undefined);
  assert.equal(inv.db.invitations.length, 1);
  assert.ok(inv.user?.qrCode.startsWith('PC-USR-'));
  assert.equal(inv.user?.carCount, 3);
  assert.equal(inv.user?.vehicleQrCodes.length, 3);
  assert.equal(inv.user?.vehicleQrCodes[0].label, 'Auto 1');
  assert.equal(inv.user?.vehicleQrCodes[2].label, 'Auto 3');
  assert.equal(new Set(inv.user?.vehicleQrCodes.map((v) => v.code)).size, 3);

  const firstCarCode = inv.user!.vehicleQrCodes[0].code;

  const updatedCars = updateUserAccess(
    inv.db,
    inv.user!.id,
    { carCount: 4 },
    'Admin',
  );
  assert.equal(updatedCars.error, undefined);
  const editedUser = updatedCars.db.users.find((u) => u.id === inv.user!.id);
  assert.equal(editedUser?.vehicleQrCodes.length, 4);
  // Preserves existing car QR codes when adding another automobile
  assert.equal(editedUser?.vehicleQrCodes[0].code, firstCarCode);

  const balancesCsv = buildBalancesCsv(updatedCars.db);
  assert.ok(balancesCsv.includes('De Las Flores #389'));
  assert.ok(balancesCsv.includes('De Los Robles #104 Int. 2B'));

  const paymentsCsv = buildPaymentsCsv(updatedCars.db);
  assert.ok(paymentsCsv.startsWith('Folio,Casa,Vecino'));
});
