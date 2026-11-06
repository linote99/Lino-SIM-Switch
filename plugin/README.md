# UFI-TOOLS 插件

粘入 UFI-TOOLS 的插件编辑框即可，需包含 `[KANO_PLUGIN_START]` 与 `[KANO_PLUGIN_END]` 标记。

## 功能

两个互斥开关：

- **单卡模式** — 只使用 SIM 卡 1
- **双卡双待** — 厂商卡参与，可能抢网

切换时：

1. 写 `/data/local/tmp/lino_sim_switch_mode`
2. 立即 `setprop persist.radio.multisim.config`

## 依赖

Magisk 模块 `lino_sim_switch`。没装时界面会提示「模块未安装，设置无法持久化」，此时切换仅在本次开机内有效。

## 依赖的全局函数

来自 UFI-TOOLS 宿主页面：

- `runShellWithRoot(cmd, timeout)` → `{ success, content }`
- `createFixedToast(id, html)` → `{ el, close }`
- `createToast(text, color)`
- `checkAdvancedFunc()`
