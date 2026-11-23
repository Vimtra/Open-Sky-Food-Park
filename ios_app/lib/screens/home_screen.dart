import 'dart:async';
import 'dart:math';

import 'package:cupertino_ui/cupertino_ui.dart';
import 'package:flutter/services.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/kit.dart';
import '../ui/park_art.dart';
import 'account_screen.dart';
import 'dish_sheet.dart';
import 'search_screen.dart';

/// Home. A night-sky band on top with the trucks as big tabs (All · each truck), a search bar
/// with rotating dish hints, a VEG switch, filter chips and a poster carousel. Below it, either
/// the whole park (cravings, rails, trucks) or the chosen truck's menu.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _scroll = ScrollController();

  /// null = all trucks.
  String? _stallId;

  /// A craving slug (all trucks) or a menu category id (one truck). null = everything.
  String? _filter;

  void _pickStall(String? id) {
    if (id == _stallId) return;
    HapticFeedback.selectionClick();
    setState(() {
      _stallId = id;
      _filter = null;
    });
    if (_scroll.hasClients) _scroll.animateTo(0, duration: OsMotion.page, curve: OsMotion.move);
  }

  void _pickFilter(String? f) {
    HapticFeedback.selectionClick();
    setState(() => _filter = f == _filter ? null : f);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final cat = state.catalog;
    final stall = _stallId == null ? null : cat.stallById[_stallId];

    return CupertinoPageScaffold(
      backgroundColor: OsColors.surface0,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: CustomScrollView(
          controller: _scroll,
          slivers: [
            SliverToBoxAdapter(
              child: _NightBand(
                stallId: _stallId,
                filter: _filter,
                onStall: _pickStall,
                onFilter: _pickFilter,
              ),
            ),
            if (stall == null) ..._parkBody(context, state) else ..._truckBody(context, state, stall),
            SliverToBoxAdapter(child: _Signoff(bottomInset: MediaQuery.paddingOf(context).bottom)),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- all trucks

  List<Widget> _parkBody(BuildContext context, AppState state) {
    final cat = state.catalog;
    if (_filter != null) {
      final craving = cat.cravings.where((c) => c.slug == _filter).firstOrNull;
      final items = cat.items.where((m) => m.craving == _filter && state.vegOk(m)).toList();
      return [
        SliverToBoxAdapter(child: SectionTitle(craving?.name ?? 'Dishes', action: 'Clear', onAction: () => _pickFilter(null))),
        _DishGrid(items: items),
      ];
    }

    final featured = cat.items.where((m) => m.isFeatured && m.imageUrl != null && state.vegOk(m)).toList();
    final under10 = cat.items.where((m) => m.priceCents < 1000 && m.imageUrl != null && m.isAvailable && state.vegOk(m)).toList()
      ..sort((a, b) => a.priceCents.compareTo(b.priceCents));
    final hearts = cat.items.where((m) => state.isFavouriteItem(m.id)).toList();

    return [
      if (cat.park.announcement != null)
        SliverToBoxAdapter(
          child: Container(
            margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: OsColors.ember50, borderRadius: BorderRadius.circular(OsRadius.lg)),
            child: Row(children: [
              const Icon(CupertinoIcons.speaker_2_fill, color: OsColors.ember700, size: 18),
              const SizedBox(width: 10),
              Expanded(child: Text(cat.park.announcement!, style: OsText.label)),
            ]),
          ),
        ),
      const SliverToBoxAdapter(child: SectionTitle("What's on your mind?")),
      SliverToBoxAdapter(child: _CravingGrid(onPick: _pickFilter)),
      if (hearts.isNotEmpty) ...[
        const SliverToBoxAdapter(child: SectionTitle('Your favourites')),
        SliverToBoxAdapter(child: _DishRail(items: hearts)),
      ],
      const SliverToBoxAdapter(child: SectionTitle('Fresh off the trucks')),
      SliverToBoxAdapter(child: _DishRail(items: featured)),
      SliverToBoxAdapter(child: SectionTitle('Trucks at Open Sky', action: '${cat.stalls.where((s) => s.isOpen).length} open')),
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverList.separated(
          itemCount: cat.stalls.length,
          separatorBuilder: (_, _) => const SizedBox(height: 16),
          itemBuilder: (_, i) => _TruckCard(stall: cat.stalls[i], onTap: () => _pickStall(cat.stalls[i].id)),
        ),
      ),
      if (under10.isNotEmpty) ...[
        const SliverToBoxAdapter(child: SectionTitle('Under \$10')),
        SliverToBoxAdapter(child: _DishRail(items: under10.take(12).toList())),
      ],
    ];
  }

  // ---------------------------------------------------------------- one truck

  List<Widget> _truckBody(BuildContext context, AppState state, Stall stall) {
    final cat = state.catalog;
    final sections = [
      for (final c in cat.categoriesByStall[stall.id] ?? const <MenuCategory>[])
        if (_filter == null || _filter == c.id)
          (c, (cat.itemsByStall[stall.id] ?? const <MenuItem>[]).where((m) => m.categoryId == c.id && state.vegOk(m)).toList()),
    ].where((s) => s.$2.isNotEmpty).toList();

    return [
      SliverToBoxAdapter(child: _TruckHeader(stall: stall)),
      if (sections.isEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 40, 24, 0),
            child: Text(state.vegOnly ? 'No veg dishes here. Switch VEG off to see the full menu.' : 'Nothing on this menu yet.',
                textAlign: TextAlign.center, style: OsText.body.copyWith(color: OsColors.ink500)),
          ),
        ),
      for (final (c, items) in sections) ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 26, 16, 4),
            child: Row(children: [
              Expanded(child: Text(c.name, style: OsText.heading)),
              Text('${items.length}', style: OsText.small),
            ]),
          ),
        ),
        SliverList.separated(
          itemCount: items.length,
          separatorBuilder: (_, _) => const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: SizedBox(height: 1, child: ColoredBox(color: OsColors.line))),
          itemBuilder: (_, i) => _MenuRow(item: items[i]),
        ),
      ],
    ];
  }
}

