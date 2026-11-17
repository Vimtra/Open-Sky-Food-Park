import 'package:cupertino_ui/cupertino_ui.dart';

import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../ui/kit.dart';

/// Profile and demo sign-in. Real Google / Apple / phone sign-in arrives with the Supabase connection.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final a = state.account;
    final park = state.catalog.park;

    return CupertinoPageScaffold(
      backgroundColor: OsColors.surface1,
      navigationBar: const CupertinoNavigationBar(middle: Text('Account'), backgroundColor: OsColors.surface1, border: null),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (a == null) ...[
              Text('Sign in', style: OsText.title),
              const SizedBox(height: 6),
              Text('Save your orders and tokens. In this demo your profile stays on this phone.', style: OsText.body.copyWith(color: OsColors.ink700)),
              const SizedBox(height: 18),
              CupertinoTextField(controller: _name, placeholder: 'Your name', padding: const EdgeInsets.all(14), style: OsText.body),
              const SizedBox(height: 10),
              CupertinoTextField(controller: _phone, placeholder: 'Mobile number (optional)', keyboardType: TextInputType.phone, padding: const EdgeInsets.all(14), style: OsText.body),
              const SizedBox(height: 14),
              PrimaryButton(
                label: 'Continue',
                onTap: () {
                  if (_name.text.trim().isEmpty) return;
                  AppScope.read(context).signIn(name: _name.text, phone: _phone.text, method: SignInMethod.phone);
                },
              ),
              const SizedBox(height: 10),
              Text('Sign in with Apple and Google come with the live app.', textAlign: TextAlign.center, style: OsText.small),
            ] else ...[
              Row(children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: const BoxDecoration(color: OsColors.night900, shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: Text(a.initials, style: OsText.weight(OsText.heading, 800).copyWith(color: OsColors.ember400)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(a.name, style: OsText.title),
                    if (a.phoneDisplay != null) Text(a.phoneDisplay!, style: OsText.label.copyWith(color: OsColors.ink500)),
                  ]),
                ),
              ]),
            ],
            const SizedBox(height: 28),
            CupertinoListSection.insetGrouped(
              margin: EdgeInsets.zero,
              header: Text('THE PARK', style: OsText.caption.copyWith(color: OsColors.ink500)),
              children: [
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.location_solid, color: OsColors.ember700),
                  title: Text(park.name, style: OsText.label),
                  subtitle: park.address == null ? null : Text(park.address!, style: OsText.small),
                ),
                if (park.instagram != null)
                  CupertinoListTile(
                    leading: const Icon(CupertinoIcons.camera, color: OsColors.ember700),
                    title: Text('@${park.instagram}', style: OsText.label),
                    subtitle: Text('Instagram', style: OsText.small),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            CupertinoListSection.insetGrouped(
              margin: EdgeInsets.zero,
              children: [
                if (a != null)
                  CupertinoListTile(
                    leading: const Icon(CupertinoIcons.square_arrow_left, color: OsColors.ink700),
                    title: Text('Sign out', style: OsText.label),
                    onTap: () => AppScope.read(context).signOut(),
                  ),
                CupertinoListTile(
                  leading: const Icon(CupertinoIcons.trash, color: OsColors.chili600),
                  title: Text('Clear demo data', style: OsText.label.copyWith(color: OsColors.chili600)),
                  onTap: () => showCupertinoDialog<void>(
                    context: context,
                    builder: (d) => CupertinoAlertDialog(
                      title: const Text('Clear demo data?'),
                      content: const Text('Removes the cart, demo orders, favourites and profile from this phone.'),
                      actions: [
                        CupertinoDialogAction(onPressed: () => Navigator.of(d).pop(), child: const Text('Keep')),
                        CupertinoDialogAction(
                          isDestructiveAction: true,
                          onPressed: () {
                            AppScope.read(context).clearDemoData();
                            Navigator.of(d).pop();
                          },
                          child: const Text('Clear'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
