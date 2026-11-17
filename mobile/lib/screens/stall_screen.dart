import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/routes.dart';
import '../ui/widgets.dart';

class StallScreen extends StatefulWidget {
  const StallScreen({super.key, required this.stallId, this.scrollToCategory});
  final String stallId;
  final String? scrollToCategory;

  @override
  State<StallScreen> createState() => _StallScreenState();
}

class _StallScreenState extends State<StallScreen> {
  final _query = TextEditingController();
  final _diets = <Diet>{};
  final _sectionKeys = <String, GlobalKey>{};
  String? _active;

  @override
  void initState() {
    super.initState();
    _query.addListener(() => setState(() {}));
    if (widget.scrollToCategory != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _jump(widget.scrollToCategory!));
    }
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _jump(String categoryId) {
    final ctx = _sectionKeys[categoryId]?.currentContext;
    if (ctx == null) return;
    setState(() => _active = categoryId);
    Scrollable.ensureVisible(ctx, duration: OsMotion.page, curve: OsMotion.move, alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtStart);
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = app.catalog;
    final stall = c.stallById[widget.stallId];
    if (stall == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: Text('This truck is not at the park.')));
    }
    final items = c.itemsByStall[stall.id] ?? const <MenuItem>[];
    final dietsOnMenu = Diet.values.where((d) => items.any((m) => m.diet == d)).toList();
    final q = _query.text.trim().toLowerCase();
    final sections = [
      for (final cat in c.categoriesByStall[stall.id] ?? const <MenuCategory>[])
        (
          cat,
          items
              .where((m) =>
                  m.categoryId == cat.id &&
                  (_diets.isEmpty || (m.diet != null && _diets.contains(m.diet))) &&
                  (q.isEmpty || m.name.toLowerCase().contains(q) || cat.name.toLowerCase().contains(q)))
              .toList(),
        ),
    ].where((s) => s.$2.isNotEmpty).toList();
    for (final (cat, _) in sections) {
      _sectionKeys.putIfAbsent(cat.id, GlobalKey.new);
    }

    // White status-bar icons over the cover photo.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _StallHero(stall: stall)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: Wrap(spacing: 16, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    OpenStatus(stall),
                    if (stall.locationLabel != null) _meta(Icons.place_outlined, stall.locationLabel!),
                    if (stall.phone != null) _meta(Icons.call_outlined, stall.phone!),
                    if (stall.instagram != null) _meta(Icons.alternate_email, stall.instagram!),
                  ]),
                ),
              ),
              if (!stall.isOpen)
                SliverToBoxAdapter(
                  child: Container(
                    margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: OsColors.ember50, borderRadius: BorderRadius.circular(OsRadius.md)),
                    child: Text('${stall.name} is closed right now, so its dishes cannot be added. You can still look through the menu.', style: OsText.weight(OsText.label, 500)),
                  ),
                ),
              SliverPersistentHeader(
                pinned: true,
                delegate: _FilterBar(
                  height: 112,
                  child: Container(
                    color: OsColors.surface0,
                    child: Column(children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                        child: Row(children: [
                          Expanded(
                            child: SizedBox(
                              height: 44,
                              child: TextField(
                                controller: _query,
                                textInputAction: TextInputAction.search,
                                decoration: InputDecoration(
                                  hintText: 'Search in ${stall.name}',
                                  filled: true,
                                  fillColor: OsColors.surface1,
                                  prefixIcon: const Icon(Icons.search, size: 20, color: OsColors.ink500),
                                  suffixIcon: _query.text.isEmpty ? null : IconButton(icon: const Icon(Icons.close, size: 18), tooltip: 'Clear search', onPressed: _query.clear),
                                  contentPadding: EdgeInsets.zero,
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(OsRadius.md), borderSide: BorderSide.none),
                                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(OsRadius.md), borderSide: BorderSide.none),
                                ),
                              ),
                            ),
                          ),
                          for (final d in dietsOnMenu) ...[
                            const SizedBox(width: 6),
                            FilterChip(
                              label: DietMark(d),
                              tooltip: dietLabel(d),
                              selected: _diets.contains(d),
                              selectedColor: OsColors.surface2,
                              side: BorderSide(color: _diets.contains(d) ? OsColors.night900 : OsColors.line),
                              materialTapTargetSize: MaterialTapTargetSize.padded,
                              onSelected: (on) => setState(() => on ? _diets.add(d) : _diets.remove(d)),
                            ),
                          ],
                        ]),
                      ),
                      SizedBox(
                        height: 52,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          children: [
                            for (final (cat, list) in sections)
                              _Tab(
                                label: cat.name,
                                count: list.length,
                                active: (_active ?? sections.first.$1.id) == cat.id,
                                onTap: () => _jump(cat.id),
                              ),
                          ],
                        ),
                      ),
                      const Divider(),
                    ]),
                  ),
                ),
              ),
              if (sections.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(40),
                    child: Column(children: [
                      Text(q.isNotEmpty || _diets.isNotEmpty ? 'No dishes match' : 'This menu is empty for now', style: OsText.subheading),
                      if (q.isNotEmpty || _diets.isNotEmpty)
                        TextButton(
                          onPressed: () => setState(() {
                            _query.clear();
                            _diets.clear();
                          }),
                          child: const Text('Clear filters'),
                        ),
                    ]),
                  ),
                ),
              for (final (cat, list) in sections) ...[
                SliverToBoxAdapter(
                  key: _sectionKeys[cat.id],
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 4),
                    child: Text.rich(TextSpan(children: [
                      TextSpan(text: cat.name, style: OsText.weight(OsText.subheading, 800)),
                      TextSpan(text: '  (${list.length})', style: OsText.weight(OsText.subheading, 600).copyWith(color: OsColors.ink500)),
                    ])),
                  ),
                ),
                SliverList.separated(
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Divider()),
                  itemBuilder: (_, i) => MenuRow(item: list[i], stall: stall),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 8, child: ColoredBox(color: OsColors.surface1))),
              ],
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
                  child: Text('${plural(items.length, 'dish', 'dishes')} on this menu. Ask the truck about ingredients and allergens before you order.', style: OsText.small),
                ),
              ),
            ],
          ),
          const Positioned(left: 0, right: 0, bottom: 0, child: SafeArea(top: false, child: CartBar())),
        ],
      ),
      ),
    );
  }

  Widget _meta(IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 16, color: OsColors.ink700),
        const SizedBox(width: 4),
        Text(text, style: OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink700)),
      ]);
}

