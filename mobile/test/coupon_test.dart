import 'package:flutter_test/flutter_test.dart';
import 'package:open_sky/data/catalog.dart';
import 'package:open_sky/data/coupons.dart';
import 'package:open_sky/data/models.dart';

// Same rules as _coupon_quote() in supabase/migrations/0005_coupons.sql.
void main() {
  MenuItem dish(String stall, int cents) => MenuItem.fromJson({'id': '$stall.d$cents', 'stall_id': stall, 'category_id': '$stall.c', 'name': 'D', 'price_cents': cents});
  Coupon coupon(Map<String, dynamic> j) => Coupon.fromJson({'id': 'c1', 'code': 'save10', 'title': 'Save', 'kind': 'percent', 'value': 10, ...j});
  final now = DateTime(2026, 11, 19, 18);
  final curry = dish('dhaba', 1500), falooda = dish('desserts', 899);

  CouponQuote q(Coupon c, {Map<MenuItem, int>? lines, bool enabled = true, int used = 0}) =>
      quoteCoupon(code: ' save10 ', couponsEnabled: enabled, coupons: [c], lines: lines ?? {curry: 2, falooda: 1}, now: now, timesUsed: used);

  String err(void Function() f) {
    try {
      f();
    } on CouponError catch (e) {
      return e.code;
    }
    return 'none';
  }

  test('percent rounds on the eligible total; codes are case-insensitive', () {
    expect(q(coupon({})).discountCents, 390); // 10% of 3899 = 389.9
  });

  test('cap and amount coupons', () {
    expect(q(coupon({'max_discount_cents': 200})).discountCents, 200);
    expect(q(coupon({'kind': 'amount', 'value': 500})).discountCents, 500);
    expect(q(coupon({'kind': 'amount', 'value': 99999})).discountCents, 3899); // never more than eligible
  });

  test('truck-only coupon counts only that truck', () {
    final r = q(coupon({'stall_id': 'desserts', 'value': 50}));
    expect(r.eligibleCents, 899);
    expect(r.discountCents, 450);
    expect(err(() => q(coupon({'stall_id': 'desserts'}), lines: {curry: 1})), 'coupon_not_applicable');
  });

  test('rejections use the server codes', () {
    expect(err(() => q(coupon({}), enabled: false)), 'coupons_disabled');
    expect(err(() => quoteCoupon(code: 'nope', couponsEnabled: true, coupons: [coupon({})], lines: {curry: 1}, now: now)), 'coupon_not_found');
    expect(err(() => q(coupon({'is_active': false}))), 'coupon_inactive');
    expect(err(() => q(coupon({'starts_at': '2026-12-01T00:00:00Z'}))), 'coupon_not_started');
    expect(err(() => q(coupon({'ends_at': '2026-11-01T00:00:00Z'}))), 'coupon_expired');
    expect(err(() => q(coupon({'min_order_cents': 5000}))), 'coupon_min_order');
    expect(err(() => q(coupon({'usage_limit': 3}), used: 3)), 'coupon_used_up');
  });

  test('tax is charged after the discount (contract v1.5)', () {
    final park = Park.fromJson({'name': 'P', 'tax_percent': 10, 'service_fee_cents': 0});
    final b = computeBill(3899, park, discountCents: 390);
    expect(b.tax, 351); // round((3899 - 390) × 10%) = 350.9
    expect(b.total, 3899 - 390 + 351);
  });
}
