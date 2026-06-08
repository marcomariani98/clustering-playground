"use strict";

// Hierarchical agglomerative clustering. Starts with n singleton clusters (one per point).
// At each step, merges the two closest clusters according to linkage method and distance metric.
// All merge history is kept in memory to reconstruct the dendrogram, so O(n²) memory usage.
class HCluster{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.steps = [];
    }

    run(data,linkage,metric){
        /* nextId creates stable names: sub-clusters stay recognizable across steps. */
        let nextId = 0;
        let initClusters = data.length;
        let allClusters = [];
        let steps = [];
        let clusters = data.map((point,index) => {
            let cluster = {
                id:++nextId,
                tree:[],
                points:[{x:point.x,y:point.y,i:index}],
                centroid:{x:point.x,y:point.y},
                level:0,
                mergeDistance:0
            };

            allClusters.push(this.cloneCluster(cluster));
            return cluster;
        });

        let iterations = 0;

        while(clusters.length > 1){
            let closestPair = this.findClosestPair(clusters,linkage,metric);

            if(!closestPair){
                break;
            }

            iterations++;

            let mergedCluster = this.mergeClusters(
                closestPair.first,
                closestPair.second,
                ++nextId,
                closestPair.distance,
                iterations
            );

            clusters = clusters
                .filter((cluster) => cluster.id !== closestPair.first.id && cluster.id !== closestPair.second.id)
                .concat(mergedCluster);

            allClusters.push(this.cloneCluster(mergedCluster));

            steps.push({
                allClusters: allClusters.map((cluster) => this.cloneCluster(cluster)),
                currentClusters: clusters.map((cluster) => this.cloneCluster(cluster)),
                initClusters:initClusters,
                iterations:iterations,
                linkage:linkage,
                metric:metric,
                merged:[closestPair.first.id,closestPair.second.id],
                mergeDistance:closestPair.distance
            });
        }

        this.steps = steps;

        return {
            allClusters:allClusters,
            currentClusters:clusters,
            initClusters:initClusters,
            steps:steps,
            iterations:iterations,
            linkage:linkage,
            metric:metric
        };
    }

    /* Search the current forest for the pair selected by the chosen linkage rule. */
    findClosestPair(clusters,linkage,metric){
        let bestPair = null;
        let bestDistance = Infinity;

        for(let i = 0;i < clusters.length;i++){
            for(let j = i + 1;j < clusters.length;j++){
                let distance = this.clusterDistance(clusters[i],clusters[j],linkage,metric);

                if(distance < bestDistance){
                    bestDistance = distance;
                    bestPair = {
                        first:clusters[i],
                        second:clusters[j],
                        distance:distance
                    };
                }
            }
        }

        return bestPair;
    }

    /* Record a parent cluster so the merge history can later become a dendrogram. */
    mergeClusters(firstCluster,secondCluster,nextId,mergeDistance,level){
        let points = firstCluster.points.concat(secondCluster.points);

        return {
            id:nextId,
            tree:[firstCluster.id,secondCluster.id],
            points:points,
            centroid:this.calculateCentroid(points),
            level:level,
            mergeDistance:mergeDistance
        };
    }

    /* Linkage changes what close clusters means: extremes, averages, centers or variance. */
    clusterDistance(firstCluster,secondCluster,linkage,metric){
        if(linkage === "complete"){
            return this.completeLink(firstCluster.points,secondCluster.points,metric);
        }

        if(linkage === "average"){
            return this.averageLink(firstCluster.points,secondCluster.points,metric);
        }

        if(linkage === "centroid"){
            return this.pointDistance(firstCluster.centroid,secondCluster.centroid,metric);
        }

        if(linkage === "ward"){
            return this.wardDistance(firstCluster,secondCluster);
        }

        return this.singleLink(firstCluster.points,secondCluster.points,metric);
    }

    /* Single link follows the nearest pair of points across two clusters. */
    singleLink(firstPoints,secondPoints,metric){
        let min = Infinity;

        for(let firstPoint of firstPoints){
            for(let secondPoint of secondPoints){
                let value = this.pointDistance(firstPoint,secondPoint,metric);

                if(value < min){
                    min = value;
                }
            }
        }

        return min;
    }

    /* Complete link uses the furthest pair, favoring compact finished clusters. */
    completeLink(firstPoints,secondPoints,metric){
        let max = -Infinity;

        for(let firstPoint of firstPoints){
            for(let secondPoint of secondPoints){
                let value = this.pointDistance(firstPoint,secondPoint,metric);

                if(value > max){
                    max = value;
                }
            }
        }

        return max;
    }

    /* Average link balances all cross-cluster point distances. */
    averageLink(firstPoints,secondPoints,metric){
        let value = 0;

        for(let firstPoint of firstPoints){
            for(let secondPoint of secondPoints){
                value += this.pointDistance(firstPoint,secondPoint,metric);
            }
        }

        return value / (firstPoints.length * secondPoints.length);
    }

    /* Ward chooses the merge with the smallest increase in within-cluster variance. */
    wardDistance(firstCluster,secondCluster){
        let centroidDistance = this.pointDistance(firstCluster.centroid,secondCluster.centroid,"euclidean");
        let sizeFactor = (firstCluster.points.length * secondCluster.points.length) /
            (firstCluster.points.length + secondCluster.points.length);

        return sizeFactor * Math.pow(centroidDistance,2);
    }

    /* Other linkage rules compare points with the distance selected in the UI. */
    pointDistance(firstPoint,secondPoint,metric){
        let dx = Math.abs(secondPoint.x - firstPoint.x);
        let dy = Math.abs(secondPoint.y - firstPoint.y);

        if(metric === "manhattan"){
            return dx + dy;
        }

        if(metric === "chebyshev"){
            return Math.max(dx,dy);
        }

        if(metric === "minkowski3"){
            return Math.pow(Math.pow(dx,3) + Math.pow(dy,3),1 / 3);
        }

        if(metric === "cosine"){
            let dot = firstPoint.x * secondPoint.x + firstPoint.y * secondPoint.y;
            let firstNorm = Math.sqrt(firstPoint.x * firstPoint.x + firstPoint.y * firstPoint.y);
            let secondNorm = Math.sqrt(secondPoint.x * secondPoint.x + secondPoint.y * secondPoint.y);

            if(firstNorm === 0 || secondNorm === 0){
                return 1;
            }

            return 1 - dot / (firstNorm * secondNorm);
        }

        return euclidianDistance(firstPoint,secondPoint);
    }

    /* A merged cluster receives the average location of all points it now contains. */
    calculateCentroid(points){
        let xAvg = 0;
        let yAvg = 0;

        for(let point of points){
            xAvg += point.x;
            yAvg += point.y;
        }

        return {
            x:xAvg / points.length,
            y:yAvg / points.length
        };
    }

    cloneCluster(cluster){
        return {
            id:cluster.id,
            tree:cluster.tree.slice(),
            points:cluster.points.map((point) => ({...point})),
            centroid:{...cluster.centroid},
            level:cluster.level,
            mergeDistance:cluster.mergeDistance
        };
    }
}
