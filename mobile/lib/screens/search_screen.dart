import 'package:material_ui/material_ui.dart';

import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/widgets.dart';

/// Opens search from the Home search bar (or a craving circle, pre-filtered), with a soft fade-up.
Future<void> openSearchPage(BuildContext context, {String? craving}) => Navigator.of(context).push(PageRouteBuilder<void>(
      pageBuilder: (_, _, _) => SearchScreen(initialCraving: craving),
      transitionDuration: OsMotion.sheet,
      reverseTransitionDuration: const Duration(milliseconds: 200),
      transitionsBuilder: (_, a, _, child) => FadeTransition(
        opacity: CurvedAnimation(parent: a, curve: OsMotion.enter),
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.03), end: Offset.zero).animate(CurvedAnimation(parent: a, curve: OsMotion.enter)), child: child),
      ),
    ));

/// Search: type for live results; with nothing typed, recent searches. Filters apply to both.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.initialCraving});
  final String? initialCraving;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _query = TextEditingController();
  final _focus = FocusNode();
  final _diets = <Diet>{};
  String? _craving;
  String? _stallId;
  bool _openOnly = false;

  @override
  void initState() {
    super.initState();
    _craving = widget.initialCraving;
    _query.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _query.dispose();
    _focus.dispose();
    super.dispose();
  }

  bool get _filtered => _diets.isNotEmpty || _craving != null || _stallId != null || _openOnly;

  void _clearFilters() => setState(() {
        _diets.clear();
        _craving = null;
        _stallId = null;
        _openOnly = false;
      });

  void _useRecent(String q) {
    _query.text = q;
    _query.selection = TextSelection.collapsed(offset: q.length);
    AppScope.read(context).addRecentSearch(q);
    _focus.unfocus();
  }

  Future<T?> _pickOne<T>(String title, List<(T, String)> options, T? current) => showModalBottomSheet<T>(
        context: context,
        showDragHandle: true,
        builder: (ctx) => SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text(title, style: OsText.heading)),
            for (final (value, label) in options)
              ListTile(
                title: Text(label, style: OsText.weight(OsText.bodyStrong, current == value ? 800 : 500)),
                trailing: current == value ? const Icon(Icons.check, color: OsColors.ember700) : null,
                onTap: () => Navigator.pop(ctx, value),
              ),
            const SizedBox(height: 8),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = app.catalog;
    final q = _query.text.trim().toLowerCase();
    final cravingName = c.cravings.where((x) => x.slug == _craving).firstOrNull?.name;
    final stallName = c.stallById[_stallId]?.name;

    // Results: query and filters together. Nothing typed and no filter means "show recents".
    List<(Stall, List<MenuItem>)>? results;
    if (q.isNotEmpty || _filtered) {
      results = [];
      for (final s in c.stalls) {
        if (_stallId != null && s.id != _stallId) continue;
        if (_openOnly && !s.isOpen) continue;
        final stallHit = q.isNotEmpty && (s.name.toLowerCase().contains(q) || s.cuisines.any((x) => x.toLowerCase().contains(q)));
        final items = (c.itemsByStall[s.id] ?? const <MenuItem>[])
            .where((m) =>
                (_craving == null || m.craving == _craving) &&
                (_diets.isEmpty || (m.diet != null && _diets.contains(m.diet))) &&
                (q.isEmpty ||
                    stallHit ||
                    m.name.toLowerCase().contains(q) ||
                    (m.description?.toLowerCase().contains(q) ?? false) ||
                    (c.categoryById[m.categoryId]?.name.toLowerCase().contains(q) ?? false)))
            .toList();
        if (items.isNotEmpty) results.add((s, items));
      }
    }
    final total = results?.fold<int>(0, (n, g) => n + g.$2.length) ?? 0;
    final cardW = (MediaQuery.sizeOf(context).width - 16 * 2 - 16) / 2;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Stack(children: [
          Column(children: [
            // Search field with back.
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 8, 16, 0),
              child: Row(children: [
                IconButton(tooltip: 'Back', icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.of(context).maybePop()),
                Expanded(
                  child: TextField(
                    controller: _query,
                    focusNode: _focus,
                    autofocus: widget.initialCraving == null,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (v) => app.addRecentSearch(v),
                    decoration: InputDecoration(
                      hintText: 'Search dishes and trucks',
                      filled: true,
                      fillColor: OsColors.surface1,
                      prefixIcon: const Icon(Icons.search, color: OsColors.ink500),
                      suffixIcon: _query.text.isEmpty ? null : IconButton(tooltip: 'Clear search', icon: const Icon(Icons.close), onPressed: _query.clear),
                      contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(OsRadius.md), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(OsRadius.md), borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(OsRadius.md), borderSide: const BorderSide(color: OsColors.ember600, width: 1.5)),
                    ),
                  ),
                ),
              ]),
            ),
            // Filters.
            SizedBox(
              height: 56,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
                children: [
                  if (_filtered) ...[
                    ActionChip(
                      avatar: const Icon(Icons.close, size: 16),
                      label: const Text('Clear'),
                      onPressed: () {
                        _focus.unfocus();
                        _clearFilters();
                      },
                    ),
                    const SizedBox(width: 8),
                  ],
                  _chip('Open now', _openOnly, () => setState(() => _openOnly = !_openOnly), icon: Icons.schedule),
                  for (final d in Diet.values) _chip(dietLabel(d), _diets.contains(d), () => setState(() => _diets.contains(d) ? _diets.remove(d) : _diets.add(d)), mark: d),
                  _chip(stallName ?? 'Truck', _stallId != null, () async {
                    final v = await _pickOne<String>('Truck', [('', 'All trucks'), for (final s in c.stalls) (s.id, s.name)], _stallId ?? '');
                    if (v != null) setState(() => _stallId = v.isEmpty ? null : v);
                  }, dropdown: true),
                  _chip(cravingName ?? 'Category', _craving != null, () async {
                    final v = await _pickOne<String>('Category', [('', 'All categories'), for (final cr in c.cravings) (cr.slug, cr.name)], _craving ?? '');
                    if (v != null) setState(() => _craving = v.isEmpty ? null : v);
                  }, dropdown: true),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: GestureDetector(
                onTapDown: (_) => _focus.unfocus(),
                behavior: HitTestBehavior.translucent,
                child: results == null ? _idle(app) : _results(results, total, q, cravingName, stallName, cardW),
              ),
            ),
          ]),
          const Positioned(left: 0, right: 0, bottom: 0, child: SafeArea(top: false, child: CartBar())),
        ]),
      ),
    );
  }

  /// Nothing typed: recent searches, then quick categories.
  Widget _idle(AppState app) {
    final c = app.catalog;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
      children: [
        if (app.recentSearches.isNotEmpty) ...[
          Row(children: [
            Expanded(child: Text('Recent searches', style: OsText.subheading)),
            TextButton(onPressed: app.clearRecentSearches, child: const Text('Clear all')),
          ]),
          for (final r in app.recentSearches)
            InkWell(
              onTap: () => _useRecent(r),
              borderRadius: BorderRadius.circular(OsRadius.md),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  const Icon(Icons.history, color: OsColors.ink500, size: 20),
                  const SizedBox(width: 12),
                  Expanded(child: Text(r, style: OsText.weight(OsText.body, 500))),
                  IconButton(
                    tooltip: 'Remove $r',
                    icon: const Icon(Icons.close, size: 18, color: OsColors.ink500),
                    onPressed: () => app.removeRecentSearch(r),
                  ),
                ]),
              ),
            ),
          const SizedBox(height: 20),
        ],
        Text('Browse by category', style: OsText.subheading),
        const SizedBox(height: 12),
        Wrap(spacing: 12, runSpacing: 16, children: [
          for (final cr in c.cravings)
            Pressable(
              semanticLabel: cr.name,
              onTap: () => setState(() => _craving = cr.slug),
              child: SizedBox(
                width: 76,
                child: Column(children: [
                  ClipOval(child: FoodImage(cr.imageUrl, width: 68, height: 68)),
                  const SizedBox(height: 6),
                  Text(cr.name, maxLines: 2, textAlign: TextAlign.center, style: OsText.weight(OsText.small, 600).copyWith(color: OsColors.ink700, height: 1.2)),
                ]),
              ),
            ),
        ]),
      ],
    );
  }

  Widget _results(List<(Stall, List<MenuItem>)> results, int total, String q, String? cravingName, String? stallName, double cardW) {
    if (results.isEmpty) {
      return ListView(padding: const EdgeInsets.all(40), children: [
        Text(q.isNotEmpty ? 'Nothing matches “${_query.text.trim()}”' : 'Nothing matches these filters', textAlign: TextAlign.center, style: OsText.heading),
        const SizedBox(height: 6),
        Text('Check the spelling, or remove a filter.', textAlign: TextAlign.center, style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
        if (_filtered) Center(child: TextButton(onPressed: _clearFilters, child: const Text('Clear filters'))),
      ]);
    }
    final title = q.isNotEmpty ? 'Results for “${_query.text.trim()}”' : (cravingName ?? stallName ?? 'Dishes');
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
      children: [
        Text.rich(TextSpan(children: [
          TextSpan(text: title, style: OsText.heading),
          TextSpan(text: '  ${total == 1 ? '1 dish' : '$total dishes'}', style: OsText.weight(OsText.label, 600).copyWith(color: OsColors.ink500)),
        ])),
        for (final (s, items) in results) ...[
          const SizedBox(height: 16),
          Row(children: [Text(s.name, style: OsText.subheading), const SizedBox(width: 8), OpenStatus(s)]),
          const SizedBox(height: 12),
          // Remember the search once someone acts on a result.
          Listener(
            onPointerUp: (_) => q.isNotEmpty ? AppScope.read(context).addRecentSearch(_query.text) : null,
            child: Wrap(spacing: 16, runSpacing: 20, children: [for (final m in items) DishCard(item: m, stall: s, width: cardW)]),
          ),
        ],
      ],
    );
  }

  Widget _chip(String label, bool selected, VoidCallback onTap, {IconData? icon, Diet? mark, bool dropdown = false}) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: FilterChip(
          selected: selected,
          onSelected: (_) {
            _focus.unfocus(); // put the keyboard away so the filtered results are visible
            onTap();
          },
          avatar: mark != null ? DietMark(mark, size: 12) : (icon != null ? Icon(icon, size: 16, color: selected ? Colors.white : OsColors.ink700) : null),
          label: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(label),
            if (dropdown) Icon(Icons.expand_more, size: 18, color: selected ? Colors.white : OsColors.ink700),
          ]),
          labelStyle: OsText.label.copyWith(color: selected ? Colors.white : OsColors.ink700),
          selectedColor: OsColors.night900,
          side: BorderSide(color: selected ? OsColors.night900 : OsColors.line),
        ),
      );
}
