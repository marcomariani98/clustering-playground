"use strict";

// GMM con EM. Tutto in 2D, quindi la covarianza e' una matrice 2x2 (a, b, c)
// e l'inversione e' fatta a mano in gaussian(). regularizer + i floor a 9 sul
// minor asse evitano che una componente collassi su un singolo punto.
class GMM{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.components = [];
        this.steps = [];
        this.regularizer = 0.0001;
    }

    run(data,k,maxIterations = 50){
        this.components = this.initComponents(data,k);
        this.steps = [];

        let oldLogLikelihood = -Infinity;
        let responsibilities = [];
        let iterations = 0;

        for(let iter = 0;iter < maxIterations;iter++){
            responsibilities = this.eStep(data,this.components);
            this.components = this.mStep(data,responsibilities,this.components.length);
            responsibilities = this.eStep(data,this.components);

            let logLikelihood = this.logLikelihood(data,this.components);
            let result = this.buildResult(data,responsibilities,iter + 1,logLikelihood);

            this.steps.push(result);
            iterations = iter + 1;

            if(Math.abs(logLikelihood - oldLogLikelihood) < 0.001){
                break;
            }

            oldLogLikelihood = logLikelihood;
        }

        responsibilities = this.eStep(data,this.components);

        let finalResult = this.buildResult(data,responsibilities,iterations,this.logLikelihood(data,this.components));
        finalResult.steps = this.steps;

        return finalResult;
    }

    // Init alla Farthest-First (Gonzalez 1985, non K-Means++ probabilistico)
    // + covarianza globale del dataset. Tutte le componenti partono con peso 1/k.
    initComponents(data,k){
        let means = [];
        let components = [];
        let firstIndex = Math.floor(Math.random() * data.length);

        means.push({x:data[firstIndex].x,y:data[firstIndex].y});

        while(means.length < k){
            let candidate = null;
            let maxDistance = -Infinity;

            for(let point of data){
                let minDistance = Infinity;

                for(let mean of means){
                    let distance = euclidianDistance(point,mean);

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

            means.push({x:candidate.x,y:candidate.y});
        }

        let globalCov = this.globalCovariance(data);

        for(let mean of means){
            components.push({
                weight:1 / means.length,
                mean:{x:mean.x,y:mean.y},
                cov:{a:globalCov.a,b:globalCov.b,c:globalCov.c}
            });
        }

        return components;
    }

    globalCovariance(data){
        let mean = this.calculateMean(data);
        let a = 0;
        let b = 0;
        let c = 0;

        for(let point of data){
            let dx = point.x - mean.x;
            let dy = point.y - mean.y;

            a += dx * dx;
            b += dx * dy;
            c += dy * dy;
        }

        a = a / data.length + this.regularizer;
        b = b / data.length;
        c = c / data.length + this.regularizer;

        return {
            a:Math.max(a,25),
            b:b,
            c:Math.max(c,25)
        };
    }

    calculateMean(points){
        let x = 0;
        let y = 0;

        for(let point of points){
            x += point.x;
            y += point.y;
        }

        return {
            x:x / points.length,
            y:y / points.length
        };
    }

    eStep(data,components){
        let responsibilities = [];

        for(let point of data){
            let row = [];
            let total = 0;

            for(let component of components){
                let value = component.weight * GMM.gaussian(point,component.mean,component.cov);
                row.push(value);
                total += value;
            }

            if(total === 0 || !Number.isFinite(total)){
                row = row.map(() => 1 / components.length);
            }else{
                row = row.map((value) => value / total);
            }

            responsibilities.push(row);
        }

        return responsibilities;
    }

    mStep(data,responsibilities,k){
        let components = [];

        for(let componentIndex = 0;componentIndex < k;componentIndex++){
            let nk = 0;
            let mean = {x:0,y:0};

            for(let i = 0;i < data.length;i++){
                let resp = responsibilities[i][componentIndex];
                nk += resp;
                mean.x += resp * data[i].x;
                mean.y += resp * data[i].y;
            }

            if(nk <= 0.000001){
                let randomPoint = data[parseInt(Math.random() * data.length)];
                components.push({
                    weight:1 / k,
                    mean:{x:randomPoint.x,y:randomPoint.y},
                    cov:this.globalCovariance(data)
                });
                continue;
            }

            mean.x = mean.x / nk;
            mean.y = mean.y / nk;

            let cov = {a:0,b:0,c:0};

            for(let i = 0;i < data.length;i++){
                let resp = responsibilities[i][componentIndex];
                let dx = data[i].x - mean.x;
                let dy = data[i].y - mean.y;

                cov.a += resp * dx * dx;
                cov.b += resp * dx * dy;
                cov.c += resp * dy * dy;
            }

            cov.a = cov.a / nk + this.regularizer;
            cov.b = cov.b / nk;
            cov.c = cov.c / nk + this.regularizer;

            if(cov.a < 9){
                cov.a = 9;
            }

            if(cov.c < 9){
                cov.c = 9;
            }

            components.push({
                weight:nk / data.length,
                mean:mean,
                cov:cov
            });
        }

        return components;
    }

    buildResult(data,responsibilities,iterations,logLikelihood){
        let assignment = this.assignCluster(data,responsibilities,this.components.length);

        return {
            components:this.cloneComponents(this.components),
            clusters:assignment.clusters,
            confidence:assignment.confidence,
            responsibilities:responsibilities.map((row) => row.slice()),
            iterations:iterations,
            logLikelihood:logLikelihood
        };
    }

    // Per il rendering serve un'etichetta hard. Prendiamo la componente con
    // responsibility piu' alta (MAP).
    assignCluster(data,responsibilities,k){
        let clusters = [];
        let confidence = [];

        for(let i = 0;i < k;i++){
            clusters.push([]);
        }

        for(let i = 0;i < data.length;i++){
            let candidate = 0;
            let maxResp = -Infinity;

            for(let j = 0;j < k;j++){
                if(responsibilities[i][j] > maxResp){
                    maxResp = responsibilities[i][j];
                    candidate = j;
                }
            }

            clusters[candidate].push(data[i]);
            confidence.push(maxResp);
        }

        return {
            clusters:clusters,
            confidence:confidence
        };
    }

    logLikelihood(data,components){
        let value = 0;

        for(let point of data){
            let total = 0;

            for(let component of components){
                total += component.weight * GMM.gaussian(point,component.mean,component.cov);
            }

            value += Math.log(Math.max(total,1e-12));
        }

        return value;
    }

    cloneComponents(components){
        return components.map((component) => ({
            weight:component.weight,
            mean:{x:component.mean.x,y:component.mean.y},
            cov:{a:component.cov.a,b:component.cov.b,c:component.cov.c}
        }));
    }

    // Densita' Gaussiana 2D. Inversione esplicita della 2x2: niente import.
    static gaussian(point,mean,cov){
        let a = cov.a;
        let b = cov.b;
        let c = cov.c;
        let det = a * c - b * b;

        if(det <= 0 || !Number.isFinite(det)){
            det = 0.0001;
        }

        let dx = point.x - mean.x;
        let dy = point.y - mean.y;
        let invA = c / det;
        let invB = -b / det;
        let invC = a / det;
        let exponent = -0.5 * (invA * dx * dx + 2 * invB * dx * dy + invC * dy * dy);
        let normalizer = 1 / (2 * Math.PI * Math.sqrt(det));

        return normalizer * Math.exp(exponent);
    }
}
