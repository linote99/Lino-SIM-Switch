# Lino SIM Switch

控制 Android 设备按几张 SIM 卡启动。用于禁用**没有可用数据网络的内置厂商卡**，避免它抢走移动数据、并在每次开机时弹出「要使用哪张卡上网」的对话框。

适用于内置贴片卡 + 用户自备卡的设备（如 U30 Air 一类随身 WiFi）。

## 问题

这类设备的内置厂商卡通常没有可用流量。系统默认 `dsds`（双卡双待），会把两张卡都拉起来：

- 开机弹出「要使用中国移动2的移动数据吗？」，不选就不走流量
- 厂商卡作为备用上网卡参与评分，导致掉线或卡顿
- 每次都得进设置手动关闭 SIM2

## 原理

`telephony-common.jar` 里 `TelephonyManager.getMultiSimConfiguration()` 的判定：

```java
String cfg = TelephonyProperties.multi_sim_config().orElse("");
if ("dsds".equals(cfg)) return DSDS;
if ("dsda".equals(cfg)) return DSDA;
if ("tsts".equals(cfg)) return TSTS;
return UNKNOWN;   // 空值或其他值 → 单卡
```

把 `persist.radio.multisim.config` 清空，系统从启动阶段就按单卡处理，厂商卡不会被拉起。

### 为什么需要 Magisk 模块

这个属性被写死在只读分区：

```
/odm/etc/build.prop:42:persist.radio.multisim.config=dsds
/dev/block/dm-15 on /odm type erofs (ro,...)
```

实测 `setprop` / `resetprop` / `resetprop -p` 都能立即生效，但**重启后被 build.prop 覆盖**。只有 `post-fs-data.sh` 的时机（init 处理完 build.prop、RIL 初始化之前）能压过它，插件在用户态跑，拿不到这个窗口。

## 组成

| 部分 | 作用 |
|---|---|
| `module/` | Magisk 模块，开机设置属性 |
| `plugin/` | UFI-TOOLS 插件，界面切换 + 记住选择 |

两者配合：插件写 `/data/local/tmp/lino_sim_switch_mode` 记录选择，模块开机读它决定 `setprop` 什么值。

## 安装

### 1. 模块

```
Magisk → 模块 → 从本地安装 → 选择 Lino-SIM-Switch-v2.0.zip
```

安装时自动：
- 清理旧模块 `lino_simctl`（如果装过）
- 立即 `setprop` 生效
- 默认写入 `single` 模式

重启后保持。

### 2. 插件

打开 UFI-TOOLS → 插件编辑 → 贴入 `plugin/sim-switch-plugin.js` 全文（含 `[KANO_PLUGIN_START]` 到 `[KANO_PLUGIN_END]`）→ 保存。

菜单出现「双卡双待控制」，点开是两个互斥开关：

- **单卡模式** —— 只使用 SIM 卡 1
- **双卡双待** —— 厂商卡参与，可能抢网

切换即时生效，重启后按所选模式启动。

## 卸载

在 Magisk 里移除模块，`update-binary` 会自动恢复 `dsds`：

```sh
setprop persist.radio.multisim.config dsds
```

重启后回到双卡双待。

手动恢复：

```sh
su -c 'setprop persist.radio.multisim.config dsds'
su -c 'echo dual > /data/local/tmp/lino_sim_switch_mode'
```

## 构建

模块打包需要保留文件权限：

```bash
cd module
zip -r ../Lino-SIM-Switch-v2.0.zip \
    module.prop post-fs-data.sh META-INF/com/google/android/update-binary
```

或使用任意保留 Unix 权限的打包方式（`post-fs-data.sh` 与 `update-binary` 需为 `755`）。

## 文件说明

```
module/
├── module.prop                                    模块元信息
├── post-fs-data.sh                                开机设置属性
└── META-INF/com/google/android/update-binary      安装/卸载逻辑

plugin/
└── sim-switch-plugin.js                           UFI-TOOLS 插件
```

## 已验证环境

- U30 Air（UNISOC UMS9620，Android 13 / API 33）
- Magisk
- 实测：属性清空后重启，`gsm.sim.state` 从 `LOADED,ABSENT` 变为 `LOADED`，活跃订阅只剩一张卡，网络正常，不再弹选卡对话框

## 风险

改动后系统认为设备只有一张卡：

- 想插第二张卡时需要切回双卡双待
- 极端情况下 RIL 可能因配置不符报错，`setprop ... dsds` 或删模块可恢复
