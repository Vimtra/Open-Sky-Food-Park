import 'package:cupertino_ui/cupertino_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/kit.dart';

String ticketLabel(TicketStatus s) => switch (s) {
      TicketStatus.pending => 'Waiting for payment',
      TicketStatus.placed => 'Sent to truck',
      TicketStatus.preparing => 'Preparing',
      TicketStatus.ready => 'Ready',
      TicketStatus.completed => 'Collected',
      TicketStatus.cancelled => 'Cancelled',
    };

String _headline(Order o) {
  if (o.status == OrderStatus.cancelled) return 'Order cancelled';
  if (o.status == OrderStatus.completed) return 'Enjoy your food';
  final live = o.stallOrders.where((s) => s.status != TicketStatus.completed && s.status != TicketStatus.cancelled).toList();
  final ready = live.where((s) => s.status == TicketStatus.ready).toList();
  if (ready.isNotEmpty) {
    if (o.fulfilment == Fulfilment.table) return 'On its way to table ${o.tableNo}';
    return ready.length == live.length && live.length > 1 ? 'Everything is ready' : 'Token ${ready.first.tokenNo} is ready';
  }
  if (live.any((s) => s.status == TicketStatus.preparing)) return 'Being prepared';
  return 'Sent to the trucks';
}

/// One order: a big token card per truck that moves Sent → Preparing → Ready by itself.
class OrderScreen extends StatelessWidget {
  const OrderScreen({super.key, required this.orderId, this.justPlaced = false});
  final String orderId;
  final bool justPlaced;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final order = state.orderById(orderId);
    if (order == null) {
      return const CupertinoPageScaffold(child: Center(child: Text('Order not found')));
    }
    final bottom = MediaQuery.paddingOf(context).bottom;

    return CupertinoPageScaffold(
      backgroundColor: OsColors.surface1,
      child: CustomScrollView(
        slivers: [
          CupertinoSliverNavigationBar(
            backgroundColor: OsColors.surface1,
            border: null,
            largeTitle: Text(_headline(order)),
            middle: Text(order.orderNo),
            alwaysShowMiddle: false,
          ),
          SliverPadding(
            padding: EdgeInsets.fromLTRB(16, 4, 16, bottom + 100),
            sliver: SliverList.list(children: [
              Text(
                '${order.orderNo} · ${order.fulfilment == Fulfilment.table ? 'Table ${order.tableNo}' : 'Pickup'} · '
                '${order.paymentMethod == PaymentMethod.online ? 'Paid' : 'Pay at the truck'}',
                style: OsText.label.copyWith(color: OsColors.ink700, fontWeight: FontWeight.w500),
              ),
              if (justPlaced && order.status == OrderStatus.active) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: OsColors.leaf50, borderRadius: BorderRadius.circular(OsRadius.lg)),
                  child: Row(children: [
                    const Icon(CupertinoIcons.check_mark_circled_solid, color: OsColors.leaf600),
                    const SizedBox(width: 10),
                    Expanded(child: Text('Order placed. Keep this screen handy: tokens update by themselves.', style: OsText.label.copyWith(color: OsColors.leaf700))),
                  ]),
                ),
              ],
              const SizedBox(height: 16),
              for (final so in order.stallOrders) ...[
                _TokenCard(order: order, so: so, logo: state.catalog.stallById[so.stallId]?.logoUrl),
                const SizedBox(height: 14),
              ],
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: OsColors.surface0, borderRadius: BorderRadius.circular(OsRadius.xl - 4)),
                child: Column(children: [
                  for (final (l, c) in [
                    ('Item total', order.itemTotalCents),
                    if (order.taxCents > 0) ('Sales tax', order.taxCents),
                    if (order.serviceFeeCents > 0) ('Service fee', order.serviceFeeCents),
                  ])
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(children: [
                        Expanded(child: Text(l, style: OsText.label.copyWith(color: OsColors.ink700, fontWeight: FontWeight.w500))),
                        Text(money(c), style: OsText.label.copyWith(fontFeatures: OsText.tabular)),
                      ]),
                    ),
                  const SizedBox(height: 6),
                  Row(children: [
                    Expanded(child: Text('Total', style: OsText.weight(OsText.subheading, 800))),
                    Text(money(order.totalCents), style: OsText.weight(OsText.subheading, 800).copyWith(fontFeatures: OsText.tabular)),
                  ]),
                ]),
              ),
              if (state.canCancel(order)) ...[
                const SizedBox(height: 16),
                CupertinoButton(
                  onPressed: () => showCupertinoDialog<void>(
                    context: context,
                    builder: (d) => CupertinoAlertDialog(
                      title: const Text('Cancel this order?'),
                      content: const Text('You can cancel until a truck starts cooking.'),
                      actions: [
                        CupertinoDialogAction(onPressed: () => Navigator.of(d).pop(), child: const Text('Keep it')),
                        CupertinoDialogAction(
                          isDestructiveAction: true,
                          onPressed: () {
                            AppScope.read(context).cancel(order);
                            Navigator.of(d).pop();
                          },
                          child: const Text('Cancel order'),
                        ),
                      ],
                    ),
                  ),
                  child: Text('Cancel order', style: OsText.weight(OsText.bodyStrong, 700).copyWith(color: OsColors.chili600)),
                ),
              ],
              const SizedBox(height: 8),
              Text('Demo: orders stay on this phone and move along by themselves.', textAlign: TextAlign.center, style: OsText.small),
            ]),
          ),
        ],
      ),
    );
  }
}

