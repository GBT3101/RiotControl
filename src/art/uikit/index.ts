/**
 * UI kit "The Ministry Dossier": bitmap fonts, panels, buttons, cards, icons, meters, banners,
 * stamps, advisor portraits, logo and mastheads — registration entry point (milestone M5).
 * Catalogue & API: docs/art/M5.md.
 */
import type { SpriteRegistry } from '../lib/registry';
import { registerFontSpecimens } from './fontSpecimen';
import { registerBanners } from './banners';
import { registerButtons } from './buttons';
import { registerCards } from './cards';
import { registerIcons } from './icons';
import { registerLogo } from './logo';
import { registerPanels } from './panels';
import { registerPortraits } from './portraits';

export function registerUiKit(reg: SpriteRegistry): void {
  registerFontSpecimens(reg);
  registerPanels(reg);
  registerIcons(reg);
  registerButtons(reg);
  registerCards(reg);
  registerBanners(reg);
  registerPortraits(reg);
  registerLogo(reg);
}
