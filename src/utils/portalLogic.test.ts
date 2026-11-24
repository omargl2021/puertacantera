import assert from 'node:assert/strict';
import test from 'node:test';
import { SEED_DATABASE } from '../data/seedData';
import {
  addHouse,
  buildBalancesCsv,
  buildPaymentsCsv,
  buildQrMatrix,
  buildVehicleQrPayload,
  buildVehicleScanUrl,
  cancelVisitPass,
  checkInVisitPass,
  chunkCorbatines,
  commentAndUpdateReport,
  computeHouseBalance,
  createReport,
  createVisitPass,
  formatMxnWhole,
  formatShortDateEs,
  generateNextResidentKey,
  getAllCorbatines,
  inviteUser,
  MAX_RECEIPT_IMAGE_BYTES,
  normalizePortalDatabase,
  parseResidentQrScanParams,
  publishNotice,
  reviewPayment,
  submitPayment,
  updateFeeSchedule,
  updateHouse,
  updateUserAccess,
  validateLoginInput,
  validateReceiptImageFile,
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
      receiptImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      receiptFileName: 'comprobante-nov.png',
      receiptFileSizeBytes: 120_000,
    },
    daniel,
    '2026-11-21T10:15:00',
  );
  assert.equal(submitted.error, undefined);
  assert.ok(submitted.payment);
  assert.equal(submitted.payment.receiptFileName, 'comprobante-nov.png');

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
  assert.ok(qr1.length >= 21);
  assert.equal(qr1.length, qr1[0].length);
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
  assert.equal(inv.user?.carCount, 3);
  assert.equal(inv.user?.vehicleQrCodes.length, 3);
  assert.equal(inv.user?.qrCode, inv.user?.vehicleQrCodes[0].code);
  assert.equal(inv.user?.vehicleQrCodes[0].label, 'Auto 1');
  assert.equal(inv.user?.vehicleQrCodes[2].label, 'Auto 3');
  assert.equal(new Set(inv.user?.vehicleQrCodes.map((v) => v.code)).size, 3);
  const payload = buildVehicleQrPayload(inv.user!, inv.user!.vehicleQrCodes[0], added.house);
  assert.ok(payload.includes('TITULAR:Carlos Hernández'));
  assert.ok(payload.includes('CASA:De Los Robles #104 Int. 2B'));

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

test('validateReceiptImageFile enforces image formats and 5 MB size limit', () => {
  assert.equal(
    validateReceiptImageFile({ name: 'transferencia.jpg', type: 'image/jpeg', size: 1024 * 500 }),
    null,
  );
  assert.equal(
    validateReceiptImageFile({
      name: 'captura.png',
      type: 'image/png',
      size: MAX_RECEIPT_IMAGE_BYTES,
    }),
    null,
  );
  assert.equal(
    validateReceiptImageFile({ name: 'foto.heic', type: '', size: 2_000_000 }),
    null,
  );
  assert.ok(
    validateReceiptImageFile({ name: 'recibo.pdf', type: 'application/pdf', size: 200_000 }),
  );
  assert.ok(
    validateReceiptImageFile({
      name: 'grande.jpg',
      type: 'image/jpeg',
      size: MAX_RECEIPT_IMAGE_BYTES + 1,
    }),
  );
});

