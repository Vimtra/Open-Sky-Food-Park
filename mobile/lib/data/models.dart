import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

// Models for the shared contract (COLLAB.md, contract v1.3–v1.6). Field names follow the database
// and shared/seed/catalog.json. Unknown or missing fields stay null: nothing is invented.

enum Diet { veg, egg, nonveg }

Diet? dietFrom(Object? v) => switch (v) { 'veg' => Diet.veg, 'egg' => Diet.egg, 'nonveg' => Diet.nonveg, _ => null };

String dietLabel(Diet d) => switch (d) { Diet.veg => 'Veg', Diet.egg => 'Egg', Diet.nonveg => 'Non-veg' };

String? _str(Object? v) => v is String && v.trim().isNotEmpty ? v : null;
int _int(Object? v, [int fallback = 0]) => v is num ? v.toInt() : (v is String ? int.tryParse(v) ?? fallback : fallback);

/// Postgres numeric columns can arrive as strings.
double _num(Object? v) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) ?? 0 : 0);

/// The database writes enums in snake_case ("pay_at_stall"); the demo store wrote camelCase.
T _enum<T extends Enum>(List<T> values, Object? raw, T fallback) {
  final key = (raw as String? ?? '').replaceAll('_', '').toLowerCase();
  return values.where((v) => v.name.toLowerCase() == key).firstOrNull ?? fallback;
}

/// Back to the database's spelling, for rpc payloads.
String snake(Enum e) => e.name.replaceAllMapped(RegExp('[A-Z]'), (m) => '_${m[0]!.toLowerCase()}');
bool _bool(Object? v, [bool fallback = false]) => v is bool ? v : fallback;

class Park {
  Park.fromJson(Map<String, dynamic> j)
      : name = j['name'] as String,
        tagline = _str(j['tagline']),
        address = _str(j['address']),
        instagram = _str(j['instagram']),
        taxPercent = _num(j['tax_percent']),
        serviceFeeCents = _int(j['service_fee_cents']),
        orderingEnabled = _bool(j['ordering_enabled'], true),
        couponsEnabled = _bool(j['coupons_enabled']),
        tableServiceEnabled = _bool(j['table_service_enabled']),
        announcement = _str(j['announcement']),
        contactEmail = _str(j['contact_email']),
        contactPhone = _str(j['contact_phone']),
        hoursText = _str(j['hours_text']),
        timezone = _str(j['timezone']) ?? 'America/Los_Angeles',
        scheduledOrdersEnabled = _bool(j['scheduled_orders_enabled']),
        ratingsPublic = _bool(j['ratings_public']);

  final String name;
  final String? tagline, address, instagram, announcement, contactEmail, contactPhone, hoursText;
  final double taxPercent;
  final int serviceFeeCents;
  final bool orderingEnabled, tableServiceEnabled;

  /// Contract v1.5: when false the cart hides the coupon box.
  final bool couponsEnabled;

  /// Contract v1.6. Truck hours are in [timezone]. Ordering for later and public ratings are the
  /// owner's switches and start off.
  final String timezone;
  final bool scheduledOrdersEnabled, ratingsPublic;
}

// ---------------------------------------------------------------- truck hours and pause (v1.6)

/// The park's clock. Set once from the catalog; truck hours are read in it, not the phone's zone.
tz.Location? _parkZone;
bool _tzReady = false;

void setParkTimezone(String name) {
  if (!_tzReady) {
    tzdata.initializeTimeZones();
    _tzReady = true;
  }
  try {
    _parkZone = tz.getLocation(name);
  } catch (_) {
    _parkZone = null; // unknown zone: fall back to the phone's clock
  }
}

DateTime _onParkClock(DateTime at) {
  final z = _parkZone;
  return z == null ? at.toLocal() : tz.TZDateTime.from(at, z);
}

/// [at] on the park's clock: weekday (0 = Sunday) and minutes since midnight.
({int dow, int minutes}) parkClock(DateTime at) {
  final l = _onParkClock(at);
  return (dow: l.weekday % 7, minutes: l.hour * 60 + l.minute);
}

/// "7:40 PM" on the park's clock.
String parkTime(DateTime at) {
  final l = _onParkClock(at);
  final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
  return '$h:${l.minute.toString().padLeft(2, '0')} ${l.hour < 12 ? 'AM' : 'PM'}';
}

