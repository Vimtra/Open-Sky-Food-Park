import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/catalog.dart';
import '../data/coupons.dart';
import '../data/models.dart';

const maxQty = 20;

/// One cart line, resolved against the catalog.
class CartLine {
  CartLine(this.item, this.qty, this.stall);
  final MenuItem item;
  final int qty;
  final Stall stall;
  bool get orderable => item.isAvailable && stall.isOpen;
}

class CartGroup {
  CartGroup(this.stall, this.lines);
  final Stall stall;
  final List<CartLine> lines;
  int get subtotalCents => lines.fold(0, (n, l) => n + l.item.priceCents * l.qty);
}

/// Everything the screens share: the catalog, the cart and (in demo mode) the orders.
/// Demo mode keeps orders on this phone only, like the website's demo keeps them in the browser.
class AppState extends ChangeNotifier {
  AppState._(this.catalog, this._prefs) {
    _restore();
    _ticker = Timer.periodic(const Duration(seconds: 5), (_) => _advanceDemoOrders());
  }

  static Future<AppState> load() async => AppState._(await Catalog.loadBundled(), await SharedPreferences.getInstance());

  static const demo = true;

  final Catalog catalog;
  final SharedPreferences _prefs;
  late final Timer _ticker;

  final Map<String, int> _lines = {};
  final List<Order> _orders = [];

  /// Signed-in customer (demo: kept on this phone). Null when signed out.
  Account? account;

  /// True once the welcome tour has been shown after the account was created.
  bool tourSeen = false;

  /// Home's VEG switch: hides dishes marked non-veg or egg. Dishes with no diet mark stay
  /// (the catalog has none on desserts, and we don't guess).
  bool vegOnly = false;

  void setVegOnly(bool v) {
    vegOnly = v;
    _changed();
  }

  /// True when [m] passes the VEG switch.
  bool vegOk(MenuItem m) => !vegOnly || (m.diet != Diet.nonveg && m.diet != Diet.egg);

  /// Last few searches, newest first (kept on this phone).
  final List<String> recentSearches = [];
  static const _maxRecent = 8;

  void addRecentSearch(String q) {
    final t = q.trim();
    if (t.length < 2) return;
    recentSearches.removeWhere((x) => x.toLowerCase() == t.toLowerCase());
    recentSearches.insert(0, t);
    if (recentSearches.length > _maxRecent) recentSearches.removeRange(_maxRecent, recentSearches.length);
    _changed();
  }

  void removeRecentSearch(String q) {
    recentSearches.remove(q);
    _changed();
  }

  void clearRecentSearches() {
    recentSearches.clear();
    _changed();
  }

  String customerName = '';
  Fulfilment fulfilment = Fulfilment.pickup;
  String tableNo = '';
  String note = '';
  PaymentMethod paymentMethod = PaymentMethod.payAtStall;

  // ---------------------------------------------------------------- cart

  int qtyOf(String itemId) => _lines[itemId] ?? 0;
  int get count => _lines.values.fold(0, (a, b) => a + b);

  List<CartGroup> get groups {
    final byStall = <String, List<CartLine>>{};
    for (final e in _lines.entries) {
      final item = catalog.itemById[e.key];
      final stall = item == null ? null : catalog.stallById[item.stallId];
      if (item == null || stall == null) continue;
      (byStall[stall.id] ??= []).add(CartLine(item, e.value, stall));
    }
    // Stalls in park order; lines in menu order.
    return [
      for (final s in catalog.stalls)
        if (byStall[s.id] case final lines?) CartGroup(s, lines..sort((a, b) => _menuOrder(a.item).compareTo(_menuOrder(b.item)))),
    ];
  }

  int _menuOrder(MenuItem m) => (catalog.categoryById[m.categoryId]?.sortOrder ?? 0) * 1000 + m.sortOrder;

  int get itemTotalCents => groups.fold(0, (n, g) => n + g.subtotalCents);
  bool get blocked => groups.any((g) => g.lines.any((l) => !l.orderable));

  void add(String itemId) {
    _lines[itemId] = min(maxQty, qtyOf(itemId) + 1);
    _changed();
  }

  void decrement(String itemId) {
    final q = qtyOf(itemId);
    if (q <= 1) {
      _lines.remove(itemId);
    } else {
      _lines[itemId] = q - 1;
    }
    _changed();
  }

