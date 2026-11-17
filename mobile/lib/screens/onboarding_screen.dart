import 'package:material_ui/material_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/widgets.dart';

/// Welcome tour shown once after a new account is created (and from Account / Settings on request).
/// Four pages, each a small picture of the real app built from the real trucks and dishes.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pages = PageController();
  double _page = 0;

  @override
  void initState() {
    super.initState();
    _pages.addListener(() => setState(() => _page = _pages.page ?? 0));
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _finish() {
    AppScope.read(context).markTourSeen();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = app.catalog;
    final name = app.account?.name.split(' ').first;
    final steps = _steps(c, name);
    final last = _page.round() == steps.length - 1;

    return Scaffold(
      backgroundColor: OsColors.surface0,
      body: SafeArea(
        child: Column(children: [
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(0, 4, 8, 0),
              child: AnimatedOpacity(
                opacity: last ? 0 : 1,
                duration: OsMotion.popover,
                child: TextButton(onPressed: last ? null : _finish, child: const Text('Skip')),
              ),
            ),
          ),
          Expanded(
            child: PageView.builder(
              controller: _pages,
              itemCount: steps.length,
              itemBuilder: (_, i) {
                // Parallax: the picture drifts and fades slightly as you swipe.
                final d = (i - _page).clamp(-1.0, 1.0);
                final s = steps[i];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(children: [
                    Expanded(
                      child: Transform.translate(
                        offset: Offset(d * 60, 0),
                        child: Opacity(opacity: (1 - d.abs() * 0.6).clamp(0, 1), child: Center(child: s.picture)),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(s.title, textAlign: TextAlign.center, style: OsText.title),
                    const SizedBox(height: 10),
                    Text(s.body, textAlign: TextAlign.center, style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
                    const SizedBox(height: 28),
                  ]),
                );
              },
            ),
          ),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < steps.length; i++)
              AnimatedContainer(
                duration: OsMotion.popover,
                curve: OsMotion.move,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: _page.round() == i ? 22 : 8,
                height: 8,
                decoration: BoxDecoration(color: _page.round() == i ? OsColors.ember500 : OsColors.surface2, borderRadius: BorderRadius.circular(99)),
              ),
          ]),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
            child: FilledButton(
              onPressed: last ? _finish : () => _pages.nextPage(duration: OsMotion.page, curve: OsMotion.move),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
              child: AnimatedSwitcher(duration: OsMotion.popover, child: Text(last ? 'Start ordering' : 'Next', key: ValueKey(last))),
            ),
          ),
        ]),
      ),
    );
  }

  List<_Step> _steps(Catalog c, String? firstName) {
    final stalls = c.stalls.take(2).toList();
    MenuItem? pick(Stall s) => (c.itemsByStall[s.id] ?? const <MenuItem>[]).where((m) => m.isFeatured && m.imageUrl != null).firstOrNull ??
        (c.itemsByStall[s.id] ?? const <MenuItem>[]).where((m) => m.imageUrl != null).firstOrNull;
    final dishes = [for (final s in stalls) if (pick(s) case final m?) (s, m)];
    final table = c.park.tableServiceEnabled;

    return [
      _Step(
        title: firstName == null ? 'Every truck in one app' : 'Welcome, $firstName',
        body: 'Browse the menus of every food truck at ${c.park.name}. Tap a truck to see its whole menu.',
        picture: _Frame(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            for (final s in stalls) ...[
              _MiniTruck(stall: s),
              const SizedBox(height: 10),
            ],
          ]),
        ),
      ),
      _Step(
        title: 'One cart for all of them',
        body: 'Add a curry from one truck and a falooda from another. It all goes into one cart and one checkout.',
        picture: _Frame(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            for (final (s, m) in dishes) ...[
              Row(children: [
                FoodImage(m.imageUrl, radius: OsRadius.sm, width: 52, height: 52),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(m.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 700)),
                    Text(s.name, style: OsText.small),
                  ]),
                ),
                Text(money(m.priceCents), style: OsText.weight(OsText.label, 700).copyWith(fontFeatures: OsText.tabular)),
              ]),
              const SizedBox(height: 12),
            ],
            Container(
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: OsColors.ember500, borderRadius: BorderRadius.circular(OsRadius.md)),
              child: Text('Place order · ${money(dishes.fold(0, (n, d) => n + d.$2.priceCents))}', style: OsText.weight(OsText.label, 800).copyWith(color: OsColors.night900)),
            ),
          ]),
        ),
      ),
      _Step(
        title: 'A token from each truck',
        body: 'Every truck cooks its part and gives you its own token number. Follow them live in Orders.',
        picture: _Frame(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            for (final (i, s) in stalls.indexed) ...[
              _MiniToken(stall: s, token: i + 1, ready: false, preparing: i == 0),
              if (i == 0) const SizedBox(height: 10),
            ],
          ]),
        ),
      ),
      _Step(
        title: table ? 'Pick it up, or stay seated' : 'Collect when it is ready',
        body: table
            ? 'When a token turns green, collect it at the truck. Or choose table service at checkout and it comes to you.'
            : 'When a token turns green, collect it at the truck and show your number.',
        picture: _Frame(child: stalls.isEmpty ? const SizedBox() : _MiniToken(stall: stalls.first, token: 1, ready: true, preparing: false)),
      ),
    ];
  }
}

