import 'package:cupertino_ui/cupertino_ui.dart';
import 'package:flutter/services.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/kit.dart';
import 'order_screen.dart';

/// One cart across every truck, then checkout on the same page.
class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  late final TextEditingController _name, _table, _note;
  bool _touched = false;

  @override
  void initState() {
    super.initState();
    final s = AppScope.read(context);
    _name = TextEditingController(text: s.customerName.isNotEmpty ? s.customerName : (s.account?.name ?? ''));
    _table = TextEditingController(text: s.tableNo);
    _note = TextEditingController(text: s.note);
  }

  @override
  void dispose() {
    _name.dispose();
    _table.dispose();
    _note.dispose();
    super.dispose();
  }

  void _place() {
    final state = AppScope.read(context);
    setState(() => _touched = true);
    final table = state.catalog.park.tableServiceEnabled && state.fulfilment == Fulfilment.table;
    if (_name.text.trim().isEmpty || (table && _table.text.trim().isEmpty)) {
      HapticFeedback.heavyImpact();
      return;
    }
    state.setCheckout(name: _name.text.trim(), tableNo: _table.text.trim(), note: _note.text.trim());
    final order = state.placeOrder();
    HapticFeedback.mediumImpact();
    Navigator.of(context).push(CupertinoPageRoute<void>(builder: (_) => OrderScreen(orderId: order.id, justPlaced: true)));
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final park = state.catalog.park;
    final groups = state.groups;
    final bottom = MediaQuery.paddingOf(context).bottom;

    if (groups.isEmpty) {
      return CupertinoPageScaffold(
        backgroundColor: OsColors.surface0,
        navigationBar: const CupertinoNavigationBar(middle: Text('Cart'), border: null, backgroundColor: OsColors.surface0),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: 88,
                height: 88,
                decoration: const BoxDecoration(color: OsColors.ember50, shape: BoxShape.circle),
                child: const Icon(CupertinoIcons.bag, size: 38, color: OsColors.ember700),
              ),
              const SizedBox(height: 18),
              Text('Your cart is empty', style: OsText.heading),
              const SizedBox(height: 6),
              Text('Add dishes from any truck. Everything goes into one cart and one checkout.', textAlign: TextAlign.center, style: OsText.body.copyWith(color: OsColors.ink700)),
            ]),
          ),
        ),
      );
    }

    final bill = computeBill(state.itemTotalCents, park);
    final table = park.tableServiceEnabled && state.fulfilment == Fulfilment.table;
    final nameError = _touched && _name.text.trim().isEmpty;
    final tableError = _touched && table && _table.text.trim().isEmpty;

    return CupertinoPageScaffold(
      backgroundColor: OsColors.surface1,
      navigationBar: CupertinoNavigationBar(
        middle: Text('Cart · ${plural(state.count, 'item')}'),
        border: null,
        backgroundColor: OsColors.surface1,
      ),
      child: Stack(
        children: [
          ListView(
            padding: EdgeInsets.fromLTRB(16, MediaQuery.paddingOf(context).top + 8, 16, bottom + 140),
            children: [
              for (final g in groups) ...[
                _Card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(children: [
                        ClipOval(child: FoodImage(g.stall.logoUrl, width: 36, height: 36)),
                        const SizedBox(width: 10),
                        Expanded(child: Text(g.stall.name, style: OsText.subheading)),
                        Text(money(g.subtotalCents), style: OsText.weight(OsText.bodyStrong, 800).copyWith(fontFeatures: OsText.tabular)),
                      ]),
                      const SizedBox(height: 4),
                      Text('Own token · collect from this truck', style: OsText.small),
                      for (final l in g.lines) ...[
                        const SizedBox(height: 14),
                        Row(children: [
                          ClipRRect(borderRadius: BorderRadius.circular(12), child: Opacity(opacity: l.orderable ? 1 : 0.4, child: FoodImage(l.item.imageUrl, width: 52, height: 52))),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                DietMark(l.item.diet, size: 13),
                                if (l.item.diet != null) const SizedBox(width: 6),
                                Expanded(child: Text(l.item.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 700))),
                              ]),
                              const SizedBox(height: 2),
                              Text(l.orderable ? money(l.item.priceCents * l.qty) : (l.item.isAvailable ? 'Truck closed' : 'Sold out'),
                                  style: OsText.small.copyWith(color: l.orderable ? OsColors.ink500 : OsColors.chili600, fontFeatures: OsText.tabular)),
                            ]),
                          ),
                          const SizedBox(width: 10),
                          l.orderable
                              ? AddButton(item: l.item, width: 88, height: 34, shadow: false)
                              : CupertinoButton(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(44, 44),
                                  onPressed: () => AppScope.read(context).remove(l.item.id),
                                  child: const Icon(CupertinoIcons.trash, color: OsColors.chili600, size: 20),
                                ),
                        ]),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // ---- how
              if (park.tableServiceEnabled) ...[
                _Label('How do you want it?'),
                _Card(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    CupertinoSlidingSegmentedControl<Fulfilment>(
                      groupValue: state.fulfilment,
                      thumbColor: OsColors.surface0,
                      backgroundColor: OsColors.surface2,
                      children: {
                        Fulfilment.pickup: _seg(CupertinoIcons.ticket, 'Pick up'),
                        Fulfilment.table: _seg(CupertinoIcons.table, 'To my table'),
                      },
                      onValueChanged: (v) => AppScope.read(context).setCheckout(fulfilment: v),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      table ? 'Each truck brings its dishes to your table.' : 'Each truck gives you a token. Collect when it shows Ready.',
                      style: OsText.small,
                    ),
                    if (table) ...[
                      const SizedBox(height: 12),
                      _Field(controller: _table, placeholder: 'Table number', keyboard: TextInputType.number, error: tableError ? 'Enter the number on your table' : null, onChanged: (_) => setState(() {})),
                    ],
                  ]),
                ),
                const SizedBox(height: 12),
              ],

              // ---- details
              _Label('Your details'),
              _Card(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  _Field(controller: _name, placeholder: 'Name for the order', error: nameError ? 'The truck calls this name out' : null, onChanged: (_) => setState(() {})),
                  const SizedBox(height: 10),
                  _Field(controller: _note, placeholder: 'Note for the trucks (optional)', maxLines: 2),
                ]),
              ),
              const SizedBox(height: 12),

              // ---- payment
              _Label('Payment'),
              _Card(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  CupertinoSlidingSegmentedControl<PaymentMethod>(
                    groupValue: state.paymentMethod,
                    thumbColor: OsColors.surface0,
                    backgroundColor: OsColors.surface2,
                    children: {
                      PaymentMethod.payAtStall: _seg(CupertinoIcons.money_dollar_circle, 'At the truck'),
                      PaymentMethod.online: _seg(CupertinoIcons.creditcard, 'Pay now'),
                    },
                    onValueChanged: (v) => AppScope.read(context).setCheckout(payment: v),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    state.paymentMethod == PaymentMethod.online
                        ? 'Demo: no card is charged. Apple Pay and cards come with the live app.'
                        : 'Pay each truck for its part when you collect.',
                    style: OsText.small,
                  ),
                ]),
              ),
              const SizedBox(height: 12),

              // ---- bill
              _Card(
                child: Column(children: [
                  _BillRow('Item total', bill.items),
                  if (bill.tax > 0) _BillRow('Sales tax (${park.taxPercent}%)', bill.tax),
                  if (bill.fee > 0) _BillRow('Service fee', bill.fee),
                  const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: SizedBox(height: 1, width: double.infinity, child: ColoredBox(color: OsColors.line))),
                  _BillRow('To pay', bill.total, strong: true),
                ]),
              ),
            ],
          ),

          // ---- sticky place-order bar
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(16, 12, 16, bottom + 12),
              decoration: const BoxDecoration(
                color: OsColors.surface0,
                border: Border(top: BorderSide(color: OsColors.line)),
              ),
              child: PrimaryButton(
                label: state.blocked ? 'Remove unavailable items' : 'Place order · ${money(bill.total)}',
                onTap: state.blocked || !park.orderingEnabled ? null : _place,
                trailing: state.blocked ? null : const Icon(CupertinoIcons.arrow_right, size: 18, color: OsColors.night900),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _seg(IconData icon, String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 16, color: OsColors.ink900),
          const SizedBox(width: 6),
          Text(text, style: OsText.weight(OsText.label, 700)),
        ]),
      );
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: OsColors.surface0, borderRadius: BorderRadius.circular(OsRadius.xl - 4)),
        child: child,
      );
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
        child: Text(text, style: OsText.subheading),
      );
}

