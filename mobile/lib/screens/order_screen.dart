import 'package:material_ui/material_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/routes.dart';
import '../ui/widgets.dart';
import 'contact_screen.dart';

String orderHeadline(Order o) {
  switch (o.status) {
    case OrderStatus.awaitingPayment:
      return 'Almost there';
    case OrderStatus.cancelled:
      return 'Order cancelled';
    case OrderStatus.completed:
      return 'Order complete';
    case OrderStatus.active:
      break;
  }
  final live = o.stallOrders.where((s) => s.status != TicketStatus.cancelled && s.status != TicketStatus.completed).toList();
  final ready = live.where((s) => s.status == TicketStatus.ready).toList();
  // Two trucks can both issue token 1, so name the truck with the number.
  String tokenReady(StallOrder s) => 'Token ${s.tokenNo} is ready at ${s.stallName}';
  if (ready.isNotEmpty && ready.length == live.length) {
    return o.fulfilment == Fulfilment.table ? 'On its way to your table' : (ready.length == 1 ? tokenReady(ready.first) : 'Everything is ready');
  }
  if (ready.isNotEmpty) return o.fulfilment == Fulfilment.table ? 'First dishes are on their way' : tokenReady(ready.first);
  if (live.any((s) => s.status == TicketStatus.preparing)) return 'Your order is being prepared';
  return 'Order sent to the trucks';
}

String _guidance(StallOrder s, Order o) {
  final table = o.fulfilment == Fulfilment.table;
  return switch (s.status) {
    TicketStatus.pending => 'We will send this to the truck once payment goes through.',
    TicketStatus.placed => '${s.stallName} has your order and will start shortly.',
    TicketStatus.preparing => table ? 'Being prepared. It will be brought to table ${o.tableNo}.' : 'Being prepared. We will tell you when it is ready.',
    TicketStatus.ready => table ? 'On its way to table ${o.tableNo}.' : 'Collect it at ${s.stallName}. Show token ${s.tokenNo}.',
    TicketStatus.completed => table ? 'Served. Enjoy!' : 'Collected. Enjoy!',
    TicketStatus.cancelled => 'Cancelled.',
  };
}

String _statusLabel(TicketStatus s) => switch (s) {
      TicketStatus.pending => 'Waiting for payment',
      TicketStatus.placed => 'Sent',
      TicketStatus.preparing => 'Preparing',
      TicketStatus.ready => 'Ready',
      TicketStatus.completed => 'Done',
      TicketStatus.cancelled => 'Cancelled',
    };

class OrderScreen extends StatelessWidget {
  const OrderScreen({super.key, required this.orderId});
  final String orderId;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final o = app.orderById(orderId);
    if (o == null) return Scaffold(appBar: AppBar(), body: const Center(child: Text('We could not find this order.')));
    final t = o.createdAt;
    final time = '${t.hour % 12 == 0 ? 12 : t.hour % 12}:${t.minute.toString().padLeft(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}';

    return Scaffold(
      appBar: AppBar(title: const Text('Your order')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          AnimatedSwitcher(
            duration: OsMotion.sheet,
            transitionBuilder: (c, a) => FadeTransition(opacity: a, child: c),
            child: Text(orderHeadline(o), key: ValueKey(orderHeadline(o)), style: OsText.title),
          ),
          const SizedBox(height: 6),
          Text(
            '${o.orderNo}  ·  $time  ·  ${o.fulfilment == Fulfilment.table ? 'Table ${o.tableNo}' : 'Pickup'}  ·  ${o.paymentMethod == PaymentMethod.online ? (AppState.demo ? 'Paid (demo)' : 'Paid') : 'Pay at the truck'}',
            style: OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink700, fontFeatures: OsText.tabular),
          ),
          if (AppState.demo && o.status == OrderStatus.active) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: OsColors.ember50, borderRadius: BorderRadius.circular(OsRadius.md)),
              child: Text('Demo: no truck receives this. The tokens move on by themselves so you can see how tracking works.', style: OsText.weight(OsText.small, 500).copyWith(color: OsColors.ink900)),
            ),
          ],
          if (o.status == OrderStatus.active && o.fulfilment == Fulfilment.pickup && o.paymentMethod == PaymentMethod.payAtStall) ...[
            const SizedBox(height: 12),
            Text('Pay each truck for its part when you collect. Show the token number.', style: OsText.weight(OsText.label, 500)),
          ],
          const SizedBox(height: 18),
          for (final s in o.stallOrders) ...[_TokenCard(s: s, o: o), const SizedBox(height: 14)],
          if (o.note != null) ...[
            Text.rich(TextSpan(children: [
              TextSpan(text: 'Your note: ', style: OsText.weight(OsText.label, 700)),
              TextSpan(text: o.note, style: OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink700)),
            ])),
            const SizedBox(height: 14),
          ],
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: OsColors.surface1, borderRadius: BorderRadius.circular(OsRadius.lg)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Bill', style: OsText.weight(OsText.label, 700)),
              const SizedBox(height: 8),
              _row('Item total', o.itemTotalCents),
              if (o.discountCents > 0) _row('Coupon ${o.couponCode ?? ''}', -o.discountCents),
              if (o.taxCents > 0) _row('Sales tax', o.taxCents),
              if (o.serviceFeeCents > 0) _row('Service fee', o.serviceFeeCents),
              const Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Divider()),
              _row('Total', o.totalCents, strong: true),
            ]),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => orderAgain(context, o),
                icon: const Icon(Icons.replay, size: 18),
                label: const Text('Order again'),
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              ),
            ),
          ]),
          Center(
            child: TextButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ContactScreen(initialTopic: 'order', orderNo: o.orderNo))),
              icon: const Icon(Icons.support_agent, size: 18),
              label: const Text('Get help with this order'),
            ),
          ),
          if (app.canCancel(o)) ...[
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () async {
                final yes = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Cancel this order?'),
                    content: const Text('You can cancel until a truck starts cooking.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep it')),
                      TextButton(onPressed: () => Navigator.pop(ctx, true), style: TextButton.styleFrom(foregroundColor: OsColors.chili600), child: const Text('Cancel order')),
                    ],
                  ),
                );
                if (yes == true) app.cancel(o);
              },
              style: OutlinedButton.styleFrom(foregroundColor: OsColors.chili600, minimumSize: const Size.fromHeight(48)),
              child: const Text('Cancel order'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _row(String label, int cents, {bool strong = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(label, style: strong ? OsText.bodyStrong : OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink700))),
          Text(money(cents), style: (strong ? OsText.bodyStrong : OsText.weight(OsText.label, 600)).copyWith(fontFeatures: OsText.tabular)),
        ]),
      );
}

