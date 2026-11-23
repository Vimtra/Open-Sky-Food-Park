import 'package:flutter_test/flutter_test.dart';
import 'package:open_sky_ios/data/catalog.dart';
import 'package:open_sky_ios/data/coupons.dart';
import 'package:open_sky_ios/data/models.dart';
import 'package:open_sky_ios/data/options.dart';
import 'package:open_sky_ios/state/app_state.dart';

// Contract v1.6 rules, checked against the same cases as web/src/lib/options.ts and stall-status.ts.
void main() {
  setParkTimezone('America/Los_Angeles');
  final curry = MenuItem.fromJson({'id': 'dhaba.curry', 'stall_id': 'dhaba', 'category_id': 'dhaba.c', 'name': 'Curry', 'price_cents': 1500});

  final size = MenuOptionGroup.fromJson({'id': 'g1', 'menu_item_id': 'dhaba.curry', 'name': 'Size', 'min_select': 1, 'max_select': 1, 'sort_order': 0});
  final extras = MenuOptionGroup.fromJson({'id': 'g2', 'menu_item_id': 'dhaba.curry', 'name': 'Add-ons', 'min_select': 0, 'max_select': 2, 'sort_order': 1});
  MenuOption opt(String id, String group, String name, int cents, {bool def = false, bool avail = true}) => MenuOption.fromJson(
      {'id': id, 'group_id': group, 'name': name, 'price_cents': cents, 'is_default': def, 'is_available': avail, 'sort_order': 0});
  final groups = indexOptions([extras, size], [
    opt('reg', 'g1', 'Regular', 0, def: true),
    opt('lg', 'g1', 'Large', 300),
    opt('pulka', 'g2', 'Extra pulka', 199),
    opt('raita', 'g2', 'Raita', 150),
    opt('egg', 'g2', 'Egg', 100, avail: false),
  ])['dhaba.curry']!;

  group('dish options', () {
    test('groups in menu order; defaults picked', () {
      expect(groups.map((g) => g.group.name), ['Size', 'Add-ons']);
      expect(defaultChoice(groups), ['reg']);
      expect(ruleText(size), 'Required · pick 1');
      expect(ruleText(extras), 'Optional · up to 2');
    });

    test('min/max, unknown and sold-out options', () {
      expect(checkChoice(groups, []), 'option_required');
      expect(checkChoice(groups, ['reg', 'lg']), 'too_many_options');
      expect(checkChoice(groups, ['reg', 'pulka', 'raita', 'egg']), 'too_many_options');
      expect(checkChoice(groups, ['reg', 'nope']), 'bad_options');
      expect(checkChoice(groups, ['reg', 'reg']), 'bad_options');
      expect(checkChoice(groups, ['reg', 'egg']), isNull);
      expect(checkChoice(groups, ['reg', 'egg'], strict: true), 'option_unavailable');
      expect(checkChoice(groups, ['lg', 'pulka', 'raita'], strict: true), isNull);
    });

    test('price adds the options and keeps a copy', () {
      final p = priceWithOptions(curry, groups, ['lg', 'pulka']);
      expect(p.unitPriceCents, 1500 + 300 + 199);
      expect(optionsText(p.chosen, money), r'Large (+$3.00), Extra pulka (+$1.99)');
      expect(optionIdsFromCopy(groups, p.chosen), ['lg', 'pulka']);
      expect(optionIdsFromCopy(groups, [const ChosenOption(group: 'Size', name: 'Huge', priceCents: 0)]), isNull);
    });

    test('line keys ignore the order options were picked in', () {
      expect(lineKey('a'), 'a');
      expect(lineKey('a', ['z', 'b']), lineKey('a', ['b', 'z']));
      expect(lineKey('a', ['b']) == lineKey('a'), isFalse);
    });

    test('coupons count option prices', () {
      final c = Coupon.fromJson({'id': 'c', 'code': 'TEN', 'title': 'T', 'kind': 'percent', 'value': 10});
      final q = quoteCoupon(code: 'ten', couponsEnabled: true, coupons: [c], priced: [(item: curry, unitCents: 1999, qty: 2)], now: DateTime(2026, 11, 19));
      expect(q.eligibleCents, 3998);
      expect(q.discountCents, 400);
    });
  });

  group('truck hours and pause', () {
    Stall stall(Map<String, dynamic> j) => Stall.fromJson({'id': 's', 'slug': 's', 'name': 'S', ...j});
    StallHours h(int weekday, String opens, String closes) => StallHours.fromJson({'stall_id': 's', 'weekday': weekday, 'opens': opens, 'closes': closes});
    // 2026-11-19 is a Thursday (weekday 4). 18:00 in Milpitas is 02:00 UTC the next day.
    final thu6pm = DateTime.utc(2026, 11, 20, 2);

    test('switched off, paused, open', () {
      expect(stall({'is_open': false}).closedReason(thu6pm), ClosedReason.closed);
      expect(stall({'paused_until': '2026-11-20T02:20:00Z'}).closedReason(thu6pm), ClosedReason.paused);
      expect(stall({'paused_until': '2026-11-20T01:50:00Z'}).closedReason(thu6pm), isNull);
      expect(stall({}).closedReason(thu6pm), isNull);
    });

    test('hours in the park time zone, including past midnight', () {
      final s = stall({'auto_hours': true})..hours = [h(4, '17:00', '23:00'), h(5, '20:00', '01:30')];
      expect(s.closedReason(thu6pm), isNull);
      expect(s.closedReason(DateTime.utc(2026, 11, 20, 0)), ClosedReason.outsideHours); // Thu 4 PM
      expect(s.closedReason(DateTime.utc(2026, 11, 20, 8)), ClosedReason.outsideHours); // Fri 12:00 AM PT, Thu closed at 11
    });

    test('Friday night runs past midnight into Saturday', () {
      final s = stall({'auto_hours': true})..hours = [h(5, '20:00', '01:30')];
      expect(s.closedReason(DateTime.utc(2026, 11, 21, 9)), isNull); // Sat 1:00 AM PT
      expect(s.closedReason(DateTime.utc(2026, 11, 21, 10)), ClosedReason.outsideHours); // Sat 2:00 AM PT
      expect(parkTime(s.nextOpening(DateTime.utc(2026, 11, 20, 2))!), '8:00 PM'); // from Thu 6 PM → Fri 8 PM
    });

    test('auto hours off ignores the hours', () {
      final s = stall({})..hours = [h(1, '17:00', '18:00')];
      expect(s.closedReason(thu6pm), isNull);
    });
  });
}
