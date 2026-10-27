// Game icons (Phosphor, fill weight), bundled in the APK. iconize() swaps the
// interface emojis of an HTML string for these SVGs, in text only (never inside tags),
// so every screen keeps writing plain emojis and gets one consistent icon set.
import i_airplane from '@phosphor-icons/core/assets/fill/airplane-fill.svg?raw';
import i_airplane_landing from '@phosphor-icons/core/assets/fill/airplane-landing-fill.svg?raw';
import i_airplane_takeoff from '@phosphor-icons/core/assets/fill/airplane-takeoff-fill.svg?raw';
import i_airplane_tilt from '@phosphor-icons/core/assets/fill/airplane-tilt-fill.svg?raw';
import i_armchair from '@phosphor-icons/core/assets/fill/armchair-fill.svg?raw';
import i_arrow_fat_up from '@phosphor-icons/core/assets/fill/arrow-fat-up-fill.svg?raw';
import i_bell_ringing from '@phosphor-icons/core/assets/fill/bell-ringing-fill.svg?raw';
import i_book_open from '@phosphor-icons/core/assets/fill/book-open-fill.svg?raw';
import i_buildings from '@phosphor-icons/core/assets/fill/buildings-fill.svg?raw';
import i_calendar_check from '@phosphor-icons/core/assets/fill/calendar-check-fill.svg?raw';
import i_chart_bar from '@phosphor-icons/core/assets/fill/chart-bar-fill.svg?raw';
import i_check_circle from '@phosphor-icons/core/assets/fill/check-circle-fill.svg?raw';
import i_city from '@phosphor-icons/core/assets/fill/city-fill.svg?raw';
import i_clipboard_text from '@phosphor-icons/core/assets/fill/clipboard-text-fill.svg?raw';
import i_clover from '@phosphor-icons/core/assets/fill/clover-fill.svg?raw';
import i_coin from '@phosphor-icons/core/assets/fill/coin-fill.svg?raw';
import i_confetti from '@phosphor-icons/core/assets/fill/confetti-fill.svg?raw';
import i_crown from '@phosphor-icons/core/assets/fill/crown-fill.svg?raw';
import i_diamond from '@phosphor-icons/core/assets/fill/diamond-fill.svg?raw';
import i_dice_five from '@phosphor-icons/core/assets/fill/dice-five-fill.svg?raw';
import i_door_open from '@phosphor-icons/core/assets/fill/door-open-fill.svg?raw';
import i_eye from '@phosphor-icons/core/assets/fill/eye-fill.svg?raw';
import i_flask from '@phosphor-icons/core/assets/fill/flask-fill.svg?raw';
import i_gear_six from '@phosphor-icons/core/assets/fill/gear-six-fill.svg?raw';
import i_gift from '@phosphor-icons/core/assets/fill/gift-fill.svg?raw';
import i_globe from '@phosphor-icons/core/assets/fill/globe-fill.svg?raw';
import i_globe_hemisphere_west from '@phosphor-icons/core/assets/fill/globe-hemisphere-west-fill.svg?raw';
import i_hammer from '@phosphor-icons/core/assets/fill/hammer-fill.svg?raw';
import i_hand_pointing from '@phosphor-icons/core/assets/fill/hand-pointing-fill.svg?raw';
import i_hand_waving from '@phosphor-icons/core/assets/fill/hand-waving-fill.svg?raw';
import i_headphones from '@phosphor-icons/core/assets/fill/headphones-fill.svg?raw';
import i_hourglass from '@phosphor-icons/core/assets/fill/hourglass-fill.svg?raw';
import i_identification_badge from '@phosphor-icons/core/assets/fill/identification-badge-fill.svg?raw';
import i_identification_card from '@phosphor-icons/core/assets/fill/identification-card-fill.svg?raw';
import i_question from '@phosphor-icons/core/assets/fill/question-fill.svg?raw';
import i_info from '@phosphor-icons/core/assets/fill/info-fill.svg?raw';
import i_letter_circle_p from '@phosphor-icons/core/assets/fill/letter-circle-p-fill.svg?raw';
import i_lightbulb from '@phosphor-icons/core/assets/fill/lightbulb-fill.svg?raw';
import i_lightning from '@phosphor-icons/core/assets/fill/lightning-fill.svg?raw';
import i_lock_simple from '@phosphor-icons/core/assets/fill/lock-simple-fill.svg?raw';
import i_map_trifold from '@phosphor-icons/core/assets/fill/map-trifold-fill.svg?raw';
import i_medal from '@phosphor-icons/core/assets/fill/medal-fill.svg?raw';
import i_microscope from '@phosphor-icons/core/assets/fill/microscope-fill.svg?raw';
import i_money from '@phosphor-icons/core/assets/fill/money-fill.svg?raw';
import i_monitor_play from '@phosphor-icons/core/assets/fill/monitor-play-fill.svg?raw';
import i_package from '@phosphor-icons/core/assets/fill/package-fill.svg?raw';
import i_pencil_simple from '@phosphor-icons/core/assets/fill/pencil-simple-fill.svg?raw';
import i_person_simple_walk from '@phosphor-icons/core/assets/fill/person-simple-walk-fill.svg?raw';
import i_plus_circle from '@phosphor-icons/core/assets/fill/plus-circle-fill.svg?raw';
import i_puzzle_piece from '@phosphor-icons/core/assets/fill/puzzle-piece-fill.svg?raw';
import i_scroll from '@phosphor-icons/core/assets/fill/scroll-fill.svg?raw';
import i_shopping_cart from '@phosphor-icons/core/assets/fill/shopping-cart-fill.svg?raw';
import i_sparkle from '@phosphor-icons/core/assets/fill/sparkle-fill.svg?raw';
import i_speaker_high from '@phosphor-icons/core/assets/fill/speaker-high-fill.svg?raw';
import i_speaker_slash from '@phosphor-icons/core/assets/fill/speaker-slash-fill.svg?raw';
import i_star from '@phosphor-icons/core/assets/fill/star-fill.svg?raw';
import i_storefront from '@phosphor-icons/core/assets/fill/storefront-fill.svg?raw';
import i_suitcase_rolling from '@phosphor-icons/core/assets/fill/suitcase-rolling-fill.svg?raw';
import i_target from '@phosphor-icons/core/assets/fill/target-fill.svg?raw';
import i_ticket from '@phosphor-icons/core/assets/fill/ticket-fill.svg?raw';
import i_timer from '@phosphor-icons/core/assets/fill/timer-fill.svg?raw';
import i_toolbox from '@phosphor-icons/core/assets/fill/toolbox-fill.svg?raw';
import i_tray_arrow_down from '@phosphor-icons/core/assets/fill/tray-arrow-down-fill.svg?raw';
import i_trend_up from '@phosphor-icons/core/assets/fill/trend-up-fill.svg?raw';
import i_trophy from '@phosphor-icons/core/assets/fill/trophy-fill.svg?raw';
import i_tray_arrow_up from '@phosphor-icons/core/assets/fill/tray-arrow-up-fill.svg?raw';
import i_truck from '@phosphor-icons/core/assets/fill/truck-fill.svg?raw';
import i_users_three from '@phosphor-icons/core/assets/fill/users-three-fill.svg?raw';
import i_warning from '@phosphor-icons/core/assets/fill/warning-fill.svg?raw';
import i_warning_circle from '@phosphor-icons/core/assets/fill/warning-circle-fill.svg?raw';
import i_wind from '@phosphor-icons/core/assets/fill/wind-fill.svg?raw';
import i_wrench from '@phosphor-icons/core/assets/fill/wrench-fill.svg?raw';

