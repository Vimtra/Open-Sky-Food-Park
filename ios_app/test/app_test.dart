import 'package:cupertino_ui/cupertino_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:open_sky_ios/data/models.dart';
import 'package:open_sky_ios/main.dart';
import 'package:open_sky_ios/state/app_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('home shows the trucks as tabs and a dish can go into the cart', (tester) async {
    final state = await tester.runAsync(AppState.load);
    await tester.pumpWidget(AppScope(state: state!, child: const OpenSkyApp()));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('All trucks'), findsOneWidget);
    for (final s in state.catalog.stalls) {
      expect(find.text(s.name), findsWidgets);
    }

    // Tapping a truck tab turns Home into that truck's menu.
    final desserts = state.catalog.stalls.firstWhere((s) => s.id == 'desi-desserts');
    await tester.tap(find.text(desserts.name).first);
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('MILK, SHAKES & LASSI'), findsOneWidget); // the truck's own sections as chips
    expect(find.text('EVERY TRUCK'), findsOneWidget);

    final item = state.catalog.items.firstWhere((m) => m.isAvailable);
    state.add(item.id);
    await tester.pump();
    expect(state.count, 1);
    expect(find.textContaining('View cart'), findsOneWidget);

    // Tear down the periodic timers (demo order ticker, search hints, carousel).
    await tester.pumpWidget(const SizedBox.shrink());
    state.dispose();
  });

  test('blurb shows size before serves, then the description', () {
    final m = MenuItem.fromJson({
      'id': 'desi-desserts.rose-milk',
      'stall_id': 'desi-desserts',
      'category_id': 'x',
      'name': 'Rose Milk',
      'description': 'Chilled milk with rose syrup.',
      'price_cents': 699,
      'diet': null,
      'image_url': null,
      'craving': null,
      'is_available': true,
      'is_featured': false,
      'sort_order': 1,
      'serves': null,
      'size_label': '12 oz',
    });
    expect(m.blurb, '12 oz | Chilled milk with rose syrup.');
  });
}
