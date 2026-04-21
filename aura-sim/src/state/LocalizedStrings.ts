/**
 * Multi-language Support for Aura Simulator
 *
 * Provides all UI strings for all supported languages, matching the original
 * firmware's translations.h from aura/translations.h.
 *
 * This module exports:
 * - Language enum (7 languages)
 * - LocalizedStrings interface
 * - get_strings(language) function
 * - Individual language packs (strings_en, strings_es, etc.)
 */

// ============================================================================
// LANGUAGE ENUM
// ============================================================================

/**
 * Supported languages matching the firmware's Language enum.
 */
export const enum Language {
  LANG_EN = 0,
  LANG_ES = 1,
  LANG_DE = 2,
  LANG_FR = 3,
  LANG_TR = 4,
  LANG_SV = 5,
  LANG_IT = 6,
}

// ============================================================================
// ENGLISH STRINGS (DEFAULT)
// ============================================================================

/**
 * English strings from aura/translations.h (strings_en)
 * This is the default language.
 */
export const strings_en: LocalizedStrings = {
  language: Language.LANG_EN,
  temp_placeholder: "--°C",
  feels_like_temp: "Feels like",
  seven_day_forecast: "7-DAY FORECAST",
  hourly_forecast: "HOURLY FORECAST",
  today: "Today",
  now: "Now",
  am: "am",
  pm: "pm",
  noon: "Noon",
  invalid_hour: "Invalid hour",
  day_brightness: "Brightness:",
  location: "Location:",
  use_fahrenheit: "Use °F:",
  use_24hr: "24h:",
  save: "Save",
  cancel: "Cancel",
  close: "Close",
  location_btn: "Location",
  reset_wifi: "Wi-Fi",
  reset: "Reset",
  change_location: "Change Location",
  aura_settings: "Aura Settings",
  city: "City:",
  search_results: "Search Results",
  city_placeholder: "e.g. London",
  wifi_config: `Wi-Fi Configuration:

Connect your phone
or laptop to the
temporary Wi-Fi
access point Aura

to configure.

If you do not see a
configuration screen
after connecting, visit
http://192.168.4.1
in your browser.`,
  wifi_connecting: "Connecting to Wi-Fi...",
  weather_updating: "Updating weather...",
  reset_confirmation: `Are you sure you want to
reset Wi-Fi credentials?

You will need to reconnect to
the Aura SSID with your phone or
browser to reconfigure Wi-Fi
credentials.`,
  language_label: "Language:",
  tab_display: "Display",
  tab_general: "General",
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  use_night_mode: "Dim screen at night",
  night_brightness: "Night brightness:",
  screen_off: "Auto screen off",
  screen_timeout: "Timeout:",
  seconds_short: "sec",
};

// ============================================================================
// LOCALIZED STRINGS INTERFACE
// ============================================================================

/**
 * All UI text strings for the application, in a specific language.
 * Mirrors the LocalizedStrings struct from aura/translations.h
 */
export interface LocalizedStrings {
  language: Language; // Language identifier for hash/comparison
  temp_placeholder: string;
  feels_like_temp: string;
  seven_day_forecast: string;
  hourly_forecast: string;
  today: string;
  now: string;
  am: string;
  pm: string;
  noon: string;
  invalid_hour: string;
  day_brightness: string;
  location: string;
  use_fahrenheit: string;
  use_24hr: string;
  save: string;
  cancel: string;
  close: string;
  location_btn: string;
  reset_wifi: string;
  reset: string;
  change_location: string;
  aura_settings: string;
  city: string;
  search_results: string;
  city_placeholder: string;
  wifi_config: string;
  wifi_connecting: string;
  weather_updating: string;
  reset_confirmation: string;
  language_label: string;
  tab_display: string;
  tab_general: string;
  weekdays: string[];
  use_night_mode: string;
  night_brightness: string;
  screen_off: string;
  screen_timeout: string;
  seconds_short: string;
}

/**
 * Spanish strings from aura/translations.h (strings_es)
 */
