import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

// Original vector art for the app, drawn in code so it is crisp at any size and costs nothing to download:
// food trucks, the park sign, string lights, and two looping mascots (a pulka and a falooda).
// Loops follow DESIGN.md: sine-driven, paused off screen, still under reduced motion.

const _tau = math.pi * 2;

/// Runs a repeating 0→1 clock for [builder] while the widget is on screen and motion is allowed.
class LoopClock extends StatefulWidget {
  const LoopClock({super.key, required this.period, required this.builder, this.stillAt = 0.25});
  final Duration period;
  final Widget Function(BuildContext context, double t) builder;

  /// Pose shown when motion is reduced.
  final double stillAt;

  @override
  State<LoopClock> createState() => _LoopClockState();
}

class _LoopClockState extends State<LoopClock> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.period);
  ScrollPosition? _position;
  bool _still = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _still = MediaQuery.disableAnimationsOf(context);
    _position?.removeListener(_check);
    _position = Scrollable.maybeOf(context)?.position;
    _position?.addListener(_check);
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  /// Play only while some of the widget is inside the screen.
  void _check() {
    if (!mounted) return;
    if (_still) {
      _c.stop();
      _c.value = widget.stillAt;
      return;
    }
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.attached) return;
    final top = box.localToGlobal(Offset.zero).dy;
    final visible = top < MediaQuery.sizeOf(context).height && top + box.size.height > 0;
    if (visible && !_c.isAnimating) {
      _c.repeat();
    } else if (!visible && _c.isAnimating) {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _position?.removeListener(_check);
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(animation: _c, builder: (context, _) => widget.builder(context, _c.value));
}

// ---------------------------------------------------------------- food truck

/// A side-on food truck: body, striped awning, serving window (lit when [lit]), cab, wheels.
/// Leave room on the lower body for the truck's logo (see [TruckArt.logoRect]).
class TruckPainter extends CustomPainter {
  TruckPainter({required this.body, required this.lit, this.glow = 1});
  final Color body;
  final bool lit;
  final double glow; // 0…1, the window's light

  static Rect logoRect(Size s) => Rect.fromLTWH(s.width * 0.12, s.height * 0.56, s.height * 0.22, s.height * 0.22);

  @override
  void paint(Canvas canvas, Size s) {
    final w = s.width, h = s.height;
    final ground = h * 0.86;
    final dark = Color.lerp(body, Colors.black, 0.28)!;

    // Shadow on the road.
    canvas.drawOval(Rect.fromCenter(center: Offset(w * 0.5, ground + h * 0.05), width: w * 0.92, height: h * 0.08), Paint()..color = Colors.black.withValues(alpha: 0.35));

    // Window glow spilling out when lit.
    final win = Rect.fromLTRB(w * 0.1, h * 0.26, w * 0.62, h * 0.5);
    if (lit && glow > 0) {
      canvas.drawRect(
        win.inflate(h * 0.18),
        Paint()
          ..color = const Color(0xFFFFB347).withValues(alpha: 0.45 * glow)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, h * 0.14),
      );
    }

    // Body (box) and cab.
    final box = RRect.fromRectAndCorners(Rect.fromLTRB(w * 0.03, h * 0.14, w * 0.74, ground - h * 0.06),
        topLeft: Radius.circular(h * 0.12), topRight: Radius.circular(h * 0.06), bottomLeft: Radius.circular(h * 0.06));
    canvas.drawRRect(box, Paint()..color = body);
    final cab = RRect.fromRectAndCorners(Rect.fromLTRB(w * 0.72, h * 0.32, w * 0.97, ground - h * 0.06),
        topRight: Radius.circular(h * 0.16), bottomRight: Radius.circular(h * 0.06), topLeft: Radius.circular(h * 0.04));
    canvas.drawRRect(cab, Paint()..color = dark);
    // Windshield.
    final shield = Path()
      ..moveTo(w * 0.76, h * 0.38)
      ..lineTo(w * 0.88, h * 0.38)
      ..quadraticBezierTo(w * 0.95, h * 0.4, w * 0.95, h * 0.52)
      ..lineTo(w * 0.76, h * 0.52)
      ..close();
    canvas.drawPath(shield, Paint()..color = const Color(0xFFBFD2F2).withValues(alpha: 0.85));
    // Headlight.
    canvas.drawCircle(Offset(w * 0.95, h * 0.64), h * 0.035, Paint()..color = lit ? const Color(0xFFFFE6A6) : const Color(0xFF8A90B5));

