// [KANO_PLUGIN_START] 双卡双待控制 v2.1.js
//<script>
/*
 * 双卡双待控制 —— UFI-TOOLS 插件 v2.1
 *
 * 配合 Magisk 模块 lino_sim_switch 使用。
 *
 * 原理：persist.radio.multisim.config 决定系统初始化几张卡
 *   清空    -> UNKNOWN，按单卡启动，内置厂商卡不会被拉起
 *   "dsds"  -> 双卡双待，厂商卡参与抢网并弹选卡对话框
 *
 * 写入 /data/local/tmp/lino_sim_switch_mode 记录用户选择，
 * 模块的 post-fs-data.sh 开机读它决定设置哪个值。
 */
(() => {
  'use strict';

  const VERSION  = 'v2.1';
  const MOD_DIR  = '/data/adb/modules/lino_sim_switch';
  const MODE_F   = '/data/local/tmp/lino_sim_switch_mode';
  const PROP     = 'persist.radio.multisim.config';

  const sh = async (cmd, timeout = 20000) => {
    try {
      const r = await runShellWithRoot(cmd, timeout);
      return { ok: Boolean(r && r.success), out: String((r && r.content) || '').trim() };
    } catch (e) {
      return { ok: false, out: '' };
    }
  };

  const readMode = async () => {
    const r = await sh(`cat ${MODE_F} 2>/dev/null`);
    return r.out.trim() === 'dual' ? 'dual' : 'single';
  };

  const readProp = async () => {
    const r = await sh(`getprop ${PROP}`);
    return r.out.trim();
  };

  const moduleOk = async () => {
    const r = await sh(`[ -d ${MOD_DIR} ] && [ -f ${MOD_DIR}/post-fs-data.sh ] && echo yes`);
    return r.out === 'yes';
  };

  const readSims = async () => {
    const r = await sh(
      'content query --uri content://telephony/siminfo ' +
      '--projection _id:sim_id:uicc_applications_enabled:display_name ' +
      '--where "sim_id>=0" 2>/dev/null ' +
      `| sed -n 's/^Row: [0-9]* _id=\\([0-9]*\\), sim_id=\\([-0-9]*\\), ` +
      `uicc_applications_enabled=\\([01]\\), display_name=\\(.*\\)$/\\1|\\2|\\3|\\4/p'`
    );
    if (!r.ok || !r.out) return [];
    return r.out.split('\n').filter(Boolean).map((l) => {
      const p = l.split('|');
      return { id: Number(p[0]), slot: Number(p[1]), on: p[2] === '1', name: p[3] || '?' };
    }).filter((x) => Number.isFinite(x.id));
  };

  const applyMode = async (mode) => {
    const propVal = mode === 'dual' ? 'dsds' : '';
    // 1. 记录选择，供开机读取
    const w = await sh(
      `mkdir -p /data/local/tmp && printf '%s\\n' '${mode}' > ${MODE_F} && cat ${MODE_F}`
    );
    if (!w.ok) return { ok: false, msg: '写入模式文件失败' };
    // 2. 立即生效
    const s = await sh(`setprop ${PROP} "${propVal}"`);
    if (!s.ok) return { ok: false, msg: '设置属性失败' };
    return { ok: true };
  };

  const openPanel = () => {
    const { el, close } = createFixedToast('lino_sim_switch', `
      <div style="pointer-events:all;width:90vw;max-width:440px">
        <div class="title" style="margin:0 0 6px">双卡双待控制 <span style="font-size:.58rem;opacity:.55">${VERSION}</span></div>
        <p style="font-size:.63rem;opacity:.75;line-height:1.6;margin:0 0 10px">
          控制设备按几张卡启动。单卡模式下内置厂商卡不会被拉起，不再抢网、不再弹选卡对话框。
        </p>

        <div id="ss_mod" style="font-size:.6rem;padding:7px 9px;border-radius:6px;margin-bottom:12px"></div>

        <div style="display:grid;gap:9px;margin:12px 0">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
            <div style="font-size:.7rem;line-height:1.4">
              单卡模式
              <div style="font-size:.58rem;opacity:.55">只使用 SIM 卡 1</div>
            </div>
            <button type="button" id="ss_single" class="mud-btn" role="switch">--</button>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
            <div style="font-size:.7rem;line-height:1.4">
              双卡双待
              <div style="font-size:.58rem;opacity:.55">厂商卡会参与，可能抢网</div>
            </div>
            <button type="button" id="ss_dual" class="mud-btn" role="switch">--</button>
          </div>
        </div>

        <p id="ss_msg" style="font-size:.62rem;opacity:.78;line-height:1.6;margin:8px 0 0;white-space:pre-wrap"></p>

        <div style="text-align:right;margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,.1)">
          <button type="button" id="ss_ref"   style="font-size:.6rem;padding:5px 10px;margin-right:6px">刷新</button>
          <button type="button" id="ss_close" style="font-size:.6rem;padding:5px 14px">关闭</button>
        </div>
      </div>
    `);

    const modEl = el.querySelector('#ss_mod');
    const msg   = el.querySelector('#ss_msg');
    const bS    = el.querySelector('#ss_single');
    const bD    = el.querySelector('#ss_dual');
    let busy = false, mode = 'single', propVal = '';

    const say = (t, err) => {
      msg.textContent = t;
      msg.style.color = err ? 'var(--danger,#dc3545)' : '';
    };

    const paint = () => {
      bS.disabled = busy;
      bD.disabled = busy;
      bS.textContent = mode === 'single' ? '已启用' : '点击切换';
      bD.textContent = mode === 'dual' ? '已启用' : '点击切换';
      bS.setAttribute('aria-checked', String(mode === 'single'));
      bD.setAttribute('aria-checked', String(mode === 'dual'));
      bS.classList.toggle('on', mode === 'single');
      bD.classList.toggle('on', mode === 'dual');
    };

    const refresh = async () => {
      if (busy) return;
      mode = await readMode();
      propVal = await readProp();
      const ok = await moduleOk();
      sims = await readSims();

      modEl.textContent = ok
        ? '✓ 模块已安装'
        : '⚠ 模块未安装，设置无法持久化';
      modEl.style.background = ok ? 'rgba(40,167,69,.15)' : 'rgba(220,53,69,.15)';
      modEl.style.color = ok ? '#7ee2a8' : '#ff8a95';

      paint();
      const names = sims.map((x) => `${x.name}(槽${x.slot + 1})`).join(' ');
      say(`当前识别 ${sims.length} 张卡${names ? '：' + names : ''}`);
    };

    let sims = [];

    const set = async (want) => {
      if (busy || mode === want) return;
      busy = true; paint();
      say(want === 'single' ? '正在切到单卡模式…' : '正在恢复双卡双待…');

      const r = await applyMode(want);
      busy = false;

      if (!r.ok) {
        say(r.msg, true);
        await refresh();
        return;
      }

      await refresh();
      say(want === 'single'
        ? '已切到单卡模式\n厂商卡不再被拉起，网络应更稳定。\n重启后保持。'
        : '已恢复双卡双待\n下次开机厂商卡会重新启用，可能需要手动关一次。\n重启后生效更彻底。');
    };

    bS.onclick = () => set('single');
    bD.onclick = () => set('dual');
    el.querySelector('#ss_ref').onclick   = () => refresh();
    el.querySelector('#ss_close').onclick = () => close();

    paint();
    refresh();
  };

  const btn = document.createElement('button');
  btn.textContent = '双卡双待控制';
  btn.onclick = async () => {
    if (typeof checkAdvancedFunc === 'function' && !(await checkAdvancedFunc())) {
      createToast('请先启用高级功能', 'pink');
      return;
    }
    openPanel();
  };

  const menu = document.querySelector('#collapseBtn_menu');
  const box = menu && menu.nextElementSibling &&
              menu.nextElementSibling.querySelector('.collapse_box');
  if (box) box.appendChild(btn);
  else if (document.querySelector('.actions-buttons')) {
    document.querySelector('.actions-buttons').append(btn);
  }
})();
//</script>
// [KANO_PLUGIN_END] 双卡双待控制 v2.1.js
