# 更新记录

## v2.1 — 2026-11-06

插件：
- 更名为「双卡双待控制」
- 单卡模式说明改为「只使用 SIM 卡 1」
- 模块状态区只显示「模块已安装」，去掉属性值显示

## v2.0 — 2026-11-06

重写实现方式。

- 从「反复压制 siminfo 数据库字段」改为「清空 persist.radio.multisim.config」
- 移除守护进程、特权应用、dex 编译产物
- 模块精简到 3 个文件、1894 字节
- 卸载时自动恢复 dsds

## v1.x — 2026-11-06（已废弃）

早期方案，通过 `ISub.setUiccApplicationsEnabled` binder 调用修改 `siminfo.uicc_applications_enabled`。

存在的问题：开机脚本执行后系统仍会继续初始化 SIM 并把该字段写回 1，需要守护进程每 2 秒压制一次，且只守 15 分钟。未能从根因解决。
