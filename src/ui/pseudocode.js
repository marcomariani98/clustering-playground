"use strict";

// Algorithm pseudocode display with syntax highlighting. Includes a hand-written
// tokenizer that recognizes keywords, strings, numbers, operators, and function calls
// without relying on Prism/highlight.js. This keeps the app dependency-free.
// Note: escapeHtml() lives in view-helpers.js; getSpectralLaplacianType() in main.js.

// Return the pseudocode for the currently selected algorithm as a plain string.
// Each algorithm has its own simplified pseudocode snippet that illustrates
// the core idea (initialization, iteration, convergence) without implementation details.
function getPseudocode(){
    if(state.mode === "kmeans"){
        return `let centroids = chooseInitialCentroids(data, k);
let converged = false;

while (!converged) {
  const oldCentroids = centroids;

  const clusters = assignPoints(data, centroids);
  centroids = updateCentroids(clusters);

  converged = hasConverged(oldCentroids, centroids);
}`;
    }

    if(state.mode === "spectral"){
        let laplacianType = getSpectralLaplacianType();
        return `let W = buildAffinityMatrix(data, sigma);
let L = graphLaplacian(W, { type: "${laplacianType}" });

let vectors = smallestEigenvectors(L, k);
let embedding = buildEmbedding(vectors);

return kMeans(embedding, k);`;
    }

    if(state.mode === "fuzzy"){
        return `let membership = randomMembership(data, k);
let centroids;

for (let i = 0; i < maxIterations; i++) {
  const oldMembership = membership;

  centroids = updateWeightedCentroids(data, membership);
  membership = updateMemberships(data, centroids);

  if (hasConverged(oldMembership, membership)) {
break;
  }
}

return strongestMembership(membership);`;
    }

    if(state.mode === "meanshift"){
        return `let shifted = copyPoints(data);
let stable = false;

while (!stable) {
  stable = true;

  for (let i = 0; i < shifted.length; i++) {
let neighbors = pointsWithinBandwidth(shifted[i], shifted);
let newPoint = weightedMean(neighbors);

if (distance(shifted[i], newPoint) > tolerance) {
  stable = false;
}

shifted[i] = newPoint;
  }
}

let modes = mergeNearbyPoints(shifted);
return assignPointsToModes(data, modes);`;
    }

    if(state.mode === "gmm"){
        return `let components = initializeGaussians(data, k);
let responsibilities;

for (let i = 0; i < maxIterations; i++) {
  const oldComponents = components;

  responsibilities = estimateMemberships(data, components);
  components = updateGaussians(data, responsibilities);

  if (hasConverged(oldComponents, components)) {
break;
  }
}

return mostLikelyComponent(responsibilities);`;
    }

    if(state.mode === "dbscan"){
        return `let clusterId = 0;

for (let point of data) {
  if (point.visited) continue;

  point.visited = true;
  let neighbors = regionQuery(point, epsilon);

  if (neighbors.length < minPts) {
markAsNoise(point);
  } else {
clusterId++;
expandCluster(point, neighbors, clusterId, epsilon, minPts);
  }
}`;
    }

    if(state.mode === "hdbscan"){
        return `let coreDistances = computeCoreDistances(data, minPts);
let graph = mutualReachabilityGraph(data, coreDistances);

let mst = minimumSpanningTree(graph);
let condensedTree = condenseTree(mst, minClusterSize);

let clusters = extractMostStableClusters(condensedTree);

return clusters;`;
    }

    return `let clusters = data.map(point => [point]);
let merges = [];

while (clusters.length > 1) {
  let pair = findClosestClusters(clusters);
  let distance = clusterDistance(pair[0], pair[1]);

  merges.push({ pair, distance });

  clusters = mergePair(clusters, pair);
}

return buildDendrogram(merges);`;
}

// Wrap a token with its type class for CSS styling. Type is one of:
// keyword, number, string, variable, function, property, operator, punctuation.
function pseudocodeToken(type, value){
    return `<span class="token-${type}">${escapeHtml(value)}</span>`;
}

// Hand-written tokenizer for syntax-highlighting pseudocode. Recognizes keywords,
// numbers, strings, identifiers, and operators to add semantic color without
// external dependencies. Uses a simple left-to-right scan with lookahead for
// context (e.g., checking if the next non-whitespace char is '(' to detect functions).
function highlightPseudocode(code){
    let keywords = new Set(["let", "const", "return", "while", "for", "if", "else", "continue", "break", "of"]);
    let constants = new Set(["true", "false", "null", "undefined"]);
    let html = "";
    let i = 0;

    while(i < code.length){
        let char = code[i];

        // Pass through whitespace unchanged.
        if(/\s/.test(char)){
            html += char;
            i++;
            continue;
        }

        // Scan quoted strings, handling escapes. Treat both single and double quotes.
        if(char === "\"" || char === "'"){
            let quote = char;
            let j = i + 1;
            while(j < code.length && code[j] !== quote){
                if(code[j] === "\\") j++;
                j++;
            }
            html += pseudocodeToken("string", code.slice(i, Math.min(j + 1, code.length)));
            i = Math.min(j + 1, code.length);
            continue;
        }

        // Scan numbers (integers and floats).
        if(/[0-9]/.test(char)){
            let j = i + 1;
            while(j < code.length && /[0-9.]/.test(code[j])) j++;
            html += pseudocodeToken("number", code.slice(i, j));
            i = j;
            continue;
        }

        // Scan identifiers (variables, functions, keywords). Then classify based on
        // context: if preceded by '.', it's a property; if followed by '(', it's a function call;
        // if it's a keyword/constant, use the appropriate type; otherwise it's a variable.
        if(/[A-Za-z_$]/.test(char)){
            let j = i + 1;
            while(j < code.length && /[A-Za-z0-9_$]/.test(code[j])) j++;

            let word = code.slice(i, j);
            let next = j;
            let previous = i - 1;
            // Skip whitespace to find the actual next/previous non-whitespace character.
            while(next < code.length && /\s/.test(code[next])) next++;
            while(previous >= 0 && /\s/.test(code[previous])) previous--;

            if(keywords.has(word)){
                html += pseudocodeToken("keyword", word);
            }else if(constants.has(word)){
                html += pseudocodeToken("number", word);
            }else if(code[previous] === "."){
                html += pseudocodeToken("property", word);
            }else if(code[next] === "("){
                html += pseudocodeToken("function", word);
            }else{
                html += pseudocodeToken("variable", word);
            }

            i = j;
            continue;
        }

        // Scan operators. Recognize both single-character and two-character operators (e.g., <=, >=, ===, &&).
        if("+-*/=%!<>|&".includes(char)){
            let nextChar = code[i + 1] || "";
            let value = char;
            if("=><&|".includes(nextChar)){
                value += nextChar;
                i++;
            }
            html += pseudocodeToken("operator", value);
            i++;
            continue;
        }

        // Everything else (parentheses, braces, semicolons, etc.) is punctuation.
        html += pseudocodeToken("punctuation", char);
        i++;
    }

    return html;
}

// Update the pseudocode display in the sidebar. Fetches the pseudocode for
// the current algorithm, syntax-highlights it, and renders it in the DOM.
function updatePseudocode(){
    let box = DOM("pseudocodeBox");
    if(!box) return;
    box.innerHTML = highlightPseudocode(getPseudocode());
}
