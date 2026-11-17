import 'package:material_ui/material_ui.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import 'routes.dart';

/// Shrinks to 0.96 while pressed (150ms, ease-out), the website's press feedback.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, required this.onTap, this.scale = OsMotion.pressScale, this.semanticLabel});
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final String? semanticLabel;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: widget.onTap == null ? null : (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedScale(scale: _down ? widget.scale : 1, duration: OsMotion.press, curve: OsMotion.enter, child: widget.child),
      ),
    );
  }
}

/// A catalog photo with a quiet grey placeholder (no broken-image icons).
class FoodImage extends StatelessWidget {
  const FoodImage(this.url, {super.key, this.radius = 0, this.width, this.height, this.greyed = false, this.fit = BoxFit.cover});
  final String? url;
  final double radius;
  final double? width, height;
  final bool greyed;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final src = assetFor(url);
    Widget img = src == null
        ? const ColoredBox(color: OsColors.surface1, child: Center(child: Icon(Icons.restaurant, color: OsColors.ink300)))
        : src.startsWith('http')
            ? Image.network(src, fit: fit, width: width, height: height)
            : Image.asset(src, fit: fit, width: width, height: height, cacheWidth: 720, errorBuilder: (_, _, _) => const ColoredBox(color: OsColors.surface1));
    if (greyed) {
      img = Opacity(opacity: 0.55, child: ColorFiltered(colorFilter: const ColorFilter.matrix(_greyscale), child: img));
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(width: width, height: height, child: ColoredBox(color: OsColors.surface1, child: img)),
    );
  }

  static const _greyscale = <double>[0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0];
}

/// The Indian veg / egg / non-veg mark: a square with a dot (veg, egg) or a triangle (non-veg).
class DietMark extends StatelessWidget {
  const DietMark(this.diet, {super.key, this.size = 14});
  final Diet? diet;
  final double size;

  @override
  Widget build(BuildContext context) {
    final d = diet;
    if (d == null) return const SizedBox.shrink();
    final color = switch (d) { Diet.veg => OsColors.leaf600, Diet.egg => OsColors.egg600, Diet.nonveg => OsColors.chili600 };
    return Semantics(
      label: dietLabel(d),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(border: Border.all(color: color, width: 1.5), borderRadius: BorderRadius.circular(2)),
        alignment: Alignment.center,
        child: d == Diet.nonveg
            ? CustomPaint(size: Size(size * 0.5, size * 0.45), painter: _Triangle(color))
            : Container(width: size * 0.45, height: size * 0.45, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      ),
    );
  }
}

class _Triangle extends CustomPainter {
  _Triangle(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size s) =>
      canvas.drawPath(Path()..moveTo(s.width / 2, 0)..lineTo(s.width, s.height)..lineTo(0, s.height)..close(), Paint()..color = color);
  @override
  bool shouldRepaint(_Triangle old) => old.color != color;
}

/// ADD that turns into − qty + once the dish is in the cart.
class AddButton extends StatelessWidget {
  const AddButton({super.key, required this.item, required this.stall, this.large = false});
  final MenuItem item;
  final Stall stall;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final qty = app.qtyOf(item.id);
    final w = large ? 176.0 : 96.0, h = large ? 48.0 : 36.0;
    final style = OsText.weight(large ? OsText.bodyStrong : OsText.label, 800).copyWith(fontFeatures: OsText.tabular);
    final frame = BoxDecoration(
      color: OsColors.surface0,
      borderRadius: BorderRadius.circular(OsRadius.md),
      border: Border.all(color: OsColors.line),
      boxShadow: const [BoxShadow(color: Color(0x2E0E1330), blurRadius: 16, offset: Offset(0, 6), spreadRadius: -6)],
    );

    if (!item.isAvailable || !stall.isOpen) {
      return Container(
        width: w,
        height: h,
        alignment: Alignment.center,
        decoration: frame.copyWith(boxShadow: const []),
        child: Text(item.isAvailable ? 'Closed' : 'Sold out', style: style.copyWith(color: OsColors.ink500, fontWeight: FontWeight.w600)),
      );
    }