test('inviteUser stores phone and per-car plate/color/model and rejects incomplete vehicle details', () => {
  const incomplete = inviteUser(
    SEED_DATABASE,
    {
      email: 'auto-incompleto@correo.com',
      name: 'Luis Pérez',
      phone: '442 555 1234',
      role: 'resident',
      houseId: null,
      street: 'Av. Cantera',
      exteriorNumber: '205',
      carCount: 2,
      vehicles: [
        { plate: 'qro-123-a', color: 'Blanco', model: 'Mazda 3 2024' },
        { plate: 'qro-456-b', color: '', model: 'Honda CR-V' },
      ],
    },
    'Admin',
  );
  assert.ok(incomplete.error?.includes('Automóvil 2'));

  const valid = inviteUser(
    SEED_DATABASE,
    {
      email: 'autos-completos@correo.com',
      name: 'Luis Pérez',
      phone: '442 555 1234',
      role: 'resident',
      houseId: null,
      street: 'Av. Cantera',
      exteriorNumber: '205',
      carCount: 2,
      vehicles: [
        { plate: 'qro-123-a', color: 'Blanco', model: 'Mazda 3 2024' },
        { plate: 'qro-456-b', color: 'Gris Oxford', model: 'Honda CR-V 2023' },
      ],
    },
    'Admin',
  );
  assert.equal(valid.error, undefined);
  assert.equal(valid.user?.residentKey, 'RES003');
  assert.equal(valid.user?.phone, '442 555 1234');
  assert.equal(valid.user?.vehicleQrCodes.length, 2);
  assert.equal(valid.user?.vehicleQrCodes[0].plate, 'QRO-123-A');
  assert.equal(valid.user?.vehicleQrCodes[0].color, 'Blanco');
  assert.equal(valid.user?.vehicleQrCodes[0].model, 'Mazda 3 2024');
  assert.equal(valid.user?.vehicleQrCodes[1].plate, 'QRO-456-B');
  assert.equal(valid.user?.vehicleQrCodes[1].color, 'Gris Oxford');
  assert.equal(valid.user?.vehicleQrCodes[1].model, 'Honda CR-V 2023');
});

test('role limits enforce maximum 1 treasurer and maximum 5 mesa directiva (admin)', () => {
  // Seed already has 2 active admins (Admin + Daniel Cruz) and 0 treasurers
  const t1 = inviteUser(
    SEED_DATABASE,
    { email: 'tesorero1@correo.com', role: 'treasurer', houseId: null, carCount: 0 },
    'Admin',
  );
  assert.equal(t1.error, undefined);

  // Second treasurer must be rejected
  const t2 = inviteUser(
    t1.db,
    { email: 'tesorero2@correo.com', role: 'treasurer', houseId: null, carCount: 0 },
    'Admin',
  );
  assert.ok(t2.error?.includes('Tesorería'));

  // Updating existing treasurer to keep role 'treasurer' is allowed
  const editSameTreasurer = updateUserAccess(
    t1.db,
    t1.user!.id,
    { name: 'Tesorero Principal', role: 'treasurer' },
    'Admin',
  );
  assert.equal(editSameTreasurer.error, undefined);

  // Promoting another user to treasurer while 1 is active must be rejected
  const promoteTreasurer = updateUserAccess(
    t1.db,
    SEED_DATABASE.users[1].id,
    { role: 'treasurer' },
    'Admin',
  );
  assert.ok(promoteTreasurer.error?.includes('Tesorería'));

  // Add 3 more admins to reach the cap of 5 (2 seed + 3 new = 5)
  let currentDb = t1.db;
  for (let i = 3; i <= 5; i += 1) {
    const res = inviteUser(
      currentDb,
      { email: `mesa${i}@correo.com`, role: 'admin', houseId: null, carCount: 0 },
      'Admin',
    );
    assert.equal(res.error, undefined);
    currentDb = res.db;
  }

  // 6th admin must be rejected
  const admin6 = inviteUser(
    currentDb,
    { email: 'mesa6@correo.com', role: 'admin', houseId: null, carCount: 0 },
    'Admin',
  );
  assert.ok(admin6.error?.includes('Mesa directiva'));

  // Deactivating one admin frees a slot for a new admin
  const deactivated = updateUserAccess(
    currentDb,
    currentDb.users[currentDb.users.length - 1].id,
    { active: false },
    'Admin',
  );
  assert.equal(deactivated.error, undefined);
  const replacementAdmin = inviteUser(
    deactivated.db,
    { email: 'mesa6-nuevo@correo.com', role: 'admin', houseId: null, carCount: 0 },
    'Admin',
  );
  assert.equal(replacementAdmin.error, undefined);
});