class _Field extends StatelessWidget {
  const _Field({required this.controller, required this.placeholder, this.error, this.keyboard, this.maxLines = 1, this.onChanged});
  final TextEditingController controller;
  final String placeholder;
  final String? error;
  final TextInputType? keyboard;
  final int maxLines;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CupertinoTextField(
            controller: controller,
            placeholder: placeholder,
            keyboardType: keyboard,
            maxLines: maxLines,
            minLines: 1,
            onChanged: onChanged,
            style: OsText.body,
            placeholderStyle: OsText.body.copyWith(color: OsColors.ink500),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              color: OsColors.surface1,
              borderRadius: BorderRadius.circular(OsRadius.md),
              border: Border.all(color: error != null ? OsColors.chili600 : const Color(0x00000000)),
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 6),
            Text(error!, style: OsText.small.copyWith(color: OsColors.chili600, fontWeight: FontWeight.w700)),
          ],
        ],
      );
}

class _BillRow extends StatelessWidget {
  const _BillRow(this.label, this.cents, {this.strong = false});
  final String label;
  final int cents;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final style = strong ? OsText.weight(OsText.subheading, 800) : OsText.label.copyWith(color: OsColors.ink700, fontWeight: FontWeight.w500);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Expanded(child: Text(label, style: style)),
        Text(money(cents), style: style.copyWith(fontFeatures: OsText.tabular)),
      ]),
    );
  }
}
