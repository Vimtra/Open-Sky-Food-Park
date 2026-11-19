import 'package:material_ui/material_ui.dart';

import '../screens/account_screen.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';

/// Heart for a dish or a truck (v1.6 favourites, C4). Favourites belong to the account, so a
/// signed-out tap offers sign-in instead.
class FavouriteButton extends StatelessWidget {
  const FavouriteButton.item(this.id, {super.key, this.name = 'dish', this.onDark = false}) : stall = false;
  const FavouriteButton.stall(this.id, {super.key, this.name = 'truck', this.onDark = false}) : stall = true;

  final String id, name;
  final bool stall, onDark;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final on = stall ? app.isFavouriteStall(id) : app.isFavouriteItem(id);
    return IconButton(
      tooltip: on ? 'Remove $name from favourites' : 'Save $name to favourites',
      isSelected: on,
      onPressed: () {
        final messenger = ScaffoldMessenger.of(context);
        final done = stall ? app.toggleFavouriteStall(id) : app.toggleFavouriteItem(id);
        messenger.hideCurrentSnackBar();
        if (!done) {
          messenger.showSnackBar(SnackBar(
            content: const Text('Sign in to save favourites.'),
            action: SnackBarAction(
              label: 'Sign in',
              textColor: OsColors.ember400,
              onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const SignInPage())),
            ),
          ));
          return;
        }
        final nowOn = stall ? app.isFavouriteStall(id) : app.isFavouriteItem(id);
        messenger.showSnackBar(SnackBar(content: Text(nowOn ? 'Saved to your favourites.' : 'Removed from your favourites.'), duration: const Duration(seconds: 2)));
      },
      style: IconButton.styleFrom(
        backgroundColor: onDark ? const Color(0x660B1230) : OsColors.surface0.withValues(alpha: 0.9),
        foregroundColor: onDark ? Colors.white : OsColors.ink900,
      ),
      icon: AnimatedSwitcher(
        duration: OsMotion.popover,
        transitionBuilder: (c, a) => ScaleTransition(scale: Tween(begin: 0.6, end: 1.0).animate(CurvedAnimation(parent: a, curve: OsMotion.enter)), child: c),
        child: Icon(on ? Icons.favorite : Icons.favorite_border, key: ValueKey(on), color: on ? OsColors.chili600 : null),
      ),
    );
  }
}