test('inviteUser enforces unique house addresses, names, emails, vehicle plates and generates consecutive RES001 keys', () => {
  // Empty user list starts at RES001; seed has RES001 and RES002 so next is RES003
  assert.equal(generateNextResidentKey([]), 'RES001');
  assert.equal(generateNextResidentKey(SEED_DATABASE.users), 'RES003');

  const missingExt = inviteUser(
    SEED_DATABASE,
    {
      email: 'sin-ext@correo.com',
      name: 'Sin Exterior',
      role: 'resident',
      houseId: null,
      street: 'Calle Girasol',
      exteriorNumber: '',
      interiorNumber: '4B',
      carCount: 0,
    },
    'Admin',
  );
  assert.ok(missingExt.error?.includes('Número ext'));

  // Duplicate vehicle plate within the same registration is rejected
  const dupBatchPlate = inviteUser(
    SEED_DATABASE,
    {
      email: 'dup-batch@correo.com',
      name: 'Elena Soto',
      role: 'resident',
      houseId: null,
      street: 'Calle Girasol',
      exteriorNumber: '120',
      interiorNumber: '4B',
      carCount: 2,
      vehicles: [
        { plate: 'QRO-777-A', color: 'Blanco', model: 'VW Jetta' },
        { plate: 'qro 777 a', color: 'Negro', model: 'Nissan Versa' },
      ],
    },
    'Admin',
  );
  assert.ok(dupBatchPlate.error?.includes('repetida'));

  const first = inviteUser(
    SEED_DATABASE,
    {
      email: 'girasol1@correo.com',
      name: 'Elena Soto',
      role: 'resident',
      houseId: null,
      street: 'Calle Girasol',
      exteriorNumber: '120',
      interiorNumber: '4B',
      carCount: 1,
      vehicles: [{ plate: 'QRO-777-A', color: 'Blanco', model: 'VW Jetta 2024' }],
    },
    'Admin',
  );
  assert.equal(first.error, undefined);
  assert.equal(first.user?.residentKey, 'RES003');
  assert.equal(first.db.houses.length, 2);
  const createdHouse = first.db.houses.find((h) => h.id === first.user?.houseId);
  assert.equal(createdHouse?.street, 'Calle Girasol');
  assert.equal(createdHouse?.number, '120');
  assert.equal(createdHouse?.interiorNumber, '4B');

  // Duplicate house address via street + Número ext + Num Int is rejected
  const dupAddress = inviteUser(
    first.db,
    {
      email: 'girasol2@correo.com',
      name: 'Marco Soto',
      role: 'resident',
      houseId: null,
      street: '  calle   girasol ',
      exteriorNumber: '120',
      interiorNumber: '4b',
      carCount: 0,
    },
    'Admin',
  );
  assert.ok(dupAddress.error?.includes('dirección'));

  // Duplicate house address via existing assigned houseId is rejected
  const dupHouseId = inviteUser(
    first.db,
    {
      email: 'girasol3@correo.com',
      name: 'Sofía Ruiz',
      role: 'resident',
      houseId: createdHouse!.id,
      carCount: 0,
    },
    'Admin',
  );
  assert.ok(dupHouseId.error?.includes('dirección'));

  // Duplicate resident name (case/space insensitive) is rejected
  const dupName = inviteUser(
    first.db,
    {
      email: 'otro-correo@correo.com',
      name: '  elena   soto ',
      role: 'resident',
      houseId: null,
      street: 'Calle Violeta',
      exteriorNumber: '15',
      carCount: 0,
    },
    'Admin',
  );
  assert.ok(dupName.error?.includes('nombre'));

  // Duplicate email is rejected
  const dupEmail = inviteUser(
    first.db,
    {
      email: 'GIRASOL1@correo.com',
      name: 'Pedro Luna',
      role: 'resident',
      houseId: null,
      street: 'Calle Violeta',
      exteriorNumber: '16',
      carCount: 0,
    },
    'Admin',
  );
  assert.ok(dupEmail.error?.includes('correo'));

  // Duplicate vehicle plate across different residents is rejected
  const dupPlateAcross = inviteUser(
    first.db,
    {
      email: 'pedro@correo.com',
      name: 'Pedro Luna',
      role: 'resident',
      houseId: null,
      street: 'Calle Violeta',
      exteriorNumber: '16',
      carCount: 1,
      vehicles: [{ plate: 'qro-777-a', color: 'Rojo', model: 'Seat Ibiza' }],
    },
    'Admin',
  );
  assert.ok(dupPlateAcross.error?.includes('placa'));

  // Valid second resident gets consecutive RES004 key
  const second = inviteUser(
    first.db,
    {
      email: 'pedro@correo.com',
      name: 'Pedro Luna',
      role: 'resident',
      houseId: null,
      street: 'Calle Violeta',
      exteriorNumber: '16',
      carCount: 1,
      vehicles: [{ plate: 'QRO-888-B', color: 'Rojo', model: 'Seat Ibiza 2023' }],
    },
    'Admin',
  );
  assert.equal(second.error, undefined);
  assert.equal(second.user?.residentKey, 'RES004');
  assert.ok(
    buildVehicleQrPayload(second.user!, second.user!.vehicleQrCodes[0]).includes('CLAVE:RES004'),
  );

  // Editing a house to collide with an existing address is rejected
  const editHouseDup = updateHouse(
    second.db,
    second.user!.houseId!,
    { street: 'Calle Girasol', number: '120', interiorNumber: '4B' },
    'Admin',
  );
  assert.ok(editHouseDup.error?.includes('dirección'));

  // Normalizing legacy DB without residentKey assigns RES001, RES002 sequentially
  const legacyRaw = {
    ...SEED_DATABASE,
    users: SEED_DATABASE.users.map((u) => ({ ...u, residentKey: '' })),
  };
  const normalized = normalizePortalDatabase(legacyRaw);
  assert.equal(normalized.users[0].residentKey, 'RES001');
  assert.equal(normalized.users[1].residentKey, 'RES002');
});

