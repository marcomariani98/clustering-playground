"use strict";

// K-Means visualization. Renders initial centroids (red crosses), final centroids (green crosses),
// dashed lines showing centroid movement, colored regions for Voronoi boundaries (if enabled),
// and thin lines connecting points to their assigned centroid.

class KMeansRenderer{
    constructor(primitives){
        this.p = primitives;
    }

    draw(data, options){
        let p = this.p;
        let { result, initCentroids, showBoundaries, showDetails } = options;

        p.reset();

        if(!result){
            p.drawPoints(data, p.glyphColor());
            p.drawCentroids(initCentroids, "#6F1615");
            return;
        }

        if(showBoundaries){
            p.drawCentroidBoundaries(result.centroids);
        }

        if(showDetails){
            this._drawAssignmentLines(result);
            this._drawCentroidTrails(initCentroids, result);
        }

        for(let [i, cluster] of result.clusters.entries()){
            p.drawPoints(cluster.points, cluster_color[i % cluster_color.length]);
        }

        p.drawCentroids(initCentroids, "#6F1615");
        p.drawCentroids(result.centroids, "#2d7a22");

        let detailText = showDetails ? " - centroid paths visible" : "";
        p.drawInfo(`K-Means - iterations: ${result.iterations || 1}${detailText}`);
    }

    _drawAssignmentLines(result){
        if(!result || !result.clusters || !result.centroids) return;

        let p = this.p;
        p.ctx.save();
        p.ctx.lineWidth = 0.8;

        for(let [i, cluster] of result.clusters.entries()){
            let centroid = result.centroids[i] || cluster.centroid;
            if(!centroid) continue;

            p.ctx.strokeStyle = p.colorAlpha(cluster_color[i % cluster_color.length], 0.16);

            for(let point of cluster.points){
                p.ctx.beginPath();
                p.ctx.moveTo(point.x, point.y);
                p.ctx.lineTo(centroid.x, centroid.y);
                p.ctx.stroke();
            }
        }

        p.ctx.restore();
    }

    // Traccia il movimento dei centroidi tra le iterazioni. Se l'algoritmo
    // espone centroidHistory la prendiamo dritta, altrimenti la ricostruiamo
    // dagli step (utile per K-Means in modalita' "Execute" senza animazione).
    _drawCentroidTrails(initialCentroids, result){
        if(!result) return;

        let p = this.p;
        let paths = [];

        if(result.centroidHistory){
            paths = result.centroidHistory.map((path) => path.map((point) => ({ x: point.x, y: point.y })));
        }else if(result.steps && result.steps.length > 0){
            paths = initialCentroids.map((c) => [{ x: c.x, y: c.y }]);

            for(let step of result.steps){
                for(let [i, centroid] of step.centroids.entries()){
                    if(!paths[i]) paths[i] = [];
                    paths[i].push({ x: centroid.x, y: centroid.y });
                }
            }
        }

        if(paths.length === 0) return;

        for(let [i, centroid] of initialCentroids.entries()){
            if(!paths[i]) paths[i] = [{ x: centroid.x, y: centroid.y }];
        }

        p.ctx.save();
        p.ctx.setLineDash([5, 5]);
        p.ctx.lineWidth = 1.5;

        for(let [i, path] of paths.entries()){
            if(path.length < 2) continue;

            let color = cluster_color[i % cluster_color.length];
            p.ctx.strokeStyle = p.colorAlpha(color, 0.60);
            p.ctx.beginPath();
            p.ctx.moveTo(path[0].x, path[0].y);

            for(let j = 1; j < path.length; j++){
                p.ctx.lineTo(path[j].x, path[j].y);
            }

            p.ctx.stroke();
            p.ctx.setLineDash([]);

            for(let j = 1; j < path.length - 1; j++){
                p.ctx.beginPath();
                p.ctx.arc(path[j].x, path[j].y, 3, 0, 2 * Math.PI, false);
                p.ctx.fillStyle = p.colorAlpha(color, 0.50);
                p.ctx.fill();
            }

            let last = path[path.length - 1];
            p.drawLabel({ x: last.x + 8, y: last.y + 6 }, `C${i + 1}`, color, "700 12px Arial");
            p.ctx.setLineDash([5, 5]);
        }

        p.ctx.restore();
    }
}
