import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/widgets.dart';

/// Topics in the same order and with the same values as the website (support_topic enum).
const supportTopics = [
  ('order', 'Help with an order'),
  ('feedback', 'Feedback'),
  ('lost_found', 'Lost and found'),
  ('vendor', 'Run a truck here'),
  ('other', 'Something else'),
];

Future<void> openLink(BuildContext context, Uri uri) async {
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open that on this phone.')));
  }
}

/// Contact us: message the park team (same fields and checks as the website), plus the park's and
/// the trucks' direct lines from the catalog. Nothing is shown that the catalog does not have.
class ContactScreen extends StatefulWidget {
  const ContactScreen({super.key, this.initialTopic = 'other', this.orderNo});
  final String initialTopic;
  final String? orderNo;
  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  late String _topic = widget.initialTopic;
  late final _name = TextEditingController(text: AppScope.read(context).account?.name ?? AppScope.read(context).customerName);
  late final _reach = TextEditingController(text: AppScope.read(context).account?.phone ?? '');
  late final _order = TextEditingController(text: widget.orderNo ?? '');
  final _message = TextEditingController();
  bool _touched = false;
  String? _sentRef;

  @override
  void dispose() {
    for (final c in [_name, _reach, _order, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  String? get _nameErr => _name.text.trim().isEmpty ? 'Add your name.' : null;
  String? get _reachErr {
    final v = _reach.text.trim();
    if (v.isEmpty) return 'Add an email or phone number so we can reply.';
    final email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v);
    final phone = v.replaceAll(RegExp(r'\D'), '').length == 10;
    return email || phone ? null : 'Enter a valid email, or a 10-digit phone number.';
  }

  String? get _messageErr {
    final n = _message.text.trim().length;
    if (n < 5) return 'Tell us a little about it.';
    if (n > 2000) return 'That message is too long. Keep it under 2,000 characters.';
    return null;
  }

  void _send(AppState app) {
    setState(() => _touched = true);
    if (_nameErr != null || _reachErr != null || _messageErr != null) return;
    final ref = app.submitSupportRequest(
      topic: _topic,
      name: _name.text,
      contact: _reach.text,
      orderNo: _topic == 'order' && _order.text.trim().isNotEmpty ? _order.text.trim().toUpperCase() : null,
      message: _message.text,
    );
    FocusScope.of(context).unfocus();
    setState(() => _sentRef = ref);
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final park = app.catalog.park;
    final myOrders = app.orders.take(5).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Contact us')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
        children: [
          if (_sentRef != null) _sent(app) else ..._form(app, myOrders),
          const SizedBox(height: 28),
          _Card(icon: Icons.place_outlined, title: 'Visit the park', children: [
            Text(park.address ?? 'Address coming soon.', style: OsText.weight(OsText.label, park.address == null ? 400 : 700)),
            if (park.hoursText != null) Text(park.hoursText!, style: OsText.small),
            if (park.address != null)
              TextButton.icon(
                onPressed: () => openLink(context, Uri.https('www.google.com', '/maps/search/', {'api': '1', 'query': '${park.name}, ${park.address}'})),
                icon: const Icon(Icons.directions, size: 18),
                label: const Text('Get directions'),
              ),
          ]),
          const SizedBox(height: 12),
          _Card(icon: Icons.support_agent, title: 'Reach the park team', children: [
            if (park.contactPhone != null)
              _LinkRow(icon: Icons.call_outlined, text: park.contactPhone!, onTap: () => openLink(context, Uri(scheme: 'tel', path: park.contactPhone!.replaceAll(RegExp(r'[^\d+]'), '')))),
            if (park.contactEmail != null)
              _LinkRow(icon: Icons.mail_outline, text: park.contactEmail!, onTap: () => openLink(context, Uri(scheme: 'mailto', path: park.contactEmail!))),
            if (park.instagram != null)
              _LinkRow(icon: Icons.alternate_email, text: park.instagram!, onTap: () => openLink(context, Uri.https('www.instagram.com', '/${park.instagram}/'))),
            Text('The form on this page reaches the park team directly.', style: OsText.small),
          ]),
          const SizedBox(height: 12),
          _Card(icon: Icons.storefront_outlined, title: 'Ask a truck directly', children: [
            Text('For a dish, an allergy question, or food you are waiting for, the truck can help fastest.', style: OsText.weight(OsText.label, 400).copyWith(color: OsColors.ink700)),
            const SizedBox(height: 6),
            for (final s in app.catalog.stalls)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(children: [
                  ClipOval(child: FoodImage(s.logoUrl, width: 40, height: 40)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(s.name, style: OsText.weight(OsText.label, 700)),
                      if (s.phone == null && s.instagram == null) Text('No direct line listed', style: OsText.small),
                    ]),
                  ),
                  if (s.phone != null)
                    IconButton(
                      tooltip: 'Call ${s.name}',
                      icon: const Icon(Icons.call_outlined, color: OsColors.ember700),
                      onPressed: () => openLink(context, Uri(scheme: 'tel', path: s.phone!.replaceAll(RegExp(r'[^\d+]'), ''))),
                    ),
                  if (s.instagram != null)
                    IconButton(
                      tooltip: '${s.name} on Instagram',
                      icon: const Icon(Icons.alternate_email, color: OsColors.ember700),
                      onPressed: () => openLink(context, Uri.https('www.instagram.com', '/${s.instagram}/')),
                    ),
                ]),
              ),
          ]),
        ],
      ),
    );
  }

  List<Widget> _form(AppState app, List<Order> myOrders) => [
        Text('Send the park team a message', style: OsText.title),
        const SizedBox(height: 4),
        Text('Questions about an order, the park, or running a truck here.', style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
        const SizedBox(height: 16),
        Text('What is it about?', style: OsText.label),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final (value, label) in supportTopics)
            ChoiceChip(
              label: Text(label),
              selected: _topic == value,
              labelStyle: OsText.label.copyWith(color: _topic == value ? Colors.white : OsColors.ink700),
              onSelected: (_) => setState(() => _topic = value),
            ),
        ]),
        const SizedBox(height: 16),
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          onChanged: (_) => _touched ? setState(() {}) : null,
          decoration: InputDecoration(labelText: 'Your name', errorText: _touched ? _nameErr : null),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _reach,
          keyboardType: TextInputType.emailAddress,
          onChanged: (_) => _touched ? setState(() {}) : null,
          decoration: InputDecoration(labelText: 'Email or phone', helperText: 'So we can reply.', hintText: 'you@example.com', errorText: _touched ? _reachErr : null),
        ),
        if (_topic == 'order') ...[
          const SizedBox(height: 14),
          TextField(
            controller: _order,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(labelText: 'Order number (optional)', hintText: 'OS-', helperText: 'It starts with OS-, on your order page.'),
          ),
          if (myOrders.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final o in myOrders)
                ActionChip(label: Text(o.orderNo), onPressed: () => setState(() => _order.text = o.orderNo)),
            ]),
          ],
        ],
        const SizedBox(height: 14),
        TextField(
          controller: _message,
          minLines: 4,
          maxLines: 8,
          maxLength: 2000,
          onChanged: (_) => _touched ? setState(() {}) : null,
          decoration: InputDecoration(labelText: 'Message', alignLabelWithHint: true, errorText: _touched ? _messageErr : null),
        ),
        const SizedBox(height: 8),
        FilledButton(onPressed: () => _send(app), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)), child: const Text('Send message')),
        const SizedBox(height: 8),
        Text('For allergy questions, ask the truck before you order.', style: OsText.small),
      ];

  Widget _sent(AppState app) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: OsColors.leaf50, borderRadius: BorderRadius.circular(OsRadius.xl), border: Border.all(color: OsColors.leaf600)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.check_circle, color: OsColors.leaf600, size: 32),
          const SizedBox(height: 8),
          Text('Message sent', style: OsText.title),
          const SizedBox(height: 4),
          Text('Your reference is $_sentRef. The park team will reply to ${_reach.text.trim()}.', style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
          if (AppState.demo) ...[
            const SizedBox(height: 8),
            Text('Demo: the message is kept on this phone.', style: OsText.small),
          ],
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => setState(() {
              _sentRef = null;
              _touched = false;
              _message.clear();
            }),
            child: const Text('Send another'),
          ),
        ]),
      );
}

class _Card extends StatelessWidget {
  const _Card({required this.icon, required this.title, required this.children});
  final IconData icon;
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(OsRadius.xl), border: Border.all(color: OsColors.line)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Icon(icon, size: 20, color: OsColors.ember700), const SizedBox(width: 8), Text(title, style: OsText.subheading)]),
          const SizedBox(height: 10),
          ...children,
        ]),
      );
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.icon, required this.text, required this.onTap});
  final IconData icon;
  final String text;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [Icon(icon, size: 18, color: OsColors.ink700), const SizedBox(width: 10), Text(text, style: OsText.weight(OsText.label, 600))]),
        ),
      );
}
