import 'package:material_ui/material_ui.dart';

import '../data/models.dart';
import '../screens/cart_screen.dart';
import '../screens/dish_screen.dart';
import '../screens/order_screen.dart';
import '../screens/search_screen.dart';
import '../screens/stall_screen.dart';

Future<T?> _push<T>(BuildContext context, Widget page) => Navigator.of(context).push<T>(MaterialPageRoute(builder: (_) => page));

void openStall(BuildContext context, Stall stall, {String? categoryId}) => _push(context, StallScreen(stallId: stall.id, scrollToCategory: categoryId));

void openDish(BuildContext context, Stall stall, MenuItem item) => _push(context, DishScreen(itemId: item.id));

void openCart(BuildContext context) => _push(context, const CartScreen(standalone: true));

void openOrder(BuildContext context, String orderId, {bool replace = false}) {
  final route = MaterialPageRoute<void>(builder: (_) => OrderScreen(orderId: orderId));
  if (replace) {
    Navigator.of(context).pushReplacement(route);
  } else {
    Navigator.of(context).push(route);
  }
}

void openSearch(BuildContext context, {String? craving}) => openSearchPage(context, craving: craving);