class _TokenCard extends StatelessWidget {
  const _TokenCard({required this.order, required this.so, required this.logo});
  final Order order;
  final StallOrder so;
  final String? logo;

  @override
  Widget build(BuildContext context) {
    final ready = so.status == TicketStatus.ready;
    final done = so.status == TicketStatus.completed || so.status == TicketStatus.cancelled;
    final step = switch (so.status) {
      TicketStatus.placed => 1,
      TicketStatus.preparing => 2,
      TicketStatus.ready || TicketStatus.completed => 3,
      _ => 0,
    };
    final tokenBg = ready ? OsColors.leaf600 : (done ? OsColors.surface2 : OsColors.night900);
    final guidance = switch (so.status) {
      TicketStatus.placed => '${so.stallName} has your order.',
      TicketStatus.preparing => order.fulfilment == Fulfilment.table ? 'Cooking now. It comes to table ${order.tableNo}.' : 'Cooking now. We’ll show Ready here.',
      TicketStatus.ready => order.fulfilment == Fulfilment.table ? 'On its way to your table.' : 'Collect at ${so.stallName}. Show token ${so.tokenNo}.',
      TicketStatus.completed => 'Collected. Enjoy!',
      TicketStatus.cancelled => 'Cancelled.',
      TicketStatus.pending => 'Waiting for payment.',
    };

    return AnimatedContainer(
      duration: OsMotion.page,
      curve: OsMotion.enter,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ready ? OsColors.leaf50 : OsColors.surface0,
        borderRadius: BorderRadius.circular(OsRadius.xl),
        border: Border.all(color: ready ? OsColors.leaf600 : const Color(0x00000000), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AnimatedContainer(
                duration: OsMotion.page,
                width: 86,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(color: tokenBg, borderRadius: BorderRadius.circular(OsRadius.lg - 4)),
                child: Column(children: [
                  Text('TOKEN', style: OsText.weight(OsText.caption, 800).copyWith(color: done ? OsColors.ink500 : const Color(0xCCFFFFFF), letterSpacing: 1)),
                  Text('${so.tokenNo}', style: OsText.token.copyWith(color: done ? OsColors.ink500 : OsColors.surface0, fontFeatures: OsText.tabular)),
                ]),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      if (logo != null) ...[ClipOval(child: FoodImage(logo, width: 26, height: 26)), const SizedBox(width: 8)],
                      Expanded(child: Text(so.stallName, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.subheading)),
                    ]),
                    const SizedBox(height: 6),
                    Pill(ticketLabel(so.status),
                        color: ready ? OsColors.leaf600 : (so.status == TicketStatus.preparing ? OsColors.ember100 : OsColors.surface2),
                        textColor: ready ? OsColors.surface0 : (so.status == TicketStatus.preparing ? OsColors.ember700 : OsColors.ink700)),
                    const SizedBox(height: 8),
                    Text(guidance, style: OsText.label.copyWith(color: ready ? OsColors.leaf700 : OsColors.ink700, fontWeight: ready ? FontWeight.w800 : FontWeight.w500)),
                  ],
                ),
              ),
            ],
          ),
          if (so.status != TicketStatus.cancelled) ...[
            const SizedBox(height: 16),
            Row(children: [
              for (var i = 1; i <= 3; i++) ...[
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: SizedBox(
                        height: 6,
                        child: Stack(children: [
                          const Positioned.fill(child: ColoredBox(color: OsColors.surface2)),
                          AnimatedFractionallySizedBox(
                            duration: OsMotion.page,
                            curve: OsMotion.enter,
                            alignment: Alignment.centerLeft,
                            heightFactor: 1,
                            widthFactor: i <= step ? 1 : 0,
                            child: const ColoredBox(color: OsColors.leaf600),
                          ),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(['Sent', 'Preparing', 'Ready'][i - 1],
                        style: OsText.weight(OsText.caption, i <= step ? 800 : 500).copyWith(color: i <= step ? OsColors.ink900 : OsColors.ink500)),
                  ]),
                ),
                if (i < 3) const SizedBox(width: 6),
              ],
            ]),
          ],
          const SizedBox(height: 14),
          for (final it in so.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                SizedBox(width: 28, child: Text('${it.qty}×', style: OsText.weight(OsText.label, 800).copyWith(fontFeatures: OsText.tabular))),
                DietMark(it.diet, size: 13),
                if (it.diet != null) const SizedBox(width: 6),
                Expanded(child: Text(it.name, style: OsText.label.copyWith(color: OsColors.ink700, fontWeight: FontWeight.w500))),
                Text(money(it.unitPriceCents * it.qty), style: OsText.label.copyWith(color: OsColors.ink700, fontFeatures: OsText.tabular)),
              ]),
            ),
        ],
      ),
    );
  }
}

