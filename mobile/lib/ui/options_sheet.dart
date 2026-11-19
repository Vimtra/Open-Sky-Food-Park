import 'package:material_ui/material_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../data/options.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import 'widgets.dart';

/// Contract v1.6 dish options: size, spice level, add-ons. Opens over the screen from ADD.
/// The price shown is the dish plus the chosen options, the same sum the server makes.
Future<void> showOptionsSheet(BuildContext context, MenuItem item) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: OsColors.surface0,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(OsRadius.xl))),
      builder: (_) => _OptionsSheet(item: item),
    );

class _OptionsSheet extends StatefulWidget {
  const _OptionsSheet({required this.item});
  final MenuItem item;

  @override
  State<_OptionsSheet> createState() => _OptionsSheetState();
}

class _OptionsSheetState extends State<_OptionsSheet> {
  late final List<OptionGroupView> _groups;
  late final Set<String> _picked;
  final _note = TextEditingController();
  int _qty = 1;

  @override
  void initState() {
    super.initState();
    _groups = AppScope.read(context).catalog.optionsOf(widget.item.id);
    _picked = defaultChoice(_groups).toSet();
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _toggle(OptionGroupView g, MenuOption o) {
    setState(() {
      if (g.single) {
        final had = _picked.contains(o.id);
        _picked.removeAll(g.options.map((x) => x.id));
        // A required single choice can't be cleared; an optional one can.
        if (!had || g.group.minSelect > 0) _picked.add(o.id);
      } else if (_picked.contains(o.id)) {
        _picked.remove(o.id);
      } else if (g.options.where((x) => _picked.contains(x.id)).length < g.group.maxSelect) {
        _picked.add(o.id);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final item = widget.item;
    final ids = _picked.toList();
    final problem = checkChoice(_groups, ids, strict: true);
    final unit = priceWithOptions(item, _groups, ids).unitPriceCents;
    final missing = _groups.where((g) => g.options.where((o) => _picked.contains(o.id)).length < g.group.minSelect).map((g) => g.group.name).toList();

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.88),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(child: Container(margin: const EdgeInsets.only(top: 10), width: 36, height: 4, decoration: BoxDecoration(color: OsColors.lineStrong, borderRadius: BorderRadius.circular(99)))),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 12, 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.only(top: 5), child: DietMark(item.diet)),
              if (item.diet != null) const SizedBox(width: 8),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(item.name, style: OsText.heading),
                  Text(money(item.priceCents), style: OsText.weight(OsText.label, 600).copyWith(color: OsColors.ink700, fontFeatures: OsText.tabular)),
                ]),
              ),
              IconButton(tooltip: 'Close', onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
            ]),
          ),
          const Divider(),
          Flexible(
            child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(20, 8, 20, 12), children: [
              for (final g in _groups) ...[
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: Text(g.group.name, style: OsText.subheading)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: g.group.minSelect > 0 ? OsColors.ember50 : OsColors.surface2,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(ruleText(g.group),
                        style: OsText.weight(OsText.caption, 700).copyWith(color: g.group.minSelect > 0 ? OsColors.ember700 : OsColors.ink700)),
                  ),
                ]),
                const SizedBox(height: 4),
                for (final o in g.options) _OptionRow(group: g, option: o, picked: _picked.contains(o.id), onTap: o.isAvailable ? () => _toggle(g, o) : null),
                const SizedBox(height: 6),
              ],
              const SizedBox(height: 8),
              TextField(
                controller: _note,
                maxLength: maxLineNote,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(labelText: 'Note for the truck (optional)', hintText: 'For example: no onions'),
              ),
            ]),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: OsColors.line))),
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (missing.isNotEmpty) ...[
                  Text('Choose ${missing.join(' and ')} to add this.', style: OsText.weight(OsText.small, 600).copyWith(color: OsColors.ember700)),
                  const SizedBox(height: 8),
                ],
                Row(children: [
                  _QtyStepper(qty: _qty, onChanged: (q) => setState(() => _qty = q)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: problem != null
                          ? null
                          : () {
                              app.add(item.id, optionIds: ids, qty: _qty, note: _note.text);
                              Navigator.pop(context);
                            },
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                      child: Text('Add · ${money(unit * _qty)}', style: const TextStyle(fontFeatures: OsText.tabular)),
                    ),
                  ),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.group, required this.option, required this.picked, required this.onTap});
  final OptionGroupView group;
  final MenuOption option;
  final bool picked;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final off = onTap == null;
    final icon = group.single
        ? (picked ? Icons.radio_button_checked : Icons.radio_button_off)
        : (picked ? Icons.check_box : Icons.check_box_outline_blank);
    return Semantics(
      selected: picked,
      enabled: !off,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(OsRadius.sm),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Row(children: [
            Icon(icon, size: 22, color: off ? OsColors.ink300 : (picked ? OsColors.leaf600 : OsColors.ink500)),
            const SizedBox(width: 12),
            Expanded(
              child: Text(option.name,
                  style: OsText.weight(OsText.label, picked ? 700 : 500).copyWith(color: off ? OsColors.ink500 : OsColors.ink900, fontSize: 15)),
            ),
            Text(
              off ? 'Sold out' : (option.priceCents == 0 ? '' : '+${money(option.priceCents)}'),
              style: OsText.weight(OsText.label, 600).copyWith(color: off ? OsColors.chili600 : OsColors.ink700, fontFeatures: OsText.tabular),
            ),
          ]),
        ),
      ),
    );
  }
}

/// − qty + for a line in the cart or the options sheet.
class _QtyStepper extends StatelessWidget {
  const _QtyStepper({required this.qty, required this.onChanged});
  final int qty;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) => LineStepper(
        qty: qty,
        label: 'quantity',
        onMinus: qty > 1 ? () => onChanged(qty - 1) : null,
        onPlus: qty < maxQty ? () => onChanged(qty + 1) : null,
      );
}

/// A small − qty + control used for one cart line (by its key, so options stay apart).
class LineStepper extends StatelessWidget {
  const LineStepper({super.key, required this.qty, required this.label, required this.onMinus, required this.onPlus});
  final int qty;
  final String label;
  final VoidCallback? onMinus, onPlus;

  @override
  Widget build(BuildContext context) {
    final style = OsText.weight(OsText.label, 800).copyWith(color: OsColors.leaf600, fontFeatures: OsText.tabular);
    Widget btn(IconData icon, String what, VoidCallback? onTap) => Semantics(
          button: true,
          label: '$what $label',
          child: InkWell(
            onTap: onTap,
            child: SizedBox(width: 36, height: 44, child: Icon(icon, size: 18, color: onTap == null ? OsColors.ink300 : OsColors.leaf600)),
          ),
        );
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: OsColors.surface0,
        borderRadius: BorderRadius.circular(OsRadius.md),
        border: Border.all(color: OsColors.line),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        btn(Icons.remove, 'Decrease', onMinus),
        SizedBox(width: 24, child: Text('$qty', textAlign: TextAlign.center, style: style)),
        btn(Icons.add, 'Increase', onPlus),
      ]),
    );
  }
}
