import 'package:material_ui/material_ui.dart';

import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/widgets.dart';
import 'contact_screen.dart';
import 'orders_screen.dart';

/// Help & Support: the website's FAQ (web/src/components/help-screen.tsx), worded for the app.
/// Every answer describes how the product works today; park settings decide the data-driven ones.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});
  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _Faq {
  const _Faq(this.q, this.a, {this.link, this.diets = false});
  final String q;
  final List<String> a;
  final (String, void Function(BuildContext))? link;
  final bool diets;
}

class _Topic {
  const _Topic(this.title, this.icon, this.faqs);
  final String title;
  final IconData icon;
  final List<_Faq> faqs;
}

void _openOrders(BuildContext c) => Navigator.of(c).push(MaterialPageRoute<void>(
    builder: (_) => Scaffold(appBar: AppBar(title: const Text('Your orders')), body: const OrdersScreen(inset: false))));
void Function(BuildContext) _contact(String topic) =>
    (c) => Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => ContactScreen(initialTopic: topic)));

List<_Topic> _topics(Park park) {
  final table = park.tableServiceEnabled;
  final tax = park.taxPercent;
  return [
    _Topic('Ordering', Icons.restaurant_menu, [
      const _Faq('How does ordering from several trucks work?', [
        'Add dishes from any truck to one cart and check out once. Each truck receives only its own part of the order and cooks it separately, so your dishes may be ready at different times.',
      ]),
      const _Faq('What is a token number?', [
        'Each truck gives its part of your order a token number, shown on your order page. Tokens restart every day, and two trucks can give you the same number, so check which truck each token belongs to.',
      ]),
      _Faq('How do I know when my food is ready?', [
        "Open the Orders tab. Each truck's part moves from Sent to Preparing to Ready, and the page updates by itself.",
        table
            ? 'For pickup, collect from that truck when its token shows Ready. For table service, the truck brings it over.'
            : 'When a part shows Ready, collect it from that truck and show its token.',
      ], link: ('Your orders', _openOrders)),
      const _Faq('A dish says Sold out. What happened?', [
        'Trucks switch a dish off when they run out. If something in your cart sells out, or a truck closes before you check out, the cart marks it and you remove it to continue.',
      ]),
    ]),
    _Topic(table ? 'Pickup and table service' : 'Pickup', Icons.confirmation_number_outlined, [
      table
          ? const _Faq('Pickup or table service: what is the difference?', [
              'Pickup: go to each truck when its token shows Ready.',
              'Table service: enter the number on your table at checkout, and each truck brings its dishes to you.',
            ])
          : const _Faq('How do I collect my food?', ['Go to each truck when its token shows Ready on your order page, and show the token at the window.']),
      const _Faq('Where do I collect from?', [
        'From the truck that made the dish. Your order page names the truck for every token.',
      ]),
    ]),
    _Topic('Payment', Icons.credit_card, [
      _Faq('How can I pay?', [
        AppState.demo ? 'Pay now: card, Apple Pay or Google Pay (in this demo no card is charged).' : 'Pay now: card, Apple Pay or Google Pay. One payment covers every truck in your order.',
        'Pay at the truck: pay each truck for its part when you collect.',
      ]),
      _Faq('Are taxes or fees added at checkout?', [
        tax > 0
            ? 'Menu prices do not include sales tax. The cart adds ${tax.toStringAsFixed(tax.truncateToDouble() == tax ? 0 : 2)}% sales tax and shows the full total before you order.'
            : 'The cart shows the full total before you order, including anything added on top of menu prices.',
        if (park.serviceFeeCents > 0) 'A small service fee per order is shown in the cart before you pay.',
      ]),
      _Faq('I paid, but my order still says Waiting for payment.', [
        'The trucks start as soon as the payment is confirmed, which usually takes a moment. If you were charged and it still has not moved, send us a message with your order number.',
      ], link: ('Message the park team', _contact('order'))),
    ]),
    _Topic('Changes and cancellations', Icons.receipt_long_outlined, [
      _Faq('Can I cancel my order?', ['Yes, from your order page, until any truck starts preparing it. After that, speak to the truck.'],
          link: ('Your orders', _openOrders)),
      _Faq('Something is wrong with my food or order.', [
        'Tell the truck first; they can fix most things on the spot. If that does not solve it, send the park team a message with your order number. If you paid online and need money back, say so in the message.',
      ], link: ('Message the park team', _contact('order'))),
    ]),
    _Topic('Food and allergies', Icons.health_and_safety_outlined, [
      const _Faq('Do you list allergens or ingredients?', [
        'No. The menus here do not list allergens or ingredients. If you have an allergy, ask the truck before you order.',
      ]),
      const _Faq('What do the veg, egg and non-veg marks mean?', [
        'Green dot: vegetarian. Amber dot: contains egg. Red triangle: non-vegetarian.',
        "No mark means the truck's menu does not say. Ask the truck if it matters to you.",
      ], diets: true),
    ]),
    _Topic('Your account', Icons.person_outline, [
      const _Faq('Do I need an account?', ['You can browse without one. To order, sign in from the Account tab. Your orders and tokens are kept with your account.']),
      const _Faq('How do I change the name on my orders?', ['Open Account → Settings and edit your name. Trucks call out that name with your token.']),
    ]),
    _Topic('The park and trucks', Icons.forum_outlined, [
      _Faq('I lost something at the park.', ['Send us a message with the topic Lost and found. Say what it is and roughly when you were here.'],
          link: ('Report a lost item', _contact('lost_found'))),
      _Faq('I run a food truck. Can I join Open Sky?', ['Send us a message with the topic Run a truck here and tell us about your truck and menu.'],
          link: ('Get in touch', _contact('vendor'))),
      const _Faq('I work at a truck. Where do I see orders?', [
        "Truck staff use the stall dashboard on the park's website, signing in with the email and password the park gave them.",
      ]),
    ]),
  ];
}

