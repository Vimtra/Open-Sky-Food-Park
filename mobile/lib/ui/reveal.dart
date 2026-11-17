import 'dart:ui' show ImageFilter;

import 'package:material_ui/material_ui.dart';

import '../theme/tokens.dart';

/// Entrance from DESIGN.md: rise 8px out of a 2px blur, 400ms ease-out, after [delay].
/// With [onScroll] it waits until the widget scrolls into view. Reduced motion shows it at once.
class Reveal extends StatefulWidget {
  const Reveal({super.key, required this.child, this.delay = Duration.zero, this.onScroll = false});
  final Widget child;
  final Duration delay;
  final bool onScroll;

  @override
  State<Reveal> createState() => _RevealState();
}

class _RevealState extends State<Reveal> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 400));
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: OsMotion.enter);
  ScrollPosition? _position;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _c.value = 1;
      _started = true;
      return;
    }
    if (!widget.onScroll) {
      _start();
    } else {
      _position?.removeListener(_check);
      _position = Scrollable.maybeOf(context)?.position;
      _position?.addListener(_check);
      WidgetsBinding.instance.addPostFrameCallback((_) => _check());
    }
  }

  void _check() {
    if (_started || !mounted) return;
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.attached) return;
    final top = box.localToGlobal(Offset.zero).dy;
    if (top < MediaQuery.sizeOf(context).height * 0.92) _start();
  }

  void _start() {
    if (_started) return;
    _started = true;
    _position?.removeListener(_check);
    Future.delayed(widget.delay, () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _position?.removeListener(_check);
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _t,
        child: widget.child,
        builder: (context, child) {
          final v = _t.value;
          if (v >= 1) return child!;
          final blur = 2 * (1 - v);
          return Opacity(
            opacity: v,
            child: Transform.translate(
              offset: Offset(0, 8 * (1 - v)),
              child: blur < 0.05 ? child : ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: blur, sigmaY: blur), child: child),
            ),
          );
        },
      );
}