// ==================================================================== the night band

class _NightBand extends StatelessWidget {
  const _NightBand({required this.stallId, required this.filter, required this.onStall, required this.onFilter});

  final String? stallId, filter;
  final ValueChanged<String?> onStall;
  final ValueChanged<String?> onFilter;

  static const _panel = OsColors.night800;

  /// Truck body colours, in park order (same as the Android app).
  static const _truckColors = [Color(0xFFD9442B), Color(0xFFE2558E), Color(0xFF2E9E6A), Color(0xFF3A6FD8)];

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final cat = state.catalog;
    final top = MediaQuery.paddingOf(context).top;
    final tabs = <({String? id, String label, String? image, Color? color})>[
      (id: null, label: 'All trucks', image: null, color: null),
      for (final (i, s) in cat.stalls.indexed) (id: s.id, label: s.name, image: s.logoUrl, color: _truckColors[i % _truckColors.length]),
    ];
    final selectedIndex = tabs.indexWhere((t) => t.id == stallId);

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [OsColors.night950, OsColors.night900],
        ),
      ),
      padding: EdgeInsets.only(top: top + 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ---- where you are + profile
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 16, 18),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Flexible(
                          child: Text(cat.park.name, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.heading, 800).copyWith(color: OsColors.surface0)),
                        ),
                        const SizedBox(width: 4),
                        const Icon(CupertinoIcons.chevron_right, size: 16, color: OsColors.surface0),
                      ]),
                      const SizedBox(height: 2),
                      Row(children: [
                        const Icon(CupertinoIcons.location_solid, size: 13, color: OsColors.nightMuted),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(cat.park.address ?? 'Milpitas, CA', overflow: TextOverflow.ellipsis, style: OsText.label.copyWith(color: OsColors.nightMuted, fontWeight: FontWeight.w500)),
                        ),
                      ]),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                _Avatar(account: state.account),
              ],
            ),
          ),

          // ---- string lights over the truck lot
          SizedBox(
            height: 18,
            child: LoopClock(period: const Duration(seconds: 3), builder: (_, t) => CustomPaint(painter: StringLightsPainter(t))),
          ),
          const SizedBox(height: 4),

          // ---- the trucks as tabs
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < tabs.length; i++)
                  Expanded(
                    child: _TruckTab(
                      label: tabs[i].label,
                      image: tabs[i].image,
                      color: tabs[i].color,
                      selected: i == selectedIndex,
                      onTap: () => onStall(tabs[i].id),
                    ),
                  ),
              ],
            ),
          ),

          // ---- the panel under the selected tab
          AnimatedContainer(
            duration: OsMotion.popover,
            curve: OsMotion.enter,
            margin: const EdgeInsets.symmetric(horizontal: 12),
            padding: const EdgeInsets.fromLTRB(12, 14, 12, 16),
            decoration: BoxDecoration(
              color: _panel,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(selectedIndex == 0 ? 0 : 22),
                topRight: Radius.circular(selectedIndex == tabs.length - 1 ? 0 : 22),
                bottomLeft: const Radius.circular(28),
                bottomRight: const Radius.circular(28),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _SearchRow(stallId: stallId),
                const SizedBox(height: 14),
                _FilterChips(stallId: stallId, selected: filter, onPick: onFilter),
                const SizedBox(height: 10),
                const _MascotBanner(),
                const SizedBox(height: 12),
                _PosterCarousel(stallId: stallId),
              ],
            ),
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.account});
  final Account? account;

  @override
  Widget build(BuildContext context) => Press(
        semanticLabel: account == null ? 'Sign in' : 'Your account',
        onTap: () => Navigator.of(context).push(CupertinoPageRoute<void>(builder: (_) => const AccountScreen())),
        child: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: OsColors.night700,
            border: Border.all(color: const Color(0x33FFFFFF)),
          ),
          alignment: Alignment.center,
          child: account == null
              ? const Icon(CupertinoIcons.person_fill, color: OsColors.surface0, size: 22)
              : Text(account!.initials, style: OsText.weight(OsText.bodyStrong, 800).copyWith(color: OsColors.ember400)),
        ),
      );
}

