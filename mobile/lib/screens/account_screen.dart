import 'package:material_ui/material_ui.dart';

import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import 'onboarding_screen.dart';
import 'settings_screen.dart';

/// Account tab: sign in / create account when signed out; profile, Settings and sign out when signed in.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key, required this.onOpenOrders});
  final VoidCallback onOpenOrders;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return app.account == null ? const _SignIn() : _Profile(account: app.account!, onOpenOrders: onOpenOrders);
  }
}

/// Sign-in pushed from the cart: returns to the cart once signed in (after the tour, for new accounts).
class SignInPage extends StatelessWidget {
  const SignInPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(), body: const _SignIn(popOnSignIn: true));
}

/// After a brand-new account: play the welcome tour once.
Future<void> afterSignIn(BuildContext context, {required bool isNew}) async {
  if (!isNew) return;
  await Navigator.of(context).push(PageRouteBuilder<void>(
    pageBuilder: (_, _, _) => const OnboardingScreen(),
    transitionDuration: OsMotion.page,
    reverseTransitionDuration: const Duration(milliseconds: 250),
    transitionsBuilder: (_, a, _, child) => FadeTransition(
      opacity: CurvedAnimation(parent: a, curve: OsMotion.enter),
      child: SlideTransition(position: Tween(begin: const Offset(0, 0.04), end: Offset.zero).animate(CurvedAnimation(parent: a, curve: OsMotion.enter)), child: child),
    ),
  ));
}

class _SignIn extends StatefulWidget {
  const _SignIn({this.popOnSignIn = false});
  final bool popOnSignIn;
  @override
  State<_SignIn> createState() => _SignInState();
}

class _SignInState extends State<_SignIn> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _touched = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    setState(() => _touched = true);
    if (_name.text.trim().isEmpty || _phoneError() != null) return;
    final app = AppScope.read(context);
    final isNew = app.signIn(name: _name.text, phone: _phone.text, method: SignInMethod.phone);
    await _done(isNew);
  }

  Future<void> _done(bool isNew) async {
    await afterSignIn(context, isNew: isNew);
    if (widget.popOnSignIn && mounted) Navigator.of(context).pop();
  }

  String? _phoneError() {
    final digits = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (_phone.text.trim().isEmpty) return 'Add your mobile number.';
    if (digits.length != 10) return 'Enter a 10-digit US mobile number.';
    return null;
  }

  Future<void> _google() async {
    // Demo stand-in for Google sign-in: ask for the name Google would share.
    final name = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => const _GoogleDemoSheet(),
    );
    if (name == null || name.trim().isEmpty || !mounted) return;
    final isNew = AppScope.read(context).signIn(name: name, method: SignInMethod.google);
    await _done(isNew);
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ListView(
      padding: EdgeInsets.fromLTRB(20, widget.popOnSignIn ? 8 : top + 28, 20, 40),
      children: [
        Container(
          height: 120,
          decoration: BoxDecoration(color: OsColors.night900, borderRadius: BorderRadius.circular(OsRadius.xl)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
          child: Image.asset('assets/brand/logo-compact.png', fit: BoxFit.contain, semanticLabel: 'Open Sky Food Park'),
        ),
        const SizedBox(height: 24),
        Text('Your account', style: OsText.title),
        const SizedBox(height: 6),
        Text('Sign in to order from every truck, keep your tokens in one place and see past orders.',
            style: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink700)),
        const SizedBox(height: 22),
        OutlinedButton(
          onPressed: _google,
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const _GoogleMark(),
            const SizedBox(width: 10),
            Text('Continue with Google', style: OsText.weight(OsText.bodyStrong, 700)),
          ]),
        ),
        const SizedBox(height: 20),
        Row(children: [
          const Expanded(child: Divider()),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text('or create an account', style: OsText.small)),
          const Expanded(child: Divider()),
        ]),
        const SizedBox(height: 20),
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          autofillHints: const [AutofillHints.name],
          onChanged: (_) => _touched ? setState(() {}) : null,
          decoration: InputDecoration(labelText: 'Your name', errorText: _touched && _name.text.trim().isEmpty ? 'Add your name.' : null),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          autofillHints: const [AutofillHints.telephoneNumber],
          onChanged: (_) => _touched ? setState(() {}) : null,
          decoration: InputDecoration(labelText: 'Mobile number', prefixText: '+1 ', errorText: _touched ? _phoneError() : null),
        ),
        const SizedBox(height: 18),
        FilledButton(onPressed: _create, style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)), child: const Text('Create account')),
        const SizedBox(height: 14),
        if (AppState.demo)
          Text('Demo: no code is sent and nothing leaves this phone. Already signed up here with the same details? This signs you back in.',
              textAlign: TextAlign.center, style: OsText.small),
      ],
    );
  }
}