class _HelpScreenState extends State<HelpScreen> {
  final _q = TextEditingController();

  @override
  void initState() {
    super.initState();
    _q.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final park = AppScope.of(context).catalog.park;
    final q = _q.text.trim().toLowerCase();
    final topics = [
      for (final t in _topics(park))
        _Topic(t.title, t.icon, [for (final f in t.faqs) if (q.isEmpty || f.q.toLowerCase().contains(q) || f.a.any((p) => p.toLowerCase().contains(q))) f]),
    ].where((t) => t.faqs.isNotEmpty).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Help & Support')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
        children: [
          Text('How can we help?', style: OsText.title),
          const SizedBox(height: 12),
          TextField(
            controller: _q,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Search help',
              prefixIcon: const Icon(Icons.search, color: OsColors.ink500),
              suffixIcon: _q.text.isEmpty ? null : IconButton(tooltip: 'Clear', icon: const Icon(Icons.close), onPressed: _q.clear),
            ),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _QuickLink(icon: Icons.receipt_long_outlined, label: 'Track an order', onTap: () => _openOrders(context))),
            const SizedBox(width: 10),
            Expanded(child: _QuickLink(icon: Icons.mail_outline, label: 'Message the park', onTap: () => _contact('other')(context))),
          ]),
          const SizedBox(height: 20),
          if (topics.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text('No answers match “${_q.text.trim()}”. Try other words, or send us a message.', textAlign: TextAlign.center, style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
            ),
          for (final t in topics) ...[
            Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 6),
              child: Row(children: [Icon(t.icon, size: 20, color: OsColors.ember700), const SizedBox(width: 8), Text(t.title, style: OsText.subheading)]),
            ),
            Container(
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(OsRadius.lg), border: Border.all(color: OsColors.line)),
              clipBehavior: Clip.antiAlias,
              child: Column(children: [
                for (final (i, f) in t.faqs.indexed) ...[
                  if (i > 0) const Divider(),
                  Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      initiallyExpanded: q.isNotEmpty,
                      tilePadding: const EdgeInsets.symmetric(horizontal: 14),
                      childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                      expandedCrossAxisAlignment: CrossAxisAlignment.start,
                      title: Text(f.q, style: OsText.weight(OsText.bodyStrong, 700).copyWith(fontSize: 15)),
                      children: [
                        for (final p in f.a) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(p, style: OsText.weight(OsText.label, 400).copyWith(color: OsColors.ink700, height: 1.45))),
                        if (f.diets)
                          Wrap(spacing: 18, children: [
                            for (final d in Diet.values) Row(mainAxisSize: MainAxisSize.min, children: [DietMark(d), const SizedBox(width: 6), Text(dietLabel(d), style: OsText.label)]),
                          ]),
                        if (f.link case (final label, final go)) TextButton(onPressed: () => go(context), child: Text('$label  →')),
                      ],
                    ),
                  ),
                ],
              ]),
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: OsColors.surface1, borderRadius: BorderRadius.circular(OsRadius.xl)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Still need help?', style: OsText.subheading),
              const SizedBox(height: 4),
              Text('Send the park team a message. For a dish or an allergy question, the truck can help fastest.', style: OsText.weight(OsText.label, 400).copyWith(color: OsColors.ink700)),
              const SizedBox(height: 12),
              FilledButton(onPressed: () => _contact('other')(context), child: const Text('Contact us')),
            ]),
          ),
        ],
      ),
    );
  }
}

class _QuickLink extends StatelessWidget {
  const _QuickLink({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(OsRadius.lg),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(OsRadius.lg), border: Border.all(color: OsColors.line)),
          child: Row(children: [
            Icon(icon, color: OsColors.ember700),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: OsText.weight(OsText.label, 700))),
          ]),
        ),
      );
}