  void remove(String itemId) {
    _lines.remove(itemId);
    _changed();
  }

  void setCheckout({Fulfilment? fulfilment, String? tableNo, String? note, PaymentMethod? payment, String? name}) {
    if (fulfilment != null) this.fulfilment = fulfilment;
    if (tableNo != null) this.tableNo = tableNo;
    if (note != null) this.note = note;
    if (payment != null) paymentMethod = payment;
    if (name != null) customerName = name;
    _changed();
  }

  // ---------------------------------------------------------------- account (demo)

  /// Demo sign-in: no server, the profile lives on this phone. Returns true for a brand-new account
  /// (the caller then shows the welcome tour).
  bool signIn({required String name, String? phone, required SignInMethod method}) {
    final isNew = !_knownAccounts.contains(_accountKey(name, phone, method));
    final cleanPhone = (phone == null || phone.trim().isEmpty) ? null : phone.trim();
    account = Account(name: name.trim(), phone: cleanPhone, method: method, createdAt: DateTime.now());
    _knownAccounts.add(_accountKey(name, phone, method));
    if (customerName.trim().isEmpty) customerName = account!.name;
    if (isNew) tourSeen = false;
    _changed();
    return isNew;
  }

  final Set<String> _knownAccounts = {};
  String _accountKey(String name, String? phone, SignInMethod m) => '${m.name}:${(phone ?? '').trim()}:${name.trim().toLowerCase()}';

  void signOut() {
    account = null;
    _changed();
  }

  void updateProfile({String? name, String? phone}) {
    final a = account;
    if (a == null) return;
    account = Account(
      name: (name ?? a.name).trim(),
      phone: phone == null ? a.phone : (phone.trim().isEmpty ? null : phone.trim()),
      method: a.method,
      createdAt: a.createdAt,
    );
    if (name != null && name.trim().isNotEmpty) customerName = name.trim();
    _changed();
  }

  void markTourSeen() {
    tourSeen = true;
    _changed();
  }

  /// Settings → "Clear demo data": cart, orders, account and token counters on this phone.
  Future<void> clearDemoData() async {
    _lines.clear();
    _orders.clear();
    _knownAccounts.clear();
    recentSearches.clear();
    account = null;
    tourSeen = false;
    customerName = '';
    tableNo = '';
    note = '';
    fulfilment = Fulfilment.pickup;
    paymentMethod = PaymentMethod.payAtStall;
    couponCode = null;
    supportRequests.clear();
    await _prefs.remove('tokens');
    _changed();
  }

  // ---------------------------------------------------------------- coupons (contract v1.5)

  /// The code the customer applied, if any. Re-priced live as the cart changes.
  String? couponCode;

  /// Coupons the park lists under Offers.
  List<Coupon> get offers => catalog.park.couponsEnabled ? catalog.coupons.where((c) => c.isOffer(DateTime.now())).toList() : const [];

  int _timesUsed(String code, {bool mine = false}) => _orders
      .where((o) => o.couponCode == code && o.status != OrderStatus.cancelled && (!mine || account != null))
      .length;

  /// Prices [code] against the orderable cart lines. Throws [CouponError].
  CouponQuote quote(String code) {
    final lines = <MenuItem, int>{
      for (final g in groups)
        for (final l in g.lines)
          if (l.orderable) l.item: l.qty,
    };
    final wanted = code.trim().toUpperCase();
    return quoteCoupon(
      code: wanted,
      couponsEnabled: catalog.park.couponsEnabled,
      coupons: catalog.coupons,
      lines: lines,
      now: DateTime.now(),
      timesUsed: _timesUsed(wanted),
      timesUsedByMe: account == null ? null : _timesUsed(wanted, mine: true),
    );
  }

  /// The applied coupon's current quote, or the reason it no longer applies.
  ({CouponQuote? quote, String? error}) get couponState {
    final code = couponCode;
    if (code == null) return (quote: null, error: null);
    try {
      return (quote: quote(code), error: null);
    } on CouponError catch (e) {
      return (quote: null, error: e.message);
    }
  }

  /// Returns null when applied, or the reason it can't be.
  String? applyCoupon(String code) {
    try {
      final q = quote(code);
      couponCode = q.coupon.code;
      _changed();
      return null;
    } on CouponError catch (e) {
      return e.message;
    }
  }

  void removeCoupon() {
    couponCode = null;
    _changed();
  }