export const strings_es: LocalizedStrings = {
  language: Language.LANG_ES,
  temp_placeholder: "--°C",
  feels_like_temp: "Sensación",
  seven_day_forecast: "PRONÓSTICO 7 DÍAS",
  hourly_forecast: "PRONÓSTICO POR HORAS",
  today: "Hoy",
  now: "Ahora",
  am: "am",
  pm: "pm",
  noon: "Mediodía",
  invalid_hour: "Hora inválida",
  day_brightness: "Brillo:",
  location: "Ubicación:",
  use_fahrenheit: "Usar °F:",
  use_24hr: "24h:",
  save: "Guardar",
  cancel: "Cancelar",
  close: "Cerrar",
  location_btn: "Ubicación",
  reset_wifi: "Wi-Fi",
  reset: "Restablecer",
  change_location: "Cambiar Ubicación",
  aura_settings: "Configuración Aura",
  city: "Ciudad:",
  search_results: "Resultados de Búsqueda",
  city_placeholder: "ej. Madrid",
  wifi_config: `Configuración Wi-Fi:

Conecte su teléfono
o portátil al punto de
acceso Wi-Fi temporal Aura

para configurar.

Si no ve una pantalla
de configuración después
de conectarse, visite
http://192.168.4.1
en su navegador.`,
  wifi_connecting: "Conectando a Wi-Fi...",
  weather_updating: "Actualizando el tiempo...",
  reset_confirmation: `¿Está seguro de que desea
restablecer las credenciales
Wi-Fi?

Deberá reconectarse al SSID Aura con su teléfono o navegador
para reconfigurar las
credenciales Wi-Fi.`,
  language_label: "Idioma:",
  tab_display: "Pantalla",
  tab_general: "General",
  weekdays: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  use_night_mode: "Pantalla de noche",
  night_brightness: "Brillo nocturno:",
  screen_off: "Apagado automático",
  screen_timeout: "Tiempo de espera:",
  seconds_short: "seg",
};

/**
 * German strings from aura/translations.h (strings_de)
 */
export const strings_de: LocalizedStrings = {
  language: Language.LANG_DE,
  temp_placeholder: "--°C",
  feels_like_temp: "Gefühlt",
  seven_day_forecast: "7-TAGE VORHERSAGE",
  hourly_forecast: "STÜNDLICHE VORHERSAGE",
  today: "Heute",
  now: "Jetzt",
  am: "",
  pm: "",
  noon: "Mittag",
  invalid_hour: "Ungültige Stunde",
  day_brightness: "Helligkeit:",
  location: "Standort:",
  use_fahrenheit: "°F:",
  use_24hr: "24h:",
  save: "Speichern",
  cancel: "Abbrechen",
  close: "Schließen",
  location_btn: "Standort",
  reset_wifi: "Wi-Fi",
  reset: "Zurücksetzen",
  change_location: "Standort ändern",
  aura_settings: "Aura Einstellungen",
  city: "Stadt:",
  search_results: "Suchergebnisse",
  city_placeholder: "z.B. Berlin",
  wifi_config: `Wi-Fi Konfiguration:

Verbinden Sie Ihr Telefon
oder Laptop mit dem
temporären Wi-Fi
Zugangspunkt Aura
zum Konfigurieren.

Wenn Sie keinen
Konfigurationsbildschirm
sehen, besuchen Sie
http://192.168.4.1
in Ihrem Browser.`,
  wifi_connecting: "Verbindung zum Wi-Fi...",
  weather_updating: "Actualizando el tiempo...",
  reset_confirmation: `Sind Sie sicher, dass Sie
die Wi-Fi Zugangsdaten
zurücksetzen möchten?

Sie müssen sich erneut mit
der SSID Aura verbinden, um die
Wi-Fi Zugangsdaten
neu zu konfigurieren.`,
  language_label: "Sprache:",
  tab_display: "Anzeige",
  tab_general: "Allgemein",
  weekdays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
  use_night_mode: "Nacht-Dimmen",
  night_brightness: "Nachthelligkeit:",
  screen_off: "Auto Bildschirm-Aus",
  screen_timeout: "Zeitüberschreitung:",
  seconds_short: "s",
};

/**
 * French strings from aura/translations.h (strings_fr)
 */