class _Step {
  const _Step({required this.title, required this.body, required this.picture});
  final String title, body;
  final Widget picture;
}

/// A soft phone-card frame so each picture reads as "this is the app".
class _Frame extends StatelessWidget {
  const _Frame({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(maxWidth: 340),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: OsColors.surface1,
          borderRadius: BorderRadius.circular(OsRadius.xl + 8),
          border: Border.all(color: OsColors.line),
        ),
        child: child,
      );
}

class _MiniTruck extends StatelessWidget {
  const _MiniTruck({required this.stall});
  final Stall stall;
  @override
  Widget build(BuildContext context) => Container(
        height: 96,
        decoration: BoxDecoration(color: OsColors.surface0, borderRadius: BorderRadius.circular(OsRadius.lg), border: Border.all(color: OsColors.line)),
        clipBehavior: Clip.antiAlias,
        child: Row(children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(stall.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.bodyStrong, 800)),
                Text(stall.tagline ?? stall.cuisines.join(', '), maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.small),
                const SizedBox(height: 6),
                OpenStatus(stall),
              ]),
            ),
          ),
          SizedBox(width: 96, height: 96, child: FoodImage(stall.coverUrl)),
        ]),
      );
}

class _MiniToken extends StatelessWidget {
  const _MiniToken({required this.stall, required this.token, required this.ready, required this.preparing});
  final Stall stall;
  final int token;
  final bool ready, preparing;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: ready ? OsColors.leaf50 : OsColors.surface0,
          borderRadius: BorderRadius.circular(OsRadius.lg + 4),
          border: Border.all(color: ready ? OsColors.leaf600 : OsColors.line),
        ),
        child: Row(children: [
          Container(
            width: 60,
            height: 60,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: ready ? OsColors.leaf600 : OsColors.night900, borderRadius: BorderRadius.circular(OsRadius.sm)),
            child: Text('$token', style: OsText.token.copyWith(color: Colors.white, fontSize: 30)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(stall.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 800)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: ready ? OsColors.leaf600 : (preparing ? OsColors.ember100 : OsColors.surface2),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(ready ? 'Ready' : (preparing ? 'Preparing' : 'Sent'),
                    style: OsText.weight(OsText.caption, 700).copyWith(color: ready ? Colors.white : (preparing ? OsColors.ember700 : OsColors.ink700))),
              ),
              if (ready) ...[
                const SizedBox(height: 4),
                Text('Collect it at ${stall.name}. Show token $token.', style: OsText.small.copyWith(color: OsColors.ink700)),
              ],
            ]),
          ),
        ]),
      );
}
