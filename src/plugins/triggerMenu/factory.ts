/**
 * Trigger Menu Factory
 *
 * Creates trigger-based command menus for different trigger characters.
 */

import { slashFactory } from "@milkdown/kit/plugin/slash";
import type { Ctx } from "@milkdown/kit/ctx";
import { TriggerMenuView } from "./TriggerMenuView";
import type { TriggerMenuConfig } from "./types";

/**
 * Creates a trigger menu plugin with the given configuration.
 *
 * @example
 * ```typescript
 * const { plugin, configure } = createTriggerMenu({
 *   id: "SLASH_MENU",
 *   trigger: "/",
 *   items: slashMenuItems,
 * });
 *
 * // In editor setup:
 * .use(plugin)
 * .config(configure)
 * ```
 */
export function createTriggerMenu(config: TriggerMenuConfig) {
  const plugin = slashFactory(config.id);

  function configure(ctx: Ctx) {
    ctx.set(plugin.key, {
      view: (view) => new TriggerMenuView(ctx, view, config),
    });
  }

  return { plugin, configure };
}
