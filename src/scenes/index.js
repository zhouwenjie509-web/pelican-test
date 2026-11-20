// Scene registry: scenes[0] is the intro wall, scenes[1..20] the sections in
// order, scenes[21] the 21st picture of the outro.
//
// Every section has its own file in this folder, exporting one scene object
// under its id. All twenty are painted. (`placeholder.js` remains as the
// smallest complete example of a scene, and supplies the plain pelican.)

import { SECTIONS } from "./sections.js";
import { intro } from "./intro.js";
import { press } from "./outro.js";
import { sahara } from "./sahara.js";
import { egypt } from "./egypt.js";
import { han } from "./han.js";
import { tang } from "./tang.js";
import { song } from "./song.js";
import { qingming } from "./qingming.js";
import { maya } from "./maya.js";
import { mughal } from "./mughal.js";
import { bada } from "./bada.js";
import { wayang } from "./wayang.js";
import { ukiyoe } from "./ukiyoe.js";
import { starry } from "./starry.js";
import { scream } from "./scream.js";
import { nosferatu } from "./nosferatu.js";
import { scope } from "./scope.js";
import { pixel } from "./pixel.js";
import { chat } from "./chat.js";
import { vapor } from "./vapor.js";
import { shortvideo } from "./shortvideo.js";
import { code } from "./code.js";

const BY_ID = { sahara, egypt, han, tang, song, qingming, maya, mughal, bada, wayang, ukiyoe, starry, scream, nosferatu, scope, pixel, chat, vapor, shortvideo, code };

export function buildScenes() {
  const scenes = [intro];
  for (const meta of SECTIONS) {
    const scene = BY_ID[meta.id];
    if (!scene) throw new Error(`No scene registered for section ${meta.n} (${meta.id}).`);
    scenes.push(scene);
  }
  scenes.push(press);
  return scenes;
}

export { SECTIONS };
