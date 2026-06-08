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

// ============================================================
// SKETCH → FLUX.2 INPAINTING WITH SAM3 MASK PROMPT
// Uses workflows/Inpainting_LoRa.json
// ============================================================

if (typeof ComfyUI !== 'undefined') {
  ComfyUI.sketchInpaintSam = async function (
    prompt,
    samPrompt,
    flattenedImageDataUrl,
    settings = {},
    onProgress
  ) {
    const cfg = Config.get();
    const comfyUrl = cfg.comfyUrl;

    if (!comfyUrl) {
      throw new Error('ComfyUI URL is missing in Config.');
    }

    if (!flattenedImageDataUrl) {
      throw new Error('Missing flattened sketch image.');
    }

    if (typeof onProgress === 'function') onProgress(5);

    // 1. Upload flattened sketch image to ComfyUI
    const uploadedImageName = await uploadDataUrlToComfy(
      comfyUrl,
      flattenedImageDataUrl,
      `flatdream_sketch_inpaint_${Date.now()}.png`
    );

    if (typeof onProgress === 'function') onProgress(15);

    // 2. Load the workflow JSON
    const workflowResp = await fetch('./workflows/Inpainting_LoRa.json');

    if (!workflowResp.ok) {
      throw new Error('Could not load workflows/Inpainting_LoRa.json');
    }

    const workflow = await workflowResp.json();

    // 3. Patch workflow inputs

    // Input image node
    if (workflow['1060']) {
      workflow['1060'].inputs.image = uploadedImageName;
    } else {
      throw new Error('Workflow node 1060 Load Image was not found.');
    }

    // Main generation prompt
    if (workflow['1057']) {
      workflow['1057'].inputs.value = prompt || '';
    } else {
      throw new Error('Workflow node 1057 Main Prompt was not found.');
    }

    // SAM3 mask prompt
    if (workflow['1063']) {
      workflow['1063'].inputs.value = samPrompt || 'blue sketch lines';
    } else {
      throw new Error('Workflow node 1063 SAM Mask Prompt was not found.');
    }

    // Negative prompt
    if (workflow['1024:636']) {
      workflow['1024:636'].inputs.text = settings.negativePrompt || '';
    }

    // Seed
    if (workflow['1024:642']) {
      const seed =
        settings.seed === -1 || settings.seed === undefined || Number.isNaN(settings.seed)
          ? Math.floor(Math.random() * 99999999999999)
          : settings.seed;

      workflow['1024:642'].inputs.value = seed;
    }

    // Steps
    if (workflow['1024:643']) {
      workflow['1024:643'].inputs.value = settings.steps || 20;
    }

    // CFG
    if (workflow['1024:649']) {
      workflow['1024:649'].inputs.value = settings.cfg || 2.5;
    }

    // LoRA strength
    if (workflow['1024:1164']) {
      const loraStrength =
        settings.loraStrength !== undefined ? settings.loraStrength : 1.0;

      workflow['1024:1164'].inputs.strength_model = loraStrength;
      workflow['1024:1164'].inputs.strength_clip = loraStrength;
    }

    // Save image prefix
    if (workflow['1058']) {
      workflow['1058'].inputs.filename_prefix = `flatdream_sketch_inpaint_${Date.now()}`;
    }

    if (typeof onProgress === 'function') onProgress(25);

    // 4. Queue workflow
    const queueResp = await fetch(`${comfyUrl}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!queueResp.ok) {
      const errText = await queueResp.text();
      throw new Error(`ComfyUI queue failed: ${queueResp.status} ${errText}`);
    }

    const queueData = await queueResp.json();
    const promptId = queueData.prompt_id;

    if (!promptId) {
      throw new Error('ComfyUI did not return a prompt_id.');
    }

    if (typeof onProgress === 'function') onProgress(35);

    // 5. Poll history until output is ready
    const outputUrl = await waitForComfyImageOutput(
      comfyUrl,
      promptId,
      onProgress
    );

    if (!outputUrl) {
      throw new Error('No output image found from Sketch inpainting workflow.');
    }

    if (typeof onProgress === 'function') onProgress(100);

    return outputUrl;
  };
}

// Upload data URL image to ComfyUI /upload/image
async function uploadDataUrlToComfy(comfyUrl, dataUrl, filename) {
  const blob = await fetch(dataUrl).then(r => r.blob());

  const formData = new FormData();
  formData.append('image', blob, filename);
  formData.append('type', 'input');
  formData.append('overwrite', 'true');

  const uploadResp = await fetch(`${comfyUrl}/upload/image`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResp.ok) {
    const errText = await uploadResp.text();
    throw new Error(`Image upload failed: ${uploadResp.status} ${errText}`);
  }

  const uploadData = await uploadResp.json();

  if (!uploadData.name) {
    throw new Error('ComfyUI upload did not return an image name.');
  }

  return uploadData.name;
}

// Wait for ComfyUI history and return the first generated image URL
async function waitForComfyImageOutput(comfyUrl, promptId, onProgress) {
  for (let i = 0; i < 300; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (typeof onProgress === 'function') {
      const pct = Math.min(95, 35 + i * 0.5);
      onProgress(pct);
    }

    const histResp = await fetch(`${comfyUrl}/history/${promptId}`);

    if (!histResp.ok) {
      continue;
    }

    const hist = await histResp.json();
    const job = hist[promptId];

    if (!job) continue;

    if (job.status && job.status.completed) {
      const outputUrl = findFirstImageUrlFromComfyOutputs(comfyUrl, job.outputs);

      if (outputUrl) {
        return outputUrl;
      }

      throw new Error('Workflow completed, but no output image was found.');
    }

    if (job.status && job.status.status_str === 'error') {
      throw new Error('ComfyUI workflow failed.');
    }
  }

  throw new Error('Timed out waiting for ComfyUI output.');
}

// Find first image from ComfyUI history outputs
function findFirstImageUrlFromComfyOutputs(comfyUrl, outputs) {
  if (!outputs) return null;

  for (const nodeId in outputs) {
    const node = outputs[nodeId];

    if (!node) continue;

    const imageList = [];

    if (Array.isArray(node.images)) {
      imageList.push(...node.images);
    }

    if (Array.isArray(node.gifs)) {
      imageList.push(...node.gifs);
    }

    for (const img of imageList) {
      if (!img) continue;

      const filename = img.filename;
      const subfolder = img.subfolder || '';
      const type = img.type || 'output';

      if (!filename) continue;

      return `${comfyUrl}/view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}&subfolder=${encodeURIComponent(subfolder)}`;
    }
  }

  return null;
}