    // Roof rack line.
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTRB(w * 0.08, h * 0.09, w * 0.66, h * 0.14), Radius.circular(h * 0.02)), Paint()..color = dark);

    // Serving window.
    canvas.drawRRect(
      RRect.fromRectAndRadius(win, Radius.circular(h * 0.03)),
      Paint()..color = Color.lerp(const Color(0xFF232A56), const Color(0xFFFFD58A), lit ? glow : 0)!,
    );
    if (lit) {
      // A figure in the window and a warm light strip.
      final p = Paint()..color = const Color(0xFF7A4A1E).withValues(alpha: 0.55 * glow);
      canvas.drawCircle(Offset(win.left + win.width * 0.32, win.top + win.height * 0.42), win.height * 0.2, p);
      canvas.drawRRect(
          RRect.fromRectAndRadius(Rect.fromLTWH(win.left + win.width * 0.18, win.top + win.height * 0.62, win.width * 0.28, win.height * 0.38), Radius.circular(h * 0.04)),
          p);
    }
    // Counter shelf.
    canvas.drawRect(Rect.fromLTRB(win.left - w * 0.02, win.bottom, win.right + w * 0.02, win.bottom + h * 0.035), Paint()..color = Colors.white.withValues(alpha: 0.85));

    // Striped, scalloped awning.
    final aw = Rect.fromLTRB(win.left - w * 0.03, h * 0.17, win.right + w * 0.03, h * 0.26);
    const stripes = 7;
    final sw = aw.width / stripes;
    for (var i = 0; i < stripes; i++) {
      final r = Rect.fromLTWH(aw.left + i * sw, aw.top, sw, aw.height);
      final paint = Paint()..color = i.isEven ? Colors.white : const Color(0xFFFF7A1A);
      canvas.drawRect(r, paint);
      canvas.drawArc(Rect.fromLTWH(r.left, r.bottom - sw / 2, sw, sw), 0, math.pi, true, paint);
    }

    // Wheels.
    for (final x in [w * 0.22, w * 0.8]) {
      final c = Offset(x, ground - h * 0.06);
      canvas.drawCircle(c, h * 0.11, Paint()..color = const Color(0xFF14172B));
      canvas.drawCircle(c, h * 0.05, Paint()..color = const Color(0xFFB8BCCB));
    }
  }

  @override
  bool shouldRepaint(TruckPainter old) => old.body != body || old.lit != lit || old.glow != glow;
}

/// The "All trucks" sign: a lit board on two posts with marquee bulbs, reading ALL.
class ParkSignPainter extends CustomPainter {
  ParkSignPainter({required this.lit, required this.t});
  final bool lit;
  final double t;

