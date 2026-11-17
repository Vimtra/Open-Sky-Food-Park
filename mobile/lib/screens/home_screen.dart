import 'package:material_ui/material_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/reveal.dart';
import '../ui/routes.dart';
import '../ui/widgets.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = app.catalog;
    final park = c.park;
    final bannerItems = c.banners.map((b) => b.menuItemId).whereType<String>().toSet();

    return CustomScrollView(
      slivers: [
        const SliverToBoxAdapter(child: DemoNotice()),
        // Truck cards overlap the bottom 72px of the photo, like the website.
        SliverToBoxAdapter(
          child: LayoutBuilder(builder: (context, _) {
            final heroH = _Hero.height(context);
            const overlap = 72.0, cardH = 168.0, gap = 12.0;
            final cardsH = c.stalls.length * (cardH + gap);
            return SizedBox(
              height: heroH - overlap + cardsH + 28,
              child: Stack(
                children: [
                  _Hero(park: park),
                  Positioned(
                    left: 16,
                    right: 16,
                    top: heroH - overlap,
                    child: Column(children: [
                      for (final (i, s) in c.stalls.indexed)
                        Padding(
                          padding: const EdgeInsets.only(bottom: gap),
                          child: Reveal(
                            delay: Duration(milliseconds: 270 + 90 * i),
                            child: TruckCard(stall: s, itemCount: c.itemsByStall[s.id]?.length ?? 0),
                          ),
                        ),
                    ]),
                  ),
                ],
              ),
            );
          }),
        ),
        SliverList.list(
          children: [
            if (park.announcement != null) _notice(park.announcement!),
            if (!park.orderingEnabled) _notice('The park is not taking online orders right now. You can still browse the menus.'),
            if (c.cravings.isNotEmpty)
              Rail(
                title: "What's on your mind?",
                height: 120,
                spacing: 16,
                children: [
                  for (final cr in c.cravings)
                    Pressable(
                      semanticLabel: cr.name,
                      onTap: () => openSearch(context, craving: cr.slug),
                      child: SizedBox(
                        width: 80,
                        child: Column(children: [
                          ClipOval(child: FoodImage(cr.imageUrl, width: 80, height: 80)),
                          const SizedBox(height: 8),
                          Text(cr.name, maxLines: 2, textAlign: TextAlign.center, style: OsText.weight(OsText.small, 600).copyWith(color: OsColors.ink700, height: 1.2)),
                        ]),
                      ),
                    ),
                ],
              ),
            const SizedBox(height: 40),
            _HowItWorks(tableService: park.tableServiceEnabled),
            const SizedBox(height: 40),
            if (c.banners.isNotEmpty) ...[
              Rail(
                title: 'Combos and specials',
                height: 300,
                children: [
                  for (final b in c.banners)
                    if (c.itemById[b.menuItemId] case final item?)
                      if (c.stallById[item.stallId] case final stall?)
                        SizedBox(
                          width: 236,
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Pressable(
                              scale: 0.98,
                              semanticLabel: b.title,
                              onTap: () => openDish(context, stall, item),
                              child: FoodImage(b.imageUrl, radius: OsRadius.lg, width: 236, height: 220),
                            ),
                            const SizedBox(height: 10),
                            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(b.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 700)),
                                  Text('${b.subtitle ?? stall.name} · ${money(item.priceCents)}',
                                      maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.small.copyWith(fontFeatures: OsText.tabular)),
                                ]),
                              ),
                              const SizedBox(width: 8),
                              AddButton(item: item, stall: stall),
                            ]),
                          ]),
                        ),
                ],
              ),
              const SizedBox(height: 32),
            ],
            for (final s in c.stalls) ..._stallRail(context, c, s, bannerItems),
            const SizedBox(height: 96),
          ],
        ),
      ],
    );
  }

  List<Widget> _stallRail(BuildContext context, Catalog c, Stall s, Set<String> exclude) {
    final picks = (c.itemsByStall[s.id] ?? []).where((m) => m.imageUrl != null && !exclude.contains(m.id)).toList()
      ..sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
    if (picks.length < 3) return const [];
    return [
      Rail(
        title: 'From ${s.name}',
        action: 'Full menu',
        onAction: () => openStall(context, s),
        children: [for (final m in picks.take(10)) DishCard(item: m, stall: s)],
      ),
      const SizedBox(height: 32),
    ];
  }

  Widget _notice(String text) => Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: OsColors.ember50, borderRadius: BorderRadius.circular(OsRadius.md), border: Border.all(color: OsColors.ember100)),
        child: Text(text, style: OsText.weight(OsText.label, 500)),
      );
}

