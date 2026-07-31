// เทสฟังก์ชันโหลดไฟล์สินค้าที่มีวันหมดอายุ (Location CSV Upload)
// รันด้วย: node parseFile.test.js
// ไม่ต้องติดตั้ง dependency เพิ่ม ใช้ assert ของ Node เอง

const assert = require('assert');
const { normalizeDateStr, parseLocationCSVCore, dedupRows } = require('./parseFile.core.js');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ============================================================
// ส่วนที่ 1: normalizeDateStr — เทสปกติ
// ============================================================
section('📅 normalizeDateStr — กรณีปกติ (ฟอร์แมตวันที่ที่ถูกต้อง)');

test('D/M/YY (13/1/26) แปลงเป็น YYYY-MM-DD ถูกต้อง', () => {
  const r = normalizeDateStr('13/1/26');
  assert.strictEqual(r.value, '2026-01-13');
  assert.strictEqual(r.raw, '13/1/26');
});

test('D/M/YYYY (28/2/2027) แปลงถูกต้อง', () => {
  const r = normalizeDateStr('28/2/2027');
  assert.strictEqual(r.value, '2027-02-28');
});

test('DD-MM-YYYY (13-01-2026) แปลงถูกต้อง', () => {
  const r = normalizeDateStr('13-01-2026');
  assert.strictEqual(r.value, '2026-01-13');
});

test('DD.MM.YY (13.01.26) แปลงถูกต้อง', () => {
  const r = normalizeDateStr('13.01.26');
  assert.strictEqual(r.value, '2026-01-13');
});

test('YYYY-MM-DD (2026-01-13) ที่ถูกต้องอยู่แล้ว ผ่านตรงไม่แก้ไข', () => {
  const r = normalizeDateStr('2026-01-13');
  assert.strictEqual(r.value, '2026-01-13');
});

test('YYYY-M-D (2026-1-3) เติม 0 นำหน้าให้ถูกต้อง', () => {
  const r = normalizeDateStr('2026-1-3');
  assert.strictEqual(r.value, '2026-01-03');
});

test('วันสุดท้ายของเดือน (31/12/25) แปลงถูกต้อง', () => {
  const r = normalizeDateStr('31/12/25');
  assert.strictEqual(r.value, '2025-12-31');
});

test('มีช่องว่างรอบข้อความ (" 13/1/26 ") ตัดช่องว่างก่อนแปลง', () => {
  const r = normalizeDateStr(' 13/1/26 ');
  assert.strictEqual(r.value, '2026-01-13');
});

// ============================================================
// ส่วนที่ 2: normalizeDateStr — เทส error (ฟอร์แมตผิด/ไม่สมบูรณ์)
// ============================================================
section('🚫 normalizeDateStr — กรณี error (ค่าที่แปลงไม่ได้)');

test('ค่าว่าง ("") คืน value=null, raw=""', () => {
  const r = normalizeDateStr('');
  assert.strictEqual(r.value, null);
  assert.strictEqual(r.raw, '');
});

test('undefined คืน value=null, raw=""', () => {
  const r = normalizeDateStr(undefined);
  assert.strictEqual(r.value, null);
});

test('null คืน value=null, raw=""', () => {
  const r = normalizeDateStr(null);
  assert.strictEqual(r.value, null);
});

test('เดือนเกิน 12 (13/13/26) คืน value=null แต่เก็บ raw ไว้', () => {
  const r = normalizeDateStr('13/13/26');
  assert.strictEqual(r.value, null);
  assert.strictEqual(r.raw, '13/13/26');
});

test('วันเกิน 31 (35/1/26) คืน value=null', () => {
  const r = normalizeDateStr('35/1/26');
  assert.strictEqual(r.value, null);
});

test('วันที่ 0 (0/1/26) คืน value=null (ไม่มีวันที่ 0)', () => {
  const r = normalizeDateStr('0/1/26');
  assert.strictEqual(r.value, null);
});

test('ข้อความที่ไม่ใช่วันที่เลย ("สวัสดี") คืน value=null แต่เก็บ raw ไว้ให้เห็น', () => {
  const r = normalizeDateStr('สวัสดี');
  assert.strictEqual(r.value, null);
  assert.strictEqual(r.raw, 'สวัสดี');
});

test('รูปแบบ Excel serial number (45678) คืน value=null (ไม่รองรับ)', () => {
  const r = normalizeDateStr('45678');
  assert.strictEqual(r.value, null);
});

