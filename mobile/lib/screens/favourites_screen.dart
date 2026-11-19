import 'package:material_ui/material_ui.dart';

import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/widgets.dart';

/// Account → Favourites (v1.6, C4): the trucks and dishes the customer saved with the heart.
class FavouritesScreen extends StatelessWidget {
  const FavouritesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = app.catalog;
    final stalls = c.stalls.where((s) => app.isFavouriteStall(s.id)).toList();
    final dishes = [
      for (final m in c.items)
        if (app.isFavouriteItem(m.id))
          if (c.stallById[m.stallId] case final Stall s) (m, s),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Favourites')),
      body: stalls.isEmpty && dishes.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: const BoxDecoration(color: OsColors.surface1, shape: BoxShape.circle),
                    child: const Icon(Icons.favorite_border, size: 28, color: OsColors.ink500),
                  ),
                  const SizedBox(height: 16),
                  Text('No favourites yet', style: OsText.heading),
                  const SizedBox(height: 6),
                  Text('Tap the heart on a dish or a truck to keep it here.',
                      textAlign: TextAlign.center, style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
                ]),
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(0, 8, 0, 32),
              children: [
                if (stalls.isNotEmpty) ...[
                  const SectionTitle('Trucks'),
                  const SizedBox(height: 10),
                  for (final s in stalls)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: TruckCard(stall: s, itemCount: (c.itemsByStall[s.id] ?? const []).length),
                    ),
                  const SizedBox(height: 12),
                ],
                if (dishes.isNotEmpty) ...[
                  const SectionTitle('Dishes'),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: LayoutBuilder(builder: (context, box) {
                      final w = (box.maxWidth - 12) / 2;
                      return Wrap(spacing: 12, runSpacing: 20, children: [
                        for (final (m, s) in dishes) DishCard(item: m, stall: s, width: w, showStall: true),
                      ]);
                    }),
                  ),
                ],
              ],
            ),
    );
  }
}
