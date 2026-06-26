import type { InfoContract } from "../types/type";
import { PLUGIN_ID } from "./common";

export function buildPluginInfo(): InfoContract {
  return {
    name: "如漫画",
    uuid: PLUGIN_ID,
    iconUrl: "https://www.rumanhua2.com/static/images/logo.png",
    creator: {
      name: "rumanhua",
      describe: "如漫画源插件",
    },
    describe: "如漫画源插件，支持搜索、漫画详情、在线阅读",
    version: "0.0.1",
    home: "http://www.rumanhua2.com",
    updateUrl: "",
    npmName: "breeze-plugin-rumanhua",
    function: [
      {
        id: "search",
        title: "搜索",
        action: {
          type: "openSearch",
          payload: { source: PLUGIN_ID },
        },
      },
    ],
  };
}

export function buildManifestInfo(): InfoContract {
  return buildPluginInfo();
}