/// Same calendar day on the park's clock.
bool sameParkDay(DateTime a, DateTime b) {
  final x = _onParkClock(a), y = _onParkClock(b);
  return x.year == y.year && x.month == y.month && x.day == y.day;
}

class StallHours {
  StallHours.fromJson(Map<String, dynamic> j)
      : stallId = j['stall_id'] as String,
        weekday = _int(j['weekday']),
        opens = _mins(j['opens']),
        closes = _mins(j['closes']);

  final String stallId;
  final int weekday, opens, closes;

  static int _mins(Object? v) {
    final p = (v as String? ?? '0:0').split(':');
    return (int.tryParse(p[0]) ?? 0) * 60 + (p.length > 1 ? int.tryParse(p[1]) ?? 0 : 0);
  }

  /// Same rule as withinHours() on the website: closes before opens runs past midnight.
  bool covers(int dow, int minutes) {
    if (opens < closes) return weekday == dow && minutes >= opens && minutes < closes;
    return (weekday == dow && minutes >= opens) || (weekday == (dow + 6) % 7 && minutes < closes);
  }
}

enum ClosedReason { closed, paused, outsideHours }

class Stall {
  Stall.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        slug = j['slug'] as String,
        name = j['name'] as String,
        tagline = _str(j['tagline']),
        cuisines = (j['cuisines'] as List? ?? const []).cast<String>(),
        locationLabel = _str(j['location_label']),
        phone = _str(j['phone']),
        instagram = _str(j['instagram']),
        logoUrl = _str(j['logo_url']),
        coverUrl = _str(j['cover_url']),
        avgPrepMins = j['avg_prep_mins'] is num ? (j['avg_prep_mins'] as num).toInt() : null,
        switchedOn = _bool(j['is_open'], true),
        isActive = _bool(j['is_active'], true),
        autoHours = _bool(j['auto_hours']),
        pausedUntil = DateTime.tryParse(j['paused_until'] as String? ?? ''),
        sortOrder = _int(j['sort_order']);

  final String id, slug, name;
  final String? tagline, locationLabel, phone, instagram, logoUrl, coverUrl;
  final List<String> cuisines;
  final int? avgPrepMins;
  final bool isActive;
  final int sortOrder;

  /// The truck's own Open switch (`is_open`). Use [isOpen] for "can I order now".
  final bool switchedOn;

  /// Contract v1.6: follow [hours] automatically; paused for a few minutes when busy.
  final bool autoHours;
  final DateTime? pausedUntil;
  List<StallHours> hours = const [];

  /// Same order as _stall_closed_reason() in 0006_v16.sql.
  ClosedReason? closedReason([DateTime? at]) {
    final now = at ?? DateTime.now();
    if (!isActive || !switchedOn) return ClosedReason.closed;
    if (pausedUntil != null && pausedUntil!.isAfter(now)) return ClosedReason.paused;
    if (autoHours) {
      final c = parkClock(now);
      if (!hours.any((h) => h.covers(c.dow, c.minutes))) return ClosedReason.outsideHours;
    }
    return null;
  }

  /// Taking orders right now.
  bool get isOpen => closedReason() == null;

  /// Taking orders at [at] (for orders placed for later).
  bool openAt(DateTime at) => closedReason(at) == null;

  /// Next time within a week (15-minute steps) the hours open, or null.
  DateTime? nextOpening([DateTime? from]) {
    if (hours.isEmpty) return null;
    final start = from ?? DateTime.now();
    var t = DateTime.fromMillisecondsSinceEpoch((start.millisecondsSinceEpoch / 900000).ceil() * 900000);
    final end = start.add(const Duration(days: 7));
    while (t.isBefore(end)) {
      final c = parkClock(t);
      if (hours.any((h) => h.covers(c.dow, c.minutes))) return t;
      t = t.add(const Duration(minutes: 15));
    }
    return null;
  }

  /// "Open now", "Busy · back at 7:40 PM", "Opens 5:00 PM" or "Closed now".
  String get statusLabel => switch (closedReason()) {
        null => 'Open now',
        ClosedReason.paused => 'Busy · back at ${parkTime(pausedUntil!)}',
        ClosedReason.outsideHours => switch (nextOpening()) { final t? => 'Opens ${parkTime(t)}', null => 'Closed now' },
        ClosedReason.closed => 'Closed now',
      };
}

// ---------------------------------------------------------------- dish options (v1.6)

