// Dish options (contract v1.6): the same rules as _price_lines() in supabase/migrations/0006_v16.sql
// and web/src/lib/options.ts, so the app, the website and the database agree on prices and errors.

import 'models.dart';

/// One option group of a dish with its options, in menu order.
class OptionGroupView {
  const OptionGroupView(this.group, this.options);
  final MenuOptionGroup group;
  final List<MenuOption> options;

  /// One choice only: shown as radio buttons.
  bool get single => group.maxSelect == 1;
}

/// Option groups of every dish.
Map<String, List<OptionGroupView>> indexOptions(List<MenuOptionGroup> groups, List<MenuOption> options) {
  final byGroup = <String, List<MenuOption>>{};
  for (final o in [...options]..sort((a, b) => a.sortOrder.compareTo(b.sortOrder))) {
    (byGroup[o.groupId] ??= []).add(o);
  }
  final out = <String, List<OptionGroupView>>{};
  for (final g in [...groups]..sort((a, b) => a.sortOrder.compareTo(b.sortOrder))) {
    (out[g.menuItemId] ??= []).add(OptionGroupView(g, byGroup[g.id] ?? const []));
  }
  return out;
}

/// "Required · pick 1", "Optional · up to 3"
String ruleText(MenuOptionGroup g) {
  if (g.minSelect == 0) return g.maxSelect == 1 ? 'Optional · pick 1' : 'Optional · up to ${g.maxSelect}';
  if (g.minSelect == g.maxSelect) return 'Required · pick ${g.minSelect}';
  return 'Required · pick ${g.minSelect} to ${g.maxSelect}';
}

/// Checks a choice for one dish. Returns a contract error code, or null.
/// [strict] also refuses sold-out options (orders); the cart preview skips that.
String? checkChoice(List<OptionGroupView> groups, List<String> optionIds, {bool strict = false}) {
  if (optionIds.toSet().length != optionIds.length) return 'bad_options';
  final all = {for (final g in groups) for (final o in g.options) o.id: o};
  if (optionIds.any((id) => !all.containsKey(id))) return 'bad_options';
  if (strict && optionIds.any((id) => !all[id]!.isAvailable)) return 'option_unavailable';
  for (final g in groups) {
    final picked = g.options.where((o) => optionIds.contains(o.id)).length;
    if (picked < g.group.minSelect) return 'option_required';
    if (picked > g.group.maxSelect) return 'too_many_options';
  }
  return null;
}

/// Unit price with options, and the copy of the options an order line keeps.
({int unitPriceCents, List<ChosenOption> chosen}) priceWithOptions(MenuItem item, List<OptionGroupView> groups, List<String> optionIds) {
  final chosen = <ChosenOption>[
    for (final g in groups)
      for (final o in g.options)
        if (optionIds.contains(o.id)) ChosenOption(group: g.group.name, name: o.name, priceCents: o.priceCents),
  ];
  return (unitPriceCents: item.priceCents + chosen.fold(0, (n, c) => n + c.priceCents), chosen: chosen);
}

/// The options a dish starts with: each group's available defaults.
List<String> defaultChoice(List<OptionGroupView> groups) => [
      for (final g in groups) ...g.options.where((o) => o.isDefault && o.isAvailable).take(g.group.maxSelect).map((o) => o.id),
    ];

/// "Hot, Extra pulka (+$1.99)"
String optionsText(List<ChosenOption> chosen, String Function(int) money) =>
    chosen.map((c) => c.priceCents != 0 ? '${c.name} (+${money(c.priceCents)})' : c.name).join(', ');

/// For "Order again": today's option ids for options copied on a past order line, matched by group
/// and option name. Null when one no longer exists.
List<String>? optionIdsFromCopy(List<OptionGroupView> groups, List<ChosenOption> copy) {
  final ids = <String>[];
  for (final c in copy) {
    final g = groups.where((x) => x.group.name == c.group).firstOrNull;
    final o = g?.options.where((x) => x.name == c.name).firstOrNull;
    if (o == null) return null;
    ids.add(o.id);
  }
  return ids;
}

/// The same customer-facing wording as friendlyError() in web/src/lib/format.ts.
const errorText = <String, String>{
  'sign_in_required': 'Please sign in to place your order.',
  'ordering_closed': 'The park is not taking orders right now.',
  'name_required': 'Add your name so the stall knows whose order it is.',
  'table_required': 'Enter your table number.',
  'table_service_unavailable': 'Table service is off right now. Choose pickup instead.',
  'cart_empty': 'Your cart is empty.',
  'item_not_found': 'An item in your cart is no longer on the menu. Remove it and try again.',
  'bad_quantity': 'One of the quantities is not valid.',
  'item_unavailable': 'An item in your cart just sold out. Remove it and try again.',
  'stall_closed': 'A stall in your cart has closed. Remove its items and try again.',
  'stall_paused': 'A truck in your cart has paused new orders for a few minutes. Try again shortly or remove its items.',
  'outside_hours': 'A truck in your cart is outside its opening hours. Remove its items and try again.',
  'cart_too_big': 'That cart is too big. Split it into two orders.',
  'option_required': 'Pick the required choices for each dish (like spice level or size).',
  'too_many_options': 'One of the dishes has too many add-ons picked.',
  'bad_options': 'One of the dish choices is no longer offered. Open the dish and choose again.',
  'option_unavailable': 'One of your add-ons just sold out. Open the dish and choose again.',
  'scheduling_unavailable': 'Ordering for later is not available right now.',
  'bad_pickup_time': 'Pick a pickup time at least 10 minutes from now, later today.',
  'not_completed': 'You can rate this once you have picked it up.',
  'bad_rating': 'Pick 1 to 5 stars. Comments can be up to 500 characters.',
};

String friendlyError(String code) => errorText[code] ?? 'Something went wrong. Please try again.';
