import 'package:cupertino_ui/cupertino_ui.dart';
import 'package:flutter/services.dart';

import '../data/catalog.dart';
import '../data/coupons.dart';
import '../data/models.dart';
import '../data/options.dart';
import '../state/app_state.dart';
import '../state/ready_alerts.dart';
import '../theme/tokens.dart';
import '../ui/kit.dart';
import 'dish_sheet.dart';
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
    final late = state.pickupProblem();
    if (late != null) {
      HapticFeedback.heavyImpact();
      showCupertinoDialog<void>(
        context: context,
        builder: (c) => CupertinoAlertDialog(
          title: const Text('Pick another time'),
          content: Text(friendlyError(late)),
          actions: [CupertinoDialogAction(isDefaultAction: true, onPressed: () => Navigator.of(c).pop(), child: const Text('OK'))],
        ),
      );
      return;
    }
    final order = state.placeOrder();
    HapticFeedback.mediumImpact();
    // Ask for alerts now, when the reason is obvious (iOS asks only once).
    if (state.readyAlerts) ReadyAlerts.askPermission();
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

    final coupon = state.couponState;
    final bill = computeBill(state.itemTotalCents, park, discountCents: coupon.quote?.discountCents ?? 0);
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
                      g.stall.isOpen
                          ? Text('Own token · collect from this truck', style: OsText.small)
                          : Text(g.stall.statusLabel, style: OsText.weight(OsText.small, 700).copyWith(color: OsColors.chili600)),
                      for (final l in g.lines) _LineRow(line: l),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              _Suggestions(inCart: {for (final g in groups) for (final l in g.lines) l.item.id}, cartStalls: {for (final g in groups) g.stall.id}),

              // ---- coupon
              if (park.couponsEnabled) ...[
                _Label('Offers & coupons'),
                _Card(child: _CouponBox(applied: coupon.quote, error: coupon.error)),
                const SizedBox(height: 12),
              ],

              // ---- when
              if (park.scheduledOrdersEnabled) ...[
                _Label('When?'),
                _Card(child: _When(at: state.pickupAt)),
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
                  _Field(controller: _note, placeholder: 'Note for every truck (optional)', maxLines: 2),
                  const SizedBox(height: 6),
                  Text('For one dish, tap “Add a note” under it.', style: OsText.small),
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
                  if (bill.discount > 0) _BillRow('Coupon ${coupon.quote!.coupon.code}', -bill.discount, saving: true),
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
          Flexible(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 700))),
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
  const _BillRow(this.label, this.cents, {this.strong = false, this.saving = false});
  final String label;
  final int cents;
  final bool strong, saving;

  @override
  Widget build(BuildContext context) {
    var style = strong ? OsText.weight(OsText.subheading, 800) : OsText.label.copyWith(color: OsColors.ink700, fontWeight: FontWeight.w500);
    if (saving) style = style.copyWith(color: OsColors.leaf700, fontWeight: FontWeight.w700);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Expanded(child: Text(label, style: style)),
        Text(cents < 0 ? '−${money(-cents)}' : money(cents), style: style.copyWith(fontFeatures: OsText.tabular)),
      ]),
    );
  }
}

/// One cart line: the dish, its options, its own note, and a stepper for that exact line.
class _LineRow extends StatelessWidget {
  const _LineRow({required this.line});
  final CartLine line;

