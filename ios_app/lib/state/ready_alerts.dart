import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../data/models.dart';

/// "Your food is ready" alerts on iPhone (roadmap C3), matching the Android app.
///
/// The sound is the park's bell, `ios/Runner/order_ready.wav` (the same file as Android's
/// res/raw/order_ready.wav, so both apps sound alike). iOS plays bundled .wav files under 30 s.
///
/// Today the alert fires from the app when it sees a token turn Ready (demo: the demo timer).
/// When the app is closed, alerts need push (APNs): the sender in supabase/functions/notify/ must
/// set `aps.sound = "order_ready.wav"` so a push sounds the same.
class ReadyAlerts {
  ReadyAlerts._();

  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  static const soundFile = 'order_ready.wav';

  /// Set by the app: open this order when an alert is tapped.
  static void Function(String orderId)? onOpenOrder;

  static IOSFlutterLocalNotificationsPlugin? get _ios => _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();

  static bool get _supported => !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

  /// Call once at start-up. Does not ask for permission (that waits for the first order).
  /// Returns the order id if the app was opened by tapping an alert.
  static Future<String?> init() async {
    if (!_supported || _ready) return null;
    try {
      await _plugin.initialize(
        settings: const InitializationSettings(
          iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
        ),
        onDidReceiveNotificationResponse: (r) {
          final id = r.payload;
          if (id != null && id.isNotEmpty) onOpenOrder?.call(id);
        },
      );
      _ready = true;
      final launch = await _plugin.getNotificationAppLaunchDetails();
      final id = launch?.didNotificationLaunchApp == true ? launch?.notificationResponse?.payload : null;
      return (id == null || id.isEmpty) ? null : id;
    } catch (e) {
      debugPrint('ReadyAlerts.init: $e');
      return null;
    }
  }

  /// iOS asks once. We ask right after the first order, when the reason is obvious, not at launch.
  static Future<bool> askPermission() async {
    if (!_supported) return false;
    return await _ios?.requestPermissions(alert: true, sound: true, badge: false) ?? false;
  }

  static DarwinNotificationDetails _details(String subtitle) => DarwinNotificationDetails(
        presentAlert: true,
        presentBanner: true,
        presentList: true,
        presentSound: true,
        sound: soundFile,
        subtitle: subtitle,
        threadIdentifier: 'order_ready',
        interruptionLevel: InterruptionLevel.active,
      );

  /// The alert for one truck's token.
  static Future<void> showReady(Order o, StallOrder s) async {
    if (!_ready) return;
    final table = o.fulfilment == Fulfilment.table;
    final title = table ? 'On its way · token ${s.tokenNo}' : 'Token ${s.tokenNo} is ready';
    final body = table
        ? '${s.stallName} is bringing it to table ${o.tableNo}.'
        : 'Collect it at ${s.stallName}. Show token ${s.tokenNo}.\n${s.items.take(4).map((it) => '${it.qty} × ${it.name}').join('\n')}';
    try {
      await _plugin.show(
        id: s.id.hashCode & 0x7fffffff,
        title: title,
        body: body,
        notificationDetails: NotificationDetails(iOS: _details(s.stallName)),
        payload: o.id,
      );
    } catch (e) {
      debugPrint('ReadyAlerts.showReady: $e');
    }
  }

  /// "Hear the alert": a sample so the customer knows the sound.
  static Future<void> showSample() async {
    if (!_ready) return;
    await _plugin.show(
      id: 1,
      title: 'Token 12 is ready',
      body: 'This is how Open Sky tells you your food is ready.',
      notificationDetails: NotificationDetails(iOS: _details('Sample alert')),
    );
  }
}
