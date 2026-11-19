import 'dart:async';
import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/park_art.dart';
import '../ui/reveal.dart';
import '../ui/routes.dart';
import '../ui/widgets.dart';

/// Quick filters under the search bar. Each is a real slice of the menu.
enum _Quick { all, under10, combos, sweet, rice }

extension on _Quick {
  String get label => switch (this) {
        _Quick.all => 'All',
        _Quick.under10 => 'Under \$10',
        _Quick.combos => 'Combos',
        _Quick.sweet => 'Sweet treats',
        _Quick.rice => 'Mandi & Pulav',
      };
  IconData get icon => switch (this) {
        _Quick.all => Icons.grid_view_rounded,
        _Quick.under10 => Icons.savings_outlined,
        _Quick.combos => Icons.lunch_dining_outlined,
        _Quick.sweet => Icons.icecream_outlined,
        _Quick.rice => Icons.rice_bowl_outlined,
      };
  bool matches(MenuItem m) => switch (this) {
        _Quick.all => true,
        _Quick.under10 => m.priceCents < 1000,
        _Quick.combos => m.craving == 'combos',
        _Quick.sweet => const {'faloodas', 'shakes-lassi', 'desserts'}.contains(m.craving),
        _Quick.rice => const {'mandi', 'pulav'}.contains(m.craving),
      };
}