export const strings_fr: LocalizedStrings = {
  language: Language.LANG_FR,
  temp_placeholder: "--°C",
  feels_like_temp: "Ressenti",
  seven_day_forecast: "PRÉVISIONS 7 JOURS",
  hourly_forecast: "PRÉVISIONS HORAIRES",
  today: "Aujourd'hui",
  now: "Maintenant",
  am: "h",
  pm: "h",
  noon: "Midi",
  invalid_hour: "Heure invalide",
  day_brightness: "Luminosité:",
  location: "Lieu:",
  use_fahrenheit: "Utiliser °F:",
  use_24hr: "24h:",
  save: "Sauvegarder",
  cancel: "Annuler",
  close: "Fermer",
  location_btn: "Lieu",
  reset_wifi: "Wi-Fi",
  reset: "Réinitialiser",
  change_location: "Changer de lieu",
  aura_settings: "Paramètres Aura",
  city: "Ville:",
  search_results: "Résultats de recherche",
  city_placeholder: "ex. Paris",
  wifi_config: `Configuration Wi-Fi:

Connectez votre téléphone
ou ordinateur portable au
point d'accès Wi-Fi
temporaire Aura
pour configurer.

Si vous ne voyez pas
d'écran de configuration
après connexion, visitez
http://192.168.4.1
dans votre navigateur.`,
  wifi_connecting: "Connexion au Wi-Fi...",
  weather_updating: "Actualizando el tiempo...",
  reset_confirmation: `Êtes-vous sûr de vouloir
réinitialiser les
identifiants Wi-Fi?

Vous devrez vous reconnecter
au SSID Aura avec votre téléphone ou
navigateur pour reconfigurer
les identifiants Wi-Fi.`,
  language_label: "Langue:",
  tab_display: "Affichage",
  tab_general: "Général",
  weekdays: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
  use_night_mode: "Nuit écrant",
  night_brightness: "Luminosité nocturne:",
  screen_off: "Extinction auto de l'écran",
  screen_timeout: "Délai d'attente:",
  seconds_short: "s",
};

/**
 * Turkish strings from aura/translations.h (strings_tr)
 */
export const strings_tr: LocalizedStrings = {
  language: Language.LANG_TR,
  temp_placeholder: "--°C",
  feels_like_temp: "Hissedilen",
  seven_day_forecast: "YEDI GÜNLÜK TAHMIN",
  hourly_forecast: "SAATLIK TAHMIN",
  today: "Bugün",
  now: "Simdi",
  am: "öö",
  pm: "ös",
  noon: "Öğle",
  invalid_hour: "Geçersiz saat",
  day_brightness: "Parlaklik:",
  location: "Konum:",
  use_fahrenheit: "°F Kullan:",
  use_24hr: "24 Saat:",
  save: "Kaydet",
  cancel: "İptal",
  close: "Kapat",
  location_btn: "Konum",
  reset_wifi: "Wi-Fi Sifirla",
  reset: "Sifirla",
  change_location: "Konumu Değiştir",
  aura_settings: "Aura Ayarlari",
  city: "Şehir:",
  search_results: "Arama Sonuçları",
  city_placeholder: "örn. Londra",
  wifi_config: `Wi-Fi Yapilandirmasi:

Lütfen telefonunuzu veya
bilgisayarinizi geçici Wi-Fi
erişim noktasina bağlayin Aura

yapilandirmak için.

Bağlandiktan sonra bir
yapilandirma ekrani görmezseniz,
web tarayicinizda
http://192.168.4.1 adresine gidin.`,
  wifi_connecting: "Wi-Fi'ye baglaniliyor...",
  weather_updating: "Actualizando el tiempo...",
  reset_confirmation: `Wi-Fi kimlik bilgilerini sifirlamak
istediğinizden emin misiniz?

Wi-Fi kimlik bilgilerini yeniden
yapilandirmak için telefonunuz veya
tarayiciniz ile Aura SSID'sine tekrar bağlanmaniz
gerekecek.`,
  language_label: "Dil:",
  tab_display: "Ekran",
  tab_general: "Genel",
  weekdays: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  use_night_mode: "Gece kısık",
  night_brightness: "Gece parlaklığı:",
  screen_off: "Otomatik ekran kapatma",
  screen_timeout: "Zaman aşımı:",
  seconds_short: "sn",
};

/**
 * Swedish strings from aura/translations.h (strings_sv)
 */
