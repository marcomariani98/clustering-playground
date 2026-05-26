"use strict";

// Spectral clustering. Pipeline: affinity RBF -> Laplaciano (uno dei tre) ->
// k autovettori piu' piccoli (via power iteration con deflation, non Lanczos:
// piu' semplice ma O(n^3) per autovettore, ecco perche' c'e' il cap a 180 punti)
// -> K-Means nello spazio embedding.
class SpectralClustering{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.steps = [];
    }

    run(data,k,sigma,laplacianType = "symmetric"){
        let affinity = this.calculateAffinity(data,sigma);
        let degree = this.calculateDegree(affinity);
        let laplacianInfo = this.getLaplacianInfo(laplacianType);
        let laplacian = this.calculateLaplacian(affinity,{type:laplacianType});
        let embeddingOperator = this.calculateEmbeddingOperator(laplacian,degree,laplacianType);
        let eigenvectors = this.powerEigenvectors(embeddingOperator,k);
        eigenvectors = this.transformEigenvectors(eigenvectors,degree,laplacianType);
        let embedding = this.buildEmbedding(eigenvectors,laplacianType !== "randomwalk");
        let clustered = this.kmeansEmbedding(embedding,k);
        let clusters = this.buildClusters(data,clustered.assignment,k);

        this.steps = [
            {
                clusters:[data],
                affinity:affinity,
                degree:degree,
                embedding:embedding,
                laplacianType:laplacianType,
                view:"affinity",
                phaseLabel:"1. RBF similarity calculated"
            },
            {
                clusters:[data],
                affinity:affinity,
                degree:degree,
                embedding:embedding,
                laplacianType:laplacianType,
                view:"laplacian",
                phaseLabel:`2. ${laplacianInfo.label} calculated`
            },
            {
                clusters:[data],
                affinity:affinity,
                degree:degree,
                embedding:embedding,
                laplacianType:laplacianType,
                view:"embedding",
                phaseLabel:`3. ${laplacianInfo.shortLabel} eigenvectors extracted`
            },
            {
                clusters:clusters,
                affinity:affinity,
                degree:degree,
                embedding:embedding,
                laplacianType:laplacianType,
                view:"clusters",
                phaseLabel:"4. K-Means in spectral space"
            }
        ];

        return {
            clusters:clusters,
            embedding:embedding,
            affinity:affinity,
            degree:degree,
            laplacian:laplacian,
            laplacianType:laplacianType,
            laplacianLabel:laplacianInfo.label,
            steps:this.steps,
            view:"clusters",
            phaseLabel:`final clusters (${laplacianInfo.shortLabel})`
        };
    }

    /* The affinity matrix stores how strongly every pair of points is connected. */
    calculateAffinity(data,sigma){
        let matrix = [];
        let div = 2 * sigma * sigma;

        for(let i = 0;i < data.length;i++){
            matrix[i] = [];

            for(let j = 0;j < data.length;j++){
                if(i === j){
                    matrix[i][j] = 0;
                }else{
                    let distance = euclidianDistance(data[i],data[j]);
                    matrix[i][j] = Math.exp(-(distance * distance) / div);
                }
            }
        }

        return matrix;
    }

    /* Degree is the total connection strength of each point in the similarity graph. */
    calculateDegree(affinity){
        let degree = [];

        for(let row of affinity){
            degree.push(row.reduce((sum,value) => sum + value,0));
        }

        return degree;
    }

    /* Normalize connections so dense neighborhoods do not dominate only by their size. */
    calculateNormalizedAffinity(affinity){
        let degree = this.calculateDegree(affinity);
        let matrix = [];

        for(let i = 0;i < affinity.length;i++){
            matrix[i] = [];

            for(let j = 0;j < affinity.length;j++){
                let denom = Math.sqrt(Math.max(degree[i],0.0001) * Math.max(degree[j],0.0001));
                matrix[i][j] = affinity[i][j] / denom;
            }
        }

        return matrix;
    }

    /* Names and formulas keep the calculation and the UI describing the same choice. */
    getLaplacianInfo(type){
        let options = {
            unnormalized:{label:"Unnormalized Laplacian: L = D - W",shortLabel:"unnormalized L"},
            symmetric:{label:"Symmetric normalized Laplacian: L = I - D^-1/2 W D^-1/2",shortLabel:"symmetric L"},
            randomwalk:{label:"Random walk Laplacian: L = I - D^-1 W",shortLabel:"random walk L"}
        };

        return options[type] || options.symmetric;
    }

    /* Build the selected graph Laplacian so the same points can be compared three ways. */
    calculateLaplacian(affinity,{type = "symmetric"} = {}){
        let degree = this.calculateDegree(affinity);
        let normalizedAffinity = type === "symmetric" ? this.calculateNormalizedAffinity(affinity) : null;
        let laplacian = [];

        for(let i = 0;i < affinity.length;i++){
            laplacian[i] = [];

            for(let j = 0;j < affinity.length;j++){
                if(type === "unnormalized"){
                    laplacian[i][j] = (i === j ? degree[i] : 0) - affinity[i][j];
                }else if(type === "randomwalk"){
                    let value = affinity[i][j] / Math.max(degree[i],0.0001);
                    laplacian[i][j] = (i === j ? 1 : 0) - value;
                }else{
                    let value = normalizedAffinity[i][j];
                    laplacian[i][j] = (i === j ? 1 : 0) - value;
                }
            }
        }

        return laplacian;
    }

    /*
        Clusters live in the lowest eigenvectors of L. The existing visual solver
        extracts largest eigenvectors, so I - scaled(L) gives it the same directions.

        Lrw is not symmetric, therefore the symmetric deflation used below cannot
        safely run on I - Lrw. Lrw is similar to Lsym, so for random walk we solve
        the symmetric equivalent here and transform its eigenvectors afterwards.
    */
    calculateEmbeddingOperator(laplacian,degree,type){
        let scale = type === "unnormalized"
            ? Math.max(1,2 * Math.max(...degree))
            : 1;
        let matrix = [];

        for(let i = 0;i < laplacian.length;i++){
            matrix[i] = [];

            for(let j = 0;j < laplacian.length;j++){
                let value = (i === j ? 1 : 0) - laplacian[i][j] / scale;

                if(type === "randomwalk"){
                    let rowDegree = Math.sqrt(Math.max(degree[i],0.0001));
                    let columnDegree = Math.sqrt(Math.max(degree[j],0.0001));
                    value = value * rowDegree / columnDegree;
                }

                matrix[i][j] = value;
            }
        }

        return matrix;
    }

    /*
        If u solves the symmetric normalized problem, D^-1/2 u solves the
        random-walk problem. Unlike symmetric spectral clustering, this
        embedding is kept without row normalization so the variants remain
        meaningful alternatives in the visualization.
    */
    transformEigenvectors(eigenvectors,degree,type){
        if(type !== "randomwalk"){
            return eigenvectors;
        }

        return eigenvectors.map((vector) => {
            return vector.map((value,index) => {
                return value / Math.sqrt(Math.max(degree[index],0.0001));
            });
        });
    }

    /* Approximate the dominant eigenvectors that form the useful spectral coordinates. */
    powerEigenvectors(matrix,k){
        let work = matrix.map((row) => row.slice());
        let vectors = [];
        let n = matrix.length;

        for(let comp = 0;comp < k;comp++){
            let vector = [];

            for(let i = 0;i < n;i++){
                vector.push(Math.random());
            }

            vector = this.normalizeVector(vector);

            for(let iter = 0;iter < 60;iter++){
                vector = this.normalizeVector(this.multiplyMatrixVector(work,vector));
            }

            let av = this.multiplyMatrixVector(work,vector);
            let lambda = this.dot(vector,av);
            vectors.push(vector.slice());

            for(let i = 0;i < n;i++){
                for(let j = 0;j < n;j++){
                    work[i][j] -= lambda * vector[i] * vector[j];
                }
            }
        }

        return vectors;
    }

    /* Matrix-vector multiplication is the repeated step used by power iteration. */
    multiplyMatrixVector(matrix,vector){
        let result = [];

        for(let row of matrix){
            let value = 0;

            for(let i = 0;i < vector.length;i++){
                value += row[i] * vector[i];
            }

            result.push(value);
        }

        return result;
    }

    /* Normalizing preserves direction while preventing values from growing indefinitely. */
    normalizeVector(vector){
        let norm = Math.sqrt(vector.reduce((sum,value) => sum + value * value,0));

        if(norm === 0){
            return vector.map(() => 0);
        }

        return vector.map((value) => value / norm);
    }

    /* The dot product estimates an eigenvalue once a direction has settled. */
    dot(vector1,vector2){
        let value = 0;

        for(let i = 0;i < vector1.length;i++){
            value += vector1[i] * vector2[i];
        }

        return value;
    }

    /* Turn one coordinate per eigenvector into one transformed point per original point. */
    buildEmbedding(eigenvectors,normalizeRows = true){
        let embedding = [];
        let n = eigenvectors[0].length;

        for(let i = 0;i < n;i++){
            let row = [];

            for(let vector of eigenvectors){
                row.push(vector[i]);
            }

            embedding.push(normalizeRows ? this.normalizeVector(row) : row);
        }

        return embedding;
    }

    /* Once embedded, ordinary K-Means can separate shapes that were curved on the canvas. */
    kmeansEmbedding(embedding,k){
        let centroids = embedding.slice(0,k).map((row) => row.slice());
        let assignment = new Array(embedding.length).fill(0);

        for(let iter = 0;iter < 40;iter++){
            let changed = false;

            for(let i = 0;i < embedding.length;i++){
                let candidate = 0;
                let minDistance = Infinity;

                for(let c = 0;c < centroids.length;c++){
                    let distance = this.vectorDistance(embedding[i],centroids[c]);

                    if(distance < minDistance){
                        minDistance = distance;
                        candidate = c;
                    }
                }

                if(assignment[i] !== candidate){
                    changed = true;
                    assignment[i] = candidate;
                }
            }

            let sums = [];
            let counts = [];

            for(let c = 0;c < k;c++){
                sums.push(new Array(embedding[0].length).fill(0));
                counts.push(0);
            }

            for(let i = 0;i < embedding.length;i++){
                counts[assignment[i]]++;

                for(let d = 0;d < embedding[i].length;d++){
                    sums[assignment[i]][d] += embedding[i][d];
                }
            }

            for(let c = 0;c < k;c++){
                if(counts[c] === 0){
                    continue;
                }

                centroids[c] = sums[c].map((value) => value / counts[c]);
            }

            if(!changed){
                break;
            }
        }

        return {
            assignment:assignment,
            centroids:centroids
        };
    }

    /* K-Means compares positions in embedding space with Euclidean distance. */
    vectorDistance(vector1,vector2){
        let value = 0;

        for(let i = 0;i < vector1.length;i++){
            value += Math.pow(vector2[i] - vector1[i],2);
        }

        return Math.sqrt(value);
    }

    /* Map spectral labels back onto the original points for drawing and metrics. */
    buildClusters(data,assignment,k){
        let clusters = [];

        for(let i = 0;i < k;i++){
            clusters.push([]);
        }

        for(let i = 0;i < data.length;i++){
            clusters[assignment[i]].push(data[i]);
        }

        return clusters;
    }
}
