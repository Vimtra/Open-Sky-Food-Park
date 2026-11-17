import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/catalog.dart';
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

  // ---------------------------------------------------------------- orders (demo)

  List<Order> get orders => List.unmodifiable(_orders..sort((a, b) => b.createdAt.compareTo(a.createdAt)));
  Order? orderById(String id) => _orders.where((o) => o.id == id).firstOrNull;

  /// Places the cart as one order with one token per stall. Demo only: nothing leaves the phone.
  Order placeOrder() {
    final now = DateTime.now();
    final bill = computeBill(itemTotalCents, catalog.park);
    final rnd = Random();
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final orderNo = 'OS-${List.generate(5, (_) => alphabet[rnd.nextInt(alphabet.length)]).join()}';
    final tokens = Map<String, int>.from((jsonDecode(_prefs.getString('tokens') ?? '{}') as Map).cast<String, int>());

    final stallOrders = [
      for (final g in groups)
        StallOrder(
          stallId: g.stall.id,
          stallName: g.stall.name,
          tokenNo: tokens[g.stall.id] = (tokens[g.stall.id] ?? 0) + 1,
          status: TicketStatus.placed,
          subtotalCents: g.subtotalCents,
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
