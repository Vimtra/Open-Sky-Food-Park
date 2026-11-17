import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';

import 'tokens.dart';

/// Light theme only: the owner keeps the customer UI light; navy is for the app bar band and photo heroes.
ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: OsColors.ember500,
    brightness: Brightness.light,
  ).copyWith(
    primary: OsColors.ember500,
    onPrimary: OsColors.night900,
    secondary: OsColors.night900,
    onSecondary: Colors.white,
    surface: OsColors.surface0,
    onSurface: OsColors.ink900,
    onSurfaceVariant: OsColors.ink500,
    error: OsColors.chili600,
    outline: OsColors.line,
    outlineVariant: OsColors.line,
  );

  final text = TextTheme(
    displaySmall: OsText.display,
    headlineMedium: OsText.title,
    headlineSmall: OsText.heading,
    titleLarge: OsText.heading,
    titleMedium: OsText.subheading,
    titleSmall: OsText.label,
    bodyLarge: OsText.body,
    bodyMedium: OsText.weight(OsText.label, 400),
    bodySmall: OsText.small,
    labelLarge: OsText.label,
    labelMedium: OsText.caption,
    labelSmall: OsText.caption,
  );

  final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(OsRadius.md));

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: OsColors.surface0,
    fontFamily: 'Figtree',
    textTheme: text,
    splashFactory: InkSparkle.splashFactory,
    dividerTheme: const DividerThemeData(color: OsColors.line, thickness: 1, space: 1),
    appBarTheme: AppBarTheme(
      backgroundColor: OsColors.surface0,
      foregroundColor: OsColors.ink900,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: OsText.subheading,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: OsColors.ember500,
        foregroundColor: OsColors.night900,
        disabledBackgroundColor: OsColors.surface2,
        disabledForegroundColor: OsColors.ink500,
        minimumSize: const Size(44, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        shape: buttonShape,
        textStyle: OsText.weight(OsText.label, 700).copyWith(fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: OsColors.ink900,
        side: const BorderSide(color: OsColors.line),
        minimumSize: const Size(44, 48),
        shape: buttonShape,
        textStyle: OsText.weight(OsText.label, 700).copyWith(fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: OsColors.ember700, textStyle: OsText.weight(OsText.label, 700)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: OsColors.surface0,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      hintStyle: OsText.weight(OsText.body, 400).copyWith(color: OsColors.ink500),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(OsRadius.md), borderSide: const BorderSide(color: OsColors.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(OsRadius.md), borderSide: const BorderSide(color: OsColors.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(OsRadius.md), borderSide: const BorderSide(color: OsColors.ember600, width: 1.5)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(OsRadius.md), borderSide: const BorderSide(color: OsColors.chili600)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: OsColors.surface0,
      selectedColor: OsColors.night900,
      side: const BorderSide(color: OsColors.line),
      shape: const StadiumBorder(),
      labelStyle: OsText.label.copyWith(color: OsColors.ink700),
      secondaryLabelStyle: OsText.label.copyWith(color: Colors.white),
      showCheckmark: false,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: OsColors.surface0,
      surfaceTintColor: Colors.transparent,
      indicatorColor: OsColors.ember50,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => OsText.caption.copyWith(color: s.contains(WidgetState.selected) ? OsColors.ember700 : OsColors.ink500),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(color: s.contains(WidgetState.selected) ? OsColors.ember700 : OsColors.ink500, size: 24),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: OsColors.night900,
      contentTextStyle: OsText.weight(OsText.label, 600).copyWith(color: Colors.white),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(OsRadius.md)),
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {TargetPlatform.android: FadeForwardsPageTransitionsBuilder()},
    ),
  );
}
