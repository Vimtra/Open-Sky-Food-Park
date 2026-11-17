import 'package:material_ui/material_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/routes.dart';
import '../ui/widgets.dart';

/// Cart and checkout in one screen, grouped by truck, as on the website.
class CartScreen extends StatefulWidget {
  const CartScreen({super.key, this.standalone = false, this.onBrowse});
  final bool standalone;
  final VoidCallback? onBrowse;

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  late final _name = TextEditingController(text: AppScope.read(context).customerName);
  late final _table = TextEditingController(text: AppScope.read(context).tableNo);
  late final _note = TextEditingController(text: AppScope.read(context).note);
  bool _touched = false;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _table.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _place(AppState app) async {
    setState(() => _touched = true);
    final table = app.catalog.park.tableServiceEnabled && app.fulfilment == Fulfilment.table;
    if (_name.text.trim().isEmpty || (table && _table.text.trim().isEmpty)) return;
    setState(() => _busy = true);
    app.setCheckout(name: _name.text, tableNo: _table.text, note: _note.text);
    await Future<void>.delayed(const Duration(milliseconds: 350));
    final order = app.placeOrder();
    if (!mounted) return;
    setState(() => _busy = false);
    openOrder(context, order.id, replace: widget.standalone);
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final park = app.catalog.park;
    final groups = app.groups;

    Widget content;
    if (app.count == 0) {
      content = Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(color: OsColors.surface1, shape: BoxShape.circle),
              child: const Icon(Icons.shopping_bag_outlined, size: 28, color: OsColors.ink500),
            ),
            const SizedBox(height: 16),
            Text('Your cart is empty', style: OsText.heading),
            const SizedBox(height: 6),
            Text('Add dishes from any truck. Everything goes into one cart and one checkout.', textAlign: TextAlign.center, style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: widget.onBrowse ?? () => Navigator.of(context).popUntil((r) => r.isFirst),
              child: const Text('Browse the food trucks'),
            ),
          ]),
        ),
      );
    } else {
      final bill = computeBill(app.itemTotalCents, park);
      final tableOn = park.tableServiceEnabled && app.fulfilment == Fulfilment.table;
      final nameErr = _touched && _name.text.trim().isEmpty ? 'Add your name so the truck can call it out.' : null;
      final tableErr = _touched && tableOn && _table.text.trim().isEmpty ? 'Enter the number on your table.' : null;

      content = ListView(
        padding: EdgeInsets.fromLTRB(16, widget.standalone ? 8 : MediaQuery.paddingOf(context).top + 20, 16, 140),
        children: [
          Text('Your cart', style: OsText.title),
          const SizedBox(height: 4),
          Text('${plural(app.count, 'item')} from ${plural(groups.length, 'truck')}. Each truck prepares its own part and gives you a token.',
              style: OsText.weight(OsText.label, 400).copyWith(color: OsColors.ink700)),
          const SizedBox(height: 18),
          for (final g in groups) ...[_StallGroup(group: g), const SizedBox(height: 14)],
          const SizedBox(height: 10),
          Text('How do you want it?', style: OsText.subheading),
          const SizedBox(height: 10),
          _Choice(
            selected: !tableOn,
            icon: Icons.confirmation_number_outlined,
            title: 'Pick it up',
            body: 'Each truck calls your token. Collect at the window.',
            onTap: () => app.setCheckout(fulfilment: Fulfilment.pickup),
          ),
          if (park.tableServiceEnabled) ...[
            const SizedBox(height: 10),
            _Choice(
              selected: tableOn,
              icon: Icons.chair_outlined,
              title: 'Bring it to my table',
              body: 'Use the number on your table.',
              onTap: () => app.setCheckout(fulfilment: Fulfilment.table),
            ),
          ],
          if (tableOn) ...[
            const SizedBox(height: 12),
            TextField(controller: _table, keyboardType: TextInputType.text, decoration: InputDecoration(labelText: 'Table number', errorText: tableErr)),
          ],
          const SizedBox(height: 18),
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(labelText: 'Your name', helperText: 'The truck calls this out with your token.', errorText: nameErr),
            onChanged: (_) => _touched ? setState(() {}) : null,
          ),
          const SizedBox(height: 14),
          TextField(controller: _note, maxLines: 2, decoration: const InputDecoration(labelText: 'Note for the trucks (optional)', hintText: 'Less spicy, no onions…')),
          const SizedBox(height: 20),
          Text('Payment', style: OsText.subheading),
          const SizedBox(height: 10),
          _Choice(
            selected: app.paymentMethod == PaymentMethod.payAtStall,
            icon: Icons.payments_outlined,
            title: 'Pay at the truck',
            body: 'Pay each truck for its part when you collect.',
            onTap: () => app.setCheckout(payment: PaymentMethod.payAtStall),
          ),
          const SizedBox(height: 10),
          _Choice(
            selected: app.paymentMethod == PaymentMethod.online,
            icon: Icons.credit_card,
            title: 'Pay now',
            body: AppState.demo ? 'Demo: no card is charged.' : 'Card, Apple Pay or Google Pay.',
            onTap: () => app.setCheckout(payment: PaymentMethod.online),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: OsColors.surface1, borderRadius: BorderRadius.circular(OsRadius.lg)),
            child: Column(children: [
              _billRow('Item total (${plural(app.count, 'item')})', bill.items),
              if (bill.tax > 0) _billRow('Sales tax (${park.taxPercent}%)', bill.tax),
              if (bill.fee > 0) _billRow('Service fee', bill.fee),
              const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider()),
              _billRow('To pay', bill.total, strong: true),
            ]),
          ),
          if (!park.orderingEnabled) ...[const SizedBox(height: 12), _warn('The park is not taking online orders right now.')],
          if (app.blocked) ...[const SizedBox(height: 12), _warn('Remove the items marked unavailable to continue.')],
        ],
      );
    }

    final bill = computeBill(app.itemTotalCents, park);
    return Scaffold(
      appBar: widget.standalone ? AppBar() : null,
      body: content,
      bottomNavigationBar: app.count == 0
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                decoration: const BoxDecoration(
                  color: OsColors.surface0,
                  border: Border(top: BorderSide(color: OsColors.line)),
                  boxShadow: [BoxShadow(color: Color(0x2E0E1330), blurRadius: 20, offset: Offset(0, -6), spreadRadius: -8)],
                ),
                child: FilledButton(
                  onPressed: _busy || app.blocked || !park.orderingEnabled ? null : () => _place(app),
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                  child: _busy
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: OsColors.night900))
                      : Text(app.paymentMethod == PaymentMethod.online ? 'Pay ${money(bill.total)}' : 'Place order · ${money(bill.total)}'),
                ),
              ),
            ),
    );
  }

  Widget _billRow(String label, int cents, {bool strong = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(child: Text(label, style: strong ? OsText.bodyStrong : OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink700))),
          Text(money(cents), style: (strong ? OsText.bodyStrong : OsText.weight(OsText.label, 600)).copyWith(fontFeatures: OsText.tabular)),
        ]),
      );

  Widget _warn(String text) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: OsColors.chili50, borderRadius: BorderRadius.circular(OsRadius.md)),
        child: Text(text, style: OsText.weight(OsText.label, 600).copyWith(color: OsColors.chili600)),
      );
}