  @override
  Widget build(BuildContext context) {
    final l = line;
    final s = AppScope.read(context);
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ClipRRect(borderRadius: BorderRadius.circular(12), child: Opacity(opacity: l.orderable ? 1 : 0.4, child: FoodImage(l.item.imageUrl, width: 52, height: 52))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                DietMark(l.item.diet, size: 13),
                if (l.item.diet != null) const SizedBox(width: 6),
                Expanded(child: Text(l.item.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 700))),
              ]),
              if (l.options.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(optionsText(l.options, money), style: OsText.small.copyWith(color: OsColors.ink700)),
              ],
              const SizedBox(height: 2),
              Text(
                l.orderable
                    ? '${money(l.unitPriceCents)} each · ${money(l.unitPriceCents * l.qty)}'
                    : (!l.item.isAvailable ? 'Sold out' : (l.problem != null ? 'Choices changed: remove and add again' : l.stall.statusLabel)),
                style: OsText.small.copyWith(color: l.orderable ? OsColors.ink500 : OsColors.chili600, fontFeatures: OsText.tabular),
              ),
            ]),
          ),
          const SizedBox(width: 10),
          l.orderable
              ? _LineStepper(line: l)
              : CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(44, 44),
                  onPressed: () => s.remove(l.key),
                  child: const Icon(CupertinoIcons.trash, color: OsColors.chili600, size: 20),
                ),
        ]),
        if (l.orderable)
          Padding(
            padding: const EdgeInsets.only(left: 64, top: 4),
            child: CupertinoButton(
              padding: EdgeInsets.zero,
              minimumSize: const Size(0, 32),
              onPressed: () => _editNote(context, l),
              child: Text(
                l.note.isEmpty ? '+ Add a note for this dish' : '“${l.note}” · Edit',
                style: OsText.weight(OsText.small, 700).copyWith(color: l.note.isEmpty ? OsColors.ember700 : OsColors.ink700),
              ),
            ),
          ),
      ]),
    );
  }

  static Future<void> _editNote(BuildContext context, CartLine l) async {
    final c = TextEditingController(text: l.note);
    await showCupertinoDialog<void>(
      context: context,
      builder: (d) => CupertinoAlertDialog(
        title: Text('Note for ${l.item.name}'),
        content: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: CupertinoTextField(controller: c, placeholder: 'e.g. no onions, extra spicy', maxLength: maxLineNote, autofocus: true),
        ),
        actions: [
          CupertinoDialogAction(onPressed: () => Navigator.of(d).pop(), child: const Text('Cancel')),
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () {
              AppScope.read(context).setLineNote(l.key, c.text.trim());
              Navigator.of(d).pop();
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    c.dispose();
  }
}

class _LineStepper extends StatelessWidget {
  const _LineStepper({required this.line});
  final CartLine line;

  @override
  Widget build(BuildContext context) {
    final s = AppScope.read(context);
    Widget step(IconData icon, VoidCallback? onTap, String label) => Semantics(
          button: true,
          label: label,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onTap == null
                ? null
                : () {
                    HapticFeedback.selectionClick();
                    onTap();
                  },
            child: SizedBox(width: 30, height: 34, child: Icon(icon, size: 15, color: onTap == null ? OsColors.ink300 : OsColors.leaf600)),
          ),
        );
    return Container(
      height: 34,
      decoration: BoxDecoration(border: Border.all(color: OsColors.line), borderRadius: BorderRadius.circular(OsRadius.md - 2)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        step(CupertinoIcons.minus, () => s.decrement(line.key), 'Remove one ${line.item.name}'),
        SizedBox(width: 20, child: Text('${line.qty}', textAlign: TextAlign.center, style: OsText.weight(OsText.label, 800).copyWith(color: OsColors.leaf600, fontFeatures: OsText.tabular))),
        step(CupertinoIcons.plus, line.qty >= maxQty ? null : () => s.increment(line.key), 'Add one more ${line.item.name}'),
      ]),
    );
  }
}

/// Coupon code box plus the park's listed offers.
class _CouponBox extends StatefulWidget {
  const _CouponBox({required this.applied, required this.error});
  final CouponQuote? applied;
  final String? error;

  @override
  State<_CouponBox> createState() => _CouponBoxState();
}

class _CouponBoxState extends State<_CouponBox> {
  final _code = TextEditingController();
  String? _problem;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  void _apply(String code) {
    final c = code.trim().toUpperCase();
    if (c.isEmpty) {
      setState(() => _problem = 'Enter a code.');
      return;
    }
    final err = AppScope.read(context).applyCoupon(c);
    setState(() => _problem = err);
    if (err == null) {
      _code.clear();
      HapticFeedback.mediumImpact();
    } else {
      HapticFeedback.heavyImpact();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final q = widget.applied;
    if (q != null) {
      return Row(children: [
        Container(
          width: 34,
          height: 34,
          decoration: const BoxDecoration(color: OsColors.leaf600, shape: BoxShape.circle),
          child: const Icon(CupertinoIcons.checkmark_alt, size: 18, color: OsColors.surface0),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${q.coupon.code} applied', style: OsText.weight(OsText.label, 800).copyWith(color: OsColors.leaf700)),
            Text('You save ${money(q.discountCents)} · ${q.coupon.title}', style: OsText.small.copyWith(color: OsColors.ink700)),
          ]),
        ),
        CupertinoButton(
          padding: EdgeInsets.zero,
          minimumSize: const Size(44, 44),
          onPressed: () => AppScope.read(context).removeCoupon(),
          child: const Icon(CupertinoIcons.xmark_circle_fill, color: OsColors.ink300, size: 22),
        ),
      ]);
    }
    final offers = state.offers;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (widget.error != null && state.couponCode != null) ...[
        Text('${state.couponCode}: ${widget.error}', style: OsText.weight(OsText.small, 700).copyWith(color: OsColors.chili600)),
        const SizedBox(height: 8),
      ],
      Row(children: [
        Expanded(
          child: CupertinoTextField(
            controller: _code,
            placeholder: 'Coupon code',
            textCapitalization: TextCapitalization.characters,
            autocorrect: false,
            onSubmitted: _apply,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            style: OsText.weight(OsText.body, 700),
            decoration: BoxDecoration(color: OsColors.surface1, borderRadius: BorderRadius.circular(OsRadius.md)),
          ),
        ),
        const SizedBox(width: 10),
        CupertinoButton(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          minimumSize: const Size(44, 46),
          color: OsColors.night900,
          borderRadius: BorderRadius.circular(OsRadius.md),
          onPressed: () => _apply(_code.text),
          child: Text('Apply', style: OsText.weight(OsText.label, 800).copyWith(color: OsColors.surface0)),
        ),
      ]),
      if (_problem != null) ...[
        const SizedBox(height: 8),
        Text(_problem!, style: OsText.weight(OsText.small, 700).copyWith(color: OsColors.chili600)),
      ],
      for (final o in offers) ...[
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
          decoration: BoxDecoration(border: Border.all(color: OsColors.lineStrong), borderRadius: BorderRadius.circular(OsRadius.md)),
          child: Row(children: [
            const Icon(CupertinoIcons.tag, size: 18, color: OsColors.ember600),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(o.title, style: OsText.weight(OsText.label, 800)),
                Text(o.code, style: OsText.small.copyWith(color: OsColors.ink700, fontWeight: FontWeight.w700, letterSpacing: 0.6)),
              ]),
            ),
            CupertinoButton(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: const Size(44, 44),
              onPressed: () => _apply(o.code),
              child: Text('Apply', style: OsText.weight(OsText.label, 800).copyWith(color: OsColors.ember700)),
            ),
          ]),
        ),
      ],
    ]);
  }
}

