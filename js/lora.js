const LoRA = (() => {

  const LORAS = {
    torzev: {
      name:        'FLUX.2_9b\\torzev.safetensors',
      trigger:     'torzev',
      label:       'TORZEV',
      strengthKey: 'loraStrength',
    },
    jmsmcbnntt: {
      name:        'FLUX.2_9b\\jmsmcbnntt.safetensors',
      trigger:     'jmsmcbnntt',
      label:       'JMSMCBNNTT',
      strengthKey: 'lora2Strength',
    },
  };

  function getActive()   { return Config.get().activeLora || 'torzev'; }
  function getConfig()   { return LORAS[getActive()] || LORAS.torzev; }
  function getTrigger()  { return getConfig().trigger; }
  function getName()     { return getConfig().name; }
  function getStrength() {
    const cfg = Config.get();
    return cfg[getConfig().strengthKey] ?? 1.0;
  }
  function setActive(key) { Config.set('activeLora', key); }

  function prependTrigger(prompt) {
    const trigger = getTrigger();
    if (prompt.trim().toLowerCase().startsWith(trigger.toLowerCase())) return prompt.trim();
    return `${trigger} ${prompt.trim()}`;
  }

  return { getTrigger, getStrength, getName, setActive, getActive, prependTrigger };
})();

window.LoRA = LoRA;