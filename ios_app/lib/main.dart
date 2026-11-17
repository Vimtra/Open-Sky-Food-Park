import 'package:cupertino_ui/cupertino_ui.dart';
import 'package:flutter/services.dart';

import 'data/catalog.dart';
import 'screens/cart_screen.dart';
import 'screens/home_screen.dart';
import 'screens/order_screen.dart';
import 'screens/search_screen.dart';
import 'state/app_state.dart';
import 'theme/tokens.dart';
import 'ui/kit.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  final state = await AppState.load();
  runApp(AppScope(state: state, child: const OpenSkyApp()));
}

class OpenSkyApp extends StatelessWidget {
  const OpenSkyApp({super.key});

  @override
  Widget build(BuildContext context) => CupertinoApp(
        title: 'Open Sky',
        debugShowCheckedModeBanner: false,
        theme: CupertinoThemeData(
          brightness: Brightness.light,
          primaryColor: OsColors.ember600,
          scaffoldBackgroundColor: OsColors.surface0,
          barBackgroundColor: const Color(0xF2FFFFFF),
          textTheme: CupertinoTextThemeData(
            textStyle: OsText.body,
            navTitleTextStyle: OsText.bodyStrong,
            navLargeTitleTextStyle: OsText.weight(OsText.display, 800).copyWith(fontSize: 32),
            actionTextStyle: OsText.weight(OsText.body, 600).copyWith(color: OsColors.ember700),
            tabLabelTextStyle: OsText.weight(OsText.caption, 700).copyWith(fontSize: 10.5),
          ),
        ),
        home: const Shell(),
      );
}

/// Four tabs (Home, Search, Cart, Orders), each with its own navigation stack, and the
/// floating "View cart" bar while browsing.
class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  final _tabs = CupertinoTabController();

  @override
  void initState() {
    super.initState();
    _tabs.addListener(_onTab);
  }

  void _onTab() => setState(() {});

  @override
  void dispose() {
    _tabs.removeListener(_onTab);
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final ready = state.orders.where((o) => o.stallOrders.any((s) => s.status.name == 'ready')).length;

    BottomNavigationBarItem item(IconData icon, IconData active, String label, {int badge = 0, bool dot = false}) => BottomNavigationBarItem(
          label: label,
          icon: _Badged(icon: Icon(icon), count: badge, dot: dot),
          activeIcon: _Badged(icon: Icon(active), count: badge, dot: dot),
        );

    return Stack(
      children: [
        CupertinoTabScaffold(
          controller: _tabs,
          tabBar: CupertinoTabBar(
            activeColor: OsColors.ember600,
            inactiveColor: OsColors.ink500,
            backgroundColor: const Color(0xF5FFFFFF),
            border: const Border(top: BorderSide(color: OsColors.line, width: 0.5)),
            height: 54,
            onTap: (_) => HapticFeedback.selectionClick(),
            items: [
              item(CupertinoIcons.house, CupertinoIcons.house_fill, 'Food'),
              item(CupertinoIcons.search, CupertinoIcons.search, 'Search'),
              item(CupertinoIcons.bag, CupertinoIcons.bag_fill, 'Cart', badge: state.count),
              item(CupertinoIcons.doc_text, CupertinoIcons.doc_text_fill, 'Orders', dot: ready > 0),
            ],
          ),
          tabBuilder: (context, i) => CupertinoTabView(
            builder: (_) => switch (i) {
              0 => const HomeScreen(),
              1 => const SearchScreen(autofocus: false),
              2 => const CartScreen(),
              _ => const OrdersScreen(),
            },
          ),
        ),
        _CartBar(browsing: _tabs.index <= 1, onOpen: () => _tabs.index = 2),
      ],
    );
  }
}

class _Badged extends StatelessWidget {
  const _Badged({required this.icon, required this.count, required this.dot});
  final Widget icon;
  final int count;
  final bool dot;

  @override
  Widget build(BuildContext context) => Stack(
        clipBehavior: Clip.none,
        children: [
          icon,
          if (count > 0)
            Positioned(
              right: -10,
              top: -4,
              child: Container(
                constraints: const BoxConstraints(minWidth: 18),
                height: 18,
                padding: const EdgeInsets.symmetric(horizontal: 5),
                decoration: BoxDecoration(color: OsColors.ember500, borderRadius: BorderRadius.circular(9), border: Border.all(color: OsColors.surface0, width: 1.5)),
                alignment: Alignment.center,
                child: Text('$count', style: OsText.weight(OsText.caption, 800).copyWith(fontSize: 10.5, color: OsColors.night900, height: 1)),
              ),
            )
          else if (dot)
            Positioned(
              right: -3,
              top: -1,
              child: Container(width: 10, height: 10, decoration: BoxDecoration(color: OsColors.leaf600, shape: BoxShape.circle, border: Border.all(color: OsColors.surface0, width: 1.5))),
            ),
        ],
      );
}

/// "3 items · $26.97 — View cart" floating above the tab bar while browsing.
class _CartBar extends StatelessWidget {
  const _CartBar({required this.browsing, required this.onOpen});
  final bool browsing;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final count = state.count;
    final bottom = MediaQuery.paddingOf(context).bottom + 54 + 10;
    final stalls = state.groups.length;
    final show = browsing && count > 0;

    return AnimatedPositioned(
      duration: OsMotion.sheet,
      curve: show ? OsMotion.enter : OsMotion.exit,
      left: 12,
      right: 12,
      bottom: show ? bottom : -120,
      child: Press(
        scale: 0.98,
        onTap: show ? onOpen : null,
        child: Container(
          height: 62,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          decoration: BoxDecoration(
            color: OsColors.ember500,
            borderRadius: BorderRadius.circular(OsRadius.lg + 2),
            boxShadow: const [BoxShadow(color: Color(0x4D0B1230), blurRadius: 24, offset: Offset(0, 10), spreadRadius: -8)],
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AnimatedSwitcher(
                      duration: OsMotion.press,
                      transitionBuilder: (c, a) => ScaleTransition(scale: Tween(begin: 0.95, end: 1.0).animate(a), alignment: Alignment.centerLeft, child: FadeTransition(opacity: a, child: c)),
                      child: Text(
                        '${plural(count, 'item')} · ${money(state.itemTotalCents)}',
                        key: ValueKey(count),
                        style: OsText.weight(OsText.bodyStrong, 800).copyWith(color: OsColors.night900, fontFeatures: OsText.tabular),
                      ),
                    ),
                    Text(
                      stalls > 1 ? 'From $stalls trucks, one checkout' : (stalls == 1 ? 'From ${state.groups.first.stall.name}' : ''),
                      style: OsText.weight(OsText.caption, 700).copyWith(color: const Color(0xBF0B1230)),
                    ),
                  ],
                ),
              ),
              Text('View cart', style: OsText.weight(OsText.bodyStrong, 800).copyWith(color: OsColors.night900)),
              const SizedBox(width: 6),
              const Icon(CupertinoIcons.chevron_right, size: 18, color: OsColors.night900),
            ],
          ),
        ),
      ),
    );
  }
}
