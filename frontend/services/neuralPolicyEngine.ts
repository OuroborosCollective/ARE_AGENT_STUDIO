
/**
 * Real In-Browser Deterministic Neural Policy Engine.
 * Direct implementation of forward and backward backpropagation with real matrix mathematics,
 * AdamW adaptive momentum updates, visual pixel-luminance spatial pooling, and real trajectory curve generation.
 */
export class NeuralPolicyEngine {
  public inputDim = 16;
  public hidden1Dim = 32;
  public hidden2Dim = 16;
  public outputDim = 4;

  // Real Weight & Bias Tensors
  public W1!: number[][];
  public b1!: number[];
  public W2!: number[][];
  public b2!: number[];
  public W3!: number[][];
  public b3!: number[];

  // AdamW Optimizer State Tensors (1st & 2nd moment vectors)
  private mW1!: number[][];
  private vW1!: number[][];
  private mW2!: number[][];
  private vW2!: number[][];
  private mW3!: number[][];
  private vW3!: number[][];
  private beta1 = 0.9;
  private beta2 = 0.999;
  private epsilon = 1e-8;
  private weightDecay = 1e-4;

  public learningRate = 0.01;
  public totalTrainedBatches = 0;
  private readonly STORAGE_KEY = 'are_agent_studio_neural_policy_weights_v1';
  public seed: string;
  private random: () => number;
  private persistWeights: boolean;

  constructor(seed = 'are-agent-studio-policy-v1', persistWeights = true) {
    this.seed = seed;
    this.random = this.createSeededRandom(seed);
    this.persistWeights = persistWeights;
    this.initializeParameters();

    if (this.persistWeights) this.loadFromLocalStorage();
  }

  private initializeParameters(): void {
    this.W1 = this.initHeMatrix(this.hidden1Dim, this.inputDim);
    this.b1 = new Array(this.hidden1Dim).fill(0.01);
    this.W2 = this.initHeMatrix(this.hidden2Dim, this.hidden1Dim);
    this.b2 = new Array(this.hidden2Dim).fill(0.01);
    this.W3 = this.initHeMatrix(this.outputDim, this.hidden2Dim);
    this.b3 = new Array(this.outputDim).fill(0.01);

    // Init optimizer moments
    this.mW1 = this.zerosMatrix(this.hidden1Dim, this.inputDim);
    this.vW1 = this.zerosMatrix(this.hidden1Dim, this.inputDim);
    this.mW2 = this.zerosMatrix(this.hidden2Dim, this.hidden1Dim);
    this.vW2 = this.zerosMatrix(this.hidden2Dim, this.hidden1Dim);
    this.mW3 = this.zerosMatrix(this.outputDim, this.hidden2Dim);
    this.vW3 = this.zerosMatrix(this.outputDim, this.hidden2Dim);
    this.totalTrainedBatches = 0;
  }

  /**
   * Starts a clean deterministic policy for a new local project run. The
   * caller owns durable checkpoints; streams and credentials are never part
   * of a policy reset.
   */
  public reset(seed = this.seed): void {
    this.seed = seed;
    this.random = this.createSeededRandom(seed);
    this.initializeParameters();
  }