  @override
  void paint(Canvas canvas, Size s) {
    final w = s.width, h = s.height;
    final ground = h * 0.86;
    canvas.drawOval(Rect.fromCenter(center: Offset(w * 0.5, ground + h * 0.05), width: w * 0.7, height: h * 0.07), Paint()..color = Colors.black.withValues(alpha: 0.35));
    final post = Paint()..color = const Color(0xFF3A4060);
    canvas.drawRect(Rect.fromLTRB(w * 0.24, h * 0.5, w * 0.29, ground), post);
    canvas.drawRect(Rect.fromLTRB(w * 0.71, h * 0.5, w * 0.76, ground), post);
    final board = RRect.fromRectAndRadius(Rect.fromLTRB(w * 0.1, h * 0.1, w * 0.9, h * 0.6), Radius.circular(h * 0.08));
    if (lit) {
      canvas.drawRRect(board.inflate(h * 0.06),
          Paint()
            ..color = const Color(0x66FF7A1A)
            ..maskFilter = MaskFilter.blur(BlurStyle.normal, h * 0.12));
    }
    // Frame is full ember when selected, a dim brass when not.
    canvas.drawRRect(board, Paint()..color = lit ? const Color(0xFFFF7A1A) : const Color(0xFF7A5A48));
    canvas.drawRRect(board.deflate(h * 0.05), Paint()..color = const Color(0xFF0B1230));
    // Marquee bulbs chase around the board.
    const n = 14;
    final r = board.outerRect.deflate(h * 0.025);
    for (var i = 0; i < n; i++) {
      final f = i / n;
      final p = f < 0.5
          ? Offset(r.left + r.width * (f * 2), i.isEven ? r.top : r.bottom)
          : Offset(r.left + r.width * ((f - 0.5) * 2), i.isEven ? r.bottom : r.top);
      final on = (0.5 + 0.5 * math.sin(_tau * (t * 2 - f))) > 0.45;
      canvas.drawCircle(p, h * 0.025, Paint()..color = on && lit ? const Color(0xFFFFE6A6) : const Color(0xFFFFC247).withValues(alpha: 0.55));
    }
    final tp = TextPainter(
      text: TextSpan(
        text: 'ALL',
        style: TextStyle(fontFamily: 'Figtree', fontSize: h * 0.22, fontWeight: FontWeight.w800, fontVariations: const [FontVariation.weight(800)], color: Colors.white, letterSpacing: 1),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(w * 0.5 - tp.width / 2, h * 0.35 - tp.height / 2));
  }

  @override
  bool shouldRepaint(ParkSignPainter old) => old.lit != lit || old.t != t;
}

/// A strand of string lights sagging across [size], bulbs breathing out of phase.
class StringLightsPainter extends CustomPainter {
  StringLightsPainter(this.t);
  final double t;

  @override
  void paint(Canvas canvas, Size s) {
    final wire = Paint()
      ..color = Colors.white.withValues(alpha: 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    const spans = 3;
    final spanW = s.width / spans;
    for (var k = 0; k < spans; k++) {
      final x0 = k * spanW, x1 = x0 + spanW;
      final path = Path()
        ..moveTo(x0, 4)
        ..quadraticBezierTo((x0 + x1) / 2, s.height * 1.3, x1, 4);
      canvas.drawPath(path, wire);
      const bulbs = 6;
      for (var i = 1; i < bulbs; i++) {
        final u = i / bulbs;
        // Point on the quadratic curve.
        final x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * ((x0 + x1) / 2) + u * u * x1;
        final y = (1 - u) * (1 - u) * 4 + 2 * (1 - u) * u * (s.height * 1.3) + u * u * 4;
        final phase = (k * bulbs + i) * 0.13;
        final a = 0.55 + 0.45 * (0.5 + 0.5 * math.sin(_tau * (t + phase)));
        canvas.drawCircle(Offset(x, y + 3), 7, Paint()..color = const Color(0xFFFFB347).withValues(alpha: 0.18 * a)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5));
        canvas.drawCircle(Offset(x, y + 3), 2.6, Paint()..color = Color.lerp(const Color(0xFFFFC247), const Color(0xFFFFF1C9), a)!.withValues(alpha: a));
      }
    }
  }

  @override
  bool shouldRepaint(StringLightsPainter old) => old.t != t;
}

// ---------------------------------------------------------------- mascots

/// Shared limbs and face for the mascots. [beat] is the dance phase in radians.
void _face(Canvas canvas, Offset c, double size, {required bool blink, required double beat}) {
  final eyeDx = size * 0.16, eyeY = c.dy - size * 0.04;
  for (final sx in [-1.0, 1.0]) {
    final e = Offset(c.dx + sx * eyeDx, eyeY);
    if (blink) {
      canvas.drawLine(e.translate(-size * 0.05, 0), e.translate(size * 0.05, 0), Paint()
        ..color = const Color(0xFF2B1A0E)
        ..strokeWidth = size * 0.025
        ..strokeCap = StrokeCap.round);
    } else {
      canvas.drawOval(Rect.fromCenter(center: e, width: size * 0.11, height: size * 0.14), Paint()..color = Colors.white);
      canvas.drawCircle(e.translate(size * 0.012 * math.sin(beat), size * 0.015), size * 0.038, Paint()..color = const Color(0xFF2B1A0E));
      canvas.drawCircle(e.translate(size * 0.025, -size * 0.01), size * 0.013, Paint()..color = Colors.white);
    }
    // Blush.
    canvas.drawOval(Rect.fromCenter(center: Offset(c.dx + sx * size * 0.27, eyeY + size * 0.1), width: size * 0.11, height: size * 0.06),
        Paint()..color = const Color(0xFFFF7A8A).withValues(alpha: 0.55));
  }
  // Open smile.
  final m = Path()
    ..moveTo(c.dx - size * 0.09, c.dy + size * 0.07)
    ..quadraticBezierTo(c.dx, c.dy + size * (0.2 + 0.02 * math.sin(beat * 2)), c.dx + size * 0.09, c.dy + size * 0.07)
    ..close();
  canvas.drawPath(m, Paint()..color = const Color(0xFF7A1E1E));
  canvas.drawOval(Rect.fromCenter(center: Offset(c.dx, c.dy + size * 0.13), width: size * 0.07, height: size * 0.04), Paint()..color = const Color(0xFFFF8A8A));
}

void _limb(Canvas canvas, Offset from, Offset to, double width, Color color) {
  canvas.drawLine(from, to, Paint()
    ..color = color
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round);
}

/// A puffed pulka with toasty spots, waving with one arm and stepping side to side.
class PulkaBuddyPainter extends CustomPainter {
  PulkaBuddyPainter(this.t);
  final double t;

