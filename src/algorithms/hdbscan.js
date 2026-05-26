"use strict";

// HDBSCAN versione "didattica": core distance -> mutual reachability -> MST ->
// taglia il MST a vari threshold e tieni il cut con stabilita' migliore.
// Stabilita' qui e' una versione semplificata (sum of birth-death dei cluster),
// non quella formale del paper. Va benissimo per visualizzare l'idea.
class HDBSCAN{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.steps = [];
    }

    run(data,minPts,minClusterSize){
        // L'indice originale serve al rendering per ricollegare i punti dataset
        // ai punti visualizzati.
        let dataset = data.map((point,index) => ({
            x:point.x,
            y:point.y,
            i:index
        }));

        let coreDistances = this.calculateCoreDistances(dataset,minPts);
        let edges = this.calculateMutualReachability(dataset,coreDistances);
        let mst = this.calculateMST(dataset,edges);
        let thresholds = [...new Set(mst.map((edge) => edge.weight))]
            .sort((a,b) => b - a);

        if(thresholds.length === 0){
            thresholds = [0];
        }

        let steps = [];
        let bestResult = null;
        let bestStability = -Infinity;

        steps.push({
            phase:"core",
            phaseLabel:"1. Core distance: radius of the minPts neighbor",
            clusters:[],
            noise:dataset,
            coreDistances:coreDistances,
            mst:[],
            threshold:0
        });

        steps.push({
            phase:"mutual",
            phaseLabel:"2. Mutual reachability: density-weighted edges",
            clusters:[],
            noise:dataset,
            coreDistances:coreDistances,
            reachabilityEdges:edges,
            mst:[],
            threshold:0
        });

        steps.push({
            phase:"mst",
            phaseLabel:"3. MST: minimum skeleton of mutual reachability",
            clusters:[],
            noise:dataset,
            coreDistances:coreDistances,
            mst:mst,
            threshold:0
        });

        for(let [index,threshold] of thresholds.entries()){
            let result = this.cutMST(dataset,mst,threshold,minClusterSize);
            result.coreDistances = coreDistances;
            result.mst = mst;
            result.threshold = threshold;
            result.phase = "cut";
            result.phaseLabel = this.getThresholdLabel(index,thresholds.length,threshold);
            result.stability = this.calculateStability(result,mst);
            result.steps = steps;
            steps.push(result);

            if(result.stability > bestStability){
                bestStability = result.stability;
                bestResult = result;
            }
        }

        this.steps = steps;

        if(!bestResult){
            bestResult = this.cutMST(dataset,mst,thresholds[0],minClusterSize);
            bestResult.coreDistances = coreDistances;
            bestResult.mst = mst;
            bestResult.threshold = thresholds[0];
            bestResult.stability = this.calculateStability(bestResult,mst);
        }

        let selectedResult = this.cloneResult(bestResult);
        selectedResult.phase = "selected";
        selectedResult.phaseLabel = `7. Selected clusters: maximum simplified stability`;
        selectedResult.steps = steps;
        steps.push(selectedResult);
        return selectedResult;
    }

    cloneResult(result){
        return {
            phase:result.phase,
            phaseLabel:result.phaseLabel,
            clusters:result.clusters.map((cluster) => cluster.slice()),
            noise:result.noise.slice(),
            threshold:result.threshold,
            mst:result.mst,
            coreDistances:result.coreDistances,
            reachabilityEdges:result.reachabilityEdges,
            stability:result.stability
        };
    }

    getThresholdLabel(index,total,threshold){
        let zone = "medium";
        let stepNumber = 5;

        if(index === 0){
            zone = "high";
            stepNumber = 4;
        }else if(index === total - 1){
            zone = "low";
            stepNumber = 6;
        }

        return `${stepNumber}. ${zone} threshold cut: ${threshold.toFixed(2)}`;
    }

    /* Core distance says how far a point must reach to contain its required neighbors. */
    calculateCoreDistances(data,minPts){
        let coreDistances = [];

        for(let point of data){
            let distances = [];

            for(let other of data){
                if(point === other){
                    continue;
                }

                distances.push(euclidianDistance(point,other));
            }

            distances.sort((a,b) => a - b);

            let idx = Math.max(0,Math.min(distances.length - 1,minPts - 1));
            coreDistances.push(distances[idx] || 0);
        }

        return coreDistances;
    }

    /* Mutual reachability turns sparse paths into expensive edges before building groups. */
    calculateMutualReachability(data,coreDistances){
        let edges = [];

        for(let i = 0;i < data.length;i++){
            for(let j = i + 1;j < data.length;j++){
                let distance = euclidianDistance(data[i],data[j]);
                let weight = Math.max(coreDistances[i],coreDistances[j],distance);

                edges.push({
                    from:i,
                    to:j,
                    a:data[i],
                    b:data[j],
                    weight:weight
                });
            }
        }

        return edges;
    }

    /* The minimum spanning tree keeps the cheapest density connections without cycles. */
    calculateMST(data,edges){
        let parent = data.map((_,index) => index);
        let mst = [];
        let sorted = edges.slice().sort((a,b) => a.weight - b.weight);

        let find = (x) => {
            while(parent[x] !== x){
                parent[x] = parent[parent[x]];
                x = parent[x];
            }

            return x;
        };

        let union = (a,b) => {
            let rootA = find(a);
            let rootB = find(b);

            if(rootA === rootB){
                return false;
            }

            parent[rootB] = rootA;
            return true;
        };

        for(let edge of sorted){
            if(union(edge.from,edge.to)){
                mst.push(edge);
            }
        }

        return mst;
    }

    /* Cutting heavy MST edges creates candidates; undersized groups become noise. */
    cutMST(data,mst,threshold,minClusterSize){
        let parent = data.map((_,index) => index);

        let find = (x) => {
            while(parent[x] !== x){
                parent[x] = parent[parent[x]];
                x = parent[x];
            }

            return x;
        };

        let union = (a,b) => {
            let rootA = find(a);
            let rootB = find(b);

            if(rootA !== rootB){
                parent[rootB] = rootA;
            }
        };

        for(let edge of mst){
            if(edge.weight <= threshold){
                union(edge.from,edge.to);
            }
        }

        let groups = new Map();

        for(let i = 0;i < data.length;i++){
            let root = find(i);

            if(!groups.has(root)){
                groups.set(root,[]);
            }

            groups.get(root).push(data[i]);
        }

        let clusters = [];
        let noise = [];

        for(let group of groups.values()){
            if(group.length >= minClusterSize){
                clusters.push(group);
            }else{
                noise = noise.concat(group);
            }
        }

        return {
            clusters:clusters,
            noise:noise,
            threshold:threshold,
            mst:mst
        };
    }

    /* Prefer clusters that survive a wider density interval and contain more points. */
    calculateStability(result,mst){
        let stability = 0;
        let lambdaNow = 1 / Math.max(result.threshold,0.0001);

        for(let cluster of result.clusters){
            let ids = new Set(cluster.map((point) => point.i));
            let exitDistance = Infinity;

            for(let edge of mst){
                let fromInside = ids.has(edge.from);
                let toInside = ids.has(edge.to);

                if(fromInside !== toInside && edge.weight > result.threshold){
                    exitDistance = Math.min(exitDistance,edge.weight);
                }
            }

            if(exitDistance === Infinity){
                exitDistance = Math.max(...mst.map((edge) => edge.weight),result.threshold);
            }

            let lambdaBirth = 1 / Math.max(exitDistance,0.0001);
            stability += cluster.length * Math.max(0,lambdaNow - lambdaBirth);
        }

        return stability;
    }
}
