import 'package:cupertino_ui/cupertino_ui.dart';
import 'package:flutter/services.dart';

import '../data/catalog.dart';
import '../data/models.dart';
import '../state/app_state.dart';
import '../screens/dish_sheet.dart';
import '../theme/tokens.dart';

/// Scales to 0.96 while pressed, with a light haptic tap: the iOS feel for every tappable card.
class Press extends StatefulWidget {
  const Press({super.key, required this.child, this.onTap, this.scale = OsMotion.pressScale, this.semanticLabel});

  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final String? semanticLabel;

  @override
  State<Press> createState() => _PressState();
}

class _PressState extends State<Press> {
  bool _down = false;

  void _set(bool v) {
    if (widget.onTap != null && _down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) => Semantics(
        button: widget.onTap != null,
        label: widget.semanticLabel,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (_) => _set(true),
          onTapUp: (_) => _set(false),
          onTapCancel: () => _set(false),
          onTap: widget.onTap == null
              ? null
              : () {
                  HapticFeedback.selectionClick();
                  widget.onTap!();
                },
          child: AnimatedScale(
            scale: _down ? widget.scale : 1,
            duration: OsMotion.press,
            curve: OsMotion.enter,
            child: widget.child,
          ),
        ),
      );
}

/// Catalog photo (bundled asset or uploaded URL) with a quiet placeholder.
class FoodImage extends StatelessWidget {
  const FoodImage(this.url, {super.key, this.fit = BoxFit.cover, this.width, this.height});

  final String? url;
  final BoxFit fit;
  final double? width, height;

  @override
  Widget build(BuildContext context) {
    final src = assetFor(url);
    final fallback = Container(
      width: width,
      height: height,
      color: OsColors.surface2,
      alignment: Alignment.center,
      child: const Icon(CupertinoIcons.photo, color: OsColors.ink300),
    );
    if (src == null) return fallback;
    Widget err(BuildContext _, Object _, StackTrace? _) => fallback;
    return src.startsWith('http')
        ? Image.network(src, fit: fit, width: width, height: height, errorBuilder: err)
        : Image.asset(src, fit: fit, width: width, height: height, errorBuilder: err, gaplessPlayback: true);
  }
}

/// The veg / egg / non-veg square. Nothing when the menu doesn't say.
class DietMark extends StatelessWidget {
  const DietMark(this.diet, {super.key, this.size = 15});

  final Diet? diet;
  final double size;

  @override
  Widget build(BuildContext context) {
    final d = diet;
    if (d == null) return const SizedBox.shrink();
    final color = switch (d) {
      Diet.veg => OsColors.leaf600,
      Diet.egg => OsColors.egg600,
      Diet.nonveg => OsColors.chili600,
    };
    return Semantics(
      label: switch (d) {
        Diet.veg => 'Vegetarian',
        Diet.egg => 'Contains egg',
        Diet.nonveg => 'Non-vegetarian',
      },
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: OsColors.surface0,
          border: Border.all(color: color, width: 1.4),
          borderRadius: BorderRadius.circular(3),
        ),
        alignment: Alignment.center,
        child: d == Diet.nonveg
            ? CustomPaint(size: Size.square(size * 0.5), painter: _Triangle(color))
            : Container(width: size * 0.45, height: size * 0.45, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      ),
    );
  }
}

class _Triangle extends CustomPainter {
  _Triangle(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size s) => canvas.drawPath(
        Path()
          ..moveTo(s.width / 2, 0)
          ..lineTo(s.width, s.height)
          ..lineTo(0, s.height)
          ..close(),
        Paint()..color = color,
      );

  @override
  bool shouldRepaint(_Triangle old) => old.color != color;
}

/// ADD button that turns into a − qty + stepper. Disabled when sold out or the truck is closed.
class AddButton extends StatelessWidget {
  const AddButton({super.key, required this.item, this.width = 92, this.height = 36, this.shadow = true});

  final MenuItem item;
  final double width, height;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final stall = state.catalog.stallById[item.stallId];
    final qty = state.qtyOf(item.id);
    final open = stall?.isOpen ?? false;
    // Dishes with options (size, spice, add-ons) open the dish sheet to choose them.
    final custom = state.catalog.optionsOf(item.id).isNotEmpty;
    final box = BoxDecoration(
      color: OsColors.surface0,
      borderRadius: BorderRadius.circular(OsRadius.md - 2),
      border: Border.all(color: OsColors.line),
      boxShadow: shadow ? const [BoxShadow(color: Color(0x2E0E1330), blurRadius: 14, offset: Offset(0, 5), spreadRadius: -5)] : null,
    );
    final label = OsText.weight(OsText.label, 800).copyWith(color: OsColors.leaf600, letterSpacing: 0.6, fontFeatures: OsText.tabular);

    if (!item.isAvailable || !open) {
      return Container(
        width: width,
        height: height,
        decoration: box.copyWith(boxShadow: const []),
        alignment: Alignment.center,
        child: Text(
          !item.isAvailable ? 'Sold out' : (stall?.closedReason() == ClosedReason.paused ? 'Busy' : 'Closed'),
          style: OsText.small.copyWith(fontWeight: FontWeight.w700),
        ),
      );
    }