    return AnimatedSwitcher(
      duration: OsMotion.popover,
      switchInCurve: OsMotion.enter,
      switchOutCurve: OsMotion.exit,
      transitionBuilder: (child, a) => FadeTransition(opacity: a, child: ScaleTransition(scale: Tween(begin: 0.95, end: 1.0).animate(a), child: child)),
      child: qty == 0
          ? Pressable(
              key: const ValueKey('add'),
              semanticLabel: 'Add ${item.name} to cart',
              onTap: () => app.add(item.id),
              child: Container(
                width: w,
                height: h,
                alignment: Alignment.center,
                decoration: frame,
                child: Text('ADD', style: style.copyWith(color: OsColors.leaf600, letterSpacing: 0.6)),
              ),
            )
          : Container(
              key: const ValueKey('stepper'),
              width: w,
              height: h,
              decoration: frame,
              child: Row(
                children: [
                  _StepButton(icon: Icons.remove, label: qty == 1 ? 'Remove ${item.name}' : 'Decrease ${item.name}', onTap: () => app.decrement(item.id), width: large ? 52 : 32),
                  Expanded(child: Center(child: Text('$qty', style: style.copyWith(color: OsColors.leaf600)))),
                  _StepButton(icon: Icons.add, label: 'Increase ${item.name}', onTap: qty >= maxQty ? null : () => app.add(item.id), width: large ? 52 : 32),
                ],
              ),
            ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, required this.label, required this.onTap, required this.width});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final double width;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(OsRadius.md),
          child: SizedBox(width: width, height: double.infinity, child: Icon(icon, size: 18, color: onTap == null ? OsColors.ink300 : OsColors.leaf600)),
        ),
      );
}

class OpenStatus extends StatelessWidget {
  const OpenStatus(this.stall, {super.key});
  final Stall stall;

  @override
  Widget build(BuildContext context) {
    final c = stall.isOpen ? OsColors.leaf600 : OsColors.ink500;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: stall.isOpen ? OsColors.leaf600 : OsColors.ink300, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(stall.isOpen ? 'Open now' : 'Closed', style: OsText.weight(OsText.small, 700).copyWith(color: c)),
      ],
    );
  }
}

/// Section heading with an optional trailing link.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            Expanded(child: Text(title, style: OsText.heading)),
            if (action != null)
              TextButton(
                onPressed: onAction,
                style: TextButton.styleFrom(minimumSize: const Size(44, 44), padding: const EdgeInsets.symmetric(horizontal: 4)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [Text(action!), const Icon(Icons.chevron_right, size: 18)]),
              ),
          ],
        ),
      );
}

/// Sideways row of cards with the edges faded (mask 0 → 6% … 94% → 0), as on the website.
class Rail extends StatelessWidget {
  const Rail({super.key, required this.title, required this.children, this.height = 250, this.action, this.onAction, this.spacing = 12});
  final String title;
  final List<Widget> children;
  final double height, spacing;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle(title, action: action, onAction: onAction),
          const SizedBox(height: 12),
          SizedBox(
            height: height,
            child: ShaderMask(
              blendMode: BlendMode.dstIn,
              shaderCallback: (r) => const LinearGradient(
                colors: [Color(0x00000000), Color(0xFF000000), Color(0xFF000000), Color(0x00000000)],
                stops: [0, 0.04, 0.94, 1],
              ).createShader(r),
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: children.length,
                separatorBuilder: (_, _) => SizedBox(width: spacing),
                itemBuilder: (_, i) => children[i],
              ),
            ),
          ),
        ],
      );
}

/// Photo-led dish tile used in rails and search.
class DishCard extends StatelessWidget {
  const DishCard({super.key, required this.item, required this.stall, this.width = 160, this.showStall = false});
  final MenuItem item;
  final Stall stall;
  final double width;
  final bool showStall;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Pressable(
                semanticLabel: item.name,
                scale: 0.98,
                onTap: () => openDish(context, stall, item),
                child: FoodImage(item.imageUrl, radius: OsRadius.lg, width: width, height: width, greyed: !item.isAvailable),
              ),
              Positioned(right: 8, bottom: -12, child: AddButton(item: item, stall: stall)),
            ],
          ),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: () => openDish(context, stall, item),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(padding: const EdgeInsets.only(top: 3), child: DietMark(item.diet)),
                if (item.diet != null) const SizedBox(width: 6),
                Expanded(child: Text(item.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 700))),
              ],
            ),
          ),
          if (showStall) Text(stall.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: OsText.small),
          const SizedBox(height: 2),
          Text(money(item.priceCents), style: OsText.weight(OsText.label, 700).copyWith(fontFeatures: OsText.tabular)),
        ],
      ),
    );
  }
}

