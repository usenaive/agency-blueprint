// Tap and bounce: the bot taps into each field, types, presses sign up, and the journey passes.
// Its eyes follow the tap, or your pointer. At rest it blinks, bobs and runs the journey again.
// Reduced motion: the filled form with its "Journey passed" sticker, nothing moves.
(() => {
  const stage = document.querySelector('.stage');
  if (!stage || !document.documentElement.classList.contains('motion')) return;
  const phone = stage.querySelector('.phone');
  const screen = stage.querySelector('.screen');
  const tap = stage.querySelector('.tap');
  const bot = stage.querySelector('.bot');
  const eyes = bot.querySelector('.bot__eyes');
  const fields = [...stage.querySelectorAll('.field')];
  const button = stage.querySelector('.app__btn');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const look = (x, y) => {
    const r = bot.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height * 0.4);
    const d = Math.hypot(dx, dy) || 1;
    eyes.style.transform = `translate(${(dx / d) * 6}px, ${(dy / d) * 5}px)`;
  };
  const press = async (el) => {
    tap.style.left = `${screen.offsetLeft + el.offsetLeft + el.offsetWidth * 0.6}px`;
    tap.style.top = `${screen.offsetTop + el.offsetTop + el.offsetHeight / 2}px`;
    const r = el.getBoundingClientRect();
    look(r.left + r.width / 2, r.top + r.height / 2);
    tap.classList.remove('is-on'); void tap.offsetWidth; tap.classList.add('is-on');
    bot.classList.add('is-tap');
    await wait(220);
    bot.classList.remove('is-tap');
  };
  const type = async (field, ms) => {
    const v = field.querySelector('.field__v'), text = v.dataset.v;
    fields.forEach((f) => f.classList.toggle('is-focus', f === field));
    for (let i = 1; i <= text.length; i++) { v.textContent = text.slice(0, i); await wait(ms); }
  };

  let busy = false;
  const journey = async () => {
    busy = true;
    stage.classList.add('is-reset');
    fields.forEach((f) => { f.querySelector('.field__v').textContent = ''; });
    await wait(300);
    await press(fields[0]); await type(fields[0], 22);
    await press(fields[1]); await type(fields[1], 28);
    fields.forEach((f) => f.classList.remove('is-focus'));
    await press(button);
    button.classList.add('is-press');
    await wait(160);
    button.classList.remove('is-press');
    stage.classList.remove('is-reset');
    eyes.style.transform = '';
    busy = false;
  };

  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);
  addEventListener('pointermove', (e) => { if (!busy && visible) look(e.clientX, e.clientY); }, { passive: true });
  journey();
  setInterval(() => { if (visible && !document.hidden && !busy) journey(); }, 7500);
})();
