importScripts("trainer.js");

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type !== "train") {
    return;
  }

  const trainer = self.GomokuTrainer;
  const model = message.model;
  const samples = message.samples || [];
  const options = message.options || {};
  const epochs = Number(options.epochs) || 20;
  const history = [];

  try {
    for (let epoch = 1; epoch <= epochs; epoch++) {
      const metrics = trainer.trainEpoch(model, samples, options);
      const row = { epoch, ...metrics };
      history.push(row);
      if (epoch === 1 || epoch === epochs || epoch % 3 === 0) {
        self.postMessage({ type: "progress", metrics: row });
      }
    }
    const latest = history.at(-1) || { loss: 0, policyLoss: 0, valueLoss: 0, top1: 0, top3: 0, valueMae: 0 };
    model.metrics = {
      ...model.metrics,
      samples: samples.length,
      loss: latest.loss,
      policyLoss: latest.policyLoss,
      valueLoss: latest.valueLoss,
      top1: latest.top1,
      top3: latest.top3,
      valueMae: latest.valueMae,
      rating: Math.round((model.metrics?.rating || 1000) + latest.top3 * 90 + latest.top1 * 45 - latest.loss * 7 - latest.valueMae * 18),
    };
    self.postMessage({ type: "done", model, history, metrics: model.metrics });
  } catch (error) {
    self.postMessage({ type: "error", error: error?.message || String(error) });
  }
};
