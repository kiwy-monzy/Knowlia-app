import { debounce } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";

// Debounced function to save configuration changes
const debouncedSetConfig = debounce(async (key: string, value: string) => {
  await invoke("set_config_value", { key, value: value.trim() });
}, 500);

export class GlobalConfig {
  use_same_model = true;
  vision_api_key = "NONE";
  vision_base_url = "http://127.0.0.1:1234";
  vision_model = "qwen/qwen2.5-vl-7b";
  chat_api_key = "NONE";
  chat_base_url = "http://127.0.0.1:1234";
  chat_model = "gpt-oss-20b";
  enable_background_tasks = false;
  screenshot_delay = 10;
  user_intention_delay = 15;
  app_path = "";

  constructor() {
    this.loadConfig();
  }

  async loadConfig() {
    const sqlGlobalConfig = await invoke<GlobalConfig>("get_global_config");
    console.log("sqlGlobalConfig", sqlGlobalConfig);
    if (sqlGlobalConfig.use_same_model) {
      this.use_same_model = String(sqlGlobalConfig.use_same_model) === "true";
    }
    if (sqlGlobalConfig.app_path) {
      this.app_path = sqlGlobalConfig.app_path;
    }
    // Vision Model
    if (sqlGlobalConfig.vision_api_key) {
      this.vision_api_key = sqlGlobalConfig.vision_api_key;
    }
    if (sqlGlobalConfig.vision_base_url) {
      this.vision_base_url = sqlGlobalConfig.vision_base_url;
    }
    if (sqlGlobalConfig.vision_model) {
      this.vision_model = sqlGlobalConfig.vision_model;
    }
    // Chat Model
    if (sqlGlobalConfig.chat_api_key) {
      this.chat_api_key = sqlGlobalConfig.chat_api_key;
    }
    if (sqlGlobalConfig.chat_base_url) {
      this.chat_base_url = sqlGlobalConfig.chat_base_url;
    }
    if (sqlGlobalConfig.chat_model) {
      this.chat_model = sqlGlobalConfig.chat_model;
    }
    // Background Tasks
    if (sqlGlobalConfig.enable_background_tasks) {
      this.enable_background_tasks =
        String(sqlGlobalConfig.enable_background_tasks) === "true";
    }
    if (sqlGlobalConfig.screenshot_delay) {
      this.screenshot_delay = Number(sqlGlobalConfig.screenshot_delay);
    }
    if (sqlGlobalConfig.user_intention_delay) {
      this.user_intention_delay = Number(sqlGlobalConfig.user_intention_delay);
    }
  }

  async debounceSaveConfig(key: string, value: string) {
    await debouncedSetConfig(key, value);
  }
}

export const globalConfig = new GlobalConfig();