class _GoogleDemoSheet extends StatefulWidget {
  const _GoogleDemoSheet();
  @override
  State<_GoogleDemoSheet> createState() => _GoogleDemoSheetState();
}

class _GoogleDemoSheetState extends State<_GoogleDemoSheet> {
  final _name = TextEditingController();
  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Continue with Google', style: OsText.heading),
          const SizedBox(height: 6),
          Text('Demo: Google sign-in is not connected yet. Enter the name your Google account would share.',
              style: OsText.weight(OsText.label, 400).copyWith(color: OsColors.ink700)),
          const SizedBox(height: 16),
          TextField(controller: _name, autofocus: true, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Name')),
          const SizedBox(height: 16),
          FilledButton(onPressed: () => Navigator.pop(context, _name.text), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)), child: const Text('Continue')),
        ]),
      );
}

/// The four-colour "G", drawn as text so no brand asset is bundled.
class _GoogleMark extends StatelessWidget {
  const _GoogleMark();
  @override
  Widget build(BuildContext context) => Container(
        width: 22,
        height: 22,
        alignment: Alignment.center,
        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: OsColors.line)),
        child: Text('G', style: OsText.weight(OsText.label, 800).copyWith(color: const Color(0xFF4285F4), height: 1)),
      );
}

class _Profile extends StatelessWidget {
  const _Profile({required this.account, required this.onOpenOrders});
  final Account account;
  final VoidCallback onOpenOrders;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final top = MediaQuery.paddingOf(context).top;
    final orders = app.orders;
    final live = orders.where((o) => o.status == OrderStatus.active).length;

    return ListView(
      padding: EdgeInsets.fromLTRB(16, top + 24, 16, 40),
      children: [
        Text('Account', style: OsText.title),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(OsRadius.xl), border: Border.all(color: OsColors.line)),
          child: Row(children: [
            Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: const BoxDecoration(color: OsColors.night900, shape: BoxShape.circle),
              child: Text(account.initials, style: OsText.weight(OsText.subheading, 800).copyWith(color: Colors.white)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(account.name, style: OsText.heading),
                Text(account.method == SignInMethod.google ? 'Signed in with Google' : (account.phoneDisplay ?? ''), style: OsText.small),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 20),
        _Section(children: [
          _Tile(
            icon: Icons.receipt_long_outlined,
            title: 'Your orders',
            subtitle: orders.isEmpty ? 'No orders yet' : (live > 0 ? '$live in progress' : '${orders.length} past ${orders.length == 1 ? 'order' : 'orders'}'),
            onTap: onOpenOrders,
          ),
          _Tile(
            icon: Icons.settings_outlined,
            title: 'Settings',
            subtitle: 'Profile, ordering preferences, app tour',
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const SettingsScreen())),
          ),
          _Tile(
            icon: Icons.slideshow_outlined,
            title: 'How the app works',
            subtitle: 'Replay the welcome tour',
            onTap: () => afterSignIn(context, isNew: true),
          ),
        ]),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: () => _confirmSignOut(context),
          icon: const Icon(Icons.logout, size: 18),
          label: const Text('Sign out'),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), foregroundColor: OsColors.ink900),
        ),
      ],
    );
  }
}

Future<void> _confirmSignOut(BuildContext context) async {
  final yes = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Sign out?'),
      content: const Text('Your cart stays on this phone.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sign out')),
      ],
    ),
  );
  if (yes == true && context.mounted) AppScope.read(context).signOut();
}

/// Public so Settings can reuse the same sign-out confirmation.
Future<void> confirmSignOut(BuildContext context) => _confirmSignOut(context);

class _Section extends StatelessWidget {
  const _Section({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(OsRadius.xl), border: Border.all(color: OsColors.line)),
        clipBehavior: Clip.antiAlias,
        child: Column(children: [
          for (final (i, c) in children.indexed) ...[if (i > 0) const Divider(indent: 60), c],
        ]),
      );
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => ListTile(
        minTileHeight: 64,
        leading: Container(
          width: 36,
          height: 36,
          decoration: const BoxDecoration(color: OsColors.surface1, shape: BoxShape.circle),
          child: Icon(icon, size: 20, color: OsColors.ink700),
        ),
        title: Text(title, style: OsText.weight(OsText.bodyStrong, 700).copyWith(fontSize: 15)),
        subtitle: Text(subtitle, style: OsText.small),
        trailing: const Icon(Icons.chevron_right, color: OsColors.ink500),
        onTap: onTap,
      );
}