/// A truck tab: the drawn truck (or the ALL park sign) parked on the lot. Selecting it lights the
/// serving window and the truck hops once.
class _TruckTab extends StatelessWidget {
  const _TruckTab({required this.label, required this.image, required this.color, required this.selected, required this.onTap});

  final String label;
  final String? image;
  final Color? color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = color;
    final picture = LayoutBuilder(builder: (context, box) {
      // Cap the truck so it fits the tab height on wide screens (iPad) too.
      final w = box.maxWidth.clamp(0.0, 94.0);
      final size = Size(w, w * 78 / 116);
      return Center(child: TweenAnimationBuilder<double>(
        key: ValueKey('$label-$selected'),
        tween: Tween(begin: 0, end: selected ? 1 : 0),
        duration: selected ? const Duration(milliseconds: 420) : OsMotion.popover,
        curve: OsMotion.enter,
        builder: (context, v, _) => Transform.translate(
          offset: Offset(0, selected ? -sin(pi * v) * 7 : 0),
          child: SizedBox.fromSize(
            size: size,
            child: c == null
                ? LoopClock(period: const Duration(seconds: 2), builder: (_, t) => CustomPaint(size: size, painter: ParkSignPainter(lit: selected, t: t)))
                : Stack(children: [
                    CustomPaint(size: size, painter: TruckPainter(body: c, lit: selected, glow: selected ? v.clamp(0.0, 1.0) : 0)),
                    if (image != null)
                      Positioned.fromRect(
                        rect: TruckPainter.logoRect(size),
                        child: Container(
                          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: OsColors.surface0, width: 1.5)),
                          child: ClipOval(child: FoodImage(image)),
                        ),
                      ),
                  ]),
          ),
        ),
      ));
    });

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Semantics(
        selected: selected,
        button: true,
        label: label,
        child: AnimatedContainer(
          duration: OsMotion.popover,
          curve: OsMotion.enter,
          height: selected ? 116 : 106,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
          decoration: BoxDecoration(
            color: selected ? _NightBand._panel : const Color(0x14FFFFFF),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              SizedBox(height: 64, child: picture),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: OsText.weight(OsText.caption, selected ? 800 : 600).copyWith(color: selected ? OsColors.surface0 : OsColors.nightMuted, fontSize: 12.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The park's promise between two dancing mascots (the pulka and the falooda, shared with the Android app).
class _MascotBanner extends StatelessWidget {
  const _MascotBanner();

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const Mascot(kind: 'pulka', size: Size(64, 86)),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('EVERY TRUCK',
                    textAlign: TextAlign.center, style: OsText.weight(OsText.heading, 800).copyWith(color: OsColors.surface0, fontSize: 19, letterSpacing: 1.2)),
                Text('ONE CART',
                    textAlign: TextAlign.center,
                    style: OsText.weight(OsText.hero, 800).copyWith(color: OsColors.ember400, fontSize: 34, height: 1.0, letterSpacing: 0.6)),
                const SizedBox(height: 6),
                Text('Pay once. A token from each truck.', textAlign: TextAlign.center, style: OsText.weight(OsText.small, 600).copyWith(color: OsColors.nightMuted)),
              ],
            ),
          ),
          const Mascot(kind: 'falooda', size: Size(64, 86)),
        ],
      );
}