class _StallHero extends StatelessWidget {
  const _StallHero({required this.stall});
  final Stall stall;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return SizedBox(
      height: 240 + top,
      child: Stack(fit: StackFit.expand, children: [
        FoodImage(stall.coverUrl, greyed: !stall.isOpen),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0x800B1230), Color(0x000B1230), Color(0x590B1230), Color(0xE60B1230)],
              stops: [0, 0.3, 0.6, 1],
            ),
          ),
        ),
        Positioned(
          top: top + 4,
          left: 8,
          child: IconButton(
            tooltip: 'Back',
            onPressed: () => Navigator.of(context).maybePop(),
            style: IconButton.styleFrom(backgroundColor: const Color(0x660B1230), foregroundColor: Colors.white),
            icon: const Icon(Icons.arrow_back),
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 16,
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            if (stall.logoUrl != null)
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2), color: Colors.white),
                child: ClipOval(child: FoodImage(stall.logoUrl)),
              ),
            if (stall.logoUrl != null) const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(stall.name, style: OsText.title.copyWith(color: Colors.white)),
                if (stall.tagline != null) Text(stall.tagline!, style: OsText.weight(OsText.label, 600).copyWith(color: Colors.white.withValues(alpha: 0.9))),
                Text(stall.cuisines.join(' · '), style: OsText.weight(OsText.small, 500).copyWith(color: Colors.white.withValues(alpha: 0.75))),
              ]),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.label, required this.count, required this.active, required this.onTap});
  final String label;
  final int count;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: AnimatedContainer(
          duration: OsMotion.press,
          margin: const EdgeInsets.only(right: 20),
          padding: const EdgeInsets.only(top: 14),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: active ? OsColors.ember500 : Colors.transparent, width: 3))),
          child: Text.rich(TextSpan(children: [
            TextSpan(text: label, style: OsText.weight(OsText.label, active ? 700 : 600).copyWith(color: active ? OsColors.ink900 : OsColors.ink500)),
            TextSpan(text: ' $count', style: OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink500)),
          ])),
        ),
      );
}

class _FilterBar extends SliverPersistentHeaderDelegate {
  _FilterBar({required this.child, required this.height});
  final Widget child;
  final double height;
  @override
  double get minExtent => height;
  @override
  double get maxExtent => height;
  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => child;
  @override
  bool shouldRebuild(_FilterBar old) => true;
}

/// One dish on a menu: name, price, "Serves N | description", photo with ADD.
class MenuRow extends StatelessWidget {
  const MenuRow({super.key, required this.item, required this.stall});
  final MenuItem item;
  final Stall stall;

  @override
  Widget build(BuildContext context) {
    final blurb = item.blurb;
    return InkWell(
      onTap: () => openDish(context, stall, item),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 22),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Opacity(
              opacity: item.isAvailable ? 1 : 0.6,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                DietMark(item.diet),
                const SizedBox(height: 4),
                Text(item.name, style: OsText.weight(OsText.bodyStrong, 700).copyWith(fontSize: 17)),
                const SizedBox(height: 2),
                Text(money(item.priceCents), style: OsText.weight(OsText.label, 600).copyWith(fontSize: 15, fontFeatures: OsText.tabular)),
                if (blurb != null) ...[
                  const SizedBox(height: 6),
                  Text(blurb, maxLines: 2, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 400).copyWith(color: OsColors.ink500)),
                ],
              ]),
            ),
          ),
          const SizedBox(width: 16),
          if (item.imageUrl != null)
            SizedBox(
              width: 120,
              height: 132,
              child: Stack(alignment: Alignment.topCenter, clipBehavior: Clip.none, children: [
                FoodImage(item.imageUrl, radius: OsRadius.lg, width: 120, height: 116, greyed: !item.isAvailable),
                Positioned(bottom: 0, child: AddButton(item: item, stall: stall)),
              ]),
            )
          else
            AddButton(item: item, stall: stall),
        ]),
      ),
    );
  }
}
