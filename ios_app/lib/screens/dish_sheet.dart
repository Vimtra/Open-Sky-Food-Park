import 'package:cupertino_ui/cupertino_ui.dart';
import 'package:flutter/services.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../data/options.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/kit.dart';

/// Opens a dish as a bottom sheet over the current screen (photo, details, options, add to cart).
Future<void> showDish(BuildContext context, MenuItem item) => showCupertinoModalPopup<void>(
      context: context,
      barrierColor: const Color(0x990B1230),
      builder: (_) => DishSheet(item: item),
    );

/// The dish sheet. Dishes with options (contract v1.6: size, spice, add-ons) are chosen here,
/// with a note for the truck and a quantity; the price is the dish plus its options.
class DishSheet extends StatefulWidget {
  const DishSheet({super.key, required this.item});
  final MenuItem item;

  @override
  State<DishSheet> createState() => _DishSheetState();
}

class _DishSheetState extends State<DishSheet> {
  late final List<OptionGroupView> _groups;
  late final Set<String> _picked;
  final _note = TextEditingController();
  int _qty = 1;
  bool _tried = false;

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
    HapticFeedback.selectionClick();
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
    final item = widget.item;
    final state = AppScope.of(context);
    final stall = state.catalog.stallById[item.stallId];
    final section = state.catalog.categoryById[item.categoryId]?.name;
    final qtyInCart = state.qtyOf(item.id);
    final bottom = MediaQuery.paddingOf(context).bottom;
    final maxH = MediaQuery.sizeOf(context).height * 0.9;
    final custom = _groups.isNotEmpty;
    final ids = _picked.toList();
    final problem = custom ? checkChoice(_groups, ids, strict: true) : null;
    final unit = custom ? priceWithOptions(item, _groups, ids).unitPriceCents : item.priceCents;
    final canOrder = item.isAvailable && (stall?.isOpen ?? false);
    final fav = state.isFavouriteItem(item.id);

    void addToCart() {
      setState(() => _tried = true);
      if (problem != null) return;
      AppScope.read(context).add(item.id, optionIds: ids, qty: _qty, note: _note.text.trim().isEmpty ? null : _note.text.trim());
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop();
    }

    return Container(
      constraints: BoxConstraints(maxHeight: maxH),
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      decoration: const BoxDecoration(
        color: OsColors.surface0,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Stack(
                    children: [
                      AspectRatio(aspectRatio: custom ? 1.6 : 1.15, child: FoodImage(item.imageUrl)),
                      Positioned(
                        top: 12,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: Container(width: 40, height: 5, decoration: BoxDecoration(color: const Color(0xCCFFFFFF), borderRadius: BorderRadius.circular(3))),
                        ),
                      ),
                      Positioned(
                        top: 14,
                        right: 14,
                        child: Row(children: [
                          _RoundButton(
                            icon: fav ? CupertinoIcons.heart_fill : CupertinoIcons.heart,
                            color: fav ? OsColors.chili600 : OsColors.surface0,
                            semantic: fav ? 'Remove from favourites' : 'Save to favourites',
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
                              s.toggleFavouriteItem(item.id);
                            },
                          ),
                          const SizedBox(width: 8),
                          _RoundButton(icon: CupertinoIcons.xmark, semantic: 'Close', onTap: () => Navigator.of(context).pop()),
                        ]),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            DietMark(item.diet),
                            if (item.diet != null) const SizedBox(width: 8),
                            if (section != null) Text(section, style: OsText.small),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(item.name, style: OsText.title),
                        const SizedBox(height: 6),
                        Text(money(item.priceCents), style: OsText.weight(OsText.subheading, 800).copyWith(fontFeatures: OsText.tabular)),
                        if (item.blurb != null) ...[
                          const SizedBox(height: 10),
                          Text(item.blurb!, style: OsText.body.copyWith(color: OsColors.ink700)),
                        ],
                        if (stall != null) ...[
                          const SizedBox(height: 18),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(color: OsColors.surface1, borderRadius: BorderRadius.circular(OsRadius.lg)),
                            child: Row(
                              children: [
                                ClipOval(child: FoodImage(stall.logoUrl, width: 40, height: 40)),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(stall.name, style: OsText.bodyStrong),
                                      const SizedBox(height: 2),
                                      OpenStatus(stall.isOpen, label: stall.statusLabel),
                                    ],
                                  ),
                                ),
                                const Icon(CupertinoIcons.ticket, size: 18, color: OsColors.ink500),
                                const SizedBox(width: 6),
                                Text('Token at pickup', style: OsText.small),
                              ],
                            ),
                          ),
                        ],
                        for (final g in _groups) _GroupPicker(group: g, picked: _picked, showError: _tried, onToggle: (o) => _toggle(g, o)),
                        if (custom && canOrder) ...[
                          const SizedBox(height: 20),
                          Text('Note for the truck', style: OsText.bodyStrong),
                          const SizedBox(height: 8),
                          CupertinoTextField(
                            controller: _note,
                            placeholder: 'e.g. no onions (optional)',
                            maxLength: maxLineNote,
                            padding: const EdgeInsets.all(12),
                            style: OsText.body,
                            decoration: BoxDecoration(color: OsColors.surface1, borderRadius: BorderRadius.circular(OsRadius.md)),
                          ),
                        ],
                        const SizedBox(height: 12),
                        Text('Ask the truck about ingredients and allergens before you order.', style: OsText.small),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_tried && problem != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Text(friendlyError(problem), style: OsText.weight(OsText.small, 700).copyWith(color: OsColors.chili600)),
            ),
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, 12 + bottom),
            decoration: const BoxDecoration(
              color: OsColors.surface0,
              border: Border(top: BorderSide(color: OsColors.line)),
            ),
            child: custom
                ? Row(children: [
                    _QtyStepper(qty: _qty, onChanged: (q) => setState(() => _qty = q)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: PrimaryButton(
                        label: canOrder ? 'Add · ${money(unit * _qty)}' : (item.isAvailable ? (stall?.statusLabel ?? 'Closed') : 'Sold out'),
                        onTap: canOrder ? addToCart : null,
                        height: 50,
                      ),
                    ),
                  ])
                : Row(
                    children: [
                      AddButton(item: item, width: 116, height: 50, shadow: false),
                      const SizedBox(width: 12),
                      Expanded(
                        child: PrimaryButton(
                          label: qtyInCart == 0 ? 'Add item · ${money(item.priceCents)}' : 'Done · ${money(item.priceCents * qtyInCart)}',
                          onTap: canOrder
                              ? () {
                                  if (qtyInCart == 0) AppScope.read(context).add(item.id);
                                  Navigator.of(context).pop();
                                }
                              : null,
                          height: 50,
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

class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.semantic, required this.onTap, this.color = OsColors.surface0});
  final IconData icon;
  final String semantic;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) => Press(
        semanticLabel: semantic,
        onTap: onTap,
        child: Container(
          width: 36,
          height: 36,
          decoration: const BoxDecoration(color: Color(0xB30B1230), shape: BoxShape.circle),
          child: Icon(icon, size: 17, color: color),
        ),
      );
}

