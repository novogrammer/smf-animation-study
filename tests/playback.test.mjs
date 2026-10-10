import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from 'spessasynth_core';

// Compile the application sources in memory; use the real SMF parser and a controlled clock.
function loadSource(file, globals = {}, imports = {}) {
  const cache = new Map();
  function load(filename) {
    filename = resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, TextDecoder, URLSearchParams, DOMException,
      console: { log() {}, error() {} }, setTimeout, clearTimeout,
      require(name) {
        if (name === 'spessasynth_core') return core;
        if (name in imports) return imports[name];
        if (name.startsWith('.')) return load(resolve(dirname(filename), name + '.ts'));
        throw new Error(`Unexpected dependency: ${name}`);
      },
      ...globals,
    });
    return module.exports;
  }
  return load(file);
}

function scheduler() {
  let now = 0, id = 0;
  const frames = new Map();
  return {
    globals: {
      performance: { now: () => now },
      requestAnimationFrame(fn) { frames.set(++id, fn); return id; },
      cancelAnimationFrame(id) { frames.delete(id); },
      AudioContext: class { constructor() { throw new Error('Web Audio must not be used'); } },
    },
    step(seconds) {
      now = seconds * 1000;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const fn of callbacks) fn(now);
    },
    frames,
  };
}

function recorder() {
  const notes = [], sections = [], resets = [];
  return {
    notes, sections, resets,
    handlers: {
      onNoteOn: (note, time) => notes.push(['on', note.channel, note.midiNote, note.velocity, time]),
      onNoteOff: (note, time) => notes.push(['off', note.channel, note.midiNote, time]),
      onSectionChange: section => sections.push(section),
      onTimeChange: time => resets.push(time),
    },
  };
}

