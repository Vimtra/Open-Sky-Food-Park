// Models for the shared contract (COLLAB.md, contract v1.3). Field names follow the database
// and shared/seed/catalog.json. Unknown or missing fields stay null: nothing is invented.

enum Diet { veg, egg, nonveg }

Diet? dietFrom(Object? v) => switch (v) { 'veg' => Diet.veg, 'egg' => Diet.egg, 'nonveg' => Diet.nonveg, _ => null };

String dietLabel(Diet d) => switch (d) { Diet.veg => 'Veg', Diet.egg => 'Egg', Diet.nonveg => 'Non-veg' };

String? _str(Object? v) => v is String && v.trim().isNotEmpty ? v : null;
int _int(Object? v, [int fallback = 0]) => v is num ? v.toInt() : fallback;
bool _bool(Object? v, [bool fallback = false]) => v is bool ? v : fallback;

class Park {
  Park.fromJson(Map<String, dynamic> j)
      : name = j['name'] as String,
        tagline = _str(j['tagline']),
        address = _str(j['address']),
        instagram = _str(j['instagram']),
        taxPercent = (j['tax_percent'] as num?)?.toDouble() ?? 0,
        serviceFeeCents = _int(j['service_fee_cents']),
        orderingEnabled = _bool(j['ordering_enabled'], true),
        tableServiceEnabled = _bool(j['table_service_enabled']),
        announcement = _str(j['announcement']),
        contactEmail = _str(j['contact_email']),
        contactPhone = _str(j['contact_phone']),
        hoursText = _str(j['hours_text']);

  final String name;
  final String? tagline, address, instagram, announcement, contactEmail, contactPhone, hoursText;
  final double taxPercent;
  final int serviceFeeCents;
  final bool orderingEnabled, tableServiceEnabled;
}

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
        isOpen = _bool(j['is_open'], true),
        isActive = _bool(j['is_active'], true),
        sortOrder = _int(j['sort_order']);

  final String id, slug, name;
  final String? tagline, locationLabel, phone, instagram, logoUrl, coverUrl;
  final List<String> cuisines;
  final int? avgPrepMins;
  final bool isOpen, isActive;
  final int sortOrder;
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
  OrderItem({required this.menuItemId, required this.name, required this.diet, required this.unitPriceCents, required this.qty});

  OrderItem.fromJson(Map<String, dynamic> j)
      : menuItemId = j['menu_item_id'] as String?,
        name = j['name'] as String,
        diet = dietFrom(j['diet']),
        unitPriceCents = _int(j['unit_price_cents']),
        qty = _int(j['qty'], 1);

  final String? menuItemId;
  final String name;
  final Diet? diet;
  final int unitPriceCents, qty;

  Map<String, dynamic> toJson() => {'menu_item_id': menuItemId, 'name': name, 'diet': diet?.name, 'unit_price_cents': unitPriceCents, 'qty': qty};
}

class StallOrder {
  StallOrder({
    required this.stallId,
    required this.stallName,
    required this.tokenNo,
    required this.status,
    required this.subtotalCents,
    required this.items,
    required this.createdAt,
    this.readyAt,
  });

  StallOrder.fromJson(Map<String, dynamic> j)
      : stallId = j['stall_id'] as String,
        stallName = j['stall_name'] as String? ?? '',
        tokenNo = _int(j['token_no']),
        status = TicketStatus.values.byName(j['status'] as String),
        subtotalCents = _int(j['subtotal_cents']),
        items = (j['order_items'] as List).map((e) => OrderItem.fromJson(e as Map<String, dynamic>)).toList(),
        createdAt = DateTime.parse(j['created_at'] as String),
        readyAt = j['ready_at'] == null ? null : DateTime.parse(j['ready_at'] as String);

  final String stallId, stallName;
  final int tokenNo, subtotalCents;
  TicketStatus status;
  final List<OrderItem> items;
  final DateTime createdAt;
  DateTime? readyAt;

  Map<String, dynamic> toJson() => {
        'stall_id': stallId,
        'stall_name': stallName,
        'token_no': tokenNo,
        'status': status.name,
        'subtotal_cents': subtotalCents,
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
    required this.serviceFeeCents,
    required this.totalCents,
    required this.paymentMethod,
    required this.status,
    required this.createdAt,
    required this.stallOrders,
  });

  Order.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        orderNo = j['order_no'] as String,
        customerName = j['customer_name'] as String,
        fulfilment = Fulfilment.values.byName(j['fulfilment'] as String),
        tableNo = j['table_no'] as String?,
        note = j['note'] as String?,
        itemTotalCents = _int(j['item_total_cents']),
        taxCents = _int(j['tax_cents']),
        serviceFeeCents = _int(j['service_fee_cents']),
        totalCents = _int(j['total_cents']),
        paymentMethod = PaymentMethod.values.byName(j['payment_method'] as String),
        status = OrderStatus.values.byName(j['status'] as String),
        createdAt = DateTime.parse(j['created_at'] as String),
        stallOrders = (j['stall_orders'] as List).map((e) => StallOrder.fromJson(e as Map<String, dynamic>)).toList();

  final String id, orderNo, customerName;
  final Fulfilment fulfilment;
  final String? tableNo, note;
  final int itemTotalCents, taxCents, serviceFeeCents, totalCents;
  final PaymentMethod paymentMethod;
  OrderStatus status;
  final DateTime createdAt;
  final List<StallOrder> stallOrders;

  Map<String, dynamic> toJson() => {
        'id': id,
        'order_no': orderNo,
        'customer_name': customerName,
        'fulfilment': fulfilment.name,
        'table_no': tableNo,
        'note': note,
        'item_total_cents': itemTotalCents,
        'tax_cents': taxCents,
        'service_fee_cents': serviceFeeCents,
        'total_cents': totalCents,
        'payment_method': paymentMethod.name,
        'status': status.name,
        'created_at': createdAt.toIso8601String(),
        'stall_orders': stallOrders.map((e) => e.toJson()).toList(),
      };
}
