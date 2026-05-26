"use strict";

// DBSCAN. Densita' = un punto e' "core" se ha >= minPts vicini entro eps.
// Note: il regionQuery e' O(n) e expandCluster richiama indexOf in loop, quindi
// nel peggiore dei casi e' O(n^3). Per <300 punti regge, ma una grid index
// abbasserebbe drasticamente i tempi.
class DBSCAN{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.eps = 0;
        this.minPts = 0;
        this.steps = [];
    }

    run(data,eps,minPts){
        this.eps = eps;
        this.minPts = minPts;

        // Aggiungiamo l'indice originale: serve per il rendering e per
        // identificare i punti durante l'espansione senza confronti su x/y.
        let dataset = data.map((point,index) => ({
            x:point.x,
            y:point.y,
            i:index
        }));

        let clusters = [];
        let border = [];
        let noise = [];
        let core = [];
        let visited = new Set();
        let steps = [];
        let neighborCounts = dataset.map((point) => this.regionQuery(dataset,point).length);

        for(let [i,point] of dataset.entries()){
            if(visited.has(i)){
                continue;
            }

            visited.add(i);

            let neighbours = this.regionQuery(dataset,point);

            steps.push(this.snapshot(core,clusters,noise,border,neighborCounts,{
                currentPoint:point,
                currentNeighbors:neighbours,
                visited:visited,
                phaseLabel:`DBSCAN - visit P${point.i + 1}: ${neighbours.length} points inside epsilon`
            }));

            if(neighbours.length < this.minPts){
                point.label = "noise";

                if(!isInArray(noise,point)){
                    noise.push(point);
                }

                steps.push(this.snapshot(core,clusters,noise,border,neighborCounts,{
                    currentPoint:point,
                    currentNeighbors:neighbours,
                    visited:visited,
                    phaseLabel:`DBSCAN - P${point.i + 1} marked as noise`
                }));
            }else{
                let newCluster = this.expandCluster(dataset,point,neighbours,visited,border,core,noise,clusters,steps,neighborCounts);
                clusters.push(newCluster);

                steps.push(this.snapshot(core,clusters,noise,border,neighborCounts,{
                    currentPoint:point,
                    currentNeighbors:neighbours,
                    visited:visited,
                    phaseLabel:`DBSCAN - cluster ${clusters.length} expanded`
                }));
            }
        }

        let finalNoise = noise.filter((point) => !isInCluster(clusters,point));

        this.steps = steps;

        return {
            core:core,
            clusters:clusters,
            noise:finalNoise,
            border:border,
            eps:this.eps,
            neighborCounts:neighborCounts,
            visitedIndexes:dataset.map((point) => point.i),
            steps:steps
        };
    }

    expandCluster(dataset,point,neighbours,visited,border,core,noise,clusters,steps,neighborCounts){
        let cluster = [];
        let queue = neighbours.slice();

        point.label = "core";
        cluster.push(point);

        if(!isInArray(core,point)){
            core.push(point);
        }

        steps.push(this.snapshot(core,clusters,noise,border,neighborCounts,{
            activeCluster:cluster,
            currentPoint:point,
            currentNeighbors:neighbours,
            visited:visited,
            phaseLabel:`DBSCAN - P${point.i + 1} is core, expanding cluster`
        }));

        for(let i = 0;i < queue.length;i++){
            let neighbour = queue[i];
            let neighbourIndex = dataset.indexOf(neighbour);
            let neighbourPoints = this.regionQuery(dataset,neighbour);

            if(!visited.has(neighbourIndex)){
                visited.add(neighbourIndex);

                if(neighbourPoints.length >= this.minPts){
                    neighbour.label = "core";

                    if(!isInArray(core,neighbour)){
                        core.push(neighbour);
                    }

                    for(let neighbourPoint of neighbourPoints){
                        if(!queue.includes(neighbourPoint)){
                            queue.push(neighbourPoint);
                        }
                    }
                }else{
                    neighbour.label = "border";

                    if(!isInArray(border,neighbour)){
                        border.push(neighbour);
                    }
                }

                steps.push(this.snapshot(core,clusters,noise,border,neighborCounts,{
                    activeCluster:cluster,
                    currentPoint:neighbour,
                    currentNeighbors:neighbourPoints,
                    visited:visited,
                    phaseLabel:`DBSCAN - expand from P${neighbour.i + 1}: ${neighbourPoints.length} epsilon neighbors`
                }));
            }

            if(neighbour.label === "noise"){
                neighbour.label = "border";

                if(!isInArray(border,neighbour)){
                    border.push(neighbour);
                }
            }

            if(!isInCluster(clusters,neighbour) && !isInArray(cluster,neighbour)){
                cluster.push(neighbour);
            }
        }

        return cluster;
    }

    regionQuery(dataset,point){
        let neighbours = [];

        for(let neighbour of dataset){
            if(euclidianDistance(point,neighbour) <= this.eps){
                neighbours.push(neighbour);
            }
        }

        return neighbours;
    }

    snapshot(core,clusters,noise,border,neighborCounts,options = {}){
        let visibleNoise = noise.filter((point) => !isInCluster(clusters,point));
        let visibleClusters = clusters.map((cluster) => cluster.slice());

        if(options.activeCluster && options.activeCluster.length > 0){
            visibleClusters = visibleClusters.concat([options.activeCluster.slice()]);
        }

        return {
            core: core.slice(),
            clusters: visibleClusters,
            noise: visibleNoise,
            border: border.slice(),
            eps: this.eps,
            neighborCounts: neighborCounts.slice(),
            currentPoint: options.currentPoint ? {...options.currentPoint} : null,
            currentNeighbors: options.currentNeighbors ? options.currentNeighbors.map((point) => ({...point})) : [],
            visitedIndexes: options.visited ? Array.from(options.visited) : [],
            phaseLabel: options.phaseLabel || ""
        };
    }
}