function song() {
  const bytes = readFileSync(new URL('../public/assets/smf/When_the_Saints_Go_Marching_In--novo.mid', import.meta.url));
  return core.BasicMIDI.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

test('query defaults and explicit noaudio/autoplay settings', () => {
  const { readPlaybackOptions } = loadSource('src/playback_options.ts');
  for (const [query, player, autoplay] of [
    ['', 'audio', false], ['?player=noaudio&autoplay=1', 'noaudio', true],
    ['?player=audio&autoplay=1', 'audio', true], ['?player=noaudio&autoplay=0', 'noaudio', false],
    ['?player=unknown&autoplay=true', 'audio', false],
  ]) {
    const options = readPlaybackOptions(query);
    assert.equal(options.player, player); assert.equal(options.autoplay, autoplay);
  }
});

test('actual SMF notes, velocities, markers, pause, loop and disposal without Web Audio', async () => {
  const clock = scheduler(), log = recorder(), midi = song();
  const { NoAudioPlayback } = loadSource('src/noaudio_playback.ts', clock.globals);
  const player = new NoAudioPlayback(midi, log.handlers);
  assert.equal(player.paused, true); assert.equal(player.duration, 48);
  await player.play(); clock.step(47.99);
  const expected = midi.timeline.map(({tr, ev}) => midi.tracks[tr].events[ev]).flatMap(event => {
    const type = event.statusByte & 0xf0, channel = event.statusByte & 0xf, time = midi.midiTicksToSeconds(event.ticks);
    if (time > 47.99) return [];
    if (type === 0x90 && event.data[1] > 0) return [['on', channel, event.data[0], event.data[1], time]];
    if (type === 0x80 || type === 0x90 && event.data[1] === 0) return [['off', channel, event.data[0], time]];
    return [];
  });
  assert.deepEqual(log.notes, expected);
  assert.deepEqual(log.sections.map(s => s.section), ['intro', 'call', 'response', 'march', 'finale']);
  clock.step(48.25); assert.equal(player.currentTime, 0.25);
  assert.deepEqual(log.resets, [0]); assert.equal(log.sections.at(-1).section, 'intro');
  player.pause(); clock.step(60); assert.equal(player.currentTime, 0.25);
  await player.play(); clock.step(60.5); assert.equal(player.currentTime, 0.75);
  clock.step(204.5); assert.equal(player.currentTime, 0.75); // Three skipped loops.
  assert.deepEqual(log.resets, [0, 0]);
  await player.dispose(); await player.dispose(); assert.equal(clock.frames.size, 0);
  const count = log.notes.length; clock.step(205); await player.play(); assert.equal(log.notes.length, count);
});

test('tempo changes, velocity-zero note-off and exact event timestamps after a delayed frame', async () => {
  const midi = new core.MIDIBuilder({format: 0, timeDivision: 480, initialTempo: 120});
  midi.noteOn(0, 0, 0, 60, 100);
  midi.setTempo(480, 60);
  midi.noteOn(480, 0, 0, 64, 80);
  midi.noteOn(720, 0, 0, 60, 0);
  midi.noteOff(960, 0, 0, 64);
  midi.addEvent(1440, 0, 6, new TextEncoder().encode('LoopEnd'));
  midi.flush();
  const clock = scheduler(), log = recorder();
  const { NoAudioPlayback } = loadSource('src/noaudio_playback.ts', clock.globals);
  const player = new NoAudioPlayback(midi, log.handlers);
  await player.play(); clock.step(1.75);
  assert.deepEqual(log.notes, [
    ['on', 0, 60, 100, 0], ['on', 0, 64, 80, 0.5], ['off', 0, 60, 1], ['off', 0, 64, 1.5],
  ]);
  await player.dispose();
});

test('audio resume blocked: pending promise returns to Play wait without starting the sequencer', async () => {
  let timer, seq, audio, finishResume;
  class Events { addEvent() {} removeEvent() {} }
  class Synth {
    eventHandler = new Events(); soundBankManager = { addSoundBank: async () => {} };
    connect() {} disconnect() {} destroy() {} stopAll() {}
  }
  class Seq {
    paused = true; eventHandler = new Events(); currentTime = 0; currentHighResolutionTime = 0;
    duration = 48; plays = 0;
    constructor() { seq = this; }
    loadNewSongList() {} async getMIDI() { return song(); }
    play() { this.plays++; this.paused = false; } pause() { this.paused = true; }
  }
  class Audio {
    state = 'suspended'; audioWorklet = { addModule: async () => {} };
    constructor() { audio = this; }
    resume() { return new Promise(resolve => { finishResume = resolve; }); }
    async close() { this.state = 'closed'; }
  }
  const { createSpessaSynthPlaybackAsync } = loadSource('src/spessasynth_playback.ts', {
    AudioContext: Audio, fetch: async () => ({ok: true, arrayBuffer: async () => new ArrayBuffer(0)}),
    setTimeout(fn) { timer = fn; return 1; }, clearTimeout() {},
  }, {
    spessasynth_lib: {Sequencer: Seq, WorkletSynthesizer: Synth},
    'spessasynth_lib/dist/spessasynth_processor.min.js?url': {default: 'worklet.js'},
  });
  const playback = await createSpessaSynthPlaybackAsync(recorder().handlers);
  const started = playback.play(); timer();
  await assert.rejects(started, {name: 'NotAllowedError'});
  assert.equal(playback.paused, true); assert.equal(seq.plays, 0);
  finishResume(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(seq.plays, 0); // A late resume cannot start a rejected request.
  audio.resume = async () => { audio.state = 'running'; };
  await playback.play(); assert.equal(seq.plays, 1);
  await playback.dispose(); assert.equal(audio.state, 'closed');
});

test('UI can recover from autoplay refusal and disposes independently', async () => {
  const elements = new Map(), intervals = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      attrs: {}, listeners: new Map(), textContent: '', disabled: true,
      setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, v) { this.listeners.set(k, v); },
      removeEventListener(k) { this.listeners.delete(k); },
    });
    return elements.get(selector);
  }
  const { PlayerControls } = loadSource('src/player.ts', {
    document: {querySelector: element}, window: {setInterval(fn) { intervals.set(1, fn); return 1; }},
    clearInterval(id) { intervals.delete(id); },
  });
  const playback = {currentTime: 0, duration: 48, paused: true,
    async play() { throw new DOMException('Blocked', 'NotAllowedError'); }, pause() { this.paused = true; }};
  const controls = new PlayerControls(playback);
  await controls.tryAutoplay();
  assert.equal(element('#resume').disabled, false);
  assert.equal(element('#player-status').textContent, 'Press Play to start playback.');
  playback.play = async () => { playback.paused = false; };
  element('#resume').listeners.get('click')();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(element('#resume').textContent, 'Pause');
  controls.dispose(); assert.equal(intervals.size, 0); assert.equal(playback.paused, false);
});

test('noaudio loader fetches only the SMF, with no audio resources', async () => {
  const clock = scheduler(), log = recorder(), requests = [];
  const bytes = readFileSync(new URL('../public/assets/smf/When_the_Saints_Go_Marching_In--novo.mid', import.meta.url));
  const { createNoAudioPlaybackAsync } = loadSource('src/noaudio_playback.ts', {
    ...clock.globals,
    fetch: async url => {
      requests.push(url);
      return {ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)};
    },
  });
  const playback = await createNoAudioPlaybackAsync(log.handlers);
  assert.deepEqual(requests, ['./assets/smf/When_the_Saints_Go_Marching_In--novo.mid']);
  assert.equal(playback.paused, true);
  await playback.dispose();
});