import i_x_circle from '@phosphor-icons/core/assets/fill/x-circle-fill.svg?raw';
import i_hand_heart from '@phosphor-icons/core/assets/fill/hand-heart-fill.svg?raw';
const svg = (raw: string, cls: string) => raw.replace('<svg ', `<svg class="ic${cls ? ` ic-${cls}` : ''}" aria-hidden="true" `);

/** Emoji → icon. Longest sequences first so ZWJ emojis match before their parts. */
const ICONS: [string, string][] = [
  ['🧑‍🔧', svg(i_wrench, '')],
  ['💁', svg(i_hand_heart, 'pink')],
  ['✖', svg(i_x_circle, 'red')],
  ['👨‍✈️', svg(i_identification_badge, '')],
  ['🧑‍✈️', svg(i_identification_badge, '')],
  ['✈️', svg(i_airplane_tilt, 'sky')],
  ['🏙️', svg(i_city, '')],
  ['⬆️', svg(i_arrow_fat_up, 'green')],
  ['✏️', svg(i_pencil_simple, '')],
  ['🏗️', svg(i_hammer, '')],
  ['🛎️', svg(i_bell_ringing, 'gold')],
  ['🛋️', svg(i_armchair, '')],
  ['🛩️', svg(i_airplane, '')],
  ['⚠️', svg(i_warning, 'orange')],
  ['🗺️', svg(i_map_trifold, '')],
  ['🅿️', svg(i_letter_circle_p, '')],
  ['🎟️', svg(i_ticket, '')],
  ['🪙', svg(i_coin, 'gold')],
  ['✈', svg(i_airplane_tilt, 'sky')],
  ['🎁', svg(i_gift, 'pink')],
  ['📺', svg(i_monitor_play, '')],
  ['📦', svg(i_package, 'tan')],
  ['🛫', svg(i_airplane_takeoff, 'sky')],
  ['👥', svg(i_users_three, '')],
  ['⭐', svg(i_star, 'gold')],
  ['🧪', svg(i_flask, 'violet')],
  ['🔬', svg(i_microscope, 'teal')],
  ['⚡', svg(i_lightning, 'gold')],
  ['🎲', svg(i_dice_five, '')],
  ['🌟', svg(i_sparkle, 'gold')],
  ['🔧', svg(i_wrench, '')],
  ['🏆', svg(i_trophy, 'gold')],
  ['📋', svg(i_clipboard_text, '')],
  ['🧍', svg(i_person_simple_walk, '')],
  ['⬆', svg(i_arrow_fat_up, 'green')],
  ['🧩', svg(i_puzzle_piece, '')],
  ['🏢', svg(i_buildings, '')],
  ['👋', svg(i_hand_waving, '')],
  ['✔', svg(i_check_circle, 'green')],
  ['✅', svg(i_check_circle, 'green')],
  ['🎯', svg(i_target, 'red')],
  ['➕', svg(i_plus_circle, '')],
  ['📅', svg(i_calendar_check, '')],
  ['❗', svg(i_warning_circle, 'orange')],
  ['🛒', svg(i_shopping_cart, '')],
  ['🍀', svg(i_clover, 'green')],
  ['📖', svg(i_book_open, '')],
  ['🌍', svg(i_globe_hemisphere_west, 'teal')],
  ['🎉', svg(i_confetti, 'pink')],
  ['🔇', svg(i_speaker_slash, '')],
  ['🔊', svg(i_speaker_high, '')],
  ['🧰', svg(i_toolbox, '')],
  ['💡', svg(i_lightbulb, 'gold')],
  ['📜', svg(i_scroll, 'tan')],
  ['✨', svg(i_sparkle, 'gold')],
  ['📊', svg(i_chart_bar, '')],
  ['💨', svg(i_wind, '')],
  ['🔒', svg(i_lock_simple, '')],
  ['💎', svg(i_diamond, 'sky')],
  ['🚪', svg(i_door_open, '')],
  ['🧳', svg(i_suitcase_rolling, 'tan')],
  ['🏬', svg(i_storefront, '')],
  ['🏪', svg(i_storefront, '')],
  ['🚚', svg(i_truck, '')],
  ['⏳', svg(i_hourglass, '')],
  ['📥', svg(i_tray_arrow_down, '')],
  ['📤', svg(i_tray_arrow_up, '')],
  ['⚙', svg(i_gear_six, '')],
  ['❓', svg(i_question, '')],
  ['⏱', svg(i_timer, '')],
  ['🪪', svg(i_identification_card, '')],
  ['🥇', svg(i_medal, 'gold')],
  ['🥈', svg(i_medal, 'silver')],
  ['🥉', svg(i_medal, 'bronze')],
  ['👀', svg(i_eye, '')],
  ['👉', svg(i_hand_pointing, '')],
  ['🎧', svg(i_headphones, '')],
  ['💰', svg(i_money, 'green')],
  ['🛬', svg(i_airplane_landing, 'sky')],
  ['👑', svg(i_crown, 'gold')],
  ['ⓘ', svg(i_info, '')],
  ['🌐', svg(i_globe, '')],
  ['📈', svg(i_trend_up, 'green')],
];

// Never match a piece of a longer ZWJ emoji (🧑‍🔧 must not become 🧑 + wrench).
const PATTERN = new RegExp(`(?<!\u200D)(?:${ICONS.map(([e]) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?!\uFE0F?\u200D)`, 'gu');
const BY_EMOJI = new Map(ICONS);

/** Replaces the interface emojis in the text parts of an HTML string. */
export function iconize(html: string): string {
  return html.replace(/(<[^>]*>)|([^<]+)/g, (_, tag: string | undefined, text: string | undefined) =>
    tag ?? text!.replace(PATTERN, (e) => BY_EMOJI.get(e) ?? e),
  );
}

/** One icon by its emoji, for code that builds DOM nodes directly. */
export const icon = (emoji: string) => BY_EMOJI.get(emoji) ?? emoji;
