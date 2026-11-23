import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import 'coupons.dart';
import 'models.dart';
import 'options.dart';

/// The menu, loaded once and indexed for the screens. In demo mode it comes from the bundled
/// assets/data/catalog.json (a copy of shared/seed/catalog.json); a Supabase source comes later (B2).
class Catalog {
  Catalog._(this.park, this.stalls, this.categories, this.items, this.cravings, this.banners, this.placeholderPriceIds, this.coupons,
      List<StallHours> hours, List<MenuOptionGroup> optionGroups, List<MenuOption> options) {
    setParkTimezone(park.timezone);
    optionsByItem.addAll(indexOptions(optionGroups, options));
    for (final s in stalls) {
      s.hours = hours.where((h) => h.stallId == s.id).toList();
      stallById[s.id] = s;
      stallBySlug[s.slug] = s;
    }
    for (final c in categories) {
      categoryById[c.id] = c;
      (categoriesByStall[c.stallId] ??= []).add(c);
    }
    for (final m in items) {
      itemById[m.id] = m;
      (itemsByStall[m.stallId] ??= []).add(m);
    }
  }

  final Park park;
  final List<Stall> stalls;
  final List<MenuCategory> categories;
  final List<MenuItem> items;
  final List<Craving> cravings;
  final List<PromoBanner> banners;
  final Set<String> placeholderPriceIds;

  /// Coupons the app can apply. The bundled demo catalog has none (they are created in the admin
  /// panel and come from Supabase once the app is connected).
  final List<Coupon> coupons;

  final stallById = <String, Stall>{};
  final stallBySlug = <String, Stall>{};
  final categoryById = <String, MenuCategory>{};
  final categoriesByStall = <String, List<MenuCategory>>{};
  final itemById = <String, MenuItem>{};
  final itemsByStall = <String, List<MenuItem>>{};

  /// Contract v1.6: option groups per dish (size, spice, add-ons). Empty until the owner adds some.
  final optionsByItem = <String, List<OptionGroupView>>{};
  List<OptionGroupView> optionsOf(String itemId) => optionsByItem[itemId] ?? const [];

  static Future<Catalog> loadBundled() async =>
      Catalog.fromJson(jsonDecode(await rootBundle.loadString('assets/data/catalog.json')) as Map<String, dynamic>);

  /// From catalog.json, or from the same tables read live from Supabase (see live.dart).
  static Catalog fromJson(Map<String, dynamic> j) {
    List<T> list<T>(String key, T Function(Map<String, dynamic>) f) =>
        (j[key] as List? ?? const []).map((e) => f(e as Map<String, dynamic>)).toList();
    int bySort(dynamic a, dynamic b) => (a.sortOrder as int).compareTo(b.sortOrder as int);

    return Catalog._(
      Park.fromJson(j['park'] as Map<String, dynamic>),
      list('stalls', Stall.fromJson).where((s) => s.isActive).toList()..sort(bySort),
      list('menu_categories', MenuCategory.fromJson)..sort(bySort),
      list('menu_items', MenuItem.fromJson)..sort(bySort),
      list('cravings', Craving.fromJson)..sort(bySort),
      list('banners', PromoBanner.fromJson).where((b) => b.isActive).toList()..sort(bySort),
      (j['placeholder_price_item_ids'] as List? ?? const []).cast<String>().toSet(),
      list('coupons', Coupon.fromJson),
      list('stall_hours', StallHours.fromJson),
      list('menu_option_groups', MenuOptionGroup.fromJson),
      list('menu_options', MenuOption.fromJson),
    );
  }

  /// Dish for a `/stall/<slug>/<dish>` link.
  MenuItem? dish(String stallSlug, String dishSlug) {
    final s = stallBySlug[stallSlug];
    return s == null ? null : itemById['${s.id}.$dishSlug'];
  }
}

/// Catalog image keys are "img/..."; bundled under assets/. Uploaded images will be full URLs.
String? assetFor(String? url) {
  if (url == null) return null;
  if (url.startsWith('http')) return url;
  return 'assets/${url.replaceFirst(RegExp(r'^/+'), '')}';
}

String money(int cents) {
  final neg = cents < 0;
  final c = cents.abs();
  final dollars = (c ~/ 100).toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  return '${neg ? '-' : ''}\$$dollars.${(c % 100).toString().padLeft(2, '0')}';
}

String plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

/// Same rounding as the website and the database: tax = round(items × percent / 100).
/// Contract v1.5: tax is charged on (items − discount); total = items − discount + tax + fee.
({int items, int discount, int tax, int fee, int total}) computeBill(int itemTotalCents, Park park, {int discountCents = 0}) {
  final discount = discountCents.clamp(0, itemTotalCents);
  final tax = ((itemTotalCents - discount) * park.taxPercent / 100).round();
  return (items: itemTotalCents, discount: discount, tax: tax, fee: park.serviceFeeCents, total: itemTotalCents - discount + tax + park.serviceFeeCents);
}