test('QR scan URL round-trips resident details and getAllCorbatines / chunkCorbatines support 1 or 4 per sheet', () => {
  const daniel = SEED_DATABASE.users[1];
  const house = SEED_DATABASE.houses[0];
  const car1 = daniel.vehicleQrCodes[0];

  const scanUrl = buildVehicleScanUrl(daniel, car1, house, 'https://puertacantera.test');
  assert.ok(scanUrl.startsWith('https://puertacantera.test/?scan=1'));

  const urlObj = new URL(scanUrl);
  // 1) Parsing with live DB enriches from live records
  const parsedWithDb = parseResidentQrScanParams(urlObj.search, SEED_DATABASE);
  assert.ok(parsedWithDb);
  assert.equal(parsedWithDb.residentKey, 'RES002');
  assert.equal(parsedWithDb.name, 'Daniel Cruz');
  assert.equal(parsedWithDb.code, car1.code);
  assert.equal(parsedWithDb.houseLabel, 'De Las Flores #389');

  // 2) Parsing without local DB (external phone scan) still reconstructs full resident info from URL
  const parsedStandalone = parseResidentQrScanParams(urlObj.search);
  assert.ok(parsedStandalone);
  assert.equal(parsedStandalone.residentKey, 'RES002');
  assert.equal(parsedStandalone.name, 'Daniel Cruz');
  assert.equal(parsedStandalone.houseLabel, 'De Las Flores #389');

  // Corbatín catalog + 1 or 4 per sheet chunking
  const allCorbatines = getAllCorbatines(SEED_DATABASE);
  assert.equal(allCorbatines.length, 3); // Admin (1 car) + Daniel Cruz (2 cars)
  assert.equal(chunkCorbatines(allCorbatines, 1).length, 3);
  assert.equal(chunkCorbatines(allCorbatines, 4).length, 1);

  // Add 2 more cars via a new resident -> 5 corbatines => 2 sheets at 4-per-sheet, 5 sheets at 1-per-sheet
  const added = inviteUser(
    SEED_DATABASE,
    {
      email: 'corbatin5@correo.com',
      name: 'Valeria Ruiz',
      role: 'resident',
      houseId: null,
      street: 'Av. Cantera',
      exteriorNumber: '55',
      carCount: 2,
      vehicles: [
        { plate: 'QRO-101-X', color: 'Blanco', model: 'BMW X1' },
        { plate: 'QRO-102-Y', color: 'Negro', model: 'Audi A3' },
      ],
    },
    'Admin',
  );
  const fiveCorbatines = getAllCorbatines(added.db);
  assert.equal(fiveCorbatines.length, 5);
  assert.equal(chunkCorbatines(fiveCorbatines, 1).length, 5);
  const fourUpPages = chunkCorbatines(fiveCorbatines, 4);
  assert.equal(fourUpPages.length, 2);
  assert.equal(fourUpPages[0].length, 4);
  assert.equal(fourUpPages[1].length, 1);
});


