"use strict";

class FuzzyRenderer{
    constructor(primitives){
        this.p = primitives;
    }

    draw(data, options){
        let p = this.p;
        let { result, showBoundaries, showDetails } = options;

        p.reset();

        if(!result){
            p.drawPoints(data, p.glyphColor());
            return;
        }

        if(showBoundaries){
            p.drawCentroidBoundaries(result.centroids);
        }

        if(showDetails){
            this._drawMembershipLinks(data, result);
            this._drawCentroidTrails(result);
        }

        for(let [i, cluster] of result.clusters.entries()){
            let color = cluster_color[i % cluster_color.length];

            for(let point of cluster){
                let idx = data.indexOf(point);
                let confidence = idx >= 0 ? result.confidence[idx] : 1;
                // Alpha proporzionale alla membership: piu' sicuro = piu' opaco.
                let alpha = 0.22 + confidence * 0.78;

                this._drawAmbiguity(point, confidence);
                p.drawPointAlpha(point, color, alpha);
            }
        }

        p.drawCentroids(result.centroids, p.glyphColor());
        let detailText = showDetails ? " - soft memberships visible" : "";
        p.drawInfo(`Fuzzy C-Means - iterations: ${result.iterations} - alpha = membership${detailText}`);
    }

    // Quando un punto e' indeciso tra due centroidi (confidence bassa) gli
    // mettiamo un alone viola. Sotto il 30% di ambiguita' non disturbiamo.
    _drawAmbiguity(point, confidence){
        let ambiguity = 1 - confidence;
        if(ambiguity < 0.30) return;

        let p = this.p;
        let radius = 6 + ambiguity * 13;

        p.ctx.save();
        p.ctx.beginPath();
        p.ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
        p.ctx.fillStyle = `rgba(124, 58, 237, ${0.05 + ambiguity * 0.12})`;
        p.ctx.fill();
        p.ctx.strokeStyle = `rgba(124, 58, 237, ${0.16 + ambiguity * 0.22})`;
        p.ctx.lineWidth = 1;
        p.ctx.stroke();
        p.ctx.restore();
    }

    _drawMembershipLinks(data, result){
        if(!result.memberships || !result.centroids) return;

        let p = this.p;
        p.ctx.save();

        for(let i = 0; i < data.length; i++){
            // Solo le due membership piu' forti: la terza in giu' aggiunge rumore visivo.
            let top = result.memberships[i]
                .map((value, index) => ({ value, index }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 2);

            for(let item of top){
                if(item.value < 0.12 || !result.centroids[item.index]) continue;

                let centroid = result.centroids[item.index];
                let color = cluster_color[item.index % cluster_color.length];

                p.ctx.beginPath();
                p.ctx.moveTo(data[i].x, data[i].y);
                p.ctx.lineTo(centroid.x, centroid.y);
                p.ctx.strokeStyle = p.colorAlpha(color, 0.05 + item.value * 0.26);
                p.ctx.lineWidth = 0.6 + item.value * 1.6;
                p.ctx.stroke();
            }
        }

        p.ctx.restore();
    }

    _drawCentroidTrails(result){
        if(!result.centroidHistory || result.centroidHistory.length === 0) return;

        let p = this.p;
        p.ctx.save();
        p.ctx.setLineDash([4, 5]);
        p.ctx.lineWidth = 1.4;

        for(let [i, path] of result.centroidHistory.entries()){
            if(!path || path.length < 2) continue;

            let color = cluster_color[i % cluster_color.length];
            p.ctx.strokeStyle = p.colorAlpha(color, 0.56);
            p.ctx.beginPath();
            p.ctx.moveTo(path[0].x, path[0].y);

            for(let j = 1; j < path.length; j++){
                p.ctx.lineTo(path[j].x, path[j].y);
            }

            p.ctx.stroke();
            p.ctx.setLineDash([]);

            for(let j = 1; j < path.length - 1; j++){
                p.ctx.beginPath();
                p.ctx.arc(path[j].x, path[j].y, 2.6, 0, 2 * Math.PI, false);
                p.ctx.fillStyle = p.colorAlpha(color, 0.45);
                p.ctx.fill();
            }

            p.ctx.setLineDash([4, 5]);
        }

        p.ctx.restore();
    }
}
