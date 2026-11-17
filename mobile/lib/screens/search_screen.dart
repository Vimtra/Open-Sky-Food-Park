import 'package:material_ui/material_ui.dart';

import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/widgets.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.initialCraving, this.standalone = false});
  final String? initialCraving;

  /// Pushed from a craving circle (has a back button) rather than shown as a tab.
  final bool standalone;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _query = TextEditingController();
  String? _craving;

  @override
  void initState() {
    super.initState();
    _craving = widget.initialCraving;
    _query.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).catalog;
    final q = _query.text.trim().toLowerCase();
    final cravingName = c.cravings.where((x) => x.slug == _craving).firstOrNull?.name;

    List<(Stall, List<MenuItem>)>? results;
    if (q.isNotEmpty || _craving != null) {
      results = [];
      for (final s in c.stalls) {
        final stallHit = q.isNotEmpty && (s.name.toLowerCase().contains(q) || s.cuisines.any((x) => x.toLowerCase().contains(q)));
        final items = (c.itemsByStall[s.id] ?? const <MenuItem>[])
            .where((m) =>
                (_craving == null || m.craving == _craving) &&
                (q.isEmpty || stallHit || m.name.toLowerCase().contains(q) || (c.categoryById[m.categoryId]?.name.toLowerCase().contains(q) ?? false)))
            .toList();
        if (items.isNotEmpty) results.add((s, items));
      }
    }
    final total = results?.fold<int>(0, (n, g) => n + g.$2.length) ?? 0;
    final cardW = (MediaQuery.sizeOf(context).width - 16 * 2 - 16) / 2;

    final body = CustomScrollView(slivers: [
      SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, widget.standalone ? 8 : MediaQuery.paddingOf(context).top + 20, 16, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('What are you craving?', style: OsText.title),
            const SizedBox(height: 14),
            TextField(
              controller: _query,
              autofocus: !widget.standalone && widget.initialCraving == null,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Search dishes and trucks',
                prefixIcon: const Icon(Icons.search, color: OsColors.ink500),
                suffixIcon: _query.text.isEmpty ? null : IconButton(tooltip: 'Clear search', icon: const Icon(Icons.close), onPressed: _query.clear),
              ),
            ),
          ]),
        ),
      ),
      SliverToBoxAdapter(
        child: SizedBox(
          height: 60,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            children: [
              for (final cr in c.cravings)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(cr.name),
                    selected: cr.slug == _craving,
                    labelStyle: OsText.label.copyWith(color: cr.slug == _craving ? Colors.white : OsColors.ink700),
                    onSelected: (_) => setState(() => _craving = cr.slug == _craving ? null : cr.slug),
                  ),
                ),
            ],
          ),
        ),
      ),
      if (results == null) ...[
        SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.fromLTRB(16, 20, 16, 12), child: Text('Browse by truck', style: OsText.heading))),
        SliverList.list(children: [
          for (final s in c.stalls)
            Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 14), child: TruckCard(stall: s, itemCount: c.itemsByStall[s.id]?.length ?? 0)),
        ]),
      ] else if (results.isEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(40),
            child: Column(children: [
              Text('Nothing matches ${q.isNotEmpty ? '“${_query.text.trim()}”' : cravingName}', textAlign: TextAlign.center, style: OsText.heading),
              const SizedBox(height: 6),
              Text('Check the spelling, or pick one of the categories above.', textAlign: TextAlign.center, style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
            ]),
          ),
        )
      else ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Text.rich(TextSpan(children: [
              TextSpan(text: cravingName != null && q.isEmpty ? cravingName : 'Results for “${_query.text.trim()}”', style: OsText.heading),
              TextSpan(text: '  ${plural(total)}', style: OsText.weight(OsText.label, 600).copyWith(color: OsColors.ink500)),
            ])),
          ),
        ),
        for (final (s, items) in results)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [Text(s.name, style: OsText.subheading), const SizedBox(width: 8), OpenStatus(s)]),
                const SizedBox(height: 12),
                Wrap(spacing: 16, runSpacing: 20, children: [for (final m in items) DishCard(item: m, stall: s, width: cardW)]),
              ]),
            ),
          ),
      ],
      const SliverToBoxAdapter(child: SizedBox(height: 120)),
    ]);

    return Scaffold(
      appBar: widget.standalone ? AppBar() : null,
      body: Stack(children: [
        body,
        if (widget.standalone) const Positioned(left: 0, right: 0, bottom: 0, child: SafeArea(top: false, child: CartBar())),
      ]),
    );
  }

  String plural(int n) => n == 1 ? '1 dish' : '$n dishes';
}