/// App home: a night-sky header band (truck tabs, search, VEG, quick filters, carousel) over light content.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.onOpenAccount});
  final VoidCallback? onOpenAccount;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _stallId; // null = all trucks
  _Quick _quick = _Quick.all;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = app.catalog;
    final stalls = _stallId == null ? c.stalls : c.stalls.where((s) => s.id == _stallId).toList();

    bool shown(MenuItem m) => (_stallId == null || m.stallId == _stallId) && app.vegOk(m) && _quick.matches(m);
    final dishes = c.items.where((m) => shown(m) && m.imageUrl != null).toList();

    // Carousel: the park's combo banners for these trucks, else each truck's featured dishes.
    final slides = <(MenuItem, Stall)>[
      for (final b in c.banners)
        if (c.itemById[b.menuItemId] case final m? when shown(m))
          if (c.stallById[m.stallId] case final s?) (m, s),
    ];
    if (slides.length < 3) {
      for (final m in dishes.where((m) => m.isFeatured)) {
        if (slides.length >= 6) break;
        if (slides.any((x) => x.$1.id == m.id)) continue;
        slides.add((m, c.stallById[m.stallId]!));
      }
    }

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: _HeaderBand(
            stallId: _stallId,
            onStall: (id) => setState(() => _stallId = id),
            quick: _quick,
            onQuick: (q) => setState(() => _quick = q),
            slides: slides,
            onOpenAccount: widget.onOpenAccount,
          ),
        ),
        if (_quick != _Quick.all || dishes.length < 6)
          ..._filteredGrid(context, c, dishes)
        else
          SliverList.list(children: [
            const SizedBox(height: 28),
            if (c.park.announcement != null) _notice(c.park.announcement!),
            if (!c.park.orderingEnabled) _notice('The park is not taking online orders right now. You can still browse the menus.'),
            _Cravings(stallId: _stallId),
            const SizedBox(height: 32),
            for (final s in stalls) ..._stallRail(context, c, s, shown),
            if (_stallId == null) ...[
              SectionTitle('Trucks at the park'),
              const SizedBox(height: 12),
              for (final s in c.stalls)
                Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: _TruckRow(stall: s, itemCount: c.itemsByStall[s.id]?.length ?? 0)),
              const SizedBox(height: 16),
            ],
            _HowItWorks(tableService: c.park.tableServiceEnabled),
            const SizedBox(height: 110),
          ]),
      ],
    );
  }

  List<Widget> _filteredGrid(BuildContext context, Catalog c, List<MenuItem> dishes) {
    final w = (MediaQuery.sizeOf(context).width.clamp(0, 640) - 16 * 2 - 16) / 2;
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
          child: Text.rich(TextSpan(children: [
            TextSpan(text: _quick == _Quick.all ? 'Dishes' : _quick.label, style: OsText.heading),
            TextSpan(text: '  ${dishes.length == 1 ? '1 dish' : '${dishes.length} dishes'}', style: OsText.weight(OsText.label, 600).copyWith(color: OsColors.ink500)),
          ])),
        ),
      ),
      if (dishes.isEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(children: [
              Text('Nothing here with these filters', style: OsText.subheading, textAlign: TextAlign.center),
              TextButton(
                onPressed: () {
                  AppScope.read(context).setVegOnly(false);
                  setState(() => _quick = _Quick.all);
                },
                child: const Text('Show everything'),
              ),
            ]),
          ),
        )
      else
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
          sliver: SliverToBoxAdapter(
            child: Wrap(spacing: 16, runSpacing: 22, children: [
              for (final m in dishes) DishCard(item: m, stall: c.stallById[m.stallId]!, width: w, showStall: _stallId == null),
            ]),
          ),
        ),
    ];
  }

  List<Widget> _stallRail(BuildContext context, Catalog c, Stall s, bool Function(MenuItem) shown) {
    final picks = (c.itemsByStall[s.id] ?? const <MenuItem>[]).where((m) => m.imageUrl != null && shown(m)).toList()
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

// ---------------------------------------------------------------- header band

class _HeaderBand extends StatelessWidget {
  const _HeaderBand({
    required this.stallId,
    required this.onStall,
    required this.quick,
    required this.onQuick,
    required this.slides,
    required this.onOpenAccount,
  });
  final String? stallId;
  final ValueChanged<String?> onStall;
  final _Quick quick;
  final ValueChanged<_Quick> onQuick;
  final List<(MenuItem, Stall)> slides;
  final VoidCallback? onOpenAccount;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final park = app.catalog.park;
    final top = MediaQuery.paddingOf(context).top;
    final account = app.account;

    return Container(
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(OsRadius.xl + 8)),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [OsColors.night950, OsColors.night900, OsColors.night800],
          stops: [0, 0.45, 1],
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(children: [
        // A warm string-light glow behind the top of the band.
        const Positioned(
          top: -120,
          right: -80,
          child: IgnorePointer(
            child: SizedBox(
              width: 320,
              height: 320,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [Color(0x40FF7A1A), Color(0x00FF7A1A)]),
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.only(top: top + 10, bottom: 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Park + profile
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Flexible(child: Text(park.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.heading.copyWith(color: Colors.white))),
                      if (AppState.demo) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(color: OsColors.ember500, borderRadius: BorderRadius.circular(99)),
                          child: Text('DEMO', style: OsText.weight(OsText.caption, 800).copyWith(color: OsColors.night900, fontSize: 10, letterSpacing: 0.6)),
                        ),
                      ],
                    ]),
                    if (park.address != null)
                      Row(children: [
                        const Icon(Icons.place, size: 15, color: OsColors.ember400),
                        const SizedBox(width: 3),
                        Flexible(child: Text(park.address!, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 500).copyWith(color: OsColors.nightMuted))),
                      ]),
                  ]),
                ),
                const SizedBox(width: 12),
                Pressable(
                  semanticLabel: 'Account',
                  onTap: onOpenAccount,
                  child: Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: OsColors.night700,
                      border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
                    ),
                    child: account == null
                        ? const Icon(Icons.person_outline, color: Colors.white)
                        : Text(account.initials, style: OsText.weight(OsText.label, 800).copyWith(color: Colors.white)),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 18),
            _TruckLot(selected: stallId, onSelect: onStall),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(children: [
                Expanded(child: _SearchPill(stallId: stallId)),
                const SizedBox(width: 10),
                const _VegSwitch(),
              ]),
            ),
            const SizedBox(height: 14),
            _QuickTabs(selected: quick, onSelect: onQuick),
            const SizedBox(height: 10),
            const _MascotBanner(),
            if (slides.isNotEmpty) ...[
              const SizedBox(height: 18),
              _Carousel(slides: slides),
            ],
          ]),
        ),
      ]),
    );
  }
}

/// The truck lot: each truck parked on a road under twinkling string lights, plus the ALL park sign.
/// Tapping one switches its window light on (with a hop) and filters the page to it.
class _TruckLot extends StatelessWidget {
  const _TruckLot({required this.selected, required this.onSelect});
  final String? selected;
  final ValueChanged<String?> onSelect;