class MenuOptionGroup {
  MenuOptionGroup.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        menuItemId = j['menu_item_id'] as String,
        name = j['name'] as String,
        minSelect = _int(j['min_select']),
        maxSelect = _int(j['max_select'], 1),
        sortOrder = _int(j['sort_order']);

  final String id, menuItemId, name;
  final int minSelect, maxSelect, sortOrder;
}

class MenuOption {
  MenuOption.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        groupId = j['group_id'] as String,
        name = j['name'] as String,
        priceCents = _int(j['price_cents']),
        isDefault = _bool(j['is_default']),
        isAvailable = _bool(j['is_available'], true),
        sortOrder = _int(j['sort_order']);

  final String id, groupId, name;
  final int priceCents, sortOrder;
  final bool isDefault, isAvailable;
}

/// The copy of a chosen option an order line keeps (`order_items.options`).
class ChosenOption {
  const ChosenOption({required this.group, required this.name, required this.priceCents});
  ChosenOption.fromJson(Map<String, dynamic> j)
      : group = j['group'] as String? ?? '',
        name = j['name'] as String? ?? '',
        priceCents = _int(j['price_cents']);

  final String group, name;
  final int priceCents;
  Map<String, dynamic> toJson() => {'group': group, 'name': name, 'price_cents': priceCents};
}

class MenuCategory {
  MenuCategory.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        stallId = j['stall_id'] as String,
        name = j['name'] as String,
        sortOrder = _int(j['sort_order']);

  final String id, stallId, name;
  final int sortOrder;
}

class MenuItem {
  MenuItem.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        stallId = j['stall_id'] as String,
        categoryId = j['category_id'] as String,
        name = j['name'] as String,
        description = _str(j['description']),
        serves = j['serves'] is num ? (j['serves'] as num).toInt() : null,
        sizeLabel = _str(j['size_label']),
        priceCents = _int(j['price_cents']),
        diet = dietFrom(j['diet']),
        imageUrl = _str(j['image_url']),
        craving = _str(j['craving']),
        isAvailable = _bool(j['is_available'], true),
        isFeatured = _bool(j['is_featured']),
        sortOrder = _int(j['sort_order']);

  final String id, stallId, categoryId, name;
  final String? description, imageUrl, craving;

  /// Cup or portion size, e.g. "12 oz" (contract v1.4). Shown instead of "Serves N" when set.
  final String? sizeLabel;
  final int? serves;
  final int priceCents, sortOrder;
  final Diet? diet;
  final bool isAvailable, isFeatured;

  /// The part of the id after `<stall>.`: used in links.
  String get slug => id.contains('.') ? id.substring(id.indexOf('.') + 1) : id;

  /// "12 oz | …" or "Serves 4 | …" (either half optional): the website's dishBlurb() rule.
  String? get blurb {
    final amount = sizeLabel?.trim() ?? (serves != null ? 'Serves $serves' : null);
    final parts = [?amount, ?description];
    return parts.isEmpty ? null : parts.join(' | ');
  }
}

class Craving {
  Craving.fromJson(Map<String, dynamic> j)
      : slug = j['slug'] as String,
        name = j['name'] as String,
        imageUrl = _str(j['image_url']),
        sortOrder = _int(j['sort_order']);

  final String slug, name;
  final String? imageUrl;
  final int sortOrder;
}

class PromoBanner {
  PromoBanner.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        title = j['title'] as String,
        subtitle = _str(j['subtitle']),
        imageUrl = _str(j['image_url']),
        stallId = _str(j['stall_id']),
        menuItemId = _str(j['menu_item_id']),
        isActive = _bool(j['is_active'], true),
        sortOrder = _int(j['sort_order']);

  final String id, title;
  final String? subtitle, imageUrl, stallId, menuItemId;
  final bool isActive;
  final int sortOrder;
}

// ---------------------------------------------------------------- account

/// How the customer signed in. The website offers Google (and phone when an SMS provider is set up).
enum SignInMethod { google, phone }

class Account {
  Account({required this.name, required this.phone, required this.method, required this.createdAt});

  Account.fromJson(Map<String, dynamic> j)
      : name = j['name'] as String? ?? '',
        phone = _str(j['phone']),
        method = SignInMethod.values.asNameMap()[j['method']] ?? SignInMethod.phone,
        createdAt = DateTime.tryParse(j['created_at'] as String? ?? '') ?? DateTime.now();

