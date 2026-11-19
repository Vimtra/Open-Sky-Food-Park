import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';

import 'screens/account_screen.dart';
import 'screens/cart_screen.dart';
import 'screens/home_screen.dart';
import 'screens/order_screen.dart';
import 'screens/orders_screen.dart';
import 'state/app_state.dart';
import 'state/ready_alerts.dart';
import 'theme/theme.dart';
import 'theme/tokens.dart';
import 'ui/widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  final state = await AppState.load();
  // "Food is ready" alerts: own channel and bell sound. Tapping one opens that order.
  state.onTokenReady = ReadyAlerts.showReady;
  ReadyAlerts.onOpenOrder = openOrderFromAlert;
  final launchedFor = await ReadyAlerts.init();
  runApp(AppScope(state: state, child: const OpenSkyApp()));
  if (launchedFor != null) WidgetsBinding.instance.addPostFrameCallback((_) => openOrderFromAlert(launchedFor));
}

final navigatorKey = GlobalKey<NavigatorState>();

/// A tapped alert opens its order over the tabs (not on top of whatever page was open).
void openOrderFromAlert(String orderId) => navigatorKey.currentState
  ?..popUntil((r) => r.isFirst)
  ..push(MaterialPageRoute<void>(builder: (_) => OrderScreen(orderId: orderId)));

class OpenSkyApp extends StatelessWidget {
  const OpenSkyApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Open Sky Food Park',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        // Tablets: keep the phone layout at a readable width, centred, instead of stretching it.
        builder: (context, child) {
          final w = MediaQuery.sizeOf(context).width;
          if (w <= 700) return child!;
          return ColoredBox(
            color: OsColors.surface2,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 640),
                child: MediaQuery(data: MediaQuery.of(context).copyWith(size: Size(640, MediaQuery.sizeOf(context).height)), child: child!),
              ),
            ),
          );
        },
        navigatorKey: navigatorKey,
        home: const Shell(),
      );
}

/// Bottom tabs: Home (with the search bar), Cart, Orders, Account. Detail pages push over the tabs.
class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _tab = 0;
  bool _homeScrolled = false;

  void _go(int i) => setState(() => _tab = i);

  bool _onScroll(ScrollNotification n) {
    // Only the vertical page scroll on Home, not the sideways rails.
    if (_tab == 0 && n.metrics.axis == Axis.vertical && n.depth == 0) {
      final scrolled = n.metrics.pixels > 8;
      if (scrolled != _homeScrolled) setState(() => _homeScrolled = scrolled);
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final pages = [
      HomeScreen(onOpenAccount: () => _go(3)),
      CartScreen(onBrowse: () => _go(0)),
      OrdersScreen(onBrowse: () => _go(0)),
      AccountScreen(onOpenOrders: () => _go(2)),
    ];
    final live = app.orders.where((o) => o.status.name == 'active').length;
    // Home's night header shows through the status bar until you scroll; every other tab gets a white strip.
    final heroUnderBar = _tab == 0 && !_homeScrolled;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: heroUnderBar ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: Scaffold(
        body: Stack(children: [
          NotificationListener<ScrollNotification>(onNotification: _onScroll, child: IndexedStack(index: _tab, children: pages)),
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: MediaQuery.paddingOf(context).top,
            child: AnimatedOpacity(
              opacity: heroUnderBar ? 0 : 1,
              duration: OsMotion.popover,
              child: const DecoratedBox(
                decoration: BoxDecoration(color: OsColors.surface0, border: Border(bottom: BorderSide(color: OsColors.line))),
              ),
            ),
          ),
          if (_tab == 0) Positioned(left: 0, right: 0, bottom: 0, child: CartBar(onTap: () => _go(1))),
        ]),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: _go,
          destinations: [
            const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
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
            const NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Account'),
          ],
        ),
      ),
    );
  }
}