  static const _colors = [Color(0xFFD9442B), Color(0xFFE2558E), Color(0xFF2E9E6A), Color(0xFF3A6FD8)];
  static const _truckSize = Size(116, 78);

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).catalog;
    final spots = <(String?, String, Color?, String?)>[
      (null, 'All trucks', null, null),
      for (final (i, s) in c.stalls.indexed) (s.id, s.name, _colors[i % _colors.length], s.logoUrl),
    ];
    return SizedBox(
      height: 132,
      child: Stack(children: [
        // Road with a dashed lane line.
        Positioned(
          left: 0,
          right: 0,
          top: 74,
          height: 26,
          child: ColoredBox(color: Colors.black.withValues(alpha: 0.22), child: CustomPaint(painter: _LaneLine())),
        ),
        // String lights strung above the trucks.
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          height: 18,
          child: LoopClock(period: const Duration(seconds: 3), builder: (_, t) => CustomPaint(painter: StringLightsPainter(t))),
        ),
        ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(12, 14, 12, 0),
          itemCount: spots.length,
          separatorBuilder: (_, _) => const SizedBox(width: 4),
          itemBuilder: (_, i) {
            final (id, name, color, logo) = spots[i];
            return _TruckSpot(id: id, name: name, color: color, logo: logo, on: id == selected, onTap: () => onSelect(id));
          },
        ),
      ]),
    );
  }
}

class _TruckSpot extends StatelessWidget {
  const _TruckSpot({required this.id, required this.name, required this.color, required this.logo, required this.on, required this.onTap});
  final String? id;
  final String name;
  final Color? color;
  final String? logo;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const size = _TruckLot._truckSize;
    final c = color;
    return Semantics(
      button: true,
      selected: on,
      label: name,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: size.width,
          child: Column(children: [
            // Hop once when selected; the window light fades up.
            TweenAnimationBuilder<double>(
              key: ValueKey('$id-$on'),
              tween: Tween(begin: 0, end: on ? 1 : 0),
              duration: on ? const Duration(milliseconds: 420) : OsMotion.popover,
              curve: OsMotion.enter,
              builder: (context, v, _) => Transform.translate(
                offset: Offset(0, on ? -math.sin(math.pi * v) * 8 : 0),
                child: SizedBox.fromSize(
                  size: size,
                  child: c == null
                      ? LoopClock(period: const Duration(seconds: 2), builder: (_, t) => CustomPaint(size: size, painter: ParkSignPainter(lit: on, t: t)))
                      : Stack(children: [
                          CustomPaint(size: size, painter: TruckPainter(body: c, lit: on, glow: on ? v.clamp(0.0, 1.0) : 0)),
                          if (logo != null)
                            Positioned.fromRect(
                              rect: TruckPainter.logoRect(size),
                              child: Container(
                                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 1.5)),
                                child: ClipOval(child: FoodImage(logo)),
                              ),
                            ),
                        ]),
                ),
              ),
            ),
            const SizedBox(height: 10),
            AnimatedDefaultTextStyle(
              duration: OsMotion.press,
              style: OsText.weight(OsText.small, on ? 800 : 600).copyWith(color: on ? Colors.white : OsColors.nightMuted),
              child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            const SizedBox(height: 3),
            AnimatedContainer(
              duration: OsMotion.popover,
              curve: OsMotion.move,
              width: on ? 24 : 0,
              height: 3,
              decoration: BoxDecoration(color: OsColors.ember500, borderRadius: BorderRadius.circular(99)),
            ),
          ]),
        ),
      ),
    );
  }
}

class _LaneLine extends CustomPainter {
  @override
  void paint(Canvas canvas, Size s) {
    final p = Paint()
      ..color = Colors.white.withValues(alpha: 0.28)
      ..strokeWidth = 2;
    for (var x = 8.0; x < s.width; x += 26) {
      canvas.drawLine(Offset(x, s.height - 4), Offset(x + 12, s.height - 4), p);
    }
  }

  @override
  bool shouldRepaint(_LaneLine old) => false;
}