  final String name;
  final String? phone;
  final SignInMethod method;
  final DateTime createdAt;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
  }

  Map<String, dynamic> toJson() => {'name': name, 'phone': phone, 'method': method.name, 'created_at': createdAt.toIso8601String()};

  /// "+1 (408) 555-0100" for a 10-digit US number; otherwise as typed.
  String? get phoneDisplay {
    final p = phone;
    if (p == null) return null;
    final d = p.replaceAll(RegExp(r'\D'), '');
    return d.length == 10 ? '+1 (${d.substring(0, 3)}) ${d.substring(3, 6)}-${d.substring(6)}' : p;
  }
}

// ---------------------------------------------------------------- orders

enum Fulfilment { pickup, table }

enum PaymentMethod { online, payAtStall }

enum OrderStatus { awaitingPayment, active, completed, cancelled }

enum TicketStatus { pending, placed, preparing, ready, completed, cancelled }

class OrderItem {
  OrderItem({required this.menuItemId, required this.name, required this.diet, required this.unitPriceCents, required this.qty, this.options = const [], this.note});

  OrderItem.fromJson(Map<String, dynamic> j)
      : menuItemId = j['menu_item_id'] as String?,
        name = j['name'] as String,
        diet = dietFrom(j['diet']),
        unitPriceCents = _int(j['unit_price_cents']),
        qty = _int(j['qty'], 1),
        options = (j['options'] as List? ?? const []).map((e) => ChosenOption.fromJson(e as Map<String, dynamic>)).toList(),
        note = _str(j['note']);

  final String? menuItemId;
  final String name;
  final Diet? diet;

  /// Unit price includes the options (v1.6).
  final int unitPriceCents, qty;
  final List<ChosenOption> options;
  final String? note;

  Map<String, dynamic> toJson() => {
        'menu_item_id': menuItemId,
        'name': name,
        'diet': diet?.name,
        'unit_price_cents': unitPriceCents,
        'qty': qty,
        'options': options.map((e) => e.toJson()).toList(),
        'note': note,
      };
}

class StallOrder {
  StallOrder({
    required this.stallId,
    required this.stallName,
    required this.tokenNo,
    required this.status,
    required this.subtotalCents,
    this.discountCents = 0,
    required this.items,
    required this.createdAt,
    this.readyAt,
    String? id,
    this.prepMins,
    this.readyBy,
    this.refundedCents = 0,
  }) : id = id ?? '$stallId@${createdAt.millisecondsSinceEpoch}';

  StallOrder.fromJson(Map<String, dynamic> j)
      : stallId = j['stall_id'] as String,
        stallName = j['stall_name'] as String? ?? ((j['stall'] as Map?)?['name'] as String?) ?? '',
        tokenNo = _int(j['token_no']),
        status = _enum(TicketStatus.values, j['status'], TicketStatus.placed),
        subtotalCents = _int(j['subtotal_cents']),
        discountCents = _int(j['discount_cents']),
        items = (j['order_items'] as List).map((e) => OrderItem.fromJson(e as Map<String, dynamic>)).toList(),
        createdAt = DateTime.parse(j['created_at'] as String),
        readyAt = j['ready_at'] == null ? null : DateTime.parse(j['ready_at'] as String),
        id = _str(j['id']) ?? '${j['stall_id']}@${DateTime.parse(j['created_at'] as String).millisecondsSinceEpoch}',
        prepMins = j['prep_mins'] is num ? (j['prep_mins'] as num).toInt() : null,
        readyBy = DateTime.tryParse(j['ready_by'] as String? ?? ''),
        refundedCents = _int(j['refunded_cents']);

  final String stallId, stallName;
  final int tokenNo, subtotalCents;

  /// This truck's share of the coupon discount (contract v1.5).
  final int discountCents;
  TicketStatus status;
  final List<OrderItem> items;
  final DateTime createdAt;
  DateTime? readyAt;

  /// `stall_orders.id` (ratings point at it).
  final String id;

  /// Set by the truck when it accepts (v1.6): "Ready by 7:42".
  int? prepMins;
  DateTime? readyBy;
  int refundedCents;