/// Search box with a hint that rolls through real dish names, plus the VEG switch.
class _SearchRow extends StatefulWidget {
  const _SearchRow({required this.stallId});
  final String? stallId;

  @override
  State<_SearchRow> createState() => _SearchRowState();
}

class _SearchRowState extends State<_SearchRow> {
  Timer? _timer;
  int _i = 0;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 2600), (_) {
      if (mounted) setState(() => _i++);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final pool = state.catalog.items.where((m) => widget.stallId == null || m.stallId == widget.stallId).toList();
    final names = pool.where((m) => m.isFeatured).map((m) => m.name).toList();
    if (names.length < 4) names.addAll(pool.take(8).map((m) => m.name));
    final hint = names.isEmpty ? 'dishes' : _short(names[_i % names.length]);

    return Row(
      children: [
        Expanded(
          child: Press(
            scale: 0.98,
            semanticLabel: 'Search dishes and trucks',
            onTap: () => Navigator.of(context).push(CupertinoPageRoute<void>(builder: (_) => SearchScreen(stallId: widget.stallId))),
            child: Container(
              height: 54,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(color: OsColors.surface0, borderRadius: BorderRadius.circular(OsRadius.lg)),
              child: Row(
                children: [
                  const Icon(CupertinoIcons.search, color: OsColors.ink700, size: 21),
                  const SizedBox(width: 10),
                  Text('Search for ', style: OsText.body.copyWith(color: OsColors.ink500)),
                  Expanded(
                    child: ClipRect(
                      child: AnimatedSwitcher(
                        duration: OsMotion.sheet,
                        switchInCurve: OsMotion.enter,
                        switchOutCurve: OsMotion.exit,
                        transitionBuilder: (child, a) => SlideTransition(
                          position: Tween(begin: const Offset(0, 0.9), end: Offset.zero).animate(a),
                          child: FadeTransition(opacity: a, child: child),
                        ),
                        layoutBuilder: (cur, prev) => Stack(alignment: Alignment.centerLeft, children: [...prev, ?cur]),
                        child: Text(
                          "'$hint'",
                          key: ValueKey('$hint$_i'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: OsText.body.copyWith(color: OsColors.ink500),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        // VEG switch
        GestureDetector(
          onTap: () => AppScope.read(context).setVegOnly(!state.vegOnly),
          child: Container(
            width: 64,
            height: 54,
            decoration: BoxDecoration(color: OsColors.surface0, borderRadius: BorderRadius.circular(OsRadius.lg)),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('VEG', style: OsText.weight(OsText.caption, 800).copyWith(color: OsColors.ink900, letterSpacing: 0.8)),
                const SizedBox(height: 2),
                SizedBox(
                  height: 22,
                  child: FittedBox(
                    child: CupertinoSwitch(
                      value: state.vegOnly,
                      activeTrackColor: OsColors.leaf600,
                      onChanged: (v) {
                        HapticFeedback.selectionClick();
                        AppScope.read(context).setVegOnly(v);
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static String _short(String name) => name.replaceAll(' with Fresh Live Pulka', '');
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({required this.stallId, required this.selected, required this.onPick});
  final String? stallId, selected;
  final ValueChanged<String?> onPick;

  @override
  Widget build(BuildContext context) {
    final cat = AppScope.of(context).catalog;
    final chips = <(String?, String)>[
      (null, 'All'),
      if (stallId == null)
        for (final c in cat.cravings) (c.slug, c.name)
      else
        for (final c in cat.categoriesByStall[stallId] ?? const <MenuCategory>[]) (c.id, c.name),
    ];

    return SizedBox(
      height: 36,
      child: EdgeFade(
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: chips.length,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (_, i) {
            final (id, label) = chips[i];
            final on = id == selected;
            return Press(
              onTap: () => onPick(id),
              child: AnimatedContainer(
                duration: OsMotion.press,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: on ? OsColors.surface0 : const Color(0x14FFFFFF),
                  borderRadius: BorderRadius.circular(99),
                  border: Border.all(color: on ? OsColors.surface0 : const Color(0x29FFFFFF)),
                ),
                child: Text(
                  label.toUpperCase(),
                  style: OsText.weight(OsText.caption, 800).copyWith(color: on ? OsColors.night900 : OsColors.surface0, letterSpacing: 0.6),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Big swipeable posters: the trucks' combo posters for the park, a truck's own dishes otherwise.
class _PosterCarousel extends StatefulWidget {
  const _PosterCarousel({required this.stallId});
  final String? stallId;

  @override
  State<_PosterCarousel> createState() => _PosterCarouselState();
}

class _PosterCarouselState extends State<_PosterCarousel> {
  final _pages = PageController(viewportFraction: 0.86);
  Timer? _auto;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _auto = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_pages.hasClients) return;
      final n = _slides(AppScope.read(context)).length;
      if (n < 2) return;
      _pages.animateToPage((_page + 1) % n, duration: OsMotion.page, curve: OsMotion.move);
    });
  }

  @override
  void didUpdateWidget(_PosterCarousel old) {
    super.didUpdateWidget(old);
    if (old.stallId != widget.stallId && _pages.hasClients) {
      _pages.jumpToPage(0);
      _page = 0;
    }
  }

  @override
  void dispose() {
    _auto?.cancel();
    _pages.dispose();
    super.dispose();
  }

  List<({String? image, String title, String? subtitle, MenuItem? item})> _slides(AppState state) {
    final cat = state.catalog;
    final banners = cat.banners.where((b) => widget.stallId == null || b.stallId == widget.stallId).toList();
    if (banners.isNotEmpty) {
      return [
        for (final b in banners)
          (image: b.imageUrl, title: b.title, subtitle: b.subtitle, item: b.menuItemId == null ? null : cat.itemById[b.menuItemId]),
      ];
    }
    final items = (cat.itemsByStall[widget.stallId] ?? const <MenuItem>[]).where((m) => m.imageUrl != null).toList()
      ..sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
    return [for (final m in items.take(6)) (image: m.imageUrl, title: m.name, subtitle: cat.stallById[m.stallId]?.name, item: m)];
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final slides = _slides(state);
    if (slides.isEmpty) return const SizedBox.shrink();
    final width = MediaQuery.sizeOf(context).width - 24;
    final height = min(width * 0.86 * 0.82, 300.0);

    return Column(
      children: [
        SizedBox(
          height: height,
          child: PageView.builder(
            controller: _pages,
            padEnds: false,
            onPageChanged: (i) => setState(() => _page = i),
            itemCount: slides.length,
            itemBuilder: (_, i) {
              final s = slides[i];
              return Padding(
                padding: const EdgeInsets.only(right: 10),
                child: Press(
                  scale: 0.98,
                  onTap: s.item == null ? null : () => showDish(context, s.item!),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        FoodImage(s.image),
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              stops: [0.45, 1],
                              colors: [Color(0x000B1230), Color(0xE60B1230)],
                            ),
                          ),
                        ),
                        Positioned(
                          left: 16,
                          right: 16,
                          bottom: 14,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (s.subtitle != null)
                                      Text(s.subtitle!.toUpperCase(), style: OsText.weight(OsText.caption, 800).copyWith(color: OsColors.gold400, letterSpacing: 0.8)),
                                    Text(s.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.subheading, 800).copyWith(color: OsColors.surface0)),
                                  ],
                                ),
                              ),
                              if (s.item != null) ...[
                                const SizedBox(width: 10),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(color: OsColors.ember500, borderRadius: BorderRadius.circular(99)),
                                  child: Text(money(s.item!.priceCents), style: OsText.weight(OsText.label, 800).copyWith(color: OsColors.night900, fontFeatures: OsText.tabular)),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        if (slides.length > 1) ...[
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < slides.length; i++)
                AnimatedContainer(
                  duration: OsMotion.popover,
                  curve: OsMotion.enter,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _page ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(color: i == _page ? OsColors.ember400 : const Color(0x40FFFFFF), borderRadius: BorderRadius.circular(3)),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

// ==================================================================== park body pieces

class _CravingGrid extends StatelessWidget {
  const _CravingGrid({required this.onPick});
  final ValueChanged<String?> onPick;

  @override
  Widget build(BuildContext context) {
    final cravings = AppScope.of(context).catalog.cravings;
    final rows = cravings.length > 5 ? 2 : 1;
    return SizedBox(
      height: rows * 112.0,
      child: EdgeFade(
        child: GridView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          scrollDirection: Axis.horizontal,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: rows, mainAxisExtent: 86, crossAxisSpacing: 4, mainAxisSpacing: 10),
          itemCount: cravings.length,
          itemBuilder: (_, i) {
            final c = cravings[i];
            return Press(
              onTap: () => onPick(c.slug),
              child: Column(
                children: [
                  Container(
                    width: 74,
                    height: 74,
                    decoration: const BoxDecoration(shape: BoxShape.circle, boxShadow: [BoxShadow(color: Color(0x1F0E1330), blurRadius: 10, offset: Offset(0, 4))]),
                    child: ClipOval(child: FoodImage(c.imageUrl)),
                  ),
                  const SizedBox(height: 6),
                  Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: OsText.weight(OsText.small, 600).copyWith(color: OsColors.ink700)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Photo cards in a sideways rail: price on the photo, heart top-right, name and truck below.
class _DishRail extends StatelessWidget {
  const _DishRail({required this.items});
  final List<MenuItem> items;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 248,
        child: EdgeFade(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(width: 14),
            itemBuilder: (_, i) => SizedBox(width: 162, child: _DishCard(item: items[i])),
          ),
        ),
      );
}

class _DishGrid extends StatelessWidget {
  const _DishGrid({required this.items});
  final List<MenuItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Text('No dishes here with VEG on.', textAlign: TextAlign.center, style: OsText.body.copyWith(color: OsColors.ink500)),
        ),
      );
    }
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      sliver: SliverGrid.builder(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisExtent: 250, crossAxisSpacing: 14, mainAxisSpacing: 18),
        itemCount: items.length,
        itemBuilder: (_, i) => _DishCard(item: items[i]),
      ),
    );
  }
}

class _DishCard extends StatelessWidget {
  const _DishCard({required this.item});
  final MenuItem item;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final stall = state.catalog.stallById[item.stallId];
    final fav = state.isFavouriteItem(item.id);
    return Press(
      scale: 0.97,
      onTap: () => showDish(context, item),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  FoodImage(item.imageUrl),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: [0.5, 1],
                        colors: [Color(0x000B1230), Color(0xD90B1230)],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 12,
                    bottom: 10,
                    child: Text(money(item.priceCents),
                        style: OsText.weight(OsText.heading, 800).copyWith(color: OsColors.surface0, fontFeatures: OsText.tabular, letterSpacing: -0.4)),
                  ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        AppScope.read(context).toggleFavouriteItem(item.id);
                      },
                      child: Semantics(
                        button: true,
                        label: fav ? 'Remove from favourites' : 'Add to favourites',
                        child: SizedBox(
                          width: 44,
                          height: 44,
                          child: AnimatedSwitcher(
                            duration: OsMotion.popover,
                            transitionBuilder: (c, a) => ScaleTransition(scale: Tween(begin: 0.5, end: 1.0).animate(CurvedAnimation(parent: a, curve: OsMotion.enter)), child: c),
                            child: Icon(
                              fav ? CupertinoIcons.heart_fill : CupertinoIcons.heart,
                              key: ValueKey(fav),
                              color: fav ? const Color(0xFFFF5A6E) : OsColors.surface0,
                              size: 24,
                              shadows: const [Shadow(color: Color(0x660B1230), blurRadius: 8)],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (!item.isAvailable)
                    const ColoredBox(color: Color(0x99FFFFFF), child: Center(child: Pill('Sold out', color: OsColors.night900, textColor: OsColors.surface0))),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.bodyStrong, 800)),
          const SizedBox(height: 2),
          Row(
            children: [
              DietMark(item.diet, size: 13),
              if (item.diet != null) const SizedBox(width: 5),
              Expanded(
                child: Text(
                  [stall?.name, item.sizeLabel ?? (item.serves == null ? null : 'Serves ${item.serves}')].whereType<String>().join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: OsText.small,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TruckCard extends StatelessWidget {
  const _TruckCard({required this.stall, required this.onTap});
  final Stall stall;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final count = AppScope.of(context).catalog.itemsByStall[stall.id]?.length ?? 0;
    return Press(
      scale: 0.98,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ColorFiltered(
                    colorFilter: stall.isOpen ? const ColorFilter.mode(Color(0x00000000), BlendMode.dst) : const ColorFilter.matrix(_grey),
                    child: FoodImage(stall.coverUrl),
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: [0.55, 1],
                        colors: [Color(0x000B1230), Color(0xB30B1230)],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 14,
                    bottom: 12,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(color: OsColors.surface0, shape: BoxShape.circle),
                      child: ClipOval(child: FoodImage(stall.logoUrl, width: 52, height: 52)),
                    ),
                  ),
                  Positioned(
                    right: 14,
                    bottom: 16,
                    child: Pill('$count dishes', color: const Color(0xE60B1230), textColor: OsColors.surface0, icon: CupertinoIcons.square_list),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(stall.name, style: OsText.heading),
          const SizedBox(height: 2),
          Text(stall.cuisines.join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.label.copyWith(color: OsColors.ink500, fontWeight: FontWeight.w500)),
          const SizedBox(height: 6),
          OpenStatus(stall.isOpen, label: stall.statusLabel),
        ],
      ),
    );
  }

  static const _grey = <double>[0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0, 0, 0, 1, 0];
}

// ==================================================================== truck body pieces

class _TruckHeader extends StatelessWidget {
  const _TruckHeader({required this.stall});
  final Stall stall;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 22, 16, 0),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: OsColors.surface0,
            borderRadius: BorderRadius.circular(OsRadius.xl),
            border: Border.all(color: OsColors.line),
            boxShadow: const [BoxShadow(color: Color(0x140E1330), blurRadius: 24, offset: Offset(0, 10), spreadRadius: -12)],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ClipOval(child: FoodImage(stall.logoUrl, width: 56, height: 56)),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(stall.name, style: OsText.title),
                        if (stall.tagline != null) Text(stall.tagline!, style: OsText.label.copyWith(color: OsColors.ink700, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(stall.cuisines.join(' · '), style: OsText.small),
              const SizedBox(height: 10),
              const SizedBox(height: 1, width: double.infinity, child: ColoredBox(color: OsColors.line)),
              const SizedBox(height: 10),
              Row(
                children: [
                  Flexible(child: OpenStatus(stall.isOpen, label: stall.statusLabel)),
                  const SizedBox(width: 8),
                  _TruckHeart(stallId: stall.id, name: stall.name),
                  const Spacer(),
                  if (stall.phone != null)
                    Row(children: [
                      const Icon(CupertinoIcons.phone_fill, size: 14, color: OsColors.ink700),
                      const SizedBox(width: 4),
                      Text(stall.phone!, style: OsText.weight(OsText.small, 700).copyWith(color: OsColors.ink700)),
                    ]),
                ],
              ),
            ],
          ),
        ),
      );
}

/// One dish in a truck's menu: details on the left, photo with the ADD button on the right.
class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.item});
  final MenuItem item;

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => showDish(context, item),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Opacity(
                  opacity: item.isAvailable ? 1 : 0.55,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DietMark(item.diet),
                      if (item.diet != null) const SizedBox(height: 6),
                      Text(item.name, style: OsText.weight(OsText.subheading, 700)),
                      const SizedBox(height: 4),
                      Text(money(item.priceCents), style: OsText.weight(OsText.bodyStrong, 700).copyWith(fontFeatures: OsText.tabular)),
                      if (item.blurb != null) ...[
                        const SizedBox(height: 8),
                        Text(item.blurb!, maxLines: 2, overflow: TextOverflow.ellipsis, style: OsText.label.copyWith(color: OsColors.ink500, fontWeight: FontWeight.w400)),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 14),
              SizedBox(
                width: 132,
                height: 150,
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.topCenter,
                  children: [
                    if (item.imageUrl != null)
                      ClipRRect(borderRadius: BorderRadius.circular(18), child: FoodImage(item.imageUrl, width: 132, height: 132)),
                    Positioned(bottom: 0, child: AddButton(item: item, width: 104)),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}

/// Big quiet sign-off at the bottom of the scroll, like a poster on the wall.
class _Signoff extends StatelessWidget {
  const _Signoff({required this.bottomInset});
  final double bottomInset;

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(20, 48, 20, bottomInset + 96),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Every truck.\nOne cart.', style: OsText.weight(OsText.display, 800).copyWith(fontSize: 44, height: 1.0, color: OsColors.surface2, letterSpacing: -1.6)),
            const SizedBox(height: 10),
            Text('Made for nights at Open Sky Food Park, Milpitas', style: OsText.small.copyWith(color: OsColors.ink300)),
          ],
        ),
      );
}

/// Saves a truck to favourites (Account → Favourites). Signed out, it says where to sign in.
class _TruckHeart extends StatelessWidget {
  const _TruckHeart({required this.stallId, required this.name});
  final String stallId, name;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final on = state.isFavouriteStall(stallId);
    return Press(
      semanticLabel: on ? 'Remove $name from favourites' : 'Save $name to favourites',
      onTap: () {
        final s = AppScope.read(context);
        if (s.account == null) {
          showCupertinoDialog<void>(
            context: context,
            builder: (c) => CupertinoAlertDialog(
              title: const Text('Sign in to save favourites'),
              content: const Text('Your favourites are kept with your account. Sign in from the Account tab.'),
              actions: [CupertinoDialogAction(isDefaultAction: true, onPressed: () => Navigator.of(c).pop(), child: const Text('OK'))],
            ),
          );
          return;
        }
        HapticFeedback.lightImpact();
        s.toggleFavouriteStall(stallId);
      },
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Icon(on ? CupertinoIcons.heart_fill : CupertinoIcons.heart, size: 20, color: on ? OsColors.chili600 : OsColors.ink500),
      ),
    );
  }
}

