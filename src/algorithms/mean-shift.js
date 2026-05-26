"use strict";

// Mean Shift. Ogni punto sale verso un massimo locale di densita' usando
// un kernel Gaussiano col bandwidth scelto. I punti che convergono allo
// stesso "mode" diventano un cluster — il numero di cluster emerge da solo.
class MeanShift{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.steps = [];
    }

    run(data,bandwidth,maxIterations){
        /* shifted stores moving positions, data stays as the original dataset to draw. */
        let shifted = data.map((point) => ({x:point.x,y:point.y}));
        let trails = data.map((point) => [{x:point.x,y:point.y}]);
        let steps = [];
        let iterations = 0;

        for(let iter = 0;iter < maxIterations;iter++){
            let maxShift = 0;
            let next = [];

            for(let [i,point] of shifted.entries()){
                let shiftedPoint = this.shiftPoint(point,data,bandwidth);
                let distance = euclidianDistance(point,shiftedPoint);

                if(distance > maxShift){
                    maxShift = distance;
                }

                next.push(shiftedPoint);
                trails[i].push({x:shiftedPoint.x,y:shiftedPoint.y});
            }

            shifted = next;
            iterations = iter + 1;

            steps.push(this.buildResult(data,shifted,bandwidth,iterations,trails));

            if(maxShift < 0.5){
                break;
            }
        }

        this.steps = steps;

        let result = this.buildResult(data,shifted,bandwidth,iterations,trails);
        result.steps = steps;
        return result;
    }

    /* One Mean Shift step is a weighted local average inside the bandwidth window. */
    shiftPoint(point,data,bandwidth){
        let x = 0;
        let y = 0;
        let total = 0;

        for(let other of data){
            let distance = euclidianDistance(point,other);

            if(distance <= bandwidth){
                let weight = Math.exp(-(distance * distance) / (2 * bandwidth * bandwidth));
                x += other.x * weight;
                y += other.y * weight;
                total += weight;
            }
        }

        if(total === 0){
            return {x:point.x,y:point.y};
        }

        return {
            x:x / total,
            y:y / total
        };
    }

    /* Nearby destinations are merged into modes, turning density peaks into clusters. */
    buildResult(data,shifted,bandwidth,iterations,trails){
        let modes = [];
        let assignment = [];

        for(let shiftedPoint of shifted){
            let candidate = -1;

            for(let [i,mode] of modes.entries()){
                if(euclidianDistance(shiftedPoint,mode) <= bandwidth / 2){
                    candidate = i;
                    break;
                }
            }

            if(candidate === -1){
                modes.push({x:shiftedPoint.x,y:shiftedPoint.y});
                candidate = modes.length - 1;
            }

            assignment.push(candidate);
        }

        let clusters = modes.map(() => []);

        for(let i = 0;i < data.length;i++){
            clusters[assignment[i]].push(data[i]);
        }

        let weakCount = clusters.reduce((total,cluster) => {
            return cluster.length <= 2 ? total + cluster.length : total;
        },0);

        return {
            clusters:clusters,
            modes:modes,
            assignment:assignment,
            shifted:shifted.map((point) => ({...point})),
            trails:trails.map((path) => path.map((point) => ({...point}))),
            bandwidth:bandwidth,
            weakCount:weakCount,
            iterations:iterations,
            phaseLabel:`shift toward dense areas ${iterations}`
        };
    }
}
