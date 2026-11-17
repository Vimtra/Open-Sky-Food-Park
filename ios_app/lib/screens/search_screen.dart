import 'package:cupertino_ui/cupertino_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/kit.dart';
import 'dish_sheet.dart';

/// Search across every truck (or one truck, when opened from its tab).
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.stallId, this.autofocus = true});
  final String? stallId;
  final bool autofocus;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _q = TextEditingController();
  String get _query => _q.text.trim().toLowerCase();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  List<MenuItem> _results(AppState state) {
    final cat = state.catalog;
    final q = _query;
    if (q.isEmpty) return const [];
    return cat.items.where((m) {
      if (widget.stallId != null && m.stallId != widget.stallId) return false;
      if (!state.vegOk(m)) return false;
      final stall = cat.stallById[m.stallId];
      final section = cat.categoryById[m.categoryId]?.name ?? '';
      final hay = '${m.name} ${m.description ?? ''} $section ${stall?.name ?? ''} ${stall?.cuisines.join(' ') ?? ''}'.toLowerCase();
      return q.split(RegExp(r'\s+')).every(hay.contains);
    }).toList();
  }

  void _use(String text) {
    _q.text = text;
    _q.selection = TextSelection.collapsed(offset: text.length);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final cat = state.catalog;
    final stall = widget.stallId == null ? null : cat.stallById[widget.stallId];
    final results = _results(state);

    return CupertinoPageScaffold(
      backgroundColor: OsColors.surface0,
      navigationBar: CupertinoNavigationBar(
        backgroundColor: OsColors.surface0,
        border: null,
        middle: Text(stall == null ? 'Search' : 'Search ${stall.name}', style: OsText.bodyStrong),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: CupertinoSearchTextField(
                controller: _q,
                autofocus: widget.autofocus,
                placeholder: 'Dishes, drinks or trucks',
                style: OsText.body,
                padding: const EdgeInsetsDirectional.fromSTEB(6, 12, 6, 12),
                onChanged: (_) => setState(() {}),
                onSubmitted: (v) => AppScope.read(context).addRecentSearch(v),
              ),
            ),
            Expanded(
              child: _query.isEmpty
                  ? ListView(
                      padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 90),
                      children: [
                        if (state.recentSearches.isNotEmpty) ...[
                          SectionTitle('Recent', action: 'Clear', onAction: () => AppScope.read(context).clearRecentSearches(), padding: const EdgeInsets.fromLTRB(16, 12, 16, 8)),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Wrap(spacing: 8, runSpacing: 8, children: [
                              for (final r in state.recentSearches)
                                Press(
                                  onTap: () => _use(r),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    decoration: BoxDecoration(color: OsColors.surface1, borderRadius: BorderRadius.circular(99)),
                                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                                      const Icon(CupertinoIcons.clock, size: 14, color: OsColors.ink500),
                                      const SizedBox(width: 6),
                                      Text(r, style: OsText.label),
                                    ]),
                                  ),
                                ),
                            ]),
                          ),
                        ],
                        const SectionTitle('Popular right now', padding: EdgeInsets.fromLTRB(16, 20, 16, 8)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Wrap(spacing: 8, runSpacing: 8, children: [
                            for (final c in cat.cravings)
                              Press(
                                onTap: () => _use(c.name),
                                child: Container(
                                  padding: const EdgeInsets.fromLTRB(4, 4, 14, 4),
                                  decoration: BoxDecoration(border: Border.all(color: OsColors.line), borderRadius: BorderRadius.circular(99)),
                                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                                    ClipOval(child: FoodImage(c.imageUrl, width: 30, height: 30)),
                                    const SizedBox(width: 8),
                                    Text(c.name, style: OsText.label),
                                  ]),
                                ),
                              ),
                          ]),
                        ),
                      ],
                    )
                  : results.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(children: [
                            const Icon(CupertinoIcons.search, size: 40, color: OsColors.ink300),
                            const SizedBox(height: 12),
                            Text('Nothing matches “${_q.text.trim()}”', textAlign: TextAlign.center, style: OsText.subheading),
                            const SizedBox(height: 6),
                            Text(state.vegOnly ? 'VEG is on, which hides non-veg and egg dishes.' : 'Try a dish name, a truck, or “falooda”.',
                                textAlign: TextAlign.center, style: OsText.small),
                          ]),
                        )
                      : ListView.separated(
                          padding: EdgeInsets.only(top: 4, bottom: MediaQuery.paddingOf(context).bottom + 90),
                          itemCount: results.length,
                          separatorBuilder: (_, _) => const Padding(padding: EdgeInsets.only(left: 92), child: SizedBox(height: 1, child: ColoredBox(color: OsColors.line))),
                          itemBuilder: (_, i) {
                            final m = results[i];
                            return GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () {
                                AppScope.read(context).addRecentSearch(_q.text);
                                showDish(context, m);
                              },
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                child: Row(children: [
                                  ClipRRect(borderRadius: BorderRadius.circular(14), child: FoodImage(m.imageUrl, width: 64, height: 64)),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Row(children: [
                                        DietMark(m.diet, size: 13),
                                        if (m.diet != null) const SizedBox(width: 6),
                                        Expanded(child: Text(m.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.bodyStrong)),
                                      ]),
                                      const SizedBox(height: 2),
                                      Text('${money(m.priceCents)} · ${cat.stallById[m.stallId]?.name ?? ''}', style: OsText.small.copyWith(fontFeatures: OsText.tabular)),
                                    ]),
                                  ),
                                  const SizedBox(width: 10),
                                  AddButton(item: m, width: 84, height: 34, shadow: false),
                                ]),
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
