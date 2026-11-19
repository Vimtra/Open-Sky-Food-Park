import 'package:material_ui/material_ui.dart';

import '../data/models.dart';
import '../state/app_state.dart';
import '../state/ready_alerts.dart';
import '../theme/tokens.dart';
import 'account_screen.dart';

/// Settings, reached from the Account tab. Only settings that actually do something.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final _name = TextEditingController(text: AppScope.read(context).account?.name ?? '');
  late final _phone = TextEditingController(text: AppScope.read(context).account?.phone ?? '');

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _saveProfile(AppState app) {
    if (_name.text.trim().isEmpty) {
      _toast('Your name cannot be empty.');
      return;
    }
    app.updateProfile(name: _name.text, phone: app.account?.method == SignInMethod.phone ? _phone.text : null);
    FocusScope.of(context).unfocus();
    _toast('Profile saved.');
  }

  void _toast(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final park = app.catalog.park;
    final account = app.account;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        children: [
          if (account != null) ...[
            _heading('Profile'),
            TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Name', helperText: 'Trucks call this out with your token.')),
            const SizedBox(height: 14),
            if (account.method == SignInMethod.phone)
              TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Mobile number', prefixText: '+1 '))
            else
              Text('Signed in with Google', style: OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink700)),
            const SizedBox(height: 14),
            Align(alignment: Alignment.centerLeft, child: FilledButton(onPressed: () => _saveProfile(app), child: const Text('Save profile'))),
            const SizedBox(height: 28),
          ],
          _heading('Ordering'),
          Text('Used as the starting choice at checkout. You can still change it for each order.', style: OsText.small),
          const SizedBox(height: 10),
          SegmentedButton<Fulfilment>(
            segments: [
              const ButtonSegment(value: Fulfilment.pickup, label: Text('Pick up'), icon: Icon(Icons.confirmation_number_outlined)),
              if (park.tableServiceEnabled) const ButtonSegment(value: Fulfilment.table, label: Text('To my table'), icon: Icon(Icons.chair_outlined)),
            ],
            selected: {park.tableServiceEnabled ? app.fulfilment : Fulfilment.pickup},
            onSelectionChanged: (s) => app.setCheckout(fulfilment: s.first),
            showSelectedIcon: false,
          ),
          const SizedBox(height: 14),
          SegmentedButton<PaymentMethod>(
            segments: const [
              ButtonSegment(value: PaymentMethod.payAtStall, label: Text('Pay at the truck')),
              ButtonSegment(value: PaymentMethod.online, label: Text('Pay now')),
            ],
            selected: {app.paymentMethod},
            onSelectionChanged: (s) => app.setCheckout(payment: s.first),
            showSelectedIcon: false,
          ),
          const SizedBox(height: 28),
          _heading('Notifications'),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: app.readyAlerts,
            onChanged: (v) async {
              app.setReadyAlerts(v);
              if (v) await ReadyAlerts.askPermission();
            },
            title: Text('Tell me when my food is ready', style: OsText.weight(OsText.label, 700).copyWith(fontSize: 15)),
            subtitle: Text('A notification with its own bell sound, so you can tell it apart from your other apps.', style: OsText.small),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: app.readyAlerts
                  ? () async {
                      final ok = await ReadyAlerts.askPermission() || await ReadyAlerts.allowed;
                      if (ok) {
                        await ReadyAlerts.showSample();
                      } else if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                            content: Text('Notifications are off for Open Sky. Turn them on in your phone\'s settings to hear the alert.')));
                      }
                    }
                  : null,
              icon: const Icon(Icons.notifications_active_outlined, size: 18),
              label: const Text('Hear the alert'),
            ),
          ),
          Text('To change or silence the sound, open your phone\'s settings for Open Sky and choose "Food is ready".', style: OsText.small),
          const SizedBox(height: 28),
          _heading('Help'),
          _row(Icons.slideshow_outlined, 'Replay the welcome tour', () => afterSignIn(context, isNew: true)),
          if (AppState.demo) ...[
            const SizedBox(height: 28),
            _heading('Demo data'),
            Text('Clears the cart, orders, account and token numbers on this phone.', style: OsText.small),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: () async {
                final yes = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Clear demo data?'),
                    content: const Text('This removes everything the app saved on this phone. It cannot be undone.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                      TextButton(onPressed: () => Navigator.pop(ctx, true), style: TextButton.styleFrom(foregroundColor: OsColors.chili600), child: const Text('Clear')),
                    ],
                  ),
                );
                if (yes != true || !context.mounted) return;
                await app.clearDemoData();
                if (context.mounted) Navigator.of(context).pop();
              },
              style: OutlinedButton.styleFrom(foregroundColor: OsColors.chili600),
              child: const Text('Clear demo data'),
            ),
          ],
          if (account != null) ...[
            const SizedBox(height: 28),
            OutlinedButton.icon(
              onPressed: () async {
                await confirmSignOut(context);
                if (context.mounted && AppScope.read(context).account == null) Navigator.of(context).pop();
              },
              icon: const Icon(Icons.logout, size: 18),
              label: const Text('Sign out'),
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            ),
          ],
          const SizedBox(height: 28),
          Center(
            child: Text('${park.name} app 1.0.0${park.address != null ? '\n${park.address}' : ''}', textAlign: TextAlign.center, style: OsText.small),
          ),
        ],
      ),
    );
  }

  Widget _heading(String t) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(t, style: OsText.subheading));

  Widget _row(IconData icon, String title, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(OsRadius.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(children: [
            Icon(icon, color: OsColors.ink700),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: OsText.weight(OsText.bodyStrong, 600).copyWith(fontSize: 15))),
            const Icon(Icons.chevron_right, color: OsColors.ink500),
          ]),
        ),
      );
}