/// Wide truck card (home, search): name, what it serves, open status, View menu, cover photo.
class TruckCard extends StatelessWidget {
  const TruckCard({super.key, required this.stall, required this.itemCount});
  final Stall stall;
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      scale: 0.98,
      semanticLabel: '${stall.name} menu',
      onTap: () => openStall(context, stall),
      child: Container(
        height: 168,
        decoration: BoxDecoration(
          color: OsColors.surface0,
          borderRadius: BorderRadius.circular(OsRadius.xl),
          border: Border.all(color: OsColors.line),
          boxShadow: const [BoxShadow(color: Color(0x730B1230), blurRadius: 40, offset: Offset(0, 18), spreadRadius: -18)],
        ),
        clipBehavior: Clip.antiAlias,
        child: Row(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 12, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(stall.name, style: OsText.heading, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(stall.tagline ?? stall.cuisines.join(', '), maxLines: 2, overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.label, 500).copyWith(color: OsColors.ink500)),
                    const SizedBox(height: 6),
                    Row(children: [OpenStatus(stall), Text('  ·  $itemCount dishes', style: OsText.small.copyWith(color: OsColors.ink700))]),
                    const Spacer(),
                    Container(
                      height: 36,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(color: OsColors.ember500, borderRadius: BorderRadius.circular(OsRadius.md)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Text('View menu', style: OsText.weight(OsText.label, 700).copyWith(color: OsColors.night900)),
                        const SizedBox(width: 4),
                        const Icon(Icons.arrow_forward, size: 16, color: OsColors.night900),
                      ]),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(width: 130, height: double.infinity, child: FoodImage(stall.coverUrl, greyed: !stall.isOpen)),
          ],
        ),
      ),
    );
  }
}

/// Floating "N items · $X  View cart" bar shown above content when the cart has items.
class CartBar extends StatelessWidget {
  const CartBar({super.key, this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final groups = app.groups;
    return AnimatedSwitcher(
      duration: OsMotion.sheet,
      switchInCurve: OsMotion.enter,
      switchOutCurve: OsMotion.exit,
      transitionBuilder: (c, a) => SlideTransition(position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(a), child: FadeTransition(opacity: a, child: c)),
      child: app.count == 0
          ? const SizedBox.shrink(key: ValueKey('none'))
          : Padding(
              key: const ValueKey('bar'),
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Pressable(
                semanticLabel: 'View cart',
                onTap: onTap ?? () => openCart(context),
                child: Container(
                  height: 56,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: OsColors.ember500,
                    borderRadius: BorderRadius.circular(OsRadius.lg),
                    boxShadow: const [BoxShadow(color: Color(0x4D0E1330), blurRadius: 40, offset: Offset(0, 18), spreadRadius: -14)],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${plural(app.count, 'item')} · ${money(app.itemTotalCents)}',
                                style: OsText.weight(OsText.bodyStrong, 800).copyWith(color: OsColors.night900, fontFeatures: OsText.tabular)),
                            Text(groups.length > 1 ? 'From ${groups.length} trucks, one checkout' : 'From ${groups.first.stall.name}',
                                style: OsText.caption.copyWith(color: OsColors.night900.withValues(alpha: 0.75))),
                          ],
                        ),
                      ),
                      Text('View cart', style: OsText.weight(OsText.bodyStrong, 800).copyWith(color: OsColors.night900)),
                      const SizedBox(width: 4),
                      const Icon(Icons.shopping_bag_outlined, color: OsColors.night900, size: 20),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}

/// Orange "Demo" strip, matching the website's demo notice.
class DemoNotice extends StatelessWidget {
  const DemoNotice({super.key});
  @override
  Widget build(BuildContext context) {
    if (!AppState.demo) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: OsColors.ember50,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Text.rich(
        TextSpan(children: [
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: OsColors.ember500, borderRadius: BorderRadius.circular(99)),
              child: Text('Demo', style: OsText.weight(OsText.caption, 800).copyWith(color: OsColors.night900)),
            ),
          ),
          TextSpan(text: 'Orders stay on this phone and no card is charged. Some prices are placeholders.', style: OsText.small.copyWith(color: OsColors.ink900)),
        ]),
      ),
    );
  }
}