  private createSeededRandom(seed: string): () => number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let state = h >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private initHeMatrix(rows: number, cols: number): number[][] {
    const std = Math.sqrt(2.0 / cols);
    const mat: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        // Box-Muller Gaussian sample
        const u1 = Math.max(1e-7, this.random());
        const u2 = this.random();
        const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        row.push(randStdNormal * std);
      }
      mat.push(row);
    }
    return mat;
  }

  private zerosMatrix(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () => new Array(cols).fill(0));
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
  }

  private relu(x: number): number {
    return Math.max(0, x);
  }

  /**
   * Real spatial luminance feature extractor directly from 2D Canvas ImageData buffer.
   * Partitions canvas into 4x4 spatial quadrants (16 cells) and calculates average pixel intensity.
   */
  public extractVisualFeaturesFromImageData(imageData: ImageData): number[] {
    const { width, height, data } = imageData;
    const gridCols = 4;
    const gridRows = 4;
    const cellW = Math.floor(width / gridCols);
    const cellH = Math.floor(height / gridRows);
    const features: number[] = [];

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        let intensitySum = 0;
        let count = 0;
        const startX = c * cellW;
        const startY = r * cellH;

        // Sample pixels with step 4 for performance
        for (let y = startY; y < startY + cellH; y += 4) {
          for (let x = startX; x < startX + cellW; x += 4) {
            const idx = (y * width + x) * 4;
            const rVal = data[idx];
            const gVal = data[idx + 1];
            const bVal = data[idx + 2];
            // Standard perceptual luminance
            const lum = (0.299 * rVal + 0.587 * gVal + 0.114 * bVal) / 255.0;
            intensitySum += lum;
            count++;
          }
        }
        features.push(count > 0 ? intensitySum / count : 0.5);
      }
    }
    return features;
  }

  /**
   * Structured feature vector extractor when raw canvas pixels are paired with metadata
   */
  public extractStructuredFeatures(
    heroX: number,
    heroY: number,
    enemyCount: number,
    hpRatio: number,
    manaRatio: number,
    phaseCode: number
  ): number[] {
    return [
      Math.max(0, Math.min(1, heroX)),
      Math.max(0, Math.min(1, heroY)),
      Math.sin(heroX * Math.PI),
      Math.cos(heroY * Math.PI),
      Math.max(0, Math.min(1, hpRatio)),
      Math.max(0, Math.min(1, manaRatio)),
      Math.max(0, Math.min(1, enemyCount / 5.0)),
      Math.max(0, Math.min(1, phaseCode / 5.0)),
      heroX * hpRatio,
      heroY * manaRatio,
      1.0 - hpRatio,
      heroX > 0.5 ? 1.0 : 0.0,
      heroY > 0.5 ? 1.0 : 0.0,
      enemyCount > 0 ? 1.0 : 0.0,
      Math.sqrt(heroX * heroX + heroY * heroY) / 1.414,
      1.0, // Bias feature
    ];
  }

  /**
   * Real forward pass computing dot-products across dense layers
   */
  public forward(features: number[]): {
    prediction: [number, number, number, number];
    h1: number[];
    h2: number[];
  } {
    // Hidden Layer 1 (ReLU)
    const h1: number[] = new Array(this.hidden1Dim);
    for (let i = 0; i < this.hidden1Dim; i++) {
      let sum = this.b1[i];
      for (let j = 0; j < this.inputDim; j++) {
        sum += this.W1[i][j] * (features[j] ?? 0.5);
      }
      h1[i] = this.relu(sum);
    }

    // Hidden Layer 2 (ReLU)
    const h2: number[] = new Array(this.hidden2Dim);
    for (let i = 0; i < this.hidden2Dim; i++) {
      let sum = this.b2[i];
      for (let j = 0; j < this.hidden1Dim; j++) {
        sum += this.W2[i][j] * h1[j];
      }
      h2[i] = this.relu(sum);
    }

    // Output Layer (Sigmoid normalized to [0.0, 1.0])
    const out: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < this.outputDim; i++) {
      let sum = this.b3[i];
      for (let j = 0; j < this.hidden2Dim; j++) {
        sum += this.W3[i][j] * h2[j];
      }
      out[i] = this.sigmoid(sum);
    }

    return { prediction: out, h1, h2 };
  }

  /**
   * Real backpropagation using AdamW optimizer with momentum & L2 weight decay
   */
  public trainStep(
    features: number[],
    targetAction: [number, number, number, number] // [x, y, pressure, is_touch]
  ): { loss: number; coordMse: number; bceLoss: number } {
    const { prediction, h1, h2 } = this.forward(features);

    // MSE Loss on continuous coordinates [x, y, pressure]
    const errX = prediction[0] - targetAction[0];
    const errY = prediction[1] - targetAction[1];
    const errP = prediction[2] - targetAction[2];
    const coordMse = 0.5 * (errX * errX + errY * errY + errP * errP);

    // Binary Cross Entropy Loss on touch active flag
    const p = Math.max(1e-7, Math.min(1 - 1e-7, prediction[3]));
    const t = targetAction[3];
    const bceLoss = -(t * Math.log(p) + (1 - t) * Math.log(1 - p));

    const totalLoss = coordMse + 0.5 * bceLoss;

    // Output Layer Gradients
    const dOut: number[] = [
      errX * prediction[0] * (1 - prediction[0]),
      errY * prediction[1] * (1 - prediction[1]),
      errP * prediction[2] * (1 - prediction[2]),
      (p - t) * 0.5,
    ];

    const tBatch = this.totalTrainedBatches + 1;
    const lr_t = this.learningRate * (Math.sqrt(1 - Math.pow(this.beta2, tBatch)) / (1 - Math.pow(this.beta1, tBatch)));

    // Update W3, b3 with AdamW
    for (let i = 0; i < this.outputDim; i++) {
      this.b3[i] -= this.learningRate * dOut[i];
      for (let j = 0; j < this.hidden2Dim; j++) {
        const grad = dOut[i] * h2[j] + this.weightDecay * this.W3[i][j];
        this.mW3[i][j] = this.beta1 * this.mW3[i][j] + (1 - this.beta1) * grad;
        this.vW3[i][j] = this.beta2 * this.vW3[i][j] + (1 - this.beta2) * grad * grad;
        this.W3[i][j] -= lr_t * (this.mW3[i][j] / (Math.sqrt(this.vW3[i][j]) + this.epsilon));
      }
    }

    // Gradients for Hidden Layer 2
    const dH2: number[] = new Array(this.hidden2Dim).fill(0);
    for (let j = 0; j < this.hidden2Dim; j++) {
      let sum = 0;
      for (let i = 0; i < this.outputDim; i++) {
        sum += dOut[i] * this.W3[i][j];
      }
      dH2[j] = h2[j] > 0 ? sum : 0;
    }

    // Update W2, b2 with AdamW
    for (let i = 0; i < this.hidden2Dim; i++) {
      this.b2[i] -= this.learningRate * dH2[i];
      for (let j = 0; j < this.hidden1Dim; j++) {
        const grad = dH2[i] * h1[j] + this.weightDecay * this.W2[i][j];
        this.mW2[i][j] = this.beta1 * this.mW2[i][j] + (1 - this.beta1) * grad;
        this.vW2[i][j] = this.beta2 * this.vW2[i][j] + (1 - this.beta2) * grad * grad;
        this.W2[i][j] -= lr_t * (this.mW2[i][j] / (Math.sqrt(this.vW2[i][j]) + this.epsilon));
      }
    }

    // Gradients for Hidden Layer 1
    const dH1: number[] = new Array(this.hidden1Dim).fill(0);
    for (let j = 0; j < this.hidden1Dim; j++) {
      let sum = 0;
      for (let i = 0; i < this.hidden2Dim; i++) {
        sum += dH2[i] * this.W2[i][j];
      }
      dH1[j] = h1[j] > 0 ? sum : 0;
    }

    // Update W1, b1 with AdamW
    for (let i = 0; i < this.hidden1Dim; i++) {
      this.b1[i] -= this.learningRate * dH1[i];
      for (let j = 0; j < this.inputDim; j++) {
        const featVal = features[j] ?? 0.5;
        const grad = dH1[i] * featVal + this.weightDecay * this.W1[i][j];
        this.mW1[i][j] = this.beta1 * this.mW1[i][j] + (1 - this.beta1) * grad;
        this.vW1[i][j] = this.beta2 * this.vW1[i][j] + (1 - this.beta2) * grad * grad;
        this.W1[i][j] -= lr_t * (this.mW1[i][j] / (Math.sqrt(this.vW1[i][j]) + this.epsilon));
      }
    }

    this.totalTrainedBatches++;
    if (this.persistWeights && this.totalTrainedBatches % 50 === 0) {
      this.saveToLocalStorage();
    }

    return { loss: totalLoss, coordMse, bceLoss };
  }

  /**
   * Action Chunking Trajectory Predictor: computes a smooth 6-point bezier touch path
   */
  public generateTrajectory(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    horizon: number = 6
  ): { x: number; y: number }[] {
    const trajectory: { x: number; y: number }[] = [];
    for (let step = 1; step <= horizon; step++) {
      const t = step / horizon;
      const easeT = t * t * (3 - 2 * t);
      const intermediateX = startX + (targetX - startX) * easeT;
      const intermediateY = startY + (targetY - startY) * easeT;
      trajectory.push({
        x: Math.max(0.05, Math.min(0.95, intermediateX)),
        y: Math.max(0.05, Math.min(0.95, intermediateY)),
      });
    }
    return trajectory;
  }

  public saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, this.exportWeightsJSON());
    } catch {
      // ignore
    }
  }

  public loadFromLocalStorage(): boolean {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        return this.loadWeightsJSON(data);
      }
    } catch {
      // ignore
    }
    return false;
  }

  public exportWeightsJSON(): string {
    return JSON.stringify({
      W1: this.W1,
      b1: this.b1,
      W2: this.W2,
      b2: this.b2,
      W3: this.W3,
      b3: this.b3,
      mW1: this.mW1,
      vW1: this.vW1,
      mW2: this.mW2,
      vW2: this.vW2,
      mW3: this.mW3,
      vW3: this.vW3,
      architecture: [this.inputDim, this.hidden1Dim, this.hidden2Dim, this.outputDim],
      seed: this.seed,
      totalTrainedBatches: this.totalTrainedBatches,
      learningRate: this.learningRate,
    });
  }

  private isFiniteVector(value: unknown, length: number): value is number[] {
    return Array.isArray(value) && value.length === length && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
  }

  private isFiniteMatrix(value: unknown, rows: number, cols: number): value is number[][] {
    return Array.isArray(value) && value.length === rows && value.every((row) => this.isFiniteVector(row, cols));
  }

  public loadWeightsJSON(jsonStr: string): boolean {
    try {
      const obj = JSON.parse(jsonStr);
      const validWeights = this.isFiniteMatrix(obj.W1, this.hidden1Dim, this.inputDim)
        && this.isFiniteVector(obj.b1, this.hidden1Dim)
        && this.isFiniteMatrix(obj.W2, this.hidden2Dim, this.hidden1Dim)
        && this.isFiniteVector(obj.b2, this.hidden2Dim)
        && this.isFiniteMatrix(obj.W3, this.outputDim, this.hidden2Dim)
        && this.isFiniteVector(obj.b3, this.outputDim);
      if (validWeights) {
        this.W1 = obj.W1;
        this.b1 = obj.b1;
        this.W2 = obj.W2;
        this.b2 = obj.b2;
        this.W3 = obj.W3;
        this.b3 = obj.b3;
        if (typeof obj.seed === 'string' && obj.seed) this.seed = obj.seed;
        this.totalTrainedBatches = Number.isSafeInteger(obj.totalTrainedBatches) && obj.totalTrainedBatches >= 0 ? obj.totalTrainedBatches : 0;
        this.learningRate = typeof obj.learningRate === 'number' && Number.isFinite(obj.learningRate) && obj.learningRate > 0 ? obj.learningRate : this.learningRate;
        // Older exported checkpoints did not contain optimizer state. They
        // remain loadable, with clean moments rather than invented values.
        this.mW1 = this.isFiniteMatrix(obj.mW1, this.hidden1Dim, this.inputDim) ? obj.mW1 : this.zerosMatrix(this.hidden1Dim, this.inputDim);
        this.vW1 = this.isFiniteMatrix(obj.vW1, this.hidden1Dim, this.inputDim) ? obj.vW1 : this.zerosMatrix(this.hidden1Dim, this.inputDim);
        this.mW2 = this.isFiniteMatrix(obj.mW2, this.hidden2Dim, this.hidden1Dim) ? obj.mW2 : this.zerosMatrix(this.hidden2Dim, this.hidden1Dim);
        this.vW2 = this.isFiniteMatrix(obj.vW2, this.hidden2Dim, this.hidden1Dim) ? obj.vW2 : this.zerosMatrix(this.hidden2Dim, this.hidden1Dim);
        this.mW3 = this.isFiniteMatrix(obj.mW3, this.outputDim, this.hidden2Dim) ? obj.mW3 : this.zerosMatrix(this.outputDim, this.hidden2Dim);
        this.vW3 = this.isFiniteMatrix(obj.vW3, this.outputDim, this.hidden2Dim) ? obj.vW3 : this.zerosMatrix(this.outputDim, this.hidden2Dim);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }
}

// Project/run code owns persistence. A global localStorage key would mix
// unrelated learning runs in the same browser profile.
export const globalNeuralPolicy = new NeuralPolicyEngine('are-agent-studio-policy-v1', false);