  @override
  void paint(Canvas canvas, Size s) {
    final beat = _tau * t * 2; // two dance beats per loop
    final bob = math.sin(beat).abs();
    final squash = 1 + 0.06 * math.sin(beat * 2);
    final w = s.width, h = s.height;
    const limb = Color(0xFF6B3E1A);
    final bodyC = Offset(w * 0.5, h * 0.44 - bob * h * 0.05);
    final r = w * 0.36;

    // Legs and feet (alternate steps).
    for (final sx in [-1.0, 1.0]) {
      final lift = math.max(0.0, math.sin(beat + (sx > 0 ? 0 : math.pi))) * h * 0.06;
      final hip = bodyC.translate(sx * r * 0.35, r * 0.82);
      final foot = Offset(w * 0.5 + sx * r * 0.5, h * 0.9 - lift);
      _limb(canvas, hip, foot, w * 0.045, limb);
      canvas.drawOval(Rect.fromCenter(center: foot.translate(sx * w * 0.035, 0), width: w * 0.16, height: w * 0.08), Paint()..color = const Color(0xFFFF7A1A));
    }
    // Arms: left on hip, right waving.
    final wave = math.sin(beat) * 0.6;
    final lShoulder = bodyC.translate(-r * 0.92, r * 0.1);
    _limb(canvas, lShoulder, lShoulder.translate(-w * 0.1, h * 0.12), w * 0.045, limb);
    final rShoulder = bodyC.translate(r * 0.92, r * 0.05);
    final hand = rShoulder + Offset(math.cos(-0.9 + wave) * w * 0.2, math.sin(-0.9 + wave) * w * 0.2);
    _limb(canvas, rShoulder, hand, w * 0.045, limb);
    canvas.drawCircle(hand, w * 0.045, Paint()..color = const Color(0xFFF2C98A));

    canvas.save();
    canvas.translate(bodyC.dx, bodyC.dy);
    canvas.scale(1 / squash, squash);
    // Puffed flatbread: golden disc, lighter top, toasty spots.
    final disc = Rect.fromCenter(center: Offset.zero, width: r * 2, height: r * 1.86);
    canvas.drawOval(disc.shift(Offset(0, r * 0.06)), Paint()..color = const Color(0xFFC98A3E));
    canvas.drawOval(disc, Paint()..color = const Color(0xFFF0C98A));
    canvas.drawOval(Rect.fromCenter(center: Offset(-r * 0.25, -r * 0.45), width: r * 0.9, height: r * 0.4), Paint()..color = const Color(0xFFFCE3B4).withValues(alpha: 0.8));
    const spots = [(-0.55, -0.15, 0.09), (0.5, -0.4, 0.07), (0.6, 0.35, 0.1), (-0.35, 0.55, 0.07), (0.05, -0.7, 0.06), (-0.7, 0.3, 0.06)];
    for (final (x, y, sr) in spots) {
      canvas.drawOval(Rect.fromCenter(center: Offset(x * r, y * r), width: sr * r * 2.2, height: sr * r * 1.6), Paint()..color = const Color(0xFF9A5A22).withValues(alpha: 0.75));
    }
    canvas.restore();

    _face(canvas, bodyC.translate(0, r * 0.05), r * 1.6, blink: t > 0.9 && t < 0.94, beat: beat);
    // A little steam curl.
    final steam = Paint()
      ..color = Colors.white.withValues(alpha: 0.35 + 0.25 * math.sin(beat))
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.025
      ..strokeCap = StrokeCap.round;
    final top = bodyC.translate(r * 0.2, -r * 1.05);
    canvas.drawPath(
        Path()
          ..moveTo(top.dx, top.dy)
          ..quadraticBezierTo(top.dx + w * 0.06, top.dy - h * 0.05, top.dx, top.dy - h * 0.1)
          ..quadraticBezierTo(top.dx - w * 0.06, top.dy - h * 0.15, top.dx, top.dy - h * 0.19),
        steam);
  }