/// "As soon as possible" or a time later today (15-minute steps), when the park allows it.
class _When extends StatelessWidget {
  const _When({required this.at});
  final DateTime? at;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final step = const Duration(minutes: 15).inMilliseconds;
    final first = DateTime.fromMillisecondsSinceEpoch(((now.millisecondsSinceEpoch + 20 * 60000) / step).ceil() * step);
    final slots = <DateTime>[
      for (var t = first; !t.isAfter(now.add(const Duration(hours: 12))) && sameParkDay(t, now); t = t.add(const Duration(minutes: 15))) t,
    ];
    final later = at != null;
    if (slots.isEmpty) return Text('Ordering for later opens again tomorrow.', style: OsText.small);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      CupertinoSlidingSegmentedControl<bool>(
        groupValue: later,
        thumbColor: OsColors.surface0,
        backgroundColor: OsColors.surface2,
        children: {
          false: _seg(CupertinoIcons.timer, 'As soon as possible'),
          true: _seg(CupertinoIcons.clock, 'Later today'),
        },
        onValueChanged: (v) => AppScope.read(context).setPickupAt(v == true ? slots.first : null),
      ),
      if (later) ...[
        const SizedBox(height: 12),
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: slots.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final t = slots[i];
              final on = at!.millisecondsSinceEpoch == t.millisecondsSinceEpoch;
              return Press(
                semanticLabel: 'Pick up at ${parkTime(t)}',
                onTap: () => AppScope.read(context).setPickupAt(t),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: on ? OsColors.night900 : OsColors.surface1,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(parkTime(t), style: OsText.weight(OsText.label, 700).copyWith(color: on ? OsColors.surface0 : OsColors.ink900)),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        Text('The trucks plan your order for this time.', style: OsText.small),
      ],
    ]);
  }

  static Widget _seg(IconData icon, String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 15, color: OsColors.ink900),
          const SizedBox(width: 6),
          Flexible(child: Text(text, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.small, 700).copyWith(color: OsColors.ink900))),
        ]),
      );
}

/// "Add to your order": dishes from the other trucks, sweets and drinks first. From the menu only.
class _Suggestions extends StatelessWidget {
  const _Suggestions({required this.inCart, required this.cartStalls});
  final Set<String> inCart, cartStalls;

  static final _sweetOrDrink = RegExp(r'dessert|sweet|drink|beverage|lassi|falooda|shake|juice|tea|coffee|soda|ice', caseSensitive: false);

  @override
  Widget build(BuildContext context) {
    final cat = AppScope.of(context).catalog;
    final scored = [
      for (final m in cat.items)
        if (!inCart.contains(m.id) && m.isAvailable && (cat.stallById[m.stallId]?.isOpen ?? false))
          (
            m: m,
            score: (cartStalls.contains(m.stallId) ? 0 : 2) +
                (_sweetOrDrink.hasMatch('${cat.categoryById[m.categoryId]?.name ?? ''} ${m.name}') ? 2 : 0) +
                (m.isFeatured ? 1 : 0) +
                (m.imageUrl != null ? 0.5 : 0),
          ),
    ]..sort((a, b) => b.score.compareTo(a.score));
    final picks = scored.take(6).map((x) => x.m).toList();
    if (picks.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _Label('Add to your order'),
      SizedBox(
        height: 190,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: picks.length,
          separatorBuilder: (_, _) => const SizedBox(width: 12),
          itemBuilder: (context, i) {
            final m = picks[i];
            return SizedBox(
              width: 132,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Stack(clipBehavior: Clip.none, children: [
                  Press(
                    semanticLabel: m.name,
                    onTap: () => showDish(context, m),
                    child: ClipRRect(borderRadius: BorderRadius.circular(OsRadius.lg), child: FoodImage(m.imageUrl, width: 132, height: 112)),
                  ),
                  Positioned(right: 6, bottom: -14, child: AddButton(item: m, width: 72, height: 32)),
                ]),
                const SizedBox(height: 20),
                Text(m.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.small, 700).copyWith(color: OsColors.ink900)),
                Text(money(m.priceCents), style: OsText.small.copyWith(fontFeatures: OsText.tabular)),
              ]),
            );
          },
        ),
      ),
      const SizedBox(height: 12),
    ]);
  }
}