class _StallGroup extends StatelessWidget {
  const _StallGroup({required this.group});
  final CartGroup group;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final s = group.stall;
    return Container(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(OsRadius.lg), border: Border.all(color: OsColors.line)),
      child: Column(children: [
        InkWell(
          onTap: () => openStall(context, s),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(OsRadius.lg)),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Row(children: [
              if (s.logoUrl != null) ClipOval(child: FoodImage(s.logoUrl, width: 36, height: 36)),
              if (s.logoUrl != null) const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(s.name, style: OsText.weight(OsText.bodyStrong, 800)),
                  if (!s.isOpen) Text('Closed right now', style: OsText.weight(OsText.small, 700).copyWith(color: OsColors.chili600)),
                ]),
              ),
              Text(money(group.subtotalCents), style: OsText.weight(OsText.label, 700).copyWith(fontFeatures: OsText.tabular)),
            ]),
          ),
        ),
        const Divider(),
        for (final (i, l) in group.lines.indexed) ...[
          if (i > 0) const Padding(padding: EdgeInsets.symmetric(horizontal: 14), child: Divider()),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Row(children: [
              FoodImage(l.item.imageUrl, radius: OsRadius.sm, width: 56, height: 56, greyed: !l.orderable),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(padding: const EdgeInsets.only(top: 3), child: DietMark(l.item.diet)),
                    if (l.item.diet != null) const SizedBox(width: 6),
                    Expanded(child: Text(l.item.name, style: OsText.weight(OsText.label, 600).copyWith(fontSize: 15))),
                  ]),
                  const SizedBox(height: 2),
                  l.orderable
                      ? Text('${money(l.item.priceCents)} each', style: OsText.small.copyWith(fontFeatures: OsText.tabular))
                      : Text(l.item.isAvailable ? 'Truck closed' : 'Sold out', style: OsText.weight(OsText.small, 700).copyWith(color: OsColors.chili600)),
                ]),
              ),
              const SizedBox(width: 8),
              l.orderable
                  ? AddButton(item: l.item, stall: s)
                  : TextButton(onPressed: () => app.remove(l.item.id), child: const Text('Remove')),
            ]),
          ),
        ],
      ]),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.selected, required this.icon, required this.title, required this.body, required this.onTap});
  final bool selected;
  final IconData icon;
  final String title, body;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        selected: selected,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(OsRadius.lg),
          child: AnimatedContainer(
            duration: OsMotion.press,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(OsRadius.lg),
              border: Border.all(color: selected ? OsColors.night900 : OsColors.line, width: selected ? 1.5 : 1),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: selected ? OsColors.night900 : OsColors.surface2, shape: BoxShape.circle),
                child: Icon(icon, size: 18, color: selected ? Colors.white : OsColors.ink700),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: OsText.weight(OsText.label, 700).copyWith(fontSize: 15)),
                  Text(body, style: OsText.small),
                ]),
              ),
              Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: selected ? OsColors.night900 : OsColors.ink300),
            ]),
          ),
        ),
      );
}
