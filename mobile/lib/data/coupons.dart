// Coupons (contract v1.5). Mirrors _coupon_quote() in supabase/migrations/0005_coupons.sql so the cart
// preview matches what the server will charge. The server re-checks every code when the order is placed.

import 'models.dart';

class Coupon {
  Coupon.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        code = (j['code'] as String).toUpperCase(),
        title = j['title'] as String? ?? '',
        description = j['description'] as String?,
        kind = j['kind'] == 'amount' ? CouponKind.amount : CouponKind.percent,
        value = (j['value'] as num).toInt(),
        minOrderCents = (j['min_order_cents'] as num? ?? 0).toInt(),
        maxDiscountCents = (j['max_discount_cents'] as num?)?.toInt(),
        stallId = j['stall_id'] as String?,
        startsAt = DateTime.tryParse(j['starts_at'] as String? ?? ''),
        endsAt = DateTime.tryParse(j['ends_at'] as String? ?? ''),
        usageLimit = (j['usage_limit'] as num?)?.toInt(),
        perCustomerLimit = (j['per_customer_limit'] as num?)?.toInt(),
        isActive = j['is_active'] as bool? ?? true,
        showInApp = j['show_in_app'] as bool? ?? false;

  final String id, code, title;
  final String? description, stallId;
  final CouponKind kind;

  /// Percent 1–100, or cents for [CouponKind.amount].
  final int value;
  final int minOrderCents;
  final int? maxDiscountCents, usageLimit, perCustomerLimit;
  final DateTime? startsAt, endsAt;
  final bool isActive, showInApp;

  /// Listed under Offers: active, listed and not expired.
  bool isOffer(DateTime now) => isActive && showInApp && (endsAt == null || endsAt!.isAfter(now));
}

enum CouponKind { percent, amount }

/// A coupon problem, with the same codes the server raises.
class CouponError implements Exception {
  const CouponError(this.code);
  final String code;

  /// Same wording as the website.
  String get message => switch (code) {
        'coupons_disabled' => 'Coupons are switched off right now.',
        'coupon_not_found' => "That code doesn't exist. Check the spelling.",
        'coupon_inactive' => 'That coupon is switched off.',
        'coupon_not_started' => "That coupon hasn't started yet.",
        'coupon_expired' => 'That coupon has expired.',
        'coupon_min_order' => 'Add a little more to use this coupon.',
        'coupon_not_applicable' => "This coupon is for a truck that isn't in your cart.",
        'coupon_used_up' => 'That coupon has been fully used.',
        'coupon_already_used' => "You've already used this coupon.",
        _ => 'That coupon could not be applied.',
      };

  @override
  String toString() => code;
}

class CouponQuote {
  const CouponQuote(this.coupon, this.eligibleCents, this.discountCents);
  final Coupon coupon;
  final int eligibleCents, discountCents;
}

/// Prices [lines] (item → qty) against [code]. [timesUsed] and [timesUsedByMe] count non-cancelled
/// orders that used the coupon (park-wide, and for the signed-in customer).
CouponQuote quoteCoupon({
  required String code,
  required bool couponsEnabled,
  required List<Coupon> coupons,
  required Map<MenuItem, int> lines,
  required DateTime now,
  int timesUsed = 0,
  int? timesUsedByMe,
}) {
  if (!couponsEnabled) throw const CouponError('coupons_disabled');
  final wanted = code.trim().toUpperCase();
  final c = coupons.where((x) => x.code == wanted).firstOrNull;
  if (c == null) throw const CouponError('coupon_not_found');
  if (!c.isActive) throw const CouponError('coupon_inactive');
  if (c.startsAt != null && now.isBefore(c.startsAt!)) throw const CouponError('coupon_not_started');
  if (c.endsAt != null && !now.isBefore(c.endsAt!)) throw const CouponError('coupon_expired');

  var eligible = 0;
  lines.forEach((m, qty) {
    if (qty >= 1 && qty <= 50 && (c.stallId == null || m.stallId == c.stallId)) eligible += m.priceCents * qty;
  });
  if (eligible == 0) throw const CouponError('coupon_not_applicable');
  if (eligible < c.minOrderCents) throw const CouponError('coupon_min_order');
  if (c.usageLimit != null && timesUsed >= c.usageLimit!) throw const CouponError('coupon_used_up');
  if (c.perCustomerLimit != null && timesUsedByMe != null && timesUsedByMe >= c.perCustomerLimit!) {
    throw const CouponError('coupon_already_used');
  }

  var discount = c.kind == CouponKind.percent ? (eligible * c.value / 100).round() : c.value;
  if (c.maxDiscountCents != null && discount > c.maxDiscountCents!) discount = c.maxDiscountCents!;
  if (discount > eligible) discount = eligible;
  return CouponQuote(c, eligible, discount);
}
