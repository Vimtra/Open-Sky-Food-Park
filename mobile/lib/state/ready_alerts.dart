import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../data/models.dart';
import '../theme/tokens.dart';

/// "Your food is ready" alerts (roadmap C3, board B9).
///
/// Android gives the alert its own notification channel, "Food is ready", with the park's bell
/// (res/raw/order_ready.wav) instead of the phone's usual sound, a long buzz, and the service-bell
/// icon in park orange. The customer can still change or mute it in the phone's settings for that
/// channel only.
///
/// Today the alert fires from the app when it sees a token turn Ready (demo: the demo timer).
/// When the app is closed, alerts need push messages: the sender in supabase/functions/notify/
/// must post to FCM with `android.notification.channel_id = "order_ready"` and
/// `sound = "order_ready"`, so a push sounds the same as this.
class ReadyAlerts {
  ReadyAlerts._();

  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  static const channelId = 'order_ready';
  static const soundName = 'order_ready';

  /// Set by the app: open this order when an alert is tapped.
  static void Function(String orderId)? onOpenOrder;

  static AndroidFlutterLocalNotificationsPlugin? get _android =>
      _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  static bool get _supported => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  static final _channel = AndroidNotificationChannel(
    channelId,
    'Food is ready',
    description: 'When a truck finishes your order. Plays the Open Sky bell.',
    importance: Importance.max,
    sound: const RawResourceAndroidNotificationSound(soundName),
    vibrationPattern: Int64List.fromList([0, 220, 120, 220, 120, 600]),
    enableLights: true,
    ledColor: OsColors.ember500,
  );

  /// Call once at start-up. Returns the order id if the app was opened by tapping an alert.
  static Future<String?> init() async {
    if (!_supported || _ready) return null;
    try {
      await _plugin.initialize(
        settings: const InitializationSettings(android: AndroidInitializationSettings('ic_stat_ready')),
        onDidReceiveNotificationResponse: (r) {
          final id = r.payload;
          if (id != null && id.isNotEmpty) onOpenOrder?.call(id);
        },
      );
      await _android?.createNotificationChannel(_channel);
      _ready = true;
      final launch = await _plugin.getNotificationAppLaunchDetails();
      final id = launch?.didNotificationLaunchApp == true ? launch?.notificationResponse?.payload : null;
      return (id == null || id.isEmpty) ? null : id;
    } catch (e) {
      debugPrint('ReadyAlerts.init: $e');
      return null;
    }
  }

  /// Android 13+ asks the customer once. We ask right after their first order, when the reason is
  /// obvious, not at launch. Returns false if they said no.
  static Future<bool> askPermission() async {
    if (!_supported) return false;
    return await _android?.requestNotificationsPermission() ?? false;
  }

  static Future<bool> get allowed async => _supported && (await _android?.areNotificationsEnabled() ?? false);

  static AndroidNotificationDetails _details({required String title, required String body, required List<String> lines, String? summary}) =>
      AndroidNotificationDetails(
        _channel.id,
        _channel.name,
        channelDescription: _channel.description,
        importance: Importance.max,
        priority: Priority.max,
        sound: _channel.sound,
        vibrationPattern: _channel.vibrationPattern,
        enableLights: true,
        ledColor: OsColors.ember500,
        ledOnMs: 600,
        ledOffMs: 900,
        color: OsColors.ember600,
        category: AndroidNotificationCategory.status,
        visibility: NotificationVisibility.public,
        ticker: title,
        styleInformation: InboxStyleInformation(
          lines,
          contentTitle: title,
          summaryText: summary,
        ),
      );

  /// The alert for one truck's token.
  static Future<void> showReady(Order o, StallOrder s) async {
    if (!_ready) return;
    final table = o.fulfilment == Fulfilment.table;
    final title = table ? 'On its way · token ${s.tokenNo}' : 'Token ${s.tokenNo} is ready';
    final body = table ? '${s.stallName} is bringing it to table ${o.tableNo}.' : 'Collect it at ${s.stallName}. Show token ${s.tokenNo}.';
    final lines = [body, for (final it in s.items.take(5)) '${it.qty} × ${it.name}'];
    try {
      await _plugin.show(
        id: s.id.hashCode & 0x7fffffff,
        title: title,
        body: body,
        notificationDetails: NotificationDetails(android: _details(title: title, body: body, lines: lines, summary: s.stallName)),
        payload: o.id,
      );
    } catch (e) {
      debugPrint('ReadyAlerts.showReady: $e');
    }
  }

  /// Settings → "Hear the alert": a sample so the customer knows the sound.
  static Future<void> showSample() async {
    if (!_ready) return;
    const title = 'Token 12 is ready';
    const body = 'This is how Open Sky tells you your food is ready.';
    await _plugin.show(
      id: 1,
      title: title,
      body: body,
      notificationDetails: NotificationDetails(android: _details(title: title, body: body, lines: const [body], summary: 'Sample alert')),
    );
  }
}
