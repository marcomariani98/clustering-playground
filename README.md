# 🎮 Clustering Playground

A visual playground for clustering algorithms. Open it in your browser and watch eight different algorithms compete on datasets you draw, generate, or tweak in real time.

Built in vanilla JavaScript. No npm, no build step, no dependencies. Just static files.

**🚀 [Try it live](https://marcomariani98.github.io/clustering-playground/)**

---

## 📊 What It Does

This is an educational tool. You generate (or paint) a scatter of points, pick an algorithm, and watch it cluster them. Then you change the parameters and watch it again. You can step through one iteration at a time, play an animation, or just execute once and see the result.

This project has been in development on and off for about three years, through a lot of rewrites, false starts, and lessons learned. It started as a Node.js university project, grew into a single 5,000-line file, then eventually got split back into modules because that was much less painful to read. Now it's pretty modular, but still has zero external dependencies.

The core idea is simple: clustering algorithms are easier to understand when you see them work. Theory is fine. But watching K-Means centroid movement or how DBSCAN grows clusters from density seeds makes intuition stick.

---

## ✨ What You Can Do

### 🎨 Generate or paint datasets
- Five built-in shapes: random clusters, noise, two moons, concentric circles, spiral
- Or use the brush tool. Drag to paint points. The slider controls how many points spawn per pixel you drag
- Adjust spread, noise percentage, cluster count on the fly
- Export your points to JSON, reload them later

### ▶️ Run algorithms step-by-step
- **Play ▶️** — animated execution showing each step
- **Step ⏭️** — advance one step at a time (useful when you want to understand what's happening)
- **Back ⏮️** — go back one step if you overshot (free operation, no recalculation)
- **Execute ⚡** — just run to completion instantly
- **Stop 🛑** — pause without clearing the result

### 📈 See complexity at a glance
- Each algorithm shows its worst-case complexity (O(n), O(n²), O(n³), etc.) in the top bar
- "Safe mode" warns you if your dataset is too big for the selected algorithm (and you can turn it off if you're feeling reckless)
- The application won't let you freeze your browser without asking first

### 📊 Understand the results
- Metrics cards with traffic-light coloring (green/yellow/red) explain whether the clustering is good
- Convergence sparklines show how the algorithm improves over iterations
- For Spectral: affinity heatmap in the sidebar shows which points are connected
- For GMM: cross-run AIC/BIC comparison helps you pick how many components to use
- For K-Means: you can manually place initial centroids and see how that affects convergence

### 🌙 Toggle between light and dark themes
Everything redraws in real time.

---

## 🧠 Eight Algorithms

**🎯 Centroid-based:**
- **K-Means** with four initialization options (random, Forgy, K-Means++, farthest-first)
- **Fuzzy C-Means** — soft membership instead of hard assignments
- **Gaussian Mixture Models (GMM)** — probabilistic clusters with confidence intervals

**📍 Density-based:**
- **DBSCAN** — grows clusters from dense cores
- **HDBSCAN** — hierarchical version with automatic cluster selection
- **Mean Shift** — kernel density estimation, number of clusters emerges

**🌐 Structure-based:**
- **Spectral Clustering** — five Laplacian types to choose from (symmetric, unnormalized, random walk, signless, Bethe Hessian)
- **Hierarchical Agglomerative** — bottom-up merge with the dendrogram drawn live on the canvas

---

## 🔧 Under the Hood

The code is split by responsibility:

```
src/
  algorithms/       clustering logic
  core/             app state, metrics, utilities
  data/             dataset generators
  render/           canvas drawing + algorithm-specific renderers
  ui/               metrics display, charts, legend, pseudocode
  main.js           controller and event wiring
```

No build step. Scripts load in order from `index.html`. It works if you just open the file in a browser.

**Architecture patterns:**

The controller (`main.js`) uses a Strategy registry so it doesn't know about specific algorithms. Each algorithm class exposes `run(data, params)` returning `{result, steps}`. Renderers compose shared primitives. Metrics is a private module (IIFE) that computes everything from the result.

State lives in `AppState` — one class holds the session (data, result, steps, playback timer, safe mode). Algorithms and renderers stay stateless.

---

## 💡 Why Build This?

Clustering is abstract. You can read about K-Means for an hour and still not understand centroid drift. But watch the red cross jump around for 30 seconds and it clicks.

The goal isn't performance or production use. It's making the algorithms visible and playable.

Some simplifications are intentional. The code prioritizes clarity over optimization. If you're studying algorithms, it should be readable. If you're teaching, the animation should be smooth enough for a live demo.

---

## 🚀 Local Development

Just open `index.html` in a browser. That's it.

If you want live reload while editing, spin up a static server:

```bash
python -m http.server 8000
# or
npx http-server
```

Then open `http://localhost:8000`.

---

## ✅ Testing: Smoke Test

A light smoke test catches the obvious breaks after a refactor. It's in `test/smoke.html`.

**What it checks:**

Each of the eight algorithms gets three quick checks:
- `run()` doesn't throw and returns `{result, steps}` (the contract)
- `Metrics.computeMetrics()` doesn't crash on the result
- `Metrics.convergenceSeries()` doesn't crash on the result

It's not checking if the clustering is *correct*, just that the code doesn't have holes.

**How to run it:**

Open `test/smoke.html` in any browser (even `file://` works). Green badge = all 24 tests passed. Red = something broke. Full output is in the console.

Each test uses a different dataset and different parameter values, so the harness catches both initialization bugs and common edge cases (e.g., empty clusters, single-point datasets, precision edge cases).

**If you add an algorithm:**

Add a case to the `cases` array in `test/smoke.js` — same pattern as the existing eight. The test runner will pick it up and run it alongside the others.

---

## 🔌 How to Extend

To add a new algorithm:

1. Create `src/algorithms/MyAlgo.js` with a class that has `run(data, params)` returning `{result, steps}`.
2. Create `src/render/MyAlgoRenderer.js` with a renderer class.
3. Add `<script>` tags to `index.html` in the right order.
4. Add a control panel in the HTML with `data-panel="myalgo"`.
5. Wire it into `main.js`: add the instance, add a strategy, bind buttons.
6. Add complexity badge entry, safe-mode cap, and pseudocode if you like.

The Step/Play/Back flow handles the rest.

---

## 🎯 The Philosophy

- **No dependencies.** Really. HTML, CSS, vanilla JS. Pick it up, run it, read it.
- **One file at a time.** Each file does one thing. Algorithms don't know about rendering. Renderers don't know about metrics.
- **Prefer clarity over optimization.** If the code is easier to understand, that's worth a bit of slowness.
- **Educate, don't impress.** The goal is helping people learn. Not a benchmark, not production-grade, not the fastest clustering library.

---

## 📝 Notes

- 💾 The app works without a server. Open `index.html` directly. Works offline.
- 🛡️ Safe mode is on by default. It stops you at algorithm-specific point limits (K-Means at 2000, Spectral at 180, HCluster at 30). Turn it off if you know what you're doing.
- 📊 GMM's AIC/BIC table resets when you change the dataset (detected by hashing point coordinates).
- ⚙️ Spectral and HCluster are genuinely O(n³), which is why they cap out early. That's not a bug, it's physics.
- 🌳 The dendrogram for HCluster now grows on the main canvas during execution instead of in a sidebar preview. It's more dramatic that way.

---

## 📚 Resources

- Original Clustering papers
- Papers on the various Laplacians (Spectral Clustering guides by Ng, Jordan, and Weiss)
- Mean Shift references (Comaniciu & Meer)
- GMM/EM introduction by Murphy or Bishop

This playground doesn't optimize for any of those. It just tries to make them visible.

---

**👨‍💻 Built and maintained solo over three years. Definitely has rough edges. But it works, and it teaches.**