class _TokenCard extends StatelessWidget {
  const _TokenCard({required this.s, required this.o});
  final StallOrder s;
  final Order o;

  @override
  Widget build(BuildContext context) {
    final ready = s.status == TicketStatus.ready;
    final muted = s.status == TicketStatus.cancelled || s.status == TicketStatus.completed;
    const steps = [TicketStatus.placed, TicketStatus.preparing, TicketStatus.ready];
    final reached = switch (s.status) {
      TicketStatus.placed => 1,
      TicketStatus.preparing => 2,
      TicketStatus.ready || TicketStatus.completed => 3,
      _ => 0,
    };

    return AnimatedContainer(
      duration: const Duration(milliseconds: 500),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ready ? OsColors.leaf50 : OsColors.surface0,
        borderRadius: BorderRadius.circular(OsRadius.xl),
        border: Border.all(color: ready ? OsColors.leaf600 : OsColors.line),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Token box: 24px card minus 16px padding = 8px corners.
          AnimatedContainer(
            duration: const Duration(milliseconds: 500),
            width: 76,
            height: 76,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: ready ? OsColors.leaf600 : (muted ? OsColors.surface2 : OsColors.night900),
              borderRadius: BorderRadius.circular(OsRadius.sm),
            ),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('TOKEN', style: OsText.weight(OsText.caption, 700).copyWith(color: (muted ? OsColors.ink500 : Colors.white).withValues(alpha: 0.8), fontSize: 10, letterSpacing: 1)),
              Text('${s.tokenNo}', style: OsText.token.copyWith(color: muted ? OsColors.ink500 : Colors.white, fontSize: 34, fontFeatures: OsText.tabular)),
            ]),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.stallName, style: OsText.weight(OsText.bodyStrong, 800)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: switch (s.status) {
                    TicketStatus.ready => OsColors.leaf600,
                    TicketStatus.preparing => OsColors.ember100,
                    TicketStatus.cancelled => OsColors.chili50,
                    _ => OsColors.surface2,
                  },
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(_statusLabel(s.status),
                    style: OsText.weight(OsText.caption, 700).copyWith(
                      color: switch (s.status) {
                        TicketStatus.ready => Colors.white,
                        TicketStatus.preparing => OsColors.ember700,
                        TicketStatus.cancelled => OsColors.chili600,
                        _ => OsColors.ink700,
                      },
                    )),
              ),
              const SizedBox(height: 6),
              Text(_guidance(s, o), style: OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink700)),
            ]),
          ),
        ]),
        if (!muted || s.status == TicketStatus.completed) ...[
          const SizedBox(height: 14),
          // Progress: three segments, each fills left to right 120ms after the one before.
          Row(children: [
            for (final (i, _) in steps.indexed) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: SizedBox(
                    height: 6,
                    child: Stack(children: [
                      const Positioned.fill(child: ColoredBox(color: OsColors.surface2)),
                      TweenAnimationBuilder<double>(
                        tween: Tween(end: i < reached ? 1 : 0),
                        duration: Duration(milliseconds: 400 + 120 * i),
                        curve: OsMotion.move,
                        builder: (_, v, _) => FractionallySizedBox(
                          widthFactor: v,
                          heightFactor: 1,
                          alignment: Alignment.centerLeft,
                          child: ColoredBox(color: ready || s.status == TicketStatus.completed ? OsColors.leaf600 : OsColors.ember500),
                        ),
                      ),
                    ]),
                  ),
                ),
              ),
            ],
          ]),
        ],
        const SizedBox(height: 12),
        const Divider(),
        const SizedBox(height: 8),
        for (final it in s.items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(children: [
              DietMark(it.diet, size: 12),
              const SizedBox(width: 8),
              Expanded(child: Text('${it.qty} × ${it.name}', style: OsText.weight(OsText.label, 500))),
              Text(money(it.unitPriceCents * it.qty), style: OsText.weight(OsText.label, 600).copyWith(fontFeatures: OsText.tabular)),
            ]),
          ),
      ]),
    );
  }
}


/// Roadmap C1: refill the cart from a past order, then offer to open the cart.
void orderAgain(BuildContext context, Order o) {
  final r = AppScope.read(context).orderAgain(o);
  final messenger = ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();
  final text = r.added == 0
      ? "None of these dishes can be ordered right now."
      : '${plural(r.added, 'item')} added to your cart'
          '${r.skipped.isEmpty ? '' : '. Not available now: ${r.skipped.join(', ')}'}.';
  messenger.showSnackBar(SnackBar(
    content: Text(text),
    duration: const Duration(seconds: 5),
    action: r.added == 0 ? null : SnackBarAction(label: 'View cart', textColor: OsColors.ember400, onPressed: () => openCart(context)),
  ));
}
