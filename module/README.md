# Magisk 模块

安装后在 `post-fs-data` 阶段设置 `persist.radio.multisim.config`。

## 文件

- `module.prop` — 模块元信息
- `post-fs-data.sh` — 开机脚本，读模式文件决定属性值
- `META-INF/com/google/android/update-binary` — 安装/卸载处理

## 模式文件

```
/data/local/tmp/lino_sim_switch_mode
```

内容为 `single`（默认）或 `dual`。插件负责写入。

## 属性映射

| 模式 | 属性值 | 效果 |
|---|---|---|
| `single` | 空 | UNKNOWN → 单卡 |
| `dual` | `dsds` | 双卡双待 |

## 卸载

`update-binary` 收到 `remove` 参数时自动执行：

```sh
setprop persist.radio.multisim.config dsds
```
