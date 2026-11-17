import 'package:cupertino_ui/cupertino_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/kit.dart';

/// Opens a dish as a bottom sheet over the current screen (photo, details, add to cart).
Future<void> showDish(BuildContext context, MenuItem item) => showCupertinoModalPopup<void>(
      context: context,
      barrierColor: const Color(0x990B1230),
      builder: (_) => DishSheet(item: item),
    );

class DishSheet extends StatelessWidget {
  const DishSheet({super.key, required this.item});
  final MenuItem item;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final stall = state.catalog.stallById[item.stallId];
    final section = state.catalog.categoryById[item.categoryId]?.name;
    final qty = state.qtyOf(item.id);
    final bottom = MediaQuery.paddingOf(context).bottom;
    final maxH = MediaQuery.sizeOf(context).height * 0.88;

    return Container(
      constraints: BoxConstraints(maxHeight: maxH),
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
                      AspectRatio(aspectRatio: 1.15, child: FoodImage(item.imageUrl)),
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
                        child: Press(
                          semanticLabel: 'Close',
                          onTap: () => Navigator.of(context).pop(),
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: const BoxDecoration(color: Color(0xB30B1230), shape: BoxShape.circle),
                            child: const Icon(CupertinoIcons.xmark, size: 17, color: OsColors.surface0),
                          ),
                        ),
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
                                      OpenStatus(stall.isOpen),
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
                        const SizedBox(height: 12),
                        Text('Ask the truck about ingredients and allergens before you order.', style: OsText.small),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, 12 + bottom),
            decoration: const BoxDecoration(
              color: OsColors.surface0,
              border: Border(top: BorderSide(color: OsColors.line)),
            ),
            child: Row(
              children: [
                AddButton(item: item, width: 116, height: 50, shadow: false),
                const SizedBox(width: 12),
                Expanded(
                  child: PrimaryButton(
                    label: qty == 0 ? 'Add item · ${money(item.priceCents)}' : 'Done · ${money(item.priceCents * qty)}',
                    onTap: (item.isAvailable && (stall?.isOpen ?? false))
                        ? () {
                            if (qty == 0) AppScope.read(context).add(item.id);
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
