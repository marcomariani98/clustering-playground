"use strict";

class GMMRenderer{
    constructor(primitives){
        this.p = primitives;
    }

    draw(data, options){
        let p = this.p;
        let { result, showBoundaries } = options;

        p.reset();

        if(!result){
            p.drawPoints(data, p.glyphColor());
            return;
        }

        if(showBoundaries){
            this._drawBoundaries(result);
        }

        for(let [i, cluster] of result.clusters.entries()){
            let color = cluster_color[i % cluster_color.length];

            for(let point of cluster){
                let idx = data.indexOf(point);
                let confidence = idx >= 0 ? result.confidence[idx] : 1;
                let alpha = 0.25 + confidence * 0.75;
                p.drawPointAlpha(point, color, alpha);
            }
        }

        for(let [i, component] of result.components.entries()){
            let color = cluster_color[i % cluster_color.length];
            this._drawEllipse(component, color);
            p.drawCentroids([component.mean], color);
            p.drawLabel(
                { x: component.mean.x + 8, y: component.mean.y - 8 },
                `G${i + 1}`,
                p.glyphColor(),
                "700 12px Arial"
            );
        }

        p.drawInfo(`GMM - iterations: ${result.iterations} - alpha = confidence`);
    }

    // Frontiere "probabilistiche": cella colorata in base al componente con
    // probabilita' a posteriori piu' alta. E' la versione GMM del Voronoi.
    _drawBoundaries(result){
        let p = this.p;
        let cellSize = 10;

        for(let y = 0; y < p.height; y += cellSize){
            for(let x = 0; x < p.width; x += cellSize){
                let probe = { x: x + cellSize / 2, y: y + cellSize / 2 };
                let pick = 0;
                let maxProbability = -Infinity;

                for(let [i, component] of result.components.entries()){
                    let probability = component.weight * GMM.gaussian(probe, component.mean, component.cov);
                    if(probability > maxProbability){
                        maxProbability = probability;
                        pick = i;
                    }
                }

                p.ctx.fillStyle = p.colorAlpha(cluster_color[pick % cluster_color.length], 0.12);
                p.ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
    }

    // Ellisse della covarianza: gli autovalori 2x2 in forma chiusa. Disegnamo
    // un contorno a 1 sigma (forte) e uno a 2 sigma (debole) per dare profondita'.
    _drawEllipse(component, color){
        let p = this.p;
        let { a, b, c } = component.cov;
        let trace = a + c;
        let detPart = Math.sqrt(Math.max(0, Math.pow(a - c, 2) + 4 * b * b));
        let lambda1 = Math.max(4, (trace + detPart) / 2);
        let lambda2 = Math.max(4, (trace - detPart) / 2);
        let angle = 0.5 * Math.atan2(2 * b, a - c);

        p.ctx.save();
        p.ctx.translate(component.mean.x, component.mean.y);
        p.ctx.rotate(angle);

        for(let scale of [1, 2]){
            p.ctx.beginPath();
            p.ctx.ellipse(
                0, 0,
                Math.sqrt(lambda1) * scale,
                Math.sqrt(lambda2) * scale,
                0, 0, 2 * Math.PI
            );
            p.ctx.lineWidth = scale === 1 ? 2 : 1;
            p.ctx.strokeStyle = scale === 1 ? p.colorAlpha(color, 0.75) : p.colorAlpha(color, 0.35);
            p.ctx.stroke();
        }

        p.ctx.restore();
    }
}