/// Orders tab: live orders first, then past ones.
class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final orders = state.orders;
    final live = orders.where((o) => o.status == OrderStatus.active || o.status == OrderStatus.awaitingPayment).toList();
    final past = orders.where((o) => !live.contains(o)).toList();
    final bottom = MediaQuery.paddingOf(context).bottom;

    Widget row(Order o) {
      final itemCount = o.stallOrders.fold(0, (n, s) => n + s.items.fold(0, (m, i) => m + i.qty));
      return Press(
        scale: 0.98,
        onTap: () => Navigator.of(context).push(CupertinoPageRoute<void>(builder: (_) => OrderScreen(orderId: o.id))),
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: OsColors.surface0, borderRadius: BorderRadius.circular(OsRadius.xl - 4)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(o.stallOrders.map((s) => s.stallName).join(' + '), style: OsText.bodyStrong)),
              Text(money(o.totalCents), style: OsText.weight(OsText.bodyStrong, 800).copyWith(fontFeatures: OsText.tabular)),
            ]),
            const SizedBox(height: 4),
            Text('${o.orderNo} · ${plural(itemCount, 'item')}', style: OsText.small),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 6, children: [
              for (final s in o.stallOrders)
                Pill('#${s.tokenNo} · ${ticketLabel(s.status)}',
                    color: s.status == TicketStatus.ready ? OsColors.leaf600 : OsColors.surface1,
                    textColor: s.status == TicketStatus.ready ? OsColors.surface0 : OsColors.ink700),
            ]),
          ]),
        ),
      );
    }

    return CupertinoPageScaffold(
      backgroundColor: OsColors.surface1,
      child: CustomScrollView(slivers: [
        const CupertinoSliverNavigationBar(largeTitle: Text('Orders'), backgroundColor: OsColors.surface1, border: null),
        if (orders.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(CupertinoIcons.doc_text, size: 44, color: OsColors.ink300),
                const SizedBox(height: 12),
                Text('No orders yet', style: OsText.heading),
                const SizedBox(height: 6),
                Text('Your tokens show up here after you order.', textAlign: TextAlign.center, style: OsText.body.copyWith(color: OsColors.ink700)),
              ]),
            ),
          )
        else
          SliverPadding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, bottom + 90),
            sliver: SliverList.list(children: [
              if (live.isNotEmpty) ...[Text('In progress', style: OsText.subheading), const SizedBox(height: 10), ...live.map(row)],
              if (past.isNotEmpty) ...[const SizedBox(height: 10), Text('Past orders', style: OsText.subheading), const SizedBox(height: 10), ...past.map(row)],
            ]),
          ),
      ]),
    );
  }
}