/// Our FLAVOURFEST moment: the dancing pulka and falooda either side of the park's promise.
class _MascotBanner extends StatelessWidget {
  const _MascotBanner();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          const Mascot(kind: 'pulka', size: Size(78, 104)),
          Expanded(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('EVERY TRUCK', textAlign: TextAlign.center, style: OsText.weight(OsText.heading, 800).copyWith(color: Colors.white, fontSize: 22, letterSpacing: 1)),
              ShaderMask(
                shaderCallback: (r) => const LinearGradient(colors: [OsColors.gold400, OsColors.ember500, OsColors.ember600]).createShader(r),
                child: Text('ONE CART', textAlign: TextAlign.center, style: OsText.weight(OsText.hero, 800).copyWith(color: Colors.white, fontSize: 38, height: 1, letterSpacing: 0.5)),
              ),
              const SizedBox(height: 6),
              Text('Pay once. A token from each truck.', textAlign: TextAlign.center, style: OsText.weight(OsText.small, 600).copyWith(color: OsColors.nightMuted)),
            ]),
          ),
          const Mascot(kind: 'falooda', size: Size(78, 104)),
        ]),
      );
}

/// Search pill whose hint cycles through real dish names: "Search for 'Royal Falooda'".
class _SearchPill extends StatefulWidget {
  const _SearchPill({required this.stallId});
  final String? stallId;
  @override
  State<_SearchPill> createState() => _SearchPillState();
}