/// Night park photo with the logo and headline centred over a navy scrim.
class _Hero extends StatelessWidget {
  const _Hero({required this.park});
  final Park park;

  /// The demo strip above already clears the status bar; without it the hero does.
  static double _top(BuildContext context) => AppState.demo ? 0 : MediaQuery.paddingOf(context).top;
  static double height(BuildContext context) => 490 + _top(context);

  @override
  Widget build(BuildContext context) {
    final top = _top(context);
    return SizedBox(
      height: height(context),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset('assets/hero/park-night.jpg', fit: BoxFit.cover, alignment: const Alignment(0.2, 0)),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xB30B1230), Color(0x8C0B1230), Color(0x800B1230), Color(0xD90B1230)],
                stops: [0, 0.35, 0.65, 1],
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, top + 14, 16, 96),
            child: Column(
              children: [
                const _SearchBar(),
                const SizedBox(height: 18),
                Reveal(child: Image.asset('assets/brand/logo-full.png', width: 216, semanticLabel: park.name)),
                const SizedBox(height: 18),
                Reveal(
                  delay: const Duration(milliseconds: 90),
                  child: Text('Every truck. One cart.', textAlign: TextAlign.center, style: OsText.hero.copyWith(color: Colors.white)),
                ),
                const SizedBox(height: 10),
                Reveal(
                  delay: const Duration(milliseconds: 180),
                  child: Text(
                    'Order from every truck at the park, pay once, then pick up with your token${park.tableServiceEnabled ? ' or have it brought to your table' : ''}.',
                    textAlign: TextAlign.center,
                    style: OsText.weight(OsText.body, 400).copyWith(color: Colors.white.withValues(alpha: 0.85), fontSize: 15, height: 1.45),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The search bar at the top of Home. Tapping opens search with recent searches and filters.
class _SearchBar extends StatelessWidget {
  const _SearchBar();

  @override
  Widget build(BuildContext context) => Pressable(
        scale: 0.98,
        semanticLabel: 'Search dishes and trucks',
        onTap: () => openSearch(context),
        child: Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: OsColors.surface0,
            borderRadius: BorderRadius.circular(OsRadius.lg),
            boxShadow: const [BoxShadow(color: Color(0x4D070B1F), blurRadius: 24, offset: Offset(0, 10), spreadRadius: -8)],
          ),
          child: Row(children: [
            const Icon(Icons.search, color: OsColors.ink700),
            const SizedBox(width: 10),
            Expanded(child: Text('Search dishes and trucks', style: OsText.weight(OsText.body, 500).copyWith(color: OsColors.ink500))),
            Container(width: 1, height: 22, color: OsColors.line),
            const SizedBox(width: 12),
            const Icon(Icons.tune, color: OsColors.ember700, size: 20),
          ]),
        ),
      );
}

/// B's "How it works": giant ember numerals with a title and one line.
class _HowItWorks extends StatelessWidget {
  const _HowItWorks({required this.tableService});
  final bool tableService;

  @override
  Widget build(BuildContext context) {
    final steps = [
      ('Fill one cart', 'Add dishes from any truck.'),
      ('Pay once', 'One checkout for the whole order.'),
      ('Collect with your token', tableService ? 'Each truck gives you a token. Pick up, or have it brought to your table.' : "Each truck gives you a token. Pick up when it's ready."),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('How it works', style: OsText.title),
          const SizedBox(height: 16),
          for (final (i, (title, body)) in steps.indexed)
            Reveal(
              delay: Duration(milliseconds: 90 * i),
              onScroll: true,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(
                  children: [
                    SizedBox(
                      width: 52,
                      child: ShaderMask(
                        shaderCallback: (r) => const LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [OsColors.ember400, OsColors.ember700],
                        ).createShader(r),
                        child: Text('${i + 1}', style: OsText.stepNumber.copyWith(color: Colors.white)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(title, style: OsText.subheading),
                        const SizedBox(height: 2),
                        Text(body, style: OsText.weight(OsText.small, 400)),
                      ]),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
