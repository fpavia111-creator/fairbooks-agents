// Augeas on vendor masters from Japan, China, Korea and Europe. Every company,
// number and address here is fictional.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicates, normName, normTax, mergePreview } from '../src/index.js';
import { normalizeName, normalizeAddress, nameSimilarity } from 'mythos-agent-core';

test('legal forms in Japanese, Chinese, Korean and European names are removed; the name itself is kept', () => {
  for (const n of ['株式会社架空商事', '架空商事(株)', '架空商事㈱', '（株）架空商事', '架空商事 株式会社']) assert.equal(normName(n), '架空商事', n);
  assert.equal(normName('ｶ)ｶｸｳｼｮｳｼﾞ'), 'カクウショウジ', 'half-width bank-transfer name with カ) for 株式会社');
  assert.equal(normName('虚构贸易有限公司'), '虚构贸易'); assert.equal(normName('虚構貿易股份有限公司'), '虚構貿易');
  assert.equal(normName('(주)가상상사'), '가상상사'); assert.equal(normName('가상상사 주식회사'), '가상상사'); assert.equal(normName('㈜가상상사'), '가상상사');
  assert.equal(normName('Beispiel AG'), 'beispiel'); assert.equal(normName('Muster GmbH & Co. KG'), 'muster'); assert.equal(normName('Esempio S.p.A.'), 'esempio'); assert.equal(normName('Exemplo Ltda.'), 'exemplo');
  assert.equal(normName('Acme Supply, Inc.'), 'acme supply', 'English names as before');
  // The shared core helpers behave the same way.
  assert.equal(normalizeName('株式会社架空商事'), '架空商事'); assert.equal(normalizeName('Société Exemple SARL'), 'societe exemple');
  assert.equal(normalizeAddress('東京都千代田区架空町1-1'), '東京都千代田区架空町1 1'); assert.equal(normalizeAddress('123 Main Street'), '123 main st');
  assert.equal(nameSimilarity('株式会社架空商事', '架空商事(株)'), 1);
  assert.ok(nameSimilarity('山田商事', '山本商事') < 0.9, 'two different short Japanese names are not near-identical');
});

test('duplicates in a Japanese vendor master with Japanese headers are found', () => {
  const rows = [
    { 仕入先コード: 'V001', 仕入先名: '株式会社架空商事', 法人番号: '1234567890123', 電話番号: '03-0000-0001', 住所: '東京都千代田区架空町1-1', 状態: '有効' },
    { 仕入先コード: 'V002', 仕入先名: '架空商事(株)', 法人番号: '', 電話番号: '03-0000-0001', 住所: '東京都千代田区架空町1-1', 状態: '取引停止' },
    { 仕入先コード: 'V003', 仕入先名: 'サンプル運輸株式会社', 法人番号: '9999999999999', 電話番号: '06-0000-0002', 住所: '大阪府大阪市架空区2-2', 状態: '有効' },
  ];
  const r = findDuplicates(rows);
  assert.equal(r.proposals.length, 1, JSON.stringify(r.proposals));
  const c = r.proposals[0];
  assert.deepEqual(c.records.map((x) => x.id).sort(), ['V001', 'V002'], 'ids come from 仕入先コード');
  assert.equal(c.survivor, 'V001', 'the active record (取引停止 means inactive) survives');
  assert.ok(c.reasons.includes('same normalized name'));
});

test('Korean and Chinese masters: same registration number links differently written names; different numbers keep them apart', () => {
  const ko = findDuplicates([
    { 거래처코드: 'K1', 상호: '(주)가상상사', 사업자등록번호: '123-45-67890', 주소: '서울특별시 가상구 1' },
    { 거래처코드: 'K2', 상호: '가상상사 주식회사', 사업자등록번호: '123-45-67890', 주소: '서울특별시 가상구 1' },
  ]);
  assert.equal(ko.proposals.length, 1); assert.ok(ko.proposals[0].reasons.includes('same tax id'));
  const zh = findDuplicates([
    { 供应商编号: 'C1', 供应商: '虚构贸易有限公司', 统一社会信用代码: '91310000000000001X' },
    { 供应商编号: 'C2', 供应商: '虚构贸易公司', 统一社会信用代码: '91310000000000002X' },
  ]);
  assert.equal(zh.proposals.length, 0, 'different tax ids are never merged');
  assert.equal(zh.weak_pairs.length, 1); assert.match(zh.weak_pairs[0].reasons.join(' '), /DIFFERENT tax ids/, 'the same name is shown with the warning');
  assert.notEqual(normTax('91310000000000001X'), normTax('91310000000000001Y'), 'a letter at the end of a Chinese credit code still counts');
  assert.equal(normTax('ＤＥ １２３４５６７８９'), '123456789', 'full-width digits and a country prefix');
});

test('a merge preview shows a conflict between two different Japanese addresses', () => {
  const rows = [
    { id: 'A', name: '架空商事', address: '東京都千代田区架空町1-1' },
    { id: 'B', name: '架空商事(株)', address: '大阪府大阪市架空区1-1' },
  ];
  const p = mergePreview(rows, { survivor: 'A', merge: ['B'] });
  const addr = p.fields.find((f) => f.field === 'address');
  assert.equal(addr.conflict, true, 'both used to compare as "11", so no conflict was shown');
});