test('วันที่ไม่ครบ 3 ส่วน (13/1) คืน value=null', () => {
  const r = normalizeDateStr('13/1');
  assert.strictEqual(r.value, null);
});

// ============================================================
// ส่วนที่ 3: parseLocationCSVCore — เทสปกติ
// ============================================================
section('📄 parseLocationCSVCore — กรณีปกติ (ไฟล์ถูกต้อง)');

test('ไฟล์มาตรฐานครบทุกคอลัมน์ (Location,SKU,Qty,MFD,EXP) parse ได้ครบ', () => {
  const csv = 'Location,SKU,Qty,MFD,EXP\nFA01,6900000001234,50,2024-01-01,2025-06-30\nFA01,6900000001235,20,,\nBA02,6900000001236,100,,2025-12-31';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.rows.length, 3);
  assert.strictEqual(r.rows[0].loc, 'FA01');
  assert.strictEqual(r.rows[0].sku, '6900000001234');
  assert.strictEqual(r.rows[0].qty, 50);
  assert.strictEqual(r.rows[0].exp, '2025-06-30');
});

test('เว้น Location ว่าง → default เป็น PENDING', () => {
  const csv = 'Location,SKU,Qty\n,6900000001237,30';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.rows[0].loc, 'PENDING');
});

test('เว้น MFD/EXP ว่าง → mfd/exp เป็น null ไม่ error', () => {
  const csv = 'Location,SKU,Qty,MFD,EXP\nFA01,SKU001,10,,';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.rows[0].mfd, null);
  assert.strictEqual(r.rows[0].exp, null);
  assert.strictEqual(r.badDateCount, 0); // ค่าว่างไม่นับเป็น "แปลงไม่ได้"
});

test('หัวตารางสลับลำดับคอลัมน์ได้ (ไม่ต้องเรียงตามเทมเพลต)', () => {
  const csv = 'SKU,EXP,Location,Qty,MFD\nSKU001,2026-01-01,FA01,5,2025-01-01';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.rows[0].sku, 'SKU001');
  assert.strictEqual(r.rows[0].loc, 'FA01');
  assert.strictEqual(r.rows[0].exp, '2026-01-01');
});

test('หัวตารางภาษาไทย (โลเคชั่น,รหัส,จำนวน,วันผลิต,วันหมดอายุ) ใช้ได้', () => {
  const csv = 'โลเคชั่น,รหัส,จำนวน,วันผลิต,วันหมดอายุ\nFA01,SKU001,10,1/1/26,1/1/27';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.rows[0].mfd, '2026-01-01');
  assert.strictEqual(r.rows[0].exp, '2027-01-01');
});

test('ตัดช่องว่างและแปลงตัวพิมพ์เล็ก SKU เป็นใหญ่อัตโนมัติ', () => {
  const csv = 'Location,SKU,Qty\n fa01 , sku001 ,5';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.rows[0].loc, 'FA01');
  assert.strictEqual(r.rows[0].sku, 'SKU001');
});

test('จำนวนมี comma คั่นหลักพัน (1,234) parse เป็นตัวเลขถูกต้อง', () => {
  const csv = 'Location,SKU,Qty\nFA01,SKU001,"1,234"';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.rows[0].qty, 1234);
});

// ============================================================
// ส่วนที่ 4: parseLocationCSVCore — เทส error
// ============================================================
section('🚫 parseLocationCSVCore — กรณี error');

test('ไฟล์ว่างเปล่า (string ว่าง) คืน error', () => {
  const r = parseLocationCSVCore('');
  assert.ok(r.error);
  assert.strictEqual(r.rows.length, 0);
});

test('ไฟล์มีแค่ header ไม่มีข้อมูล คืน error', () => {
  const r = parseLocationCSVCore('Location,SKU,Qty,MFD,EXP');
  assert.ok(r.error);
});

test('ไม่มีคอลัมน์ SKU เลย คืน error บอกชัดเจน', () => {
  const csv = 'Location,Qty,MFD,EXP\nFA01,50,2024-01-01,2025-06-30';
  const r = parseLocationCSVCore(csv);
  assert.ok(r.error);
  assert.ok(r.error.includes('SKU'));
});

test('ไม่มีคอลัมน์ Qty เลย คืน error บอกชัดเจน', () => {
  const csv = 'Location,SKU,MFD,EXP\nFA01,SKU001,2024-01-01,2025-06-30';
  const r = parseLocationCSVCore(csv);
  assert.ok(r.error);
  assert.ok(r.error.includes('Qty'));
});