  // ---------------------------------------------------------------- order again (roadmap C1)

  /// Refills the cart from [o]: every dish that is still on the menu, available and at an open truck,
  /// at its current price. Returns how many were added and the names that could not be.
  ({int added, List<String> skipped}) orderAgain(Order o) {
    var added = 0;
    final skipped = <String>[];
    for (final so in o.stallOrders) {
      for (final it in so.items) {
        final m = it.menuItemId == null ? null : catalog.itemById[it.menuItemId];
        final stall = m == null ? null : catalog.stallById[m.stallId];
        if (m == null || stall == null || !m.isAvailable || !stall.isOpen) {
          skipped.add(it.name);
          continue;
        }
        _lines[m.id] = min(maxQty, qtyOf(m.id) + it.qty);
        added += it.qty;
      }
    }
    if (added > 0) _changed();
    return (added: added, skipped: skipped);
  }

  // ---------------------------------------------------------------- contact (demo)

  /// Messages sent from Contact us. Demo: kept on this phone; live they go to the website's
  /// Admin → Messages through submit_support_request.
  final List<Map<String, dynamic>> supportRequests = [];

  String submitSupportRequest({required String topic, required String name, required String contact, String? orderNo, required String message}) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final rnd = Random();
    final ref = 'HS-${List.generate(5, (_) => alphabet[rnd.nextInt(alphabet.length)]).join()}';
    supportRequests.add({
      'ref_no': ref,
      'topic': topic,
      'name': name.trim(),
      'contact': contact.trim(),
      'order_no': orderNo,
      'message': message.trim(),
      'created_at': DateTime.now().toIso8601String(),
    });
    _changed();
    return ref;
  }

  // ---------------------------------------------------------------- orders (demo)

  List<Order> get orders => List.unmodifiable(_orders..sort((a, b) => b.createdAt.compareTo(a.createdAt)));
  Order? orderById(String id) => _orders.where((o) => o.id == id).firstOrNull;

  /// Places the cart as one order with one token per stall. Demo only: nothing leaves the phone.
  Order placeOrder() {
    final now = DateTime.now();
    final applied = couponState.quote;
    final bill = computeBill(itemTotalCents, catalog.park, discountCents: applied?.discountCents ?? 0);
    final rnd = Random();
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final orderNo = 'OS-${List.generate(5, (_) => alphabet[rnd.nextInt(alphabet.length)]).join()}';
    final tokens = Map<String, int>.from((jsonDecode(_prefs.getString('tokens') ?? '{}') as Map).cast<String, int>());

    // Discount split as in place_order: by share of eligible dishes, the last truck takes the
    // remainder; a truck-only coupon goes entirely to that truck.
    final gs = groups;
    var discountLeft = bill.discount;
    final scope = applied?.coupon.stallId;
    final shares = <String, int>{};
    for (final (i, g) in gs.indexed) {
      final last = i == gs.length - 1;
      final share = applied == null || (scope != null && scope != g.stall.id)
          ? 0
          : (last || scope != null)
              ? discountLeft
              : ((bill.discount * g.subtotalCents) / (applied.eligibleCents == 0 ? 1 : applied.eligibleCents)).round().clamp(0, discountLeft);
      discountLeft -= share;
      shares[g.stall.id] = share;
    }

    final stallOrders = [
      for (final g in gs)
        StallOrder(
          stallId: g.stall.id,
          stallName: g.stall.name,
          tokenNo: tokens[g.stall.id] = (tokens[g.stall.id] ?? 0) + 1,
          status: TicketStatus.placed,
          subtotalCents: g.subtotalCents,
          discountCents: shares[g.stall.id] ?? 0,
          createdAt: now,
          items: [
            for (final l in g.lines)
              OrderItem(menuItemId: l.item.id, name: l.item.name, diet: l.item.diet, unitPriceCents: l.item.priceCents, qty: l.qty),
          ],
        ),
    ];
    final table = catalog.park.tableServiceEnabled && fulfilment == Fulfilment.table;
    final order = Order(
      id: '${now.millisecondsSinceEpoch}',
      orderNo: orderNo,
      customerName: customerName.trim(),
      fulfilment: table ? Fulfilment.table : Fulfilment.pickup,
      tableNo: table ? tableNo.trim() : null,
      note: note.trim().isEmpty ? null : note.trim(),
      itemTotalCents: bill.items,
      taxCents: bill.tax,
      discountCents: bill.discount,
      couponCode: bill.discount > 0 ? applied?.coupon.code : null,
      serviceFeeCents: bill.fee,
      totalCents: bill.total,
      paymentMethod: paymentMethod,
      status: OrderStatus.active,
      createdAt: now,
      stallOrders: stallOrders,
    );
    _prefs.setString('tokens', jsonEncode(tokens));
    _orders.add(order);
    _lines.clear();
    note = '';
    couponCode = null;
    _changed();
    return order;
  }

  /// Cancel is allowed only while no stall has started cooking (same rule as the website).
  bool canCancel(Order o) => o.status == OrderStatus.active && o.stallOrders.every((s) => s.status == TicketStatus.placed);

  void cancel(Order o) {
    if (!canCancel(o)) return;
    o.status = OrderStatus.cancelled;
    for (final s in o.stallOrders) {
      s.status = TicketStatus.cancelled;
    }
    _changed();
  }

  /// Demo stand-in for the stall dashboard: each token moves placed → preparing → ready → collected.
  void _advanceDemoOrders() {
    var changed = false;
    final now = DateTime.now();
    for (final o in _orders.where((o) => o.status == OrderStatus.active)) {
      for (final s in o.stallOrders) {
        final age = now.difference(s.createdAt).inSeconds;
        final next = switch (s.status) {
          TicketStatus.placed when age >= 12 => TicketStatus.preparing,
          TicketStatus.preparing when age >= 40 => TicketStatus.ready,
          TicketStatus.ready when age >= 180 => TicketStatus.completed,
          _ => null,
        };
        if (next != null) {
          s.status = next;
          if (next == TicketStatus.ready) s.readyAt = now;
          changed = true;
        }
      }
      if (o.stallOrders.every((s) => s.status == TicketStatus.completed || s.status == TicketStatus.cancelled)) {
        o.status = OrderStatus.completed;
        changed = true;
      }
    }
    if (changed) _changed();
  }

  // ---------------------------------------------------------------- persistence

  void _changed() {
    _prefs.setString(
      'state',
      jsonEncode({
        'lines': _lines,
        'name': customerName,
        'fulfilment': fulfilment.name,
        'table_no': tableNo,
        'note': note,
        'payment': paymentMethod.name,
        'orders': _orders.map((o) => o.toJson()).toList(),
        'account': account?.toJson(),
        'known_accounts': _knownAccounts.toList(),
        'tour_seen': tourSeen,
        'recent_searches': recentSearches,
        'veg_only': vegOnly,
        'coupon_code': couponCode,
        'support_requests': supportRequests,
      }),
    );
    notifyListeners();
  }

  void _restore() {
    final raw = _prefs.getString('state');
    if (raw == null) return;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      (j['lines'] as Map? ?? {}).forEach((k, v) {
        if (catalog.itemById.containsKey(k)) _lines[k as String] = (v as num).toInt();
      });
      customerName = j['name'] as String? ?? '';
      fulfilment = Fulfilment.values.asNameMap()[j['fulfilment']] ?? Fulfilment.pickup;
      tableNo = j['table_no'] as String? ?? '';
      note = j['note'] as String? ?? '';
      paymentMethod = PaymentMethod.values.asNameMap()[j['payment']] ?? PaymentMethod.payAtStall;
      _orders.addAll((j['orders'] as List? ?? []).map((e) => Order.fromJson(e as Map<String, dynamic>)));
      if (j['account'] is Map<String, dynamic>) account = Account.fromJson(j['account'] as Map<String, dynamic>);
      _knownAccounts.addAll((j['known_accounts'] as List? ?? []).cast<String>());
      tourSeen = j['tour_seen'] as bool? ?? false;
      recentSearches.addAll((j['recent_searches'] as List? ?? []).cast<String>());
      vegOnly = j['veg_only'] as bool? ?? false;
      couponCode = j['coupon_code'] as String?;
      supportRequests.addAll((j['support_requests'] as List? ?? []).cast<Map<String, dynamic>>());
    } catch (_) {
      // A saved state from an older build: start fresh rather than crash.
    }
  }

  @override
  void dispose() {
    _ticker.cancel();
    super.dispose();
  }
}

/// Gives every screen the AppState and rebuilds dependents when it changes.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);

  static AppState of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
  static AppState read(BuildContext context) => context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
