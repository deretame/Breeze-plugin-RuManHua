import type { InfoContract } from "breeze-plugin-kit";
import { PLUGIN_ID } from "./common";

export function buildPluginInfo(): InfoContract {
  return {
    name: "如漫画",
    uuid: PLUGIN_ID,
    iconUrl: "https://www.rumanhua2.com/static/images/logo.png",
    describe: "如漫画源插件",
    version: "0.1.0",
    home: "https://github.com/deretame/Breeze-plugin-RuManHua",
    updateUrl: "https://api.github.com/repos/deretame/Breeze-plugin-RuManHua/releases/latest",
    npmName: "breeze-plugin-ru-man-hua",
    haveHome: true,
    function: [],
  };
}

export function buildManifestInfo(): InfoContract {
  return buildPluginInfo();
}