    if (qty == 0) {
      return Press(
        semanticLabel: custom ? 'Choose options for ${item.name}' : 'Add ${item.name}',
        onTap: () => custom ? showDish(context, item) : AppScope.read(context).add(item.id),
        child: Container(
          width: width,
          height: height,
          decoration: box,
          alignment: Alignment.center,
          child: custom
              ? Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('ADD', style: label.copyWith(height: 1.1)),
                  Text('options', style: OsText.weight(OsText.small, 600).copyWith(fontSize: 10, height: 1.1)),
                ])
              : Text('ADD', style: label),
        ),
      );
    }

    Widget step(IconData icon, VoidCallback? onTap, String semantic) => Semantics(
          button: true,
          label: semantic,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onTap == null
                ? null
                : () {
                    HapticFeedback.selectionClick();
                    onTap();
                  },
            child: SizedBox(width: 32, height: height, child: Icon(icon, size: 16, color: onTap == null ? OsColors.ink300 : OsColors.leaf600)),
          ),
        );

    return Container(
      width: width,
      height: height,
      decoration: box,
      child: Row(
        children: [
          step(CupertinoIcons.minus, () {
            final s = AppScope.read(context);
            // With options, − takes one off the most recently added line of this dish.
            final key = custom ? s.lastKeyOf(item.id) : item.id;
            if (key != null) s.decrement(key);
          }, 'Remove one ${item.name}'),
          Expanded(
            child: AnimatedSwitcher(
              duration: OsMotion.press,
              transitionBuilder: (c, a) => ScaleTransition(scale: Tween(begin: 0.6, end: 1.0).animate(a), child: FadeTransition(opacity: a, child: c)),
              child: Text('$qty', key: ValueKey(qty), textAlign: TextAlign.center, style: label),
            ),
          ),
          step(CupertinoIcons.plus, qty >= maxQty ? null : () => custom ? showDish(context, item) : AppScope.read(context).add(item.id), 'Add one more ${item.name}'),
        ],
      ),
    );
  }
}

/// Green dot + "Open now", or grey "Closed".
class OpenStatus extends StatelessWidget {
  const OpenStatus(this.open, {super.key, this.onDark = false, this.label});
  final bool open;
  final bool onDark;
  /// When closed: "Busy · back at 7:40 PM", "Opens 5:00 PM"…
  final String? label;

  @override
  Widget build(BuildContext context) {
    final color = open ? (onDark ? const Color(0xFF5BD69A) : OsColors.leaf600) : (onDark ? OsColors.nightMuted : OsColors.ink500);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Flexible(child: Text(open ? 'Open now' : (label ?? 'Closed'), overflow: TextOverflow.ellipsis, style: OsText.weight(OsText.small, 700).copyWith(color: color))),
      ],
    );
  }
}

/// Section heading with an optional trailing action.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.action, this.onAction, this.padding = const EdgeInsets.fromLTRB(16, 28, 16, 12)});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Padding(
        padding: padding,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: Text(title, style: OsText.heading)),
            if (action != null)
              CupertinoButton(
                padding: EdgeInsets.zero,
                minimumSize: const Size(44, 30),
                onPressed: onAction,
                child: Text(action!, style: OsText.weight(OsText.label, 700).copyWith(color: OsColors.ember700)),
              ),
          ],
        ),
      );
}

/// Primary ember button with navy text (never white on orange).
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, this.onTap, this.trailing, this.expand = true, this.height = 54});
  final String label;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool expand;
  final double height;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Press(
      onTap: onTap,
      scale: expand ? 0.98 : OsMotion.pressScale,
      child: Container(
        height: height,
        width: expand ? double.infinity : null,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: enabled ? OsColors.ember500 : OsColors.surface2,
          borderRadius: BorderRadius.circular(OsRadius.md + 2),
          boxShadow: enabled ? const [BoxShadow(color: Color(0x55FF7A1A), blurRadius: 18, offset: Offset(0, 8), spreadRadius: -8)] : null,
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: OsText.weight(OsText.bodyStrong, 800).copyWith(color: enabled ? OsColors.night900 : OsColors.ink500, fontFeatures: OsText.tabular),
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          ],
        ),
      ),
    );
  }
}

/// Small rounded chip used for filters and tags.
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.color = OsColors.surface1, this.textColor = OsColors.ink700, this.icon});
  final String text;
  final Color color, textColor;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(99)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 12, color: textColor), const SizedBox(width: 4)],
            Text(text, style: OsText.weight(OsText.caption, 800).copyWith(color: textColor)),
          ],
        ),
      );
}

/// Edge fade for horizontal rails (owner's rule: fade only the side that can still scroll).
class EdgeFade extends StatefulWidget {
  const EdgeFade({super.key, required this.child});
  final Widget child;

  @override
  State<EdgeFade> createState() => _EdgeFadeState();
}

class _EdgeFadeState extends State<EdgeFade> {
  bool _start = false, _end = true;

  bool _onScroll(ScrollMetrics m) {
    if (m.axis != Axis.horizontal) return false;
    final start = m.pixels > m.minScrollExtent + 2;
    final end = m.pixels < m.maxScrollExtent - 2;
    if (start != _start || end != _end) {
      setState(() {
        _start = start;
        _end = end;
      });
    }
    return false;
  }

  @override
  Widget build(BuildContext context) => NotificationListener<ScrollMetricsNotification>(
        onNotification: (n) => _onScroll(n.metrics),
        child: NotificationListener<ScrollNotification>(
          onNotification: (n) => _onScroll(n.metrics),
          child: ShaderMask(
            shaderCallback: (r) => LinearGradient(
              colors: [
                _start ? const Color(0x00000000) : const Color(0xFF000000),
                const Color(0xFF000000),
                const Color(0xFF000000),
                _end ? const Color(0x00000000) : const Color(0xFF000000),
              ],
              stops: const [0, 0.06, 0.92, 1],
            ).createShader(r),
            blendMode: BlendMode.dstIn,
            child: widget.child,
          ),
        ),
      );
}
