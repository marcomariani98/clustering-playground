"use strict";

// Fuzzy C-Means clustering. Each point has a degree of membership to each cluster
// rather than a hard assignment. The exponent m controls the "fuzziness" of membership:
// m → 1 converges toward hard K-Means behavior; large m makes membership uniform across all clusters.
class FuzzyCMeans{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.steps = [];
    }

    run(data,k,m,maxIterations){
        /* m controls how soft the memberships are. */
        let memberships = this.initMembership(data.length,k);
        let centroids = [];
        let centroidHistory = [];
        let steps = [];
        let iterations = 0;

        for(let iter = 0;iter < maxIterations;iter++){
            centroids = this.updateCentroids(data,memberships,k,m);

            for(let [i,centroid] of centroids.entries()){
                if(!centroidHistory[i]){
                    centroidHistory[i] = [];
                }

                centroidHistory[i].push({x:centroid.x,y:centroid.y});
            }

            memberships = this.updateMemberships(data,centroids,m);
            iterations = iter + 1;

            steps.push(this.buildResult(data,memberships,centroids,iterations,centroidHistory));
        }

        this.steps = steps;

        let result = this.buildResult(data,memberships,centroids,iterations,centroidHistory);
        result.steps = steps;
        return result;
    }

    /* Begin with random membership weights whose row always sums to one. */
    initMembership(n,k){
        let memberships = [];

        for(let i = 0;i < n;i++){
            let row = [];
            let total = 0;

            for(let c = 0;c < k;c++){
                let value = Math.random();
                row.push(value);
                total += value;
            }

            memberships.push(row.map((value) => value / total));
        }

        return memberships;
    }

    /* Pull a centroid toward points in proportion to their fuzzy membership strength. */
    updateCentroids(data,memberships,k,m){
        let centroids = [];

        for(let c = 0;c < k;c++){
            let x = 0;
            let y = 0;
            let total = 0;

            for(let i = 0;i < data.length;i++){
                let weight = Math.pow(memberships[i][c],m);
                x += weight * data[i].x;
                y += weight * data[i].y;
                total += weight;
            }

            if(total === 0){
                centroids.push({x:data[0].x,y:data[0].y});
            }else{
                centroids.push({x:x / total,y:y / total});
            }
        }

        return centroids;
    }

    /* Recalculate how strongly each point belongs to each centroid from its distances. */
    updateMemberships(data,centroids,m){
        let memberships = [];
        let power = 2 / (m - 1);

        for(let point of data){
            let row = [];

            for(let c = 0;c < centroids.length;c++){
                let distC = Math.max(euclidianDistance(point,centroids[c]),0.0001);
                let sum = 0;

                for(let j = 0;j < centroids.length;j++){
                    let distJ = Math.max(euclidianDistance(point,centroids[j]),0.0001);
                    sum += Math.pow(distC / distJ,power);
                }

                row.push(1 / sum);
            }

            memberships.push(row);
        }

        return memberships;
    }

    buildResult(data,memberships,centroids,iterations,centroidHistory = []){
        let clusters = centroids.map(() => []);
        let confidence = [];

        for(let i = 0;i < data.length;i++){
            let candidate = 0;
            let maxMembership = -Infinity;

            for(let c = 0;c < memberships[i].length;c++){
                if(memberships[i][c] > maxMembership){
                    maxMembership = memberships[i][c];
                    candidate = c;
                }
            }

            clusters[candidate].push(data[i]);
            confidence.push(maxMembership);
        }

        return {
            clusters:clusters,
            memberships:memberships.map((row) => row.slice()),
            confidence:confidence,
            centroids:centroids.map((point) => ({...point})),
            centroidHistory:centroidHistory.map((path) => path.map((point) => ({...point}))),
            iterations:iterations
        };
    }
}
