const LoRA = (() => {

  function getTrigger() {
    return Config.get().loraTrigger || 'torzev';
  }

  function getStrength() {
    return Config.get().loraStrength || 1.0;
  }

  function getName() {
    return Config.get().loraName || 'FLUX.2_9b\\torzev.safetensors';
  }

  function prependTrigger(prompt) {
    const trigger = getTrigger();
    if (prompt.trim().toLowerCase().startsWith(trigger.toLowerCase())) {
      return prompt.trim();
    }
    return `${trigger} ${prompt.trim()}`;
  }

  return { getTrigger, getStrength, getName, prependTrigger };
})();