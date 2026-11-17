import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';

import 'screens/cart_screen.dart';
import 'screens/home_screen.dart';
import 'screens/orders_screen.dart';
import 'screens/search_screen.dart';
import 'state/app_state.dart';
import 'theme/theme.dart';
import 'theme/tokens.dart';
import 'ui/widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  final state = await AppState.load();
  runApp(AppScope(state: state, child: const OpenSkyApp()));
}

class OpenSkyApp extends StatelessWidget {
  const OpenSkyApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Open Sky Food Park',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: const Shell(),
      );
}

/// Bottom tabs: Home, Search, Cart, Orders. Detail pages push over the tabs.
class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _tab = 0;

  void _go(int i) => setState(() => _tab = i);

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final pages = [
      const HomeScreen(),
      const SearchScreen(),
      CartScreen(onBrowse: () => _go(0)),
      OrdersScreen(onBrowse: () => _go(0)),
    ];
    final live = app.orders.where((o) => o.status.name == 'active').length;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      // Light status-bar icons over the night hero on Home; dark ones elsewhere.
      value: _tab == 0 ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: Scaffold(
        body: Stack(children: [
          IndexedStack(index: _tab, children: pages),
          if (_tab < 2) Positioned(left: 0, right: 0, bottom: 0, child: CartBar(onTap: () => _go(2))),
        ]),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: _go,
          destinations: [
            const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
            const NavigationDestination(icon: Icon(Icons.search), label: 'Search'),
            NavigationDestination(
              icon: Badge(isLabelVisible: app.count > 0, label: Text('${app.count}'), backgroundColor: OsColors.ember600, child: const Icon(Icons.shopping_bag_outlined)),
              selectedIcon: Badge(isLabelVisible: app.count > 0, label: Text('${app.count}'), backgroundColor: OsColors.ember600, child: const Icon(Icons.shopping_bag)),
              label: 'Cart',
            ),
            NavigationDestination(
              icon: Badge(isLabelVisible: live > 0, smallSize: 8, child: const Icon(Icons.receipt_long_outlined)),
              selectedIcon: const Icon(Icons.receipt_long),
              label: 'Orders',
            ),
          ],
        ),
      ),
    );
  }
}
