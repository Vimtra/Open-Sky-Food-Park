import 'package:flutter_test/flutter_test.dart';
import 'package:open_sky/data/catalog.dart';
import 'package:open_sky/data/models.dart';

void main() {
  test('money formats cents like the website', () {
    expect(money(1599), r'$15.99');
    expect(money(0), r'$0.00');
    expect(money(123456), r'$1,234.56');
  });

  test('bill rounds tax like the database', () {
    final park = Park.fromJson({'name': 'P', 'tax_percent': 9.375, 'service_fee_cents': 0});
    final b = computeBill(1599, park);
    expect(b.tax, 150); // round(1599 × 9.375 / 100) = round(149.9…)
    expect(b.total, 1749);
  });

  test('dish blurb joins serves and description', () {
    MenuItem item(Object? serves, Object? desc) => MenuItem.fromJson({
          'id': 's.d',
          'stall_id': 's',
          'category_id': 's.c',
          'name': 'D',
          'price_cents': 100,
          'serves': serves,
          'description': desc,
        });
    expect(item(4, 'Spicy curry.').blurb, 'Serves 4 | Spicy curry.');
    expect(item(null, 'Spicy curry.').blurb, 'Spicy curry.');
    expect(item(4, null).blurb, 'Serves 4');
    expect(item(null, '  ').blurb, isNull);
    expect(item(null, null).slug, 'd');
  });
}
