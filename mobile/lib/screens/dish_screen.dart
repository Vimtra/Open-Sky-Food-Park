import 'package:material_ui/material_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/routes.dart';
import '../ui/widgets.dart';

/// One dish: big photo, details, ADD, then more from its section, its truck and the other trucks.
class DishScreen extends StatelessWidget {
  const DishScreen({super.key, required this.itemId});
  final String itemId;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = app.catalog;
    final item = c.itemById[itemId];
    final stall = item == null ? null : c.stallById[item.stallId];
    if (item == null || stall == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: Text('We could not find this dish.')));
    }
    final category = c.categoryById[item.categoryId];
    final park = c.park;
    final blurb = item.blurb;

    bool usable(MenuItem m) => m.id != item.id && m.isAvailable && m.imageUrl != null;
    int featuredFirst(MenuItem a, MenuItem b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
    final own = (c.itemsByStall[stall.id] ?? const <MenuItem>[]).where(usable).toList();
    final sameSection = own.where((m) => m.categoryId == item.categoryId).take(10).toList();
    final shown = sameSection.map((m) => m.id).toSet();
    final sameTruck = (own.where((m) => !shown.contains(m.id)).toList()..sort(featuredFirst)).take(10).toList();
    final others = [
      for (final s in c.stalls.where((s) => s.id != stall.id))
        (s, ((c.itemsByStall[s.id] ?? const <MenuItem>[]).where(usable).toList()..sort(featuredFirst)).take(10).toList()),
    ].where((g) => g.$2.isNotEmpty).toList();

    return Scaffold(
      body: Stack(children: [
        CustomScrollView(slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: MediaQuery.sizeOf(context).width,
            backgroundColor: OsColors.surface0,
            foregroundColor: OsColors.ink900,
            leading: Padding(
              padding: const EdgeInsets.all(6),
              child: IconButton(
                tooltip: 'Back',
                style: IconButton.styleFrom(backgroundColor: OsColors.surface0.withValues(alpha: 0.9)),
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back),
              ),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: FoodImage(item.imageUrl, greyed: !item.isAvailable),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Breadcrumb: Home › truck › dish
                Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: [
                  _crumb('Home', () => Navigator.of(context).popUntil((r) => r.isFirst)),
                  const Icon(Icons.chevron_right, size: 14, color: OsColors.ink500),
                  _crumb(stall.name, () => openStall(context, stall)),
                ]),
                const SizedBox(height: 6),
                Text(item.name, style: OsText.title),
                const SizedBox(height: 10),
                Row(children: [
                  if (item.diet != null) ...[
                    DietMark(item.diet),
                    const SizedBox(width: 6),
                    Text(dietLabel(item.diet!), style: OsText.weight(OsText.label, 600).copyWith(color: OsColors.ink700)),
                    if (category != null) const Text('  ·  ', style: TextStyle(color: OsColors.ink300)),
                  ],
                  if (category != null)
                    GestureDetector(
                      onTap: () => openStall(context, stall, categoryId: category.id),
                      child: Text(category.name, style: OsText.weight(OsText.label, 600).copyWith(color: OsColors.ink700)),
                    ),
                ]),
                const SizedBox(height: 8),
                Text(money(item.priceCents), style: OsText.title.copyWith(fontFeatures: OsText.tabular)),
                if (blurb != null) ...[
                  const SizedBox(height: 6),
                  Text(blurb, style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
                ],
                const SizedBox(height: 12),
                Row(children: [
                  GestureDetector(
                    onTap: () => openStall(context, stall),
                    child: Text(stall.name,
                        style: OsText.weight(OsText.label, 700).copyWith(color: OsColors.ember700, decoration: TextDecoration.underline, decorationColor: OsColors.ember700.withValues(alpha: 0.4))),
                  ),
                  const Text('  ·  ', style: TextStyle(color: OsColors.ink300)),
                  OpenStatus(stall),
                ]),
                Text(stall.cuisines.join(', '), style: OsText.small),
                const SizedBox(height: 18),
                AddButton(item: item, stall: stall, large: true),
                if (!item.isAvailable || !stall.isOpen) ...[
                  const SizedBox(height: 8),
                  Text(item.isAvailable ? '${stall.name} is closed right now.' : 'This dish is sold out right now.', style: OsText.small),
                ],
                const SizedBox(height: 20),
                const Divider(),
                const SizedBox(height: 16),
                _step(Icons.storefront_outlined, 'Made at ', '${stall.name}${stall.locationLabel != null ? ', ${stall.locationLabel}' : ''}', line: true),
                _step(park.tableServiceEnabled ? Icons.chair_outlined : Icons.confirmation_number_outlined, 'Collect ',
                    'with your token at the truck${park.tableServiceEnabled ? ', or have it brought to your table' : ''}'),
                const SizedBox(height: 14),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.info_outline, size: 16, color: OsColors.ink500),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Ask the truck about ingredients and allergens before you order.', style: OsText.small)),
                ]),
                const SizedBox(height: 36),
              ]),
            ),
          ),
          SliverList.list(children: [
            if (sameSection.isNotEmpty) ...[
              Rail(title: category != null ? 'More ${category.name}' : 'More from ${stall.name}', children: [for (final m in sameSection) DishCard(item: m, stall: stall)]),
              const SizedBox(height: 32),
            ],
            if (sameTruck.isNotEmpty) ...[
              Rail(
                title: 'More from ${stall.name}',
                action: 'Full menu',
                onAction: () => openStall(context, stall),
                children: [for (final m in sameTruck) DishCard(item: m, stall: stall)],
              ),
              const SizedBox(height: 32),
            ],
            for (final (s, list) in others) ...[
              Rail(
                title: 'Also at the park: ${s.name}',
                action: 'Full menu',
                onAction: () => openStall(context, s),
                children: [for (final m in list) DishCard(item: m, stall: s)],
              ),
              const SizedBox(height: 32),
            ],
            const SizedBox(height: 80),
          ]),
        ]),
        const Positioned(left: 0, right: 0, bottom: 0, child: SafeArea(top: false, child: CartBar())),
      ]),
    );
  }

  Widget _crumb(String text, VoidCallback onTap) => InkWell(
        onTap: onTap,
        child: Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text(text, style: OsText.weight(OsText.small, 500))),
      );

  Widget _step(IconData icon, String bold, String rest, {bool line = false}) => IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Column(children: [
            Icon(icon, size: 20, color: OsColors.ink700),
            if (line) const Expanded(child: VerticalDivider(color: OsColors.lineStrong, width: 20, thickness: 1)),
          ]),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: line ? 14 : 0),
              child: Text.rich(TextSpan(children: [
                TextSpan(text: bold, style: OsText.weight(OsText.label, 700)),
                TextSpan(text: rest, style: OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink700)),
              ])),
            ),
          ),
        ]),
      );
}
