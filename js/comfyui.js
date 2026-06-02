const ComfyUI = (() => {

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
  async function textToImage(prompt, onProgress) {
    const cfg = Config.get();
    const workflow = await loadWorkflow('text to image.json');

    const fullPrompt = `${cfg.loraTrigger} ${prompt}`;
    workflow["710"].inputs.value = fullPrompt;
    workflow["709:668"].inputs.value = Math.floor(Math.random() * 2 ** 32);
    workflow["709:669"].inputs.value = cfg.fluxSteps;
    workflow["709:670"].inputs.value = cfg.imgWidth;
    workflow["709:671"].inputs.value = cfg.imgHeight;
    workflow["709:675"].inputs.value = cfg.fluxCfg;
    workflow["709:711"].inputs.lora_name = cfg.loraName;
    workflow["709:711"].inputs.strength_model = cfg.loraStrength;
    workflow["709:711"].inputs.strength_clip = cfg.loraStrength;

    const promptId = await queuePrompt(workflow, cfg.comfyUrl);
    return await pollForImage(promptId, cfg.comfyUrl, onProgress);
  }

  // ---- IMAGE TO IMAGE ----
  async function imageToImage(prompt, imageUrl, onProgress) {
    const cfg = Config.get();
    const workflow = await loadWorkflow('image to image.json');

    const filename = await uploadImage(imageUrl, cfg.comfyUrl);
    const fullPrompt = `${cfg.loraTrigger} ${prompt}`;

    workflow["693"].inputs.value = fullPrompt;
    workflow["694"].inputs.image = filename;
    workflow["690:664"].inputs.value = Math.floor(Math.random() * 2 ** 32);
    workflow["690:665"].inputs.value = cfg.fluxSteps;
    workflow["690:666"].inputs.value = cfg.imgWidth;
    workflow["690:667"].inputs.value = cfg.imgHeight;
    workflow["690:674"].inputs.value = cfg.fluxCfg;
    workflow["690:686"].inputs.lora_name = cfg.loraName;
    workflow["690:686"].inputs.strength_model = cfg.loraStrength;
    workflow["690:686"].inputs.strength_clip = cfg.loraStrength;

    const promptId = await queuePrompt(workflow, cfg.comfyUrl);
    return await pollForImage(promptId, cfg.comfyUrl, onProgress);
  }

  // ---- MULTI IMAGE ----
  async function multiImage(prompt, image1Url, image2Url, onProgress) {
    const cfg = Config.get();
    const workflow = await loadWorkflow('multiimage.json');

    const filename1 = await uploadImage(image1Url, cfg.comfyUrl);
    const filename2 = await uploadImage(image2Url, cfg.comfyUrl);
    const fullPrompt = `${cfg.loraTrigger} ${prompt}`;

    workflow["579"].inputs.value = fullPrompt;
    workflow["578"].inputs.image = filename1;
    workflow["580"].inputs.image = filename2;
    workflow["577:353"].inputs.value = Math.floor(Math.random() * 2 ** 32);
    workflow["577:354"].inputs.value = cfg.fluxSteps;
    workflow["577:355"].inputs.value = cfg.imgWidth;
    workflow["577:356"].inputs.value = cfg.imgHeight;
    workflow["577:553"].inputs.value = cfg.fluxCfg;
    workflow["577:583"].inputs.lora_name = cfg.loraName;
    workflow["577:583"].inputs.strength_model = cfg.loraStrength;
    workflow["577:583"].inputs.strength_clip = cfg.loraStrength;

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