  @override
  bool shouldRepaint(PulkaBuddyPainter old) => old.t != t;
}

/// A layered falooda glass with an ice-cream scoop and a cherry, swaying and waving.
class FaloodaBuddyPainter extends CustomPainter {
  FaloodaBuddyPainter(this.t);
  final double t;

  @override
  void paint(Canvas canvas, Size s) {
    final beat = _tau * t * 2 + math.pi; // opposite phase to the pulka
    final w = s.width, h = s.height;
    const limb = Color(0xFF5A2A4A);
    final sway = math.sin(beat) * 0.09;
    final bob = math.sin(beat).abs() * h * 0.04;

    // Legs (stay planted while the glass sways above).
    for (final sx in [-1.0, 1.0]) {
      final lift = math.max(0.0, math.sin(beat + (sx > 0 ? math.pi : 0))) * h * 0.05;
      final hip = Offset(w * 0.5 + sx * w * 0.09, h * 0.74 - bob);
      final foot = Offset(w * 0.5 + sx * w * 0.16, h * 0.92 - lift);
      _limb(canvas, hip, foot, w * 0.045, limb);
      canvas.drawOval(Rect.fromCenter(center: foot.translate(sx * w * 0.035, 0), width: w * 0.16, height: w * 0.08), Paint()..color = const Color(0xFFFF7A1A));
    }

    canvas.save();
    canvas.translate(w * 0.5, h * 0.76 - bob);
    canvas.rotate(sway);
    // Glass shape in local coords (origin at the base centre).
    final topW = w * 0.62, baseW = w * 0.34, gh = h * 0.5;
    final glass = Path()
      ..moveTo(-topW / 2, -gh)
      ..lineTo(topW / 2, -gh)
      ..lineTo(baseW / 2, 0)
      ..lineTo(-baseW / 2, 0)
      ..close();
    canvas.save();
    canvas.clipPath(glass);
    // Layers bottom to top: rose syrup, basil seeds in milk, vermicelli, milk.
    canvas.drawRect(Rect.fromLTRB(-topW, -gh * 0.28, topW, 0), Paint()..color = const Color(0xFFE0245E));
    canvas.drawRect(Rect.fromLTRB(-topW, -gh * 0.55, topW, -gh * 0.28), Paint()..color = const Color(0xFFF7EEF2));
    final seed = Paint()..color = const Color(0xFF2B2B33);
    for (var i = 0; i < 16; i++) {
      final x = (-0.5 + ((i * 37) % 100) / 100) * topW * 0.8;
      final y = -gh * (0.3 + ((i * 53) % 24) / 100);
      canvas.drawCircle(Offset(x, y), w * 0.012, seed);
    }
    canvas.drawRect(Rect.fromLTRB(-topW, -gh * 0.72, topW, -gh * 0.55), Paint()..color = const Color(0xFFEBD3A8));
    final noodle = Paint()
      ..color = const Color(0xFFD9B57A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.012;
    for (var i = 0; i < 5; i++) {
      final y = -gh * (0.58 + i * 0.03);
      canvas.drawPath(
          Path()
            ..moveTo(-topW / 2, y)
            ..quadraticBezierTo(0, y - gh * 0.06 * (i.isEven ? 1 : -1), topW / 2, y),
          noodle);
    }
    canvas.drawRect(Rect.fromLTRB(-topW, -gh, topW, -gh * 0.72), Paint()..color = const Color(0xFFFFF6F8));
    canvas.restore();
    // Glass outline and shine.
    canvas.drawPath(glass, Paint()
      ..color = Colors.white.withValues(alpha: 0.75)
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.02);
    canvas.drawLine(Offset(-topW * 0.36, -gh * 0.9), Offset(-baseW * 0.32, -gh * 0.1), Paint()
      ..color = Colors.white.withValues(alpha: 0.55)
      ..strokeWidth = w * 0.025
      ..strokeCap = StrokeCap.round);

    // Scoop with rose drizzle and a cherry, wobbling slightly.
    final scoopC = Offset(math.sin(beat * 2) * w * 0.01, -gh - h * 0.06);
    canvas.drawOval(Rect.fromCenter(center: scoopC, width: topW * 0.86, height: h * 0.17), Paint()..color = const Color(0xFFFFF8EE));
    final drip = Path()
      ..moveTo(scoopC.dx - topW * 0.36, scoopC.dy)
      ..quadraticBezierTo(scoopC.dx - topW * 0.2, scoopC.dy + h * 0.08, scoopC.dx - topW * 0.1, scoopC.dy + h * 0.02)
      ..quadraticBezierTo(scoopC.dx + topW * 0.05, scoopC.dy + h * 0.1, scoopC.dx + topW * 0.2, scoopC.dy + h * 0.02)
      ..quadraticBezierTo(scoopC.dx + topW * 0.32, scoopC.dy + h * 0.06, scoopC.dx + topW * 0.38, scoopC.dy - h * 0.01)
      ..quadraticBezierTo(scoopC.dx, scoopC.dy - h * 0.09, scoopC.dx - topW * 0.36, scoopC.dy)
      ..close();
    canvas.drawPath(drip, Paint()..color = const Color(0xFFFF4F86));
    final cherry = scoopC.translate(w * 0.02, -h * 0.085);
    canvas.drawLine(cherry, cherry.translate(w * 0.06, -h * 0.07), Paint()
      ..color = const Color(0xFF3E7A2E)
      ..strokeWidth = w * 0.015
      ..strokeCap = StrokeCap.round);
    canvas.drawCircle(cherry, w * 0.06, Paint()..color = const Color(0xFFD7193B));
    canvas.drawCircle(cherry.translate(-w * 0.018, -w * 0.018), w * 0.016, Paint()..color = Colors.white.withValues(alpha: 0.8));
    // Straw.
    canvas.drawLine(Offset(topW * 0.2, -gh * 0.4), Offset(topW * 0.48, -gh - h * 0.15), Paint()
      ..color = const Color(0xFFFFC247)
      ..strokeWidth = w * 0.03
      ..strokeCap = StrokeCap.round);

    _face(canvas, Offset(0, -gh * 0.45), w * 0.48, blink: t > 0.4 && t < 0.44, beat: beat);

    // Arms from the glass sides: one waving, one swinging.
    final wave = math.sin(beat) * 0.7;
    final lS = Offset(-topW * 0.42, -gh * 0.55);
    final lHand = lS + Offset(math.cos(math.pi + 0.9 - wave) * w * 0.2, math.sin(math.pi + 0.9 - wave) * -w * 0.2);
    _limb(canvas, lS, lHand, w * 0.045, limb);
    canvas.drawCircle(lHand, w * 0.045, Paint()..color = const Color(0xFFFFD6E2));
    final rS = Offset(topW * 0.4, -gh * 0.45);
    final rHand = rS.translate(w * 0.13, h * 0.06 + math.sin(beat * 2) * h * 0.02);
    _limb(canvas, rS, rHand, w * 0.045, limb);
    canvas.drawCircle(rHand, w * 0.045, Paint()..color = const Color(0xFFFFD6E2));
    canvas.restore();
  }

  @override
  bool shouldRepaint(FaloodaBuddyPainter old) => old.t != t;
}

/// Looping mascot. [kind] is 'pulka' or 'falooda'.
class Mascot extends StatelessWidget {
  const Mascot({super.key, required this.kind, this.size = const Size(84, 110)});
  final String kind;
  final Size size;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: LoopClock(
          period: const Duration(milliseconds: 1600),
          builder: (_, t) => CustomPaint(size: size, painter: kind == 'pulka' ? PulkaBuddyPainter(t) : FaloodaBuddyPainter(t)),
        ),
      );
}
