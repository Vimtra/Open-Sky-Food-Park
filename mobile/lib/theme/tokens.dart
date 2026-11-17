import 'package:material_ui/material_ui.dart';

/// Colours from shared/design-tokens.json (v2). Change them there first, then here.
abstract final class OsColors {
  static const night950 = Color(0xFF070B1F);
  static const night900 = Color(0xFF0B1230);
  static const night800 = Color(0xFF131C45);
  static const night700 = Color(0xFF1E2A5E);
  static const nightMuted = Color(0xFFA9B1D6);

  static const ink900 = Color(0xFF0E1330);
  static const ink700 = Color(0xFF3A4060);
  static const ink500 = Color(0xFF666C88);
  static const ink300 = Color(0xFFB8BCCB);

  static const surface0 = Color(0xFFFFFFFF);
  static const surface1 = Color(0xFFF5F6FA);
  static const surface2 = Color(0xFFECEEF5);

  /// ink.900 at 11% and 28%: borders and dividers blend into any surface.
  static const line = Color(0x1C0E1330);
  static const lineStrong = Color(0x470E1330);

  static const ember50 = Color(0xFFFFF4EA);
  static const ember100 = Color(0xFFFFE6D0);
  static const ember400 = Color(0xFFFF9A3D);
  static const ember500 = Color(0xFFFF7A1A);
  static const ember600 = Color(0xFFF06405);
  static const ember700 = Color(0xFFC2470A);

  static const gold400 = Color(0xFFFFC247);

  static const leaf50 = Color(0xFFE8F6EE);
  static const leaf600 = Color(0xFF0C8048);
  static const leaf700 = Color(0xFF086B3B);

  static const chili50 = Color(0xFFFDECEA);
  static const chili600 = Color(0xFFC8281E);

  static const egg600 = Color(0xFFB26A00);
}

/// Radii (px) and the 44px minimum tap target.
abstract final class OsRadius {
  static const xs = 6.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
}

/// Motion from DESIGN.md: enter = ease-out, exit = ease-in, move = ease-in-out.
abstract final class OsMotion {
  static const enter = Cubic(0.32, 0.72, 0, 1);
  static const exit = Cubic(0.55, 0, 1, 0.45);
  static const move = Cubic(0.77, 0, 0.175, 1);
  static const press = Duration(milliseconds: 150);
  static const popover = Duration(milliseconds: 200);
  static const sheet = Duration(milliseconds: 260);
  static const page = Duration(milliseconds: 340);
  static const pressScale = 0.96;
}

/// The type scale. Figtree ships as one variable font, so each style also sets the weight axis.
abstract final class OsText {
  static TextStyle _s(double size, double line, int weight, {double tracking = 0, Color color = OsColors.ink900}) => TextStyle(
        fontFamily: 'Figtree',
        fontSize: size,
        height: line / size,
        fontWeight: FontWeight.values[(weight ~/ 100) - 1],
        fontVariations: [FontVariation.weight(weight.toDouble())],
        letterSpacing: tracking * size,
        color: color,
      );

  static final hero = _s(32, 38, 800, tracking: -0.03);
  static final display = _s(32, 38, 800, tracking: -0.025);
  static final title = _s(24, 30, 800, tracking: -0.02);
  static final heading = _s(20, 26, 800, tracking: -0.015);
  static final subheading = _s(18, 24, 700, tracking: -0.01);
  static final bodyStrong = _s(16, 22, 700, tracking: -0.005);
  static final body = _s(16, 24, 400);
  static final label = _s(14, 20, 600);
  static final small = _s(13, 18, 500, color: OsColors.ink500);
  static final caption = _s(12, 16, 600, tracking: 0.01);
  static final token = _s(40, 40, 800, tracking: -0.03);
  static final stepNumber = _s(72, 61, 800, tracking: -0.04);

  /// Same style at another weight (keeps the variable-font axis in step).
  static TextStyle weight(TextStyle s, int weight) =>
      s.copyWith(fontWeight: FontWeight.values[(weight ~/ 100) - 1], fontVariations: [FontVariation.weight(weight.toDouble())]);

  static const tabular = [FontFeature.tabularFigures()];
}