/// One group of choices: a radio list (pick one) or a checklist (up to N), with its rule.
class _GroupPicker extends StatelessWidget {
  const _GroupPicker({required this.group, required this.picked, required this.showError, required this.onToggle});
  final OptionGroupView group;
  final Set<String> picked;
  final bool showError;
  final ValueChanged<MenuOption> onToggle;

  @override
  Widget build(BuildContext context) {
    final count = group.options.where((o) => picked.contains(o.id)).length;
    final short = showError && (count < group.group.minSelect || count > group.group.maxSelect);
    final full = !group.single && count >= group.group.maxSelect;
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text(group.group.name, style: OsText.bodyStrong)),
          Text(ruleText(group.group), style: OsText.weight(OsText.small, 600).copyWith(color: short ? OsColors.chili600 : OsColors.ink500)),
        ]),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(border: Border.all(color: OsColors.line), borderRadius: BorderRadius.circular(OsRadius.md)),
          child: Column(children: [
            for (final (i, o) in group.options.indexed) ...[
              if (i > 0) const SizedBox(height: 1, child: ColoredBox(color: OsColors.line)),
              _OptionRow(
                option: o,
                single: group.single,
                on: picked.contains(o.id),
                enabled: o.isAvailable && (picked.contains(o.id) || !full),
                onTap: () => onToggle(o),
              ),
            ],
          ]),
        ),
      ]),
    );
  }
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.option, required this.single, required this.on, required this.enabled, required this.onTap});
  final MenuOption option;
  final bool single, on, enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final icon = single
        ? (on ? CupertinoIcons.largecircle_fill_circle : CupertinoIcons.circle)
        : (on ? CupertinoIcons.checkmark_square_fill : CupertinoIcons.square);
    return Semantics(
      button: true,
      selected: on,
      enabled: enabled,
      label: '${option.name}${option.priceCents > 0 ? ', plus ${money(option.priceCents)}' : ''}${option.isAvailable ? '' : ', sold out'}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? onTap : null,
        child: Opacity(
          opacity: enabled ? 1 : 0.45,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            child: Row(children: [
              Icon(icon, size: 22, color: on ? OsColors.ember600 : OsColors.ink300),
              const SizedBox(width: 12),
              Expanded(child: Text(option.isAvailable ? option.name : '${option.name} · sold out', style: OsText.label)),
              if (option.priceCents > 0) Text('+${money(option.priceCents)}', style: OsText.label.copyWith(color: OsColors.ink700, fontFeatures: OsText.tabular)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _QtyStepper extends StatelessWidget {
  const _QtyStepper({required this.qty, required this.onChanged});
  final int qty;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget step(IconData icon, int? to, String label) => Semantics(
          button: true,
          label: label,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: to == null ? null : () => onChanged(to),
            child: SizedBox(width: 38, height: 50, child: Icon(icon, size: 17, color: to == null ? OsColors.ink300 : OsColors.leaf600)),
          ),
        );
    return Container(
      height: 50,
      decoration: BoxDecoration(border: Border.all(color: OsColors.line), borderRadius: BorderRadius.circular(OsRadius.md - 2)),
      child: Row(children: [
        step(CupertinoIcons.minus, qty > 1 ? qty - 1 : null, 'Fewer'),
        SizedBox(width: 26, child: Text('$qty', textAlign: TextAlign.center, style: OsText.weight(OsText.bodyStrong, 800).copyWith(color: OsColors.leaf600, fontFeatures: OsText.tabular))),
        step(CupertinoIcons.plus, qty < maxQty ? qty + 1 : null, 'More'),
      ]),
    );
  }
}