export const strings_sv: LocalizedStrings = {
  language: Language.LANG_SV,
  temp_placeholder: "--°C",
  feels_like_temp: "Känns som",
  seven_day_forecast: "7-DAGARS PROGNOS",
  hourly_forecast: "TIMPROGNOS",
  today: "Idag",
  now: "Nu",
  am: "",
  pm: "",
  noon: "Middag",
  invalid_hour: "Ogiltig timme",
  day_brightness: "Ljusstyrka:",
  location: "Plats:",
  use_fahrenheit: "Använd °F:",
  use_24hr: "24h:",
  save: "Spara",
  cancel: "Avbryt",
  close: "Stäng",
  location_btn: "Plats",
  reset_wifi: "Aterställ Wi-Fi",
  reset: "Aterställ",
  change_location: "Andra plats",
  aura_settings: "Aura-inställningar",
  city: "Stad:",
  search_results: "Sökresultat",
  city_placeholder: "t.ex. Stockholm",
  wifi_config: `Wi-Fi-konfiguration:

Anslut din telefon
eller laptop till den
tillfälliga Wi-Fi-
atkomstpunkten Aura
för att konfigurera.

Om du inte ser en
konfigurationsskärm
efter anslutning, besök
http://192.168.4.1
i din webbläsare.`,
  wifi_connecting: "Ansluter till Wi-Fi...",
  weather_updating: "Actualizando el tiempo...",
  reset_confirmation: `Ar du säker pa att du vill
aterställa Wi-Fi-
autentiseringsuppgifter?

Du maste ateransluta till
SSID Aura med din telefon eller
webbläsare för att
omkonfigurera Wi-Fi-
autentiseringsuppgifter.`,
  language_label: "Sprak:",
  tab_display: "Visning",
  tab_general: "Allmänt",
  weekdays: ["Sön", "Man", "Tis", "Ons", "Tor", "Fre", "Lör"],
  use_night_mode: "Nattdämpning",
  night_brightness: "Nattljusstyrka:",
  screen_off: "Auto skärmavstängning",
  screen_timeout: "Timeout:",
  seconds_short: "s",
};

/**
 * Italian strings from aura/translations.h (strings_it)
 */
export const strings_it: LocalizedStrings = {
  language: Language.LANG_IT,
  temp_placeholder: "--°C",
  feels_like_temp: "Percepita",
  seven_day_forecast: "PREVISIONI A 7 GIORNI",
  hourly_forecast: "PREVISIONI ORARIE",
  today: "Oggi",
  now: "Ora",
  am: "am",
  pm: "pm",
  noon: "Mezzog.",
  invalid_hour: "Ora non valida",
  day_brightness: "Luminosità:",
  location: "Posizione:",
  use_fahrenheit: "Utilizzo °F:",
  use_24hr: "24hr:",
  save: "Salva",
  cancel: "Cancellare",
  close: "Close",
  location_btn: "Posizione",
  reset_wifi: "Resetta Wi-Fi",
  reset: "Reset",
  change_location: "Cambia posizione",
  aura_settings: "Impostazioni aura",
  city: "Città:",
  search_results: "Risultati di ricerca",
  city_placeholder: "e.s. Londra",
  wifi_config: `Configurazione Wi-Fi:

Per favore collega il tuo
smartphone o laptop
al Wi-Fi temporaneo
 Aura

per configurare la rete.

Se non vedi la
Schermata di configurazione
dopo il collegamento,
visita http://192.168.4.1
sul tuo web browser.`,
  wifi_connecting: "Connessione Wi-Fi...",
  weather_updating: "Actualizando el tiempo...",
  reset_confirmation: `Sei sicuro di voler ripristinare
le credenzili Wi-Fi ?

Dovrai riconnetterti al WiFi con SSID Aura
con il tuo telefono o browser a
riconfigurare le credenziali Wi-Fi.`,
  language_label: "Lingua:",
  tab_display: "Schermo",
  tab_general: "Generale",
  weekdays: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
  use_night_mode: "Schermo notte",
  night_brightness: "Luminosità notturna:",
  screen_off: "Spegnimento auto dello schermo",
  screen_timeout: "Timeout:",
  seconds_short: "s",
};

// ============================================================================
// LOCALIZATION HELPER
// ============================================================================

/**
 * Get localized strings for the specified language.
 * Mirrors get_strings() from aura/translations.h (line 449).
 *
 * @param language - The language enum value
 * @returns LocalizedStrings object for that language
 */
export function get_strings(language: Language): LocalizedStrings {
  switch (language) {
    case Language.LANG_ES:
      return strings_es;
    case Language.LANG_DE:
      return strings_de;
    case Language.LANG_FR:
      return strings_fr;
    case Language.LANG_TR:
      return strings_tr;
    case Language.LANG_SV:
      return strings_sv;
    case Language.LANG_IT:
      return strings_it;
    default:
      return strings_en;
  }
}