class _SearchPillState extends State<_SearchPill> {
  Timer? _timer;
  int _i = 0;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 2800), (_) => setState(() => _i++));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final names = app.catalog.items
        .where((m) => m.isFeatured && app.vegOk(m) && (widget.stallId == null || m.stallId == widget.stallId))
        // Long combo names don't fit the bar; the hint drops the shared suffix (A's iOS fix).
        .map((m) => m.name.replaceAll(RegExp(r'\s+with Fresh Live Pulka$', caseSensitive: false), ''))
        .toList();
    final hint = names.isEmpty ? 'dishes and trucks' : "'${names[_i % names.length]}'";
    final still = MediaQuery.disableAnimationsOf(context);

    return Pressable(
      scale: 0.98,
      semanticLabel: 'Search dishes and trucks',
      onTap: () => openSearch(context),
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(color: OsColors.surface0, borderRadius: BorderRadius.circular(OsRadius.lg)),
        child: Row(children: [
          const Icon(Icons.search, color: OsColors.ink700),
          const SizedBox(width: 10),
          Text('Search for ', style: OsText.weight(OsText.body, 500).copyWith(color: OsColors.ink500, fontSize: 15)),
          Expanded(
            child: ClipRect(
              child: AnimatedSwitcher(
                duration: still ? Duration.zero : const Duration(milliseconds: 360),
                switchInCurve: OsMotion.enter,
                switchOutCurve: OsMotion.exit,
                // New name rises in from below; the old one (animating in reverse) leaves through the top.
                transitionBuilder: (child, a) => SlideTransition(
                  position: Tween(begin: Offset(0, child.key == ValueKey(hint) ? 0.6 : -0.6), end: Offset.zero).animate(a),
                  child: FadeTransition(opacity: a, child: child),
                ),
                // Only the outgoing name and the incoming one, never a pile of earlier ones mid-change.
                layoutBuilder: (cur, prev) => Stack(alignment: Alignment.centerLeft, children: [if (prev.isNotEmpty) prev.last, ?cur]),
                child: Text(hint, key: ValueKey(hint), maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: OsText.weight(OsText.body, 600).copyWith(color: OsColors.ink700, fontSize: 15)),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

/// White VEG box with a small switch, like the menu's veg mark.
class _VegSwitch extends StatelessWidget {
  const _VegSwitch();
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final on = app.vegOnly;
    return Tooltip(
      message: 'Hides dishes marked non-veg or egg',
      child: Semantics(
        toggled: on,
        label: 'Veg only',
        child: Pressable(
          onTap: () => app.setVegOnly(!on),
          child: Container(
            width: 64,
            height: 52,
            decoration: BoxDecoration(color: OsColors.surface0, borderRadius: BorderRadius.circular(OsRadius.lg)),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('VEG', style: OsText.weight(OsText.caption, 800).copyWith(color: on ? OsColors.leaf600 : OsColors.ink700, letterSpacing: 0.6)),
              const SizedBox(height: 4),
              AnimatedContainer(
                duration: OsMotion.popover,
                curve: OsMotion.move,
                width: 34,
                height: 18,
                padding: const EdgeInsets.all(2),
                alignment: on ? Alignment.centerRight : Alignment.centerLeft,
                decoration: BoxDecoration(color: on ? OsColors.leaf600 : OsColors.surface2, borderRadius: BorderRadius.circular(99)),
                child: Container(
                  width: 14,
                  height: 14,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(3), border: Border.all(color: OsColors.leaf600, width: 1.2)),
                  child: Container(width: 6, height: 6, decoration: const BoxDecoration(color: OsColors.leaf600, shape: BoxShape.circle)),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// ALL | UNDER $10 | COMBOS … with an ember underline on the selected one.
class _QuickTabs extends StatelessWidget {
  const _QuickTabs({required this.selected, required this.onSelect});
  final _Quick selected;
  final ValueChanged<_Quick> onSelect;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 40,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          children: [
            for (final q in _Quick.values)
              InkWell(
                onTap: () => onSelect(q),
                borderRadius: BorderRadius.circular(OsRadius.sm),
                child: AnimatedContainer(
                  duration: OsMotion.press,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(border: Border(bottom: BorderSide(color: q == selected ? OsColors.ember500 : Colors.transparent, width: 3))),
                  child: Row(children: [
                    Icon(q.icon, size: 17, color: q == selected ? Colors.white : OsColors.nightMuted),
                    const SizedBox(width: 6),
                    Text(q.label.toUpperCase(),
                        style: OsText.weight(OsText.small, q == selected ? 800 : 600).copyWith(color: q == selected ? Colors.white : OsColors.nightMuted, letterSpacing: 0.5)),
                  ]),
                ),
              ),
          ],
        ),
      );
}

/// Auto-sliding cards for real combos and featured dishes. Pauses while touched; still with reduced motion.
class _Carousel extends StatefulWidget {
  const _Carousel({required this.slides});
  final List<(MenuItem, Stall)> slides;
  @override
  State<_Carousel> createState() => _CarouselState();
}

class _CarouselState extends State<_Carousel> {
  final _pc = PageController(viewportFraction: 0.86);
  Timer? _timer;
  int _page = 0;
  bool _touching = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || _touching || widget.slides.length < 2 || MediaQuery.disableAnimationsOf(context) || !_pc.hasClients) return;
      _pc.animateToPage((_page + 1) % widget.slides.length, duration: OsMotion.page, curve: OsMotion.move);
    });
  }

  @override
  void didUpdateWidget(_Carousel old) {
    super.didUpdateWidget(old);
    if (old.slides.length != widget.slides.length && _pc.hasClients) {
      _page = 0;
      _pc.jumpToPage(0);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        SizedBox(
          height: 168,
          child: Listener(
            onPointerDown: (_) => _touching = true,
            onPointerUp: (_) => _touching = false,
            onPointerCancel: (_) => _touching = false,
            child: PageView.builder(
              controller: _pc,
              itemCount: widget.slides.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (_, i) => Padding(padding: const EdgeInsets.symmetric(horizontal: 6), child: _Slide(item: widget.slides[i].$1, stall: widget.slides[i].$2, index: i)),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (var i = 0; i < widget.slides.length; i++)
            AnimatedContainer(
              duration: OsMotion.popover,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: i == _page ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(color: i == _page ? OsColors.ember500 : Colors.white.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(99)),
            ),
        ]),
      ]);
}

class _Slide extends StatelessWidget {
  const _Slide({required this.item, required this.stall, required this.index});
  final MenuItem item;
  final Stall stall;
  final int index;

  static const _palettes = [
    [OsColors.ember500, OsColors.ember700],
    [OsColors.night700, Color(0xFF3B2A6E)],
    [OsColors.ember600, Color(0xFF8E2A0E)],
  ];

  @override
  Widget build(BuildContext context) {
    final p = _palettes[index % _palettes.length];
    final onEmber = index % _palettes.length != 1;
    final text = onEmber ? OsColors.night900 : Colors.white;
    return Pressable(
      scale: 0.98,
      semanticLabel: item.name,
      onTap: () => openDish(context, stall, item),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(OsRadius.xl),
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: p),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          Positioned(
            right: -26,
            top: 6,
            bottom: 6,
            child: AspectRatio(
              aspectRatio: 1,
              child: Container(
                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 4)),
                child: ClipOval(child: FoodImage(item.imageUrl)),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 150, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(stall.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.small, 700).copyWith(color: text.withValues(alpha: 0.8))),
              const SizedBox(height: 4),
              Text(item.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.subheading, 800).copyWith(color: text, height: 1.15)),
              const Spacer(),
              Row(children: [
                Text(money(item.priceCents), style: OsText.weight(OsText.bodyStrong, 800).copyWith(color: text, fontFeatures: OsText.tabular)),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: onEmber ? OsColors.night900 : OsColors.ember500, borderRadius: BorderRadius.circular(99)),
                  child: Text('Order now', style: OsText.weight(OsText.caption, 800).copyWith(color: onEmber ? Colors.white : OsColors.night900)),
                ),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- body sections

/// Two rows of craving circles that scroll sideways together.
class _Cravings extends StatelessWidget {
  const _Cravings({required this.stallId});
  final String? stallId;

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).catalog;
    final list = c.cravings
        .where((cr) => stallId == null || c.items.any((m) => m.craving == cr.slug && m.stallId == stallId))
        .toList();
    if (list.isEmpty) return const SizedBox.shrink();
    final rows = list.length > 5 ? 2 : 1;
    final cols = (list.length / rows).ceil();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionTitle("What's on your mind?"),
      const SizedBox(height: 12),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (var r = 0; r < rows; r++)
            Padding(
              padding: EdgeInsets.only(bottom: r < rows - 1 ? 14 : 0),
              child: Row(children: [
                for (final cr in list.skip(r * cols).take(cols))
                  Padding(
                    padding: const EdgeInsets.only(right: 14),
                    child: Pressable(
                      semanticLabel: cr.name,
                      onTap: () => openSearch(context, craving: cr.slug),
                      child: SizedBox(
                        width: 76,
                        child: Column(children: [
                          ClipOval(child: FoodImage(cr.imageUrl, width: 72, height: 72)),
                          const SizedBox(height: 6),
                          Text(cr.name, maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center,
                              style: OsText.weight(OsText.small, 600).copyWith(color: OsColors.ink700, height: 1.15)),
                        ]),
                      ),
                    ),
                  ),
              ]),
            ),
        ]),
      ),
    ]);
  }
}

/// List-style truck card: photo on the left, details on the right (no ratings: we have none).
class _TruckRow extends StatelessWidget {
  const _TruckRow({required this.stall, required this.itemCount});
  final Stall stall;
  final int itemCount;

  @override
  Widget build(BuildContext context) => Pressable(
        scale: 0.98,
        semanticLabel: '${stall.name} menu',
        onTap: () => openStall(context, stall),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Stack(children: [
            FoodImage(stall.coverUrl, radius: OsRadius.lg, width: 128, height: 140, greyed: !stall.isOpen),
            if (stall.logoUrl != null)
              Positioned(
                left: 8,
                bottom: 8,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2), color: Colors.white),
                  child: ClipOval(child: FoodImage(stall.logoUrl)),
                ),
              ),
          ]),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(stall.name, style: OsText.subheading),
                const SizedBox(height: 4),
                OpenStatus(stall),
                const SizedBox(height: 4),
                Text(stall.tagline ?? stall.cuisines.join(', '), maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink700)),
                // Cuisines as a second line only when the tagline took the first.
                if (stall.tagline != null) Text(stall.cuisines.join(', '), maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.small),
                const SizedBox(height: 10),
                Text('$itemCount dishes  ·  View menu', style: OsText.weight(OsText.small, 700).copyWith(color: OsColors.ember700)),
              ]),
            ),
          ),
        ]),
      );
}

/// "How it works": giant ember numerals with a title and one line.
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
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      decoration: BoxDecoration(color: OsColors.surface1, borderRadius: BorderRadius.circular(OsRadius.xl)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('How it works', style: OsText.heading),
        const SizedBox(height: 12),
        for (final (i, (title, body)) in steps.indexed)
          Reveal(
            delay: Duration(milliseconds: 90 * i),
            onScroll: true,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(children: [
                SizedBox(
                  width: 44,
                  child: ShaderMask(
                    shaderCallback: (r) => const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [OsColors.ember400, OsColors.ember700]).createShader(r),
                    child: Text('${i + 1}', style: OsText.stepNumber.copyWith(color: Colors.white, fontSize: 56)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(title, style: OsText.bodyStrong),
                    Text(body, style: OsText.weight(OsText.small, 400)),
                  ]),
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}
