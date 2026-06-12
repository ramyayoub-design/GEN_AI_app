const Config = (() => {
  const DEFAULTS = {
    comfyUrl:     'http://127.0.0.1:8188',
    comfy3dUrl:   'http://127.0.0.1:8189',
    lmUrl:        'http://127.0.0.1:1234',
    lmModel:      'mistralai/mistral-7b-instruct-v0.3',
    lmTemp:       0.8,
    fluxModel:    'flux-2-klein-base-9b-fp8.safetensors',
    clipModel:    'qwen_3_8b_fp8mixed.safetensors',
    vaeModel:     'flux2-vae.safetensors',
    loraName:     'FLUX.2_9b\\torzev.safetensors',
    loraTrigger:  'torzev',
    loraStrength: 1.0,
    lora2Name:     'FLUX.2_9b\\jmsmcbnntt.safetensors',
    lora2Trigger:  'jmsmcbnntt',
    lora2Strength: 1.0,
    activeLora:    'torzev',
    fluxSteps:    20,
    fluxCfg:      5,
    imgWidth:     1024,
    imgHeight:    1024,
  };

  function load() {
    try {
      const stored = localStorage.getItem('flatdream_config');
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : { ...DEFAULTS };
    } catch { return { ...DEFAULTS }; }
  }

  function save(cfg) {
    localStorage.setItem('flatdream_config', JSON.stringify(cfg));
  }

  function get() { return load(); }
  function set(key, val) { const cfg = load(); cfg[key] = val; save(cfg); }
  function setAll(obj) { save({ ...load(), ...obj }); }
  function reset() { localStorage.removeItem('flatdream_config'); }

  return { get, set, setAll, reset, DEFAULTS };
})();