"use strict";

// K-Means classico. Tengo init_centroid separato dai centroidi finali per
// poter mostrare entrambi (rosso = start, verde = end) e per fare reset
// senza buttare via i punti.
class kMeans{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.init_centroid = [];
        this.clusters = [];
        this.steps = [];
    }

    reset(){
        this.init_centroid = [];
        this.clusters = [];
        this.steps = [];
    }

    generateInitCentroids(k){
        this.init_centroid = [];

        for(let i = 0;i < k;i++){
            this.init_centroid.push({
                x:Math.floor(Math.random() * this.canvasHandler.width),
                y:Math.floor(Math.random() * this.canvasHandler.height)
            });
        }

        return this.init_centroid;
    }

    // Forgy (1965): k punti uniformi presi dal dataset. Classico baseline
    // pre-2007: veloce e semplice, ma con sfortuna becca due punti vicini
    // e parte male. Diverso da generateInitCentroids che pesca dal canvas
    // intero: qui i centroidi nascono sicuramente sopra dei dati.
    forgyCentroids(data,k){
        this.init_centroid = [];

        if(data.length === 0 || k <= 0){
            return this.init_centroid;
        }

        let indices = new Set();
        let target = Math.min(k,data.length);

        while(indices.size < target){
            indices.add(Math.floor(Math.random() * data.length));
        }

        for(let i of indices){
            this.init_centroid.push({x:data[i].x,y:data[i].y});
        }

        return this.init_centroid;
    }

    // K-Means++ vero (Arthur-Vassilvitskii 2007): primo centroide a caso, poi
    // ogni nuovo centroide e' campionato con probabilita' proporzionale a D(x)^2,
    // dove D(x) e' la distanza dal piu' vicino centroide gia' scelto. E' il
    // compromesso fra Farthest-First (sempre il piu' lontano, sensibile agli
    // outlier) e Forgy (uniforme, niente diversificazione).
    kppCentroids(data,k){
        this.init_centroid = [];

        if(data.length === 0 || k <= 0){
            return this.init_centroid;
        }

        let firstIndex = Math.floor(Math.random() * data.length);
        this.init_centroid.push({x:data[firstIndex].x,y:data[firstIndex].y});

        while(this.init_centroid.length < k){
            let weights = [];
            let total = 0;

            for(let point of data){
                let minDistSq = Infinity;

                for(let centroid of this.init_centroid){
                    let dx = point.x - centroid.x;
                    let dy = point.y - centroid.y;
                    let distSq = dx * dx + dy * dy;

                    if(distSq < minDistSq){
                        minDistSq = distSq;
                    }
                }

                weights.push(minDistSq);
                total += minDistSq;
            }

            // Tutti i punti gia' coperti dai centroidi esistenti: niente da scegliere.
            if(total === 0){
                break;
            }

            // Roulette-wheel: pesca r in [0, total) e trova l'indice corrispondente.
            let r = Math.random() * total;
            let acc = 0;
            let chosen = data[data.length - 1];

            for(let i = 0;i < data.length;i++){
                acc += weights[i];

                if(acc >= r){
                    chosen = data[i];
                    break;
                }
            }

            this.init_centroid.push({x:chosen.x,y:chosen.y});
        }

        return this.init_centroid;
    }

    // Farthest-First Traversal (Gonzalez 1985), a volte chiamato impropriamente
    // K-Means++: scelta deterministica del punto con massima distanza minima dai
    // centroidi gia' scelti. Buono su cluster sferici, ma se c'e' un outlier
    // viene preso subito come secondo centroide.
    farthestFirstCentroids(data,k){
        this.init_centroid = [];

        if(data.length === 0 || k <= 0){
            return this.init_centroid;
        }

        let firstIndex = Math.floor(Math.random() * data.length);
        this.init_centroid.push({x:data[firstIndex].x,y:data[firstIndex].y});

        while(this.init_centroid.length < k){
            let candidate = null;
            let maxDistance = -Infinity;

            for(let point of data){
                let minDistance = Infinity;

                for(let centroid of this.init_centroid){
                    let distance = euclidianDistance(point,centroid);

                    if(distance < minDistance){
                        minDistance = distance;
                    }
                }

                if(minDistance > maxDistance){
                    maxDistance = minDistance;
                    candidate = point;
                }
            }

            if(!candidate){
                break;
            }

            this.init_centroid.push({x:candidate.x,y:candidate.y});
        }

        return this.init_centroid;
    }

    run(data,maxIterations = 100){
        let centroids = this.init_centroid.map((point) => ({x:point.x,y:point.y}));
        let clusters = [];
        let steps = [];
        let hasConvergence = false;
        let iteration = 0;
        let centroidHistory = centroids.map((centroid) => [{x:centroid.x,y:centroid.y}]);

        while(iteration < maxIterations && !hasConvergence){
            clusters = this.assignCluster(data,centroids);
            let newCentroids = this.updateCentroids(clusters);

            for(let [i,centroid] of newCentroids.entries()){
                if(!centroidHistory[i]){
                    centroidHistory[i] = [];
                }

                centroidHistory[i].push({x:centroid.x,y:centroid.y});
            }

            steps.push({
                clusters: clusters.map((cluster) => ({
                    centroid:{...cluster.centroid},
                    points:cluster.points.map((point) => ({...point}))
                })),
                centroids: newCentroids.map((point) => ({...point})),
                centroidHistory: centroidHistory.map((path) => path.map((point) => ({...point}))),
                iterations: iteration + 1
            });

            // TODO: convergenza via JSON e' fragile sui float. Funziona perche'
            // i centroidi sono medie esatte di pixel int, ma andrebbe una soglia.
            hasConvergence = JSON.stringify(centroids) === JSON.stringify(newCentroids);
            centroids = newCentroids;
            iteration++;
        }

        this.clusters = clusters;
        this.steps = steps;

        return {
            clusters:clusters,
            centroids:centroids,
            steps:steps,
            centroidHistory:centroidHistory,
            iterations:iteration
        };
    }

    assignCluster(data,centroids){
        let clusters = centroids.map((centroid) => ({
            centroid:{x:centroid.x,y:centroid.y},
            points:[]
        }));

        for(let point of data){
            let minDistance = Infinity;
            let candidate = 0;

            for(let [i,centroid] of centroids.entries()){
                let distance = euclidianDistance(point,centroid);

                if(distance < minDistance){
                    minDistance = distance;
                    candidate = i;
                }
            }

            clusters[candidate].points.push(point);
        }

        return clusters;
    }

    updateCentroids(clusters){
        let newCentroids = [];

        for(let cluster of clusters){
            if(cluster.points.length === 0){
                newCentroids.push({x:cluster.centroid.x,y:cluster.centroid.y});
                continue;
            }

            let xAvg = 0;
            let yAvg = 0;

            for(let point of cluster.points){
                xAvg += point.x;
                yAvg += point.y;
            }

            newCentroids.push({
                x:xAvg / cluster.points.length,
                y:yAvg / cluster.points.length
            });
        }

        return newCentroids;
    }
}
