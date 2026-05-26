"use strict";

class HDBSCANRenderer{
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

        // Le tre fasi educative: core distance, mutual reachability, MST.
        // Ognuna disegna il proprio "stato del momento" e si ferma.
        if(result.phase === "core"){
            p.drawPoints(data, p.glyphColor());
            this._drawCoreDistances(data, result.coreDistances);
            this._drawInfo(result);
            return;
        }

        if(result.phase === "mutual"){
            p.drawPoints(data, p.glyphColor());
            this._drawMST(result.reachabilityEdges || [], "rgba(71, 85, 105, 0.12)");
            this._drawInfo(result);
            return;
        }

        if(result.phase === "mst"){
            p.drawPoints(data, p.glyphColor());
            this._drawMST(result.mst, "rgba(37, 99, 235, 0.34)");
            this._drawInfo(result);
            return;
        }

        if(showBoundaries){
            this._drawBoundaries(result);
        }

        this._drawMST(result.mst, "rgba(71, 85, 105, 0.24)");

        for(let [i, cluster] of result.clusters.entries()){
            let color = cluster_color[i % cluster_color.length];
            p.drawPoints(cluster, color);
            this._drawHull(cluster, color);
        }

        p.drawCentroids(result.noise, p.glyphColor());
        this._drawInfo(result);
    }

    _drawCoreDistances(data, coreDistances){
        let p = this.p;
        for(let [i, point] of data.entries()){
            p.drawRadius(point.x, point.y, coreDistances[i], "rgba(73, 82, 96, 0.22)", 1);
        }
    }

    _drawInfo(result){
        let p = this.p;
        let text = result.phaseLabel || `HDBSCAN - threshold: ${result.threshold.toFixed(2)} - clusters: ${result.clusters.length}`;
        if(result.stability !== undefined){
            text += ` - stability: ${result.stability.toFixed(2)}`;
        }
        p.drawInfo(text);
    }

    // Se ci sono troppi edge mostriamo solo i 1200 piu' corti: dietro a quel
    // numero il MST diventa una nuvola illeggibile e il browser inizia a soffrire.
    _drawMST(edges, color){
        let p = this.p;
        let visible = edges.length > 1200
            ? edges.slice().sort((a, b) => a.weight - b.weight).slice(0, 1200)
            : edges;

        for(let edge of visible){
            p.ctx.beginPath();
            p.ctx.moveTo(edge.a.x, edge.a.y);
            p.ctx.lineTo(edge.b.x, edge.b.y);
            p.ctx.lineWidth = 1;
            p.ctx.strokeStyle = color;
            p.ctx.stroke();
        }
    }

    _drawHull(cluster, color){
        if(cluster.length === 0) return;

        let p = this.p;
        let centroid = p.centroidOf(cluster);
        let radius = Math.max(18, getMaxDist(cluster, centroid));

        p.ctx.beginPath();
        p.ctx.arc(centroid.x, centroid.y, radius, 0, 2 * Math.PI, false);
        p.ctx.fillStyle = p.colorAlpha(color, 0.07);
        p.ctx.fill();
        p.ctx.lineWidth = 1.6;
        p.ctx.strokeStyle = p.colorAlpha(color, 0.45);
        p.ctx.stroke();
    }

    // Frontiere: colora la cella se un cluster ha un punto dentro al threshold.
    // E' coerente col fatto che HDBSCAN ammette buchi/forme arbitrarie.
    _drawBoundaries(result){
        let p = this.p;
        let cellSize = 10;

        for(let y = 0; y < p.height; y += cellSize){
            for(let x = 0; x < p.width; x += cellSize){
                let probe = { x: x + cellSize / 2, y: y + cellSize / 2 };
                let pick = -1;
                let minDistance = Infinity;

                for(let [i, cluster] of result.clusters.entries()){
                    for(let cp of cluster){
                        let d = euclidianDistance(probe, cp);
                        if(d < minDistance){
                            minDistance = d;
                            pick = i;
                        }
                    }
                }

                if(pick >= 0 && minDistance <= result.threshold){
                    p.ctx.fillStyle = p.colorAlpha(cluster_color[pick % cluster_color.length], 0.11);
                    p.ctx.fillRect(x, y, cellSize, cellSize);
                }
            }
        }
    }
}
