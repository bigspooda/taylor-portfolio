// RAINBOW BG SCRIPT
(function () {
  const overlay = document.getElementById('audio-gradient-overlay');
  const players = Array.from(document.querySelectorAll('audio'));
  const playing = new Set();

  function update() {
    if (playing.size > 0) {
      document.body.classList.add('is-playing');
      overlay.classList.add('on');
    } else {
      document.body.classList.remove('is-playing');
      overlay.classList.remove('on');
    }
  }

  players.forEach(a => {
    a.addEventListener('play', () => {
      players.forEach(b => { if (b !== a && !b.paused) b.pause(); });
      playing.add(a);
      update();
    });
    a.addEventListener('playing', () => { playing.add(a); update(); });
    a.addEventListener('pause',   () => { playing.delete(a); update(); });
    a.addEventListener('ended',   () => { playing.delete(a); update(); });
    a.addEventListener('abort',   () => { playing.delete(a); update(); });
    a.addEventListener('emptied', () => { playing.delete(a); update(); });
  });
}());

// EQUALIZER SCRIPT
(function () {
  const players = Array.from(document.querySelectorAll('audio'));

  const eq = document.createElement('div');
  eq.className = 'eq-stack';
  for (let i = 0; i < 5; i++) {
    const bar = document.createElement('div');
    bar.className = 'eq-bar';
    eq.appendChild(bar);
  }
  document.body.appendChild(eq);

  const bars = Array.from(eq.children);
  const graphs = new Map();

  function ensureGraph(audio) {
    let g = graphs.get(audio);
    if (g) return g;

    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaElementSource(audio);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;

    const data = new Uint8Array(analyser.frequencyBinCount);

    src.connect(analyser);
    analyser.connect(ac.destination);

    g = { ac, src, analyser, data, levels: new Float32Array(5).fill(0), raf: null };
    graphs.set(audio, g);
    return g;
  }

  function bandRanges(binCount, sampleRate) {
    const hzPerBin = (sampleRate / 2) / binCount;
    const stops = [60, 250, 500, 2000, 6000, 16000];
    const idx = stops.map(hz => {
      const i = Math.round(hz / hzPerBin);
      return Math.max(0, Math.min(binCount - 1, i));
    });

    const ranges = [];
    for (let i = 0; i < 5; i++) ranges.push([idx[i], idx[i + 1]]);
    return ranges;
  }

  let activeAudio = null;
  let cardEl = null;
  let targetEl = null;

  function findCard(audio) {
    return audio.closest(
      '.candy-swipe, .mouthful, .bitcrunch, .system-instruction, .megagecko, .everything-happens, .mhm, .huh, .defenders-of-the-funny, .times'
    );
  }

  function findTarget(audio) {
    return audio.closest('.album-song, .album-song-end') || audio;
  }

  function positionEQ() {
    if (!cardEl || !targetEl) return;

    const cardRect = cardEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    const cardRight = window.scrollX + cardRect.right;
    const cardLeft  = window.scrollX + cardRect.left;

    const targetMidY = window.scrollY + targetRect.top + targetRect.height / 2;

    let left = cardRight;

    const top = targetMidY;

    eq.style.top = `${top}px`;
    eq.style.left = `${left}px`;
    eq.style.transform = 'translateY(-50%)';

    const eqWidth = eq.getBoundingClientRect().width || 160;
    if (left + eqWidth > window.scrollX + window.innerWidth - 8) {
      left = Math.max(window.scrollX + 8, cardLeft - eqWidth);
      eq.style.left = `${left}px`;
    }
  }

  function startEQ(audio) {
    if (activeAudio) stopEQ(activeAudio, true);

    activeAudio = audio;
    cardEl = findCard(audio) || findTarget(audio);
    targetEl = findTarget(audio);

    const g = ensureGraph(audio);
    if (g.ac.state === 'suspended') g.ac.resume().catch(() => {});

    eq.classList.add('on');
    positionEQ();

    const { analyser, data } = g;
    const ranges = bandRanges(analyser.frequencyBinCount, g.ac.sampleRate);

    const maxWidth = parseFloat(getComputedStyle(eq).width) || 160;

    cancelAnimationFrame(g.raf);
    function draw() {
      analyser.getByteFrequencyData(data);

      for (let i = 0; i < 5; i++) {
        const [s, e] = ranges[i];
        let sum = 0;
        for (let k = s; k < e; k++) sum += data[k];
        const avg = sum / Math.max(1, e - s);
        const level = avg / 255;

        g.levels[i] = g.levels[i] * 0.8 + level * 0.2;
        bars[i].style.width = (g.levels[i] * maxWidth) + 'px';
      }
      positionEQ();

      g.raf = requestAnimationFrame(draw);
    }

    draw();
  }

  function stopEQ(audio, soft = false) {
    if (audio !== activeAudio) return;

    const g = graphs.get(audio);
    if (!g) return;

    cancelAnimationFrame(g.raf);
    g.raf = null;

    if (soft) {
      bars.forEach(b => {
        b.style.transition = 'width .2s ease';
        b.style.width = '0px';
      });
      setTimeout(() => bars.forEach(b => (b.style.transition = '')), 220);
    } else {
      bars.forEach(b => (b.style.width = '0px'));
    }

    eq.classList.remove('on');
    activeAudio = null;
  }

  window.addEventListener('scroll', () => { if (activeAudio) positionEQ(); }, { passive: true });
  window.addEventListener('resize', () => { if (activeAudio) positionEQ(); });

  players.forEach(a => {
    a.addEventListener('play', () => startEQ(a));
    a.addEventListener('playing', () => startEQ(a));
    ['pause', 'ended', 'abort', 'emptied'].forEach(evt => {
      a.addEventListener(evt, () => stopEQ(a, true));
    });
  });
})();

// CLICKABLE CARDS SCRIPT
(function () {
  const cards = document.querySelectorAll(
    '.candy-swipe, .mouthful, .bitcrunch, .system-instruction, .megagecko, .defenders-of-the-funny, .huh, .everything-happens, .mhm, .times'
  );

  if (!cards.length) return;

  cards.forEach((card) => {
    card.addEventListener('click', (e) => {
      const interactive = e.target.closest(
        'a, audio, button, input, select, textarea, label'
      );
      if (interactive) return;

      let audio = null;

      const songRow = e.target.closest('.album-song, .album-song-end');
      if (songRow) {
        audio = songRow.querySelector('audio');
      } else {
        audio = card.querySelector('audio');
      }

      if (!audio) return;

      if (audio.paused) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });
  });
})();

(function () {
  let lastY = window.scrollY;
  let ticking = false;

  function apply() {
    const y = window.scrollY;
    const goingDown = y > lastY;

    if (y > 40 && goingDown) {
      document.body.classList.add('nav-retreat');
    } else if (!goingDown || y <= 40) {
      document.body.classList.remove('nav-retreat');
    }

    lastY = y;
    ticking = false;
  }

  document.body.classList.remove('nav-retreat');
  lastY = window.scrollY;
  apply();

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(apply);
    }
  }, { passive: true });
})();