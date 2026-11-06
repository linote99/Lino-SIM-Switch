#!/system/bin/sh
# 开机按用户选择设置多卡模式
#
# 原理：telephony-common 的 TelephonyManager.getMultiSimConfiguration()
#   "dsds"/"dsda"/"tsts" -> 多卡模式，系统会把内置厂商卡也拉起来
#   其他值（含空）        -> UNKNOWN，按单卡处理
#
# 厂商卡没有可用数据网络，双待时会被系统当成备用上网卡，
# 导致开机弹「要使用中国移动2的移动数据吗」并拖慢网络。

MOD=/data/adb/modules/lino_sim_switch
CACHE=/data/local/tmp/lino_sim_switch_mode

# 读取用户选择：single（默认，只用一张卡）| dual（双卡双待）
MODE=$(cat "$CACHE" 2>/dev/null)
case "$MODE" in
    dual) setprop persist.radio.multisim.config dsds ;;
    *)    setprop persist.radio.multisim.config "" ;;
esac

exit 0
