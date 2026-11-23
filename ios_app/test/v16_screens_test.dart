import 'dart:convert';
import 'dart:io';

import 'package:cupertino_ui/cupertino_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:open_sky_ios/data/catalog.dart';
import 'package:open_sky_ios/data/models.dart';
import 'package:open_sky_ios/screens/cart_screen.dart';
import 'package:open_sky_ios/screens/dish_sheet.dart';
import 'package:open_sky_ios/screens/order_screen.dart';
import 'package:open_sky_ios/state/app_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The bundled menu plus a test-only "Spice level" (pick 1) and "Add-ons" (up to 2) on one dish.
Map<String, dynamic> _catalogWithOptions(String itemId) {
  final j = jsonDecode(File('assets/data/catalog.json').readAsStringSync()) as Map<String, dynamic>;
  j['menu_option_groups'] = [
    {'id': 'g-spice', 'menu_item_id': itemId, 'name': 'Spice level', 'min_select': 1, 'max_select': 1, 'sort_order': 0},
    {'id': 'g-add', 'menu_item_id': itemId, 'name': 'Add-ons', 'min_select': 0, 'max_select': 2, 'sort_order': 1},
  ];
  j['menu_options'] = [
    {'id': 'o-medium', 'group_id': 'g-spice', 'name': 'Medium', 'price_cents': 0, 'is_default': true, 'is_available': true, 'sort_order': 0},
    {'id': 'o-hot', 'group_id': 'g-spice', 'name': 'Extra hot', 'price_cents': 0, 'is_default': false, 'is_available': true, 'sort_order': 1},
    {'id': 'o-pulka', 'group_id': 'g-add', 'name': 'Extra pulka', 'price_cents': 199, 'is_default': false, 'is_available': true, 'sort_order': 0},
    {'id': 'o-raita', 'group_id': 'g-add', 'name': 'Raita', 'price_cents': 150, 'is_default': false, 'is_available': true, 'sort_order': 1},
  ];
  return j;
}

Widget _host(AppState state, Widget child) => AppScope(state: state, child: CupertinoApp(key: UniqueKey(), home: child));

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  const dish = 'pandemkodi-dhaba.fish-curry-with-fresh-live-pulka';

  testWidgets('dish options: pick, price, note, then the cart shows the line with its options', (tester) async {
    final state = (await tester.runAsync(() => AppState.withCatalog(Catalog.fromJson(_catalogWithOptions(dish)))))!;
    final item = state.catalog.itemById[dish]!;
    tester.view.devicePixelRatio = 3;
    tester.view.physicalSize = const Size(390 * 3, 1400 * 3);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_host(state, CupertinoPageScaffold(child: DishSheet(item: item))));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Spice level'), findsOneWidget);
    expect(find.text('Required · pick 1'), findsOneWidget);
    expect(find.text('Add · ${money(item.priceCents)}'), findsOneWidget); // Medium is picked by default

    await tester.tap(find.text('Extra hot'));
    await tester.tap(find.text('Extra pulka'));
    await tester.pump();
    expect(find.text('Add · ${money(item.priceCents + 199)}'), findsOneWidget);

    await tester.enterText(find.byType(CupertinoTextField).first, 'no onions');
    await tester.tap(find.textContaining('Add · '));
    await tester.pump();

    expect(state.count, 1);
    final line = state.groups.single.lines.single;
    expect(line.unitPriceCents, item.priceCents + 199);
    expect(line.options.map((o) => o.name), ['Extra hot', 'Extra pulka']);
    expect(line.note, 'no onions');

    await tester.pumpWidget(_host(state, const CartScreen()));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Extra hot, Extra pulka (+${money(199)})'), findsOneWidget);
    expect(find.textContaining('“no onions”'), findsOneWidget);
    expect(find.text('Add to your order'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    state.dispose();
  });

  testWidgets('order page: options and note on the line, rate the truck, order again', (tester) async {
    final state = (await tester.runAsync(() => AppState.withCatalog(Catalog.fromJson(_catalogWithOptions(dish)))))!;
    tester.view.devicePixelRatio = 3;
    tester.view.physicalSize = const Size(390 * 3, 1600 * 3);
    addTearDown(tester.view.reset);
    state.add(dish, optionIds: const ['o-hot', 'o-raita'], note: 'less oil');
    state.setCheckout(name: 'Test');
    final order = state.placeOrder();
    // Hand the truck's part over (the demo ticker would do this over time).
    for (final s in order.stallOrders) {
      s.status = TicketStatus.completed;
    }
    order.status = OrderStatus.completed;

    await tester.pumpWidget(_host(state, OrderScreen(orderId: order.id)));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Extra hot, Raita (+${money(150)})'), findsOneWidget);
    expect(find.text('“less oil”'), findsOneWidget);
    expect(find.textContaining('How was PandemKodi Dhaba'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel(RegExp('^5 stars')));
    await tester.pump();
    await tester.tap(find.text('Send'));
    await tester.pump();
    expect(state.ratingOf(order.stallOrders.single)?.stars, 5);
    expect(find.text('Your rating'), findsOneWidget);

    expect(state.count, 0); // placing the order emptied the cart
    await tester.ensureVisible(find.text('Order again'));
    await tester.tap(find.text('Order again'));
    await tester.pump();
    final back = state.groups.single.lines.single;
    expect(back.optionIds, ['o-hot', 'o-raita']);
    expect(back.note, 'less oil');

    await tester.pumpWidget(const SizedBox.shrink());
    state.dispose();
  });
}
