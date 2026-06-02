const ComfyUI = (() => {

  // ---- Deep copy workflow (avoid mutating original) ----
  function deepCopyWorkflow(workflow) {
    return JSON.parse(JSON.stringify(workflow));
  }

  // ---- Apply generation settings to workflow ----
  function patchWorkflow(workflow, genSettings, mode) {
    const defaults = {
      txt2img: { width: 1024, height: 1024, steps: 20, seed: 1, cfg: 5, loraStrength: 1, negativePrompt: '' },
      img2img: { width: 1024, height: 1024, steps: 20, seed: 1, cfg: 2.5, loraStrength: 0.5, negativePrompt: '' },
      multiimg: { width: 1024, height: 1024, steps: 20, seed: 1, cfg: 2.5, loraStrength: 1, negativePrompt: '' }
    };
    const modeDefaults = defaults[mode] || defaults.txt2img;
    const settings = { ...modeDefaults, ...genSettings };

    const patchedNodes = {};

    if (mode === 'txt2img') {
      // Text to Image patches
      workflow["709:668"].inputs.value = settings.seed;
      patchedNodes["709:668"] = { seed: settings.seed };

      workflow["709:669"].inputs.value = settings.steps;
      patchedNodes["709:669"] = { steps: settings.steps };

      workflow["709:670"].inputs.value = settings.width;
      patchedNodes["709:670"] = { width: settings.width };

      workflow["709:671"].inputs.value = settings.height;
      patchedNodes["709:671"] = { height: settings.height };

      workflow["709:675"].inputs.value = settings.cfg;
      patchedNodes["709:675"] = { cfg: settings.cfg };

      workflow["709:711"].inputs.strength_model = settings.loraStrength;
      workflow["709:711"].inputs.strength_clip = settings.loraStrength;
      patchedNodes["709:711"] = { strength_model: settings.loraStrength, strength_clip: settings.loraStrength };

      workflow["709:662"].inputs.text = settings.negativePrompt;
      patchedNodes["709:662"] = { negativePrompt: settings.negativePrompt };

    } else if (mode === 'img2img') {
      // Image to Image patches
      workflow["690:664"].inputs.value = settings.seed;
      patchedNodes["690:664"] = { seed: settings.seed };

      workflow["690:665"].inputs.value = settings.steps;
      patchedNodes["690:665"] = { steps: settings.steps };

      workflow["690:666"].inputs.value = settings.width;
      patchedNodes["690:666"] = { width: settings.width };

      workflow["690:667"].inputs.value = settings.height;
      patchedNodes["690:667"] = { height: settings.height };

      workflow["690:674"].inputs.value = settings.cfg;
      patchedNodes["690:674"] = { cfg: settings.cfg };

      workflow["690:686"].inputs.strength_model = settings.loraStrength;
      workflow["690:686"].inputs.strength_clip = settings.loraStrength;
      patchedNodes["690:686"] = { strength_model: settings.loraStrength, strength_clip: settings.loraStrength };

      workflow["698"].inputs.value = settings.negativePrompt;
      patchedNodes["698"] = { negativePrompt: settings.negativePrompt };

      workflow["691"].inputs.width = settings.width;
      workflow["691"].inputs.height = settings.height;
      patchedNodes["691"] = { resize_width: settings.width, resize_height: settings.height };

    } else if (mode === 'multiimg') {
      // Multi Reference patches
      workflow["577:353"].inputs.value = settings.seed;
      patchedNodes["577:353"] = { seed: settings.seed };

      workflow["577:354"].inputs.value = settings.steps;
      patchedNodes["577:354"] = { steps: settings.steps };

      workflow["577:355"].inputs.value = settings.width;
      patchedNodes["577:355"] = { width: settings.width };

      workflow["577:356"].inputs.value = settings.height;
      patchedNodes["577:356"] = { height: settings.height };

      workflow["577:553"].inputs.value = settings.cfg;
      patchedNodes["577:553"] = { cfg: settings.cfg };

      workflow["577:583"].inputs.strength_model = settings.loraStrength;
      workflow["577:583"].inputs.strength_clip = settings.loraStrength;
      patchedNodes["577:583"] = { strength_model: settings.loraStrength, strength_clip: settings.loraStrength };

      workflow["577:410"].inputs.text = settings.negativePrompt;
      patchedNodes["577:410"] = { negativePrompt: settings.negativePrompt };

      workflow["581"].inputs.width = settings.width;
      workflow["581"].inputs.height = settings.height;
      patchedNodes["581"] = { resize_width: settings.width, resize_height: settings.height };

      workflow["582"].inputs.width = settings.width;
      workflow["582"].inputs.height = settings.height;
      patchedNodes["582"] = { resize_width: settings.width, resize_height: settings.height };
    }

    console.log('[ComfyUI] Generation Settings:', settings);
    console.log('[ComfyUI] Patched Nodes:', patchedNodes);

    return workflow;
  }

  async function loadWorkflow(filename) {
    const resp = await fetch(`./workflows/${filename}`);
    if (!resp.ok) throw new Error(`Could not load ${filename}`);
    return resp.json();
  }

  // ---- Upload image to ComfyUI ----
  async function uploadImage(imageUrl, baseUrl) {
    const resp = await fetch(imageUrl);
    if (!resp.ok) throw new Error(`Failed to fetch image: ${imageUrl}`);
    const blob = await resp.blob();
    const filename = `flatdream_${Date.now()}.png`;
    const formData = new FormData();
    formData.append('image', blob, filename);
    formData.append('type', 'input');
    formData.append('overwrite', 'true');
    const uploadResp = await fetch(`${baseUrl}/upload/image`, {
      method: 'POST',
      body: formData
    });
    if (!uploadResp.ok) throw new Error(`Upload failed: ${uploadResp.status}`);
    return (await uploadResp.json()).name;
  }

  // ---- Queue prompt ----
  async function queuePrompt(workflow, baseUrl) {
    const resp = await fetch(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow })
    });
    if (!resp.ok) throw new Error(`ComfyUI queue error: ${resp.status}`);
    return (await resp.json()).prompt_id;
  }

  // ---- Poll for image result ----
  async function pollForImage(promptId, baseUrl, onProgress) {
    const MAX_POLLS = 300;
    let polls = 0;
    while (polls < MAX_POLLS) {
      await new Promise(r => setTimeout(r, 1000));
      polls++;
      try {
        const resp = await fetch(`${baseUrl}/history/${promptId}`);
        if (!resp.ok) continue;
        const history = await resp.json();
        if (history[promptId]) {
          const outputs = history[promptId].outputs;
          for (const nodeId in outputs) {
            const node = outputs[nodeId];
            if (node.images && node.images.length > 0) {
              const img = node.images[0];
              if (onProgress) onProgress(100);
              return `${baseUrl}/view?filename=${encodeURIComponent(img.filename)}&type=${img.type}&subfolder=${img.subfolder || ''}`;
            }
          }
        }
      } catch (e) { console.warn('Poll error:', e); }
      if (onProgress) onProgress(Math.min(90, (polls / 30) * 100));
    }
    throw new Error('ComfyUI timed out.');
  }

  // ---- Poll for 3D GLB result ----
  async function pollFor3D(promptId, baseUrl, onProgress) {
    const MAX_POLLS = 600;
    let polls = 0;
    while (polls < MAX_POLLS) {
      await new Promise(r => setTimeout(r, 2000));
      polls++;
      try {
        const resp = await fetch(`${baseUrl}/history/${promptId}`);
        if (!resp.ok) continue;
        const history = await resp.json();
        console.log('Looking for promptId:', promptId);
        console.log('History keys:', Object.keys(history));
        console.log('Match found:', !!history[promptId]);
        if (history[promptId]) {
          const outputs = history[promptId].outputs;
          for (const nodeId in outputs) {
            const node = outputs[nodeId];

            // Check for GLB in result array (TRELLIS2 format)
            if (node.result && node.result.length > 0 && node.result[0]) {
              const fullPath = node.result[0];
              const filename = fullPath.split('\\').pop().split('/').pop();
              if (onProgress) onProgress(100);
              return `${baseUrl}/view?filename=${encodeURIComponent(filename)}&type=output&subfolder=`;
            }

            // Fallback: check for gltf key
            if (node.gltf && node.gltf.length > 0) {
              const file = node.gltf[0];
              if (onProgress) onProgress(100);
              return `${baseUrl}/view?filename=${encodeURIComponent(file.filename)}&type=${file.type}&subfolder=${file.subfolder || ''}`;
            }
          }
        }
      } catch (e) { console.warn('3D Poll error:', e); }
      if (onProgress) onProgress(Math.min(90, (polls / 60) * 100));
    }
    throw new Error('ComfyUI3D timed out.');
  }

  // ---- TEXT TO IMAGE ----
  async function textToImage(prompt, genSettings, onProgress) {
    const cfg = Config.get();
    const originalWorkflow = await loadWorkflow('text to image.json');
    const workflow = deepCopyWorkflow(originalWorkflow);

    const fullPrompt = `${cfg.loraTrigger} ${prompt}`;
    workflow["710"].inputs.value = fullPrompt;
    workflow["709:711"].inputs.lora_name = cfg.loraName;

    patchWorkflow(workflow, genSettings, 'txt2img');

    const promptId = await queuePrompt(workflow, cfg.comfyUrl);
    return await pollForImage(promptId, cfg.comfyUrl, onProgress);
  }

  // ---- IMAGE TO IMAGE ----
  async function imageToImage(prompt, imageUrl, genSettings, onProgress) {
    const cfg = Config.get();
    const originalWorkflow = await loadWorkflow('image to image.json');
    const workflow = deepCopyWorkflow(originalWorkflow);

    const filename = await uploadImage(imageUrl, cfg.comfyUrl);
    const fullPrompt = `${cfg.loraTrigger} ${prompt}`;

    workflow["693"].inputs.value = fullPrompt;
    workflow["694"].inputs.image = filename;
    workflow["690:686"].inputs.lora_name = cfg.loraName;

    patchWorkflow(workflow, genSettings, 'img2img');

    const promptId = await queuePrompt(workflow, cfg.comfyUrl);
    return await pollForImage(promptId, cfg.comfyUrl, onProgress);
  }

  // ---- MULTI IMAGE ----
  async function multiImage(prompt, image1Url, image2Url, genSettings, onProgress) {
    const cfg = Config.get();
    const originalWorkflow = await loadWorkflow('multiimage.json');
    const workflow = deepCopyWorkflow(originalWorkflow);

    const filename1 = await uploadImage(image1Url, cfg.comfyUrl);
    const filename2 = await uploadImage(image2Url, cfg.comfyUrl);
    const fullPrompt = `${cfg.loraTrigger} ${prompt}`;

    workflow["579"].inputs.value = fullPrompt;
    workflow["578"].inputs.image = filename1;
    workflow["580"].inputs.image = filename2;
    workflow["577:583"].inputs.lora_name = cfg.loraName;

    patchWorkflow(workflow, genSettings, 'multiimg');

    const promptId = await queuePrompt(workflow, cfg.comfyUrl);
    return await pollForImage(promptId, cfg.comfyUrl, onProgress);
  }

  // ---- IMAGE TO 3D ----
  async function imageTo3D(imageUrl, onProgress) {
    const cfg = Config.get();
    console.log('imageTo3D called, comfy3dUrl:', cfg.comfy3dUrl);
    const workflow = await loadWorkflow('3D.json');
    console.log('Workflow loaded');

    const filename = await uploadImage(imageUrl, cfg.comfy3dUrl);
    console.log('Image uploaded as:', filename);

    workflow["85"].inputs.image = filename;
    workflow["73"].inputs.seed = Math.floor(Math.random() * 99999);
    workflow["75"].inputs.seed = Math.floor(Math.random() * 99999);

    const promptId = await queuePrompt(workflow, cfg.comfy3dUrl);
    console.log('Prompt queued with ID:', promptId);

    return await pollFor3D(promptId, cfg.comfy3dUrl, onProgress);
  }

  // ---- PING ----
  async function ping(url) {
    try {
      const resp = await fetch(`${url}/system_stats`, {
        signal: AbortSignal.timeout(3000)
      });
      return resp.ok;
    } catch { return false; }
  }

  return { textToImage, imageToImage, multiImage, imageTo3D, ping };
})();