test('แถวที่ไม่มี SKU ถูกข้าม ไม่นับเป็นแถวข้อมูล', () => {
  const csv = 'Location,SKU,Qty\nFA01,,50\nFA01,SKU001,20';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.rows.length, 1);
  assert.strictEqual(r.rows[0].sku, 'SKU001');
});

test('วันที่แปลงไม่ได้ นับใน badDateCount แต่ไม่ทำให้ทั้งไฟล์ error', () => {
  const csv = 'Location,SKU,Qty,MFD,EXP\nFA01,SKU001,10,วันพัง,2026-01-01';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.badDateCount, 1);
  assert.strictEqual(r.rows[0].mfd, null);
  assert.strictEqual(r.rows[0]._mfdRaw, 'วันพัง'); // เก็บค่าดิบไว้โชว์ error ให้ผู้ใช้เห็น
});

test('Qty ไม่ใช่ตัวเลขเลย ("abc") ตกเป็น 0 ไม่ throw', () => {
  const csv = 'Location,SKU,Qty\nFA01,SKU001,abc';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.rows[0].qty, 0);
});

test('บรรทัดว่างในไฟล์ถูกข้ามไป ไม่ทำให้ error', () => {
  const csv = 'Location,SKU,Qty\n\nFA01,SKU001,10\n\n';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.rows.length, 1);
});

test('มี BOM (\\uFEFF) นำหน้าไฟล์ ไม่ทำให้ header อ่านผิด', () => {
  const csv = '\uFEFFLocation,SKU,Qty\nFA01,SKU001,10';
  const r = parseLocationCSVCore(csv);
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.rows.length, 1);
});

// ============================================================
// ส่วนที่ 5: dedupRows — เทสปกติ + error (กรณีจริงจากไฟล์ที่เคยมีปัญหา)
// ============================================================
section('🔗 dedupRows — รวมแถวซ้ำก่อน upsert (ป้องกัน "cannot affect row a second time")');

test('SKU+Location เดียวกัน EXP ต่างกัน → แยก 2 แถว (2 lot จริง)', () => {
  const rows = [
    { sku: 'A', loc: 'L1', qty: 2, mfd: '2026-01-19', exp: '2026-07-19' },
    { sku: 'A', loc: 'L1', qty: 9, mfd: '2026-01-26', exp: '2026-07-26' },
  ];
  const r = dedupRows(rows);
  assert.strictEqual(r.length, 2);
});

test('SKU+Location+EXP เหมือนกันทุกอย่าง → รวมเป็น 1 แถว บวก qty กัน', () => {
  const rows = [
    { sku: 'B', loc: 'L2', qty: 5, mfd: '2026-01-30', exp: '2026-07-30' },
    { sku: 'B', loc: 'L2', qty: 14, mfd: '2026-01-30', exp: '2026-07-30' },
  ];
  const r = dedupRows(rows);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].qty, 19);
});

test('ไม่มี EXP เลย (null ทั้งคู่) SKU+Location เดียวกัน → รวมเป็น 1 แถว', () => {
  const rows = [
    { sku: 'C', loc: 'L3', qty: 10, mfd: null, exp: null },
    { sku: 'C', loc: 'L3', qty: 5, mfd: null, exp: null },
  ];
  const r = dedupRows(rows);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].qty, 15);
});

test('array ว่างเปล่า ไม่ throw คืน array ว่าง', () => {
  const r = dedupRows([]);
  assert.strictEqual(r.length, 0);
});

test('SKU เดียวกันคนละ Location → ไม่รวมกัน (แยก 2 แถว)', () => {
  const rows = [
    { sku: 'D', loc: 'L1', qty: 5, mfd: null, exp: '2026-01-01' },
    { sku: 'D', loc: 'L2', qty: 7, mfd: null, exp: '2026-01-01' },
  ];
  const r = dedupRows(rows);
  assert.strictEqual(r.length, 2);
});

// ============================================================
// สรุปผล
// ============================================================
console.log('\n' + '='.repeat(50));
console.log(`ผลรวม: ✅ ผ่าน ${passed} | ❌ ล้มเหลว ${failed} | รวม ${passed + failed} เทส`);
console.log('='.repeat(50));

if (failed > 0) {
  console.log('\nรายการที่ล้มเหลว:');
  failures.forEach(f => console.log(`  - ${f.name}: ${f.err.message}`));
  process.exit(1);
} else {
  console.log('\n🎉 ผ่านหมดทุกเทส!');
  process.exit(0);
}