  Map<String, dynamic> toJson() => {
        'id': id,
        'prep_mins': prepMins,
        'ready_by': readyBy?.toIso8601String(),
        'refunded_cents': refundedCents,
        'stall_id': stallId,
        'stall_name': stallName,
        'token_no': tokenNo,
        'status': status.name,
        'subtotal_cents': subtotalCents,
        'discount_cents': discountCents,
        'order_items': items.map((e) => e.toJson()).toList(),
        'created_at': createdAt.toIso8601String(),
        'ready_at': readyAt?.toIso8601String(),
      };
}

class Order {
  Order({
    required this.id,
    required this.orderNo,
    required this.customerName,
    required this.fulfilment,
    required this.tableNo,
    required this.note,
    required this.itemTotalCents,
    required this.taxCents,
    this.discountCents = 0,
    this.couponCode,
    required this.serviceFeeCents,
    required this.totalCents,
    required this.paymentMethod,
    required this.status,
    required this.createdAt,
    required this.stallOrders,
    this.pickupAt,
    this.refundedCents = 0,
  });

  Order.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        orderNo = j['order_no'] as String,
        customerName = j['customer_name'] as String,
        fulfilment = _enum(Fulfilment.values, j['fulfilment'], Fulfilment.pickup),
        tableNo = j['table_no'] as String?,
        note = j['note'] as String?,
        itemTotalCents = _int(j['item_total_cents']),
        taxCents = _int(j['tax_cents']),
        discountCents = _int(j['discount_cents']),
        couponCode = j['coupon_code'] as String?,
        serviceFeeCents = _int(j['service_fee_cents']),
        totalCents = _int(j['total_cents']),
        paymentMethod = _enum(PaymentMethod.values, j['payment_method'], PaymentMethod.payAtStall),
        status = _enum(OrderStatus.values, j['status'], OrderStatus.active),
        createdAt = DateTime.parse(j['created_at'] as String),
        stallOrders = (j['stall_orders'] as List).map((e) => StallOrder.fromJson(e as Map<String, dynamic>)).toList(),
        pickupAt = DateTime.tryParse(j['pickup_at'] as String? ?? ''),
        refundedCents = _int(j['refunded_cents']);

  final String id, orderNo, customerName;
  final Fulfilment fulfilment;
  final String? tableNo, note;
  final int itemTotalCents, taxCents, serviceFeeCents, totalCents;

  /// Coupon discount and code (contract v1.5). Total = items − discount + tax + fee.
  final int discountCents;
  final String? couponCode;
  final PaymentMethod paymentMethod;
  OrderStatus status;
  final DateTime createdAt;
  final List<StallOrder> stallOrders;

  /// Ordered for later (v1.6); null means as soon as possible.
  final DateTime? pickupAt;

  /// Money sent back so far (v1.6 refunds).
  int refundedCents;

  Map<String, dynamic> toJson() => {
        'pickup_at': pickupAt?.toIso8601String(),
        'refunded_cents': refundedCents,
        'id': id,
        'order_no': orderNo,
        'customer_name': customerName,
        'fulfilment': fulfilment.name,
        'table_no': tableNo,
        'note': note,
        'item_total_cents': itemTotalCents,
        'tax_cents': taxCents,
        'discount_cents': discountCents,
        'coupon_code': couponCode,
        'service_fee_cents': serviceFeeCents,
        'total_cents': totalCents,
        'payment_method': paymentMethod.name,
        'status': status.name,
        'created_at': createdAt.toIso8601String(),
        'stall_orders': stallOrders.map((e) => e.toJson()).toList(),
      };
}

// ---------------------------------------------------------------- ratings (v1.6)

/// One rating of one truck's part of an order (`order_ratings`), 1–5 stars.
class OrderRating {
  OrderRating({required this.stallOrderId, required this.orderId, required this.stallId, required this.stars, this.comment, required this.updatedAt});
  OrderRating.fromJson(Map<String, dynamic> j)
      : stallOrderId = j['stall_order_id'] as String,
        orderId = j['order_id'] as String,
        stallId = j['stall_id'] as String,
        stars = _int(j['stars'], 5),
        comment = _str(j['comment']),
        updatedAt = DateTime.tryParse(j['updated_at'] as String? ?? '') ?? DateTime.now();

  final String stallOrderId, orderId, stallId;
  final int stars;
  final String? comment;
  final DateTime updatedAt;

  Map<String, dynamic> toJson() =>
      {'stall_order_id': stallOrderId, 'order_id': orderId, 'stall_id': stallId, 'stars': stars, 'comment': comment, 'updated_at': updatedAt.toIso8601String()};
}
