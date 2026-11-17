import 'package:material_ui/material_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/routes.dart';
import 'order_screen.dart';

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key, this.onBrowse});
  final VoidCallback? onBrowse;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final orders = app.orders;
    final top = MediaQuery.paddingOf(context).top;

    if (orders.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(color: OsColors.surface1, shape: BoxShape.circle),
              child: const Icon(Icons.receipt_long_outlined, size: 28, color: OsColors.ink500),
            ),
            const SizedBox(height: 16),
            Text('No orders yet', style: OsText.heading),
            const SizedBox(height: 6),
            Text('Your orders and tokens show up here.', style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
            const SizedBox(height: 20),
            FilledButton(onPressed: onBrowse, child: const Text('Browse the food trucks')),
          ]),
        ),
      );
    }

    return ListView(
      padding: EdgeInsets.fromLTRB(16, top + 20, 16, 32),
      children: [
        Text('Your orders', style: OsText.title),
        const SizedBox(height: 16),
        for (final o in orders) ...[
          InkWell(
            onTap: () => openOrder(context, o.id),
            borderRadius: BorderRadius.circular(OsRadius.lg),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(OsRadius.lg), border: Border.all(color: OsColors.line)),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(orderHeadline(o), style: OsText.weight(OsText.bodyStrong, 800)),
                    const SizedBox(height: 4),
                    Text(
                      '${o.orderNo} · ${o.stallOrders.map((s) => '${s.stallName} #${s.tokenNo}').join(', ')}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: OsText.small.copyWith(fontFeatures: OsText.tabular),
                    ),
                  ]),
                ),
                const SizedBox(width: 12),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(money(o.totalCents), style: OsText.weight(OsText.label, 700).copyWith(fontFeatures: OsText.tabular)),
                  if (o.status == OrderStatus.active)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: OsColors.ember100, borderRadius: BorderRadius.circular(99)),
                      child: Text('Live', style: OsText.weight(OsText.caption, 700).copyWith(color: OsColors.ember700)),
                    ),
                ]),
                const Icon(Icons.chevron_right, color: OsColors.ink500),
              ]),